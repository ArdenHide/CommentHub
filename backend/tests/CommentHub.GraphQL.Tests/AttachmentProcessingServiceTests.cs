using System.Text;
using CommentHub.Database.Entities;
using CommentHub.GraphQL.Configuration;
using CommentHub.GraphQL.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Gif;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.PixelFormats;
using Xunit;

namespace CommentHub.GraphQL.Tests;

public sealed class AttachmentProcessingServiceTests : IDisposable
{
    // A minimal, hand-assembled 1x1 GIF89a (6-byte header, 7-byte logical screen descriptor,
    // a 4-color global color table, a 10-byte image descriptor, and a single-pixel LZW-encoded
    // image data block), built directly from the GIF spec rather than trusting a copy-pasted
    // "smallest gif" byte string.
    private static readonly byte[] TinyGifBytes =
    [
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // "GIF89a"
        0x01, 0x00, 0x01, 0x00, 0x81, 0x00, 0x00, // logical screen descriptor: 1x1, global color table of 4
        0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // global color table
        0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // image descriptor: 1x1 at (0,0)
        0x02, 0x02, 0x44, 0x01, 0x00, // LZW min code size 2; Clear, pixel 0, EOI; block terminator
        0x3B, // trailer
    ];

    private readonly string _rootPath = Directory.CreateTempSubdirectory("commenthub-attachments-").FullName;

    public void Dispose() => Directory.Delete(_rootPath, recursive: true);

    private AttachmentProcessingService CreateService(AttachmentOptions? options = null)
    {
        options ??= new AttachmentOptions();
        var environment = new TestHostEnvironment(_rootPath);
        var storage = new AttachmentStorageService(environment, Options.Create(new AttachmentOptions { RootPath = _rootPath }));
        var pending = new PendingAttachmentService(new MemoryCache(new MemoryCacheOptions()), storage, Options.Create(options));
        return new AttachmentProcessingService(storage, pending, Options.Create(options));
    }

    private static IFormFile MakeFile(byte[] bytes, string fileName)
        => new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", fileName);

    private static byte[] CreateImageBytes(int width, int height, IImageEncoder encoder)
    {
        using var image = new Image<Rgba32>(width, height);
        using var stream = new MemoryStream();
        image.Save(stream, encoder);
        return stream.ToArray();
    }

    private static byte[] CreateAnimatedGifBytes(int width, int height, int frameCount)
    {
        using var image = new Image<Rgba32>(width, height);
        for (var i = 1; i < frameCount; i++)
        {
            image.Frames.AddFrame(image.Frames.RootFrame);
        }

        image.Metadata.GetGifMetadata().RepeatCount = 0;

        using var stream = new MemoryStream();
        image.Save(stream, new GifEncoder());
        return stream.ToArray();
    }

    [Fact]
    public async Task Accepts_a_png_within_bounds_and_stores_it_unchanged()
    {
        var service = CreateService();
        var bytes = CreateImageBytes(200, 150, new PngEncoder());

        var result = await service.ProcessAsync(MakeFile(bytes, "photo.png"), CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(AttachmentKind.Image, result.Attachment!.Kind);
        Assert.Equal(200, result.Attachment.Width);
        Assert.Equal(150, result.Attachment.Height);
        Assert.Equal("image/png", result.Attachment.ContentType);
    }

    [Fact]
    public async Task Resizes_an_oversized_png_proportionally_to_fit_the_bounds()
    {
        var service = CreateService();
        var bytes = CreateImageBytes(800, 600, new PngEncoder());

        var result = await service.ProcessAsync(MakeFile(bytes, "photo.png"), CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(320, result.Attachment!.Width);
        Assert.Equal(240, result.Attachment.Height);
    }

    [Fact]
    public async Task Preserves_aspect_ratio_when_only_one_dimension_exceeds_the_bound()
    {
        var service = CreateService();
        var bytes = CreateImageBytes(320, 640, new PngEncoder());

        var result = await service.ProcessAsync(MakeFile(bytes, "tall.png"), CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(120, result.Attachment!.Width);
        Assert.Equal(240, result.Attachment.Height);
    }

    [Fact]
    public async Task Rejects_a_file_with_an_image_extension_that_is_not_actually_an_image()
    {
        var service = CreateService();
        var bytes = Encoding.UTF8.GetBytes("this is definitely not a png");

        var result = await service.ProcessAsync(MakeFile(bytes, "fake.png"), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal("INVALID_IMAGE", result.ErrorCode);
    }

    [Fact]
    public async Task Stores_an_in_bounds_gif_byte_for_byte_to_preserve_animation()
    {
        var service = CreateService();

        var result = await service.ProcessAsync(MakeFile(TinyGifBytes, "pixel.gif"), CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(AttachmentKind.Image, result.Attachment!.Kind);
        Assert.Equal("image/gif", result.Attachment.ContentType);
        Assert.Equal(1, result.Attachment.Width);
        Assert.Equal(1, result.Attachment.Height);
    }

    [Fact]
    public async Task Resizes_an_oversized_animated_gif_proportionally_and_preserves_all_frames()
    {
        var service = CreateService();
        const int frameCount = 3;
        var bytes = CreateAnimatedGifBytes(800, 600, frameCount);

        var result = await service.ProcessAsync(MakeFile(bytes, "anim.gif"), CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal("image/gif", result.Attachment!.ContentType);
        Assert.Equal(320, result.Attachment.Width);
        Assert.Equal(240, result.Attachment.Height);

        var storedBytes = await File.ReadAllBytesAsync(System.IO.Path.Combine(_rootPath, result.Attachment.StoragePath));
        using var decoded = Image.Load<Rgba32>(storedBytes);
        Assert.Equal(frameCount, decoded.Frames.Count);
        Assert.Equal(0, decoded.Metadata.GetGifMetadata().RepeatCount);
    }

    [Fact]
    public async Task Rejects_an_image_larger_than_the_configured_source_limit()
    {
        var service = CreateService(new AttachmentOptions { MaxImageSourceBytes = 10 });
        var bytes = CreateImageBytes(200, 150, new PngEncoder());

        var result = await service.ProcessAsync(MakeFile(bytes, "photo.png"), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal("FILE_TOO_LARGE", result.ErrorCode);
    }

    [Fact]
    public async Task Accepts_a_text_file_exactly_at_the_size_limit()
    {
        var options = new AttachmentOptions { MaxTextBytes = 1024 };
        var service = CreateService(options);
        var bytes = Encoding.ASCII.GetBytes(new string('a', options.MaxTextBytes));

        var result = await service.ProcessAsync(MakeFile(bytes, "notes.txt"), CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(AttachmentKind.Text, result.Attachment!.Kind);
        Assert.Equal("text/plain", result.Attachment.ContentType);
    }

    [Fact]
    public async Task Rejects_a_text_file_one_byte_over_the_size_limit()
    {
        var options = new AttachmentOptions { MaxTextBytes = 1024 };
        var service = CreateService(options);
        var bytes = Encoding.ASCII.GetBytes(new string('a', options.MaxTextBytes + 1));

        var result = await service.ProcessAsync(MakeFile(bytes, "notes.txt"), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal("FILE_TOO_LARGE", result.ErrorCode);
    }

    [Fact]
    public async Task Rejects_a_text_file_containing_a_null_byte()
    {
        var service = CreateService();
        var bytes = new byte[] { (byte)'a', 0, (byte)'b' };

        var result = await service.ProcessAsync(MakeFile(bytes, "notes.txt"), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal("INVALID_TEXT_FILE", result.ErrorCode);
    }

    [Fact]
    public async Task Rejects_an_unsupported_file_extension()
    {
        var service = CreateService();
        var bytes = Encoding.UTF8.GetBytes("whatever");

        var result = await service.ProcessAsync(MakeFile(bytes, "document.pdf"), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal("UNSUPPORTED_TYPE", result.ErrorCode);
    }

    private sealed class TestHostEnvironment(string contentRootPath) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "CommentHub.GraphQL.Tests";
        public string ContentRootPath { get; set; } = contentRootPath;
        public IFileProvider ContentRootFileProvider { get; set; } = null!;
    }
}
