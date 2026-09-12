using System.Text;
using CommentHub.Database.Entities;
using CommentHub.GraphQL.Configuration;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using SkiaSharp;

namespace CommentHub.GraphQL.Services;

/// <summary>
/// The only place raw bytes from an HTTP upload are handled: validates the file against the
/// spec (allowed formats, size limits) by decoding it — never by trusting the client-supplied
/// extension or <c>Content-Type</c> — resizes oversized images down to the configured bounds,
/// and hands the result to <see cref="IAttachmentStorageService"/>/<see cref="IPendingAttachmentService"/>.
/// </summary>
public sealed class AttachmentProcessingService(
    IAttachmentStorageService storage,
    IPendingAttachmentService pendingAttachments,
    IOptions<AttachmentOptions> options
) : IAttachmentProcessingService
{
    private readonly AttachmentOptions _options = options.Value;

    public async Task<AttachmentProcessingResult> ProcessAsync(IFormFile file, CancellationToken cancellationToken)
    {
        var extension = System.IO.Path.GetExtension(file.FileName).ToLowerInvariant();
        AttachmentKind? kind = extension switch
        {
            ".jpg" or ".jpeg" or ".png" or ".gif" => AttachmentKind.Image,
            ".txt" => AttachmentKind.Text,
            _ => null,
        };

        if (kind is null)
        {
            return AttachmentProcessingResult.Fail("UNSUPPORTED_TYPE", "Only JPG, GIF, PNG images or TXT files are allowed.");
        }

        if (file.Length <= 0)
        {
            return AttachmentProcessingResult.Fail("EMPTY_FILE", "The file is empty.");
        }

        var maxSourceBytes = kind == AttachmentKind.Image ? _options.MaxImageSourceBytes : _options.MaxTextBytes;
        if (file.Length > maxSourceBytes)
        {
            return AttachmentProcessingResult.Fail("FILE_TOO_LARGE", $"The file must be at most {maxSourceBytes / 1024} KB.");
        }

        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, cancellationToken);
        var bytes = buffer.ToArray();

        return kind == AttachmentKind.Image
            ? await ProcessImageAsync(bytes, file.FileName, cancellationToken)
            : await ProcessTextAsync(bytes, file.FileName, cancellationToken);
    }

    private async Task<AttachmentProcessingResult> ProcessImageAsync(byte[] bytes, string originalName, CancellationToken cancellationToken)
    {
        using var codec = SKCodec.Create(new MemoryStream(bytes));
        if (codec is null)
        {
            return AttachmentProcessingResult.Fail("INVALID_IMAGE", "The file is not a valid image.");
        }

        (string ContentType, string Extension)? format = codec.EncodedFormat switch
        {
            SKEncodedImageFormat.Jpeg => ("image/jpeg", ".jpg"),
            SKEncodedImageFormat.Png => ("image/png", ".png"),
            SKEncodedImageFormat.Gif => ("image/gif", ".gif"),
            _ => null,
        };

        if (format is null)
        {
            return AttachmentProcessingResult.Fail("INVALID_IMAGE", "Only JPG, GIF and PNG images are allowed.");
        }

        var (contentType, extension) = format.Value;
        var width = codec.Info.Width;
        var height = codec.Info.Height;
        var withinBounds = width <= _options.MaxImageWidth && height <= _options.MaxImageHeight;

        if (codec.EncodedFormat == SKEncodedImageFormat.Gif)
        {
            if (!withinBounds)
            {
                return AttachmentProcessingResult.Fail(
                    "IMAGE_TOO_LARGE_GIF",
                    $"GIF images larger than {_options.MaxImageWidth}x{_options.MaxImageHeight} are not supported. Please resize it before uploading."
                );
            }

            // Kept byte-for-byte: SkiaSharp can decode GIF but not re-encode it, so an in-bounds
            // GIF is stored as uploaded to preserve its animation.
            return await SaveAsync(bytes, AttachmentKind.Image, contentType, extension, width, height, originalName, cancellationToken);
        }

        if (withinBounds)
        {
            return await SaveAsync(bytes, AttachmentKind.Image, contentType, extension, width, height, originalName, cancellationToken);
        }

        using var original = SKBitmap.Decode(bytes);
        if (original is null)
        {
            return AttachmentProcessingResult.Fail("INVALID_IMAGE", "The file is not a valid image.");
        }

        var scale = Math.Min((double)_options.MaxImageWidth / width, (double)_options.MaxImageHeight / height);
        var newWidth = Math.Max(1, (int)Math.Round(width * scale));
        var newHeight = Math.Max(1, (int)Math.Round(height * scale));

        using var resizedBitmap = new SKBitmap(newWidth, newHeight);
        using (var canvas = new SKCanvas(resizedBitmap))
        {
            canvas.DrawBitmap(original, new SKRect(0, 0, newWidth, newHeight), new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.None));
        }

        using var image = SKImage.FromBitmap(resizedBitmap);
        using var data = image.Encode(codec.EncodedFormat, 90);
        var resizedBytes = data.ToArray();

        return await SaveAsync(resizedBytes, AttachmentKind.Image, contentType, extension, newWidth, newHeight, originalName, cancellationToken);
    }

    private async Task<AttachmentProcessingResult> ProcessTextAsync(byte[] bytes, string originalName, CancellationToken cancellationToken)
    {
        if (Array.IndexOf(bytes, (byte)0) >= 0)
        {
            return AttachmentProcessingResult.Fail("INVALID_TEXT_FILE", "The file does not look like a plain text file.");
        }

        var strictUtf8 = Encoding.GetEncoding("utf-8", EncoderFallback.ExceptionFallback, DecoderFallback.ExceptionFallback);
        try
        {
            strictUtf8.GetString(bytes);
        }
        catch (DecoderFallbackException)
        {
            return AttachmentProcessingResult.Fail("INVALID_TEXT_FILE", "The file must be valid UTF-8 text.");
        }

        return await SaveAsync(bytes, AttachmentKind.Text, "text/plain", ".txt", null, null, originalName, cancellationToken);
    }

    private async Task<AttachmentProcessingResult> SaveAsync(
        byte[] bytes,
        AttachmentKind kind,
        string contentType,
        string extension,
        int? width,
        int? height,
        string originalName,
        CancellationToken cancellationToken
    )
    {
        var storagePath = storage.GenerateStoragePath(extension);
        await storage.SaveAsync(storagePath, bytes, cancellationToken);

        var attachment = pendingAttachments.Put(new PendingAttachment
        {
            Token = Guid.NewGuid().ToString("N"),
            Kind = kind,
            StoragePath = storagePath,
            OriginalName = SanitizeOriginalName(originalName),
            ContentType = contentType,
            SizeBytes = bytes.Length,
            Width = width,
            Height = height,
        });

        return AttachmentProcessingResult.Ok(attachment);
    }

    private static string SanitizeOriginalName(string originalName)
    {
        var name = new string(System.IO.Path.GetFileName(originalName).Where(c => !char.IsControl(c)).ToArray());
        if (name.Length == 0)
        {
            return "file";
        }

        return name.Length > 255 ? name[..255] : name;
    }
}
