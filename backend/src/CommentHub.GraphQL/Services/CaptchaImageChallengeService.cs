using CommentHub.GraphQL.Configuration;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using SixLabors.Fonts;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Drawing.Processing;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace CommentHub.GraphQL.Services;

public sealed class CaptchaImageChallengeService(IMemoryCache cache, IOptions<CaptchaOptions> options)
    : ICaptchaChallengeService
{
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    private const int LinesCount = 20;
    private const string FontResourceName = "CommentHub.GraphQL.Resources.Fonts.LiberationSans-Bold.ttf";

    private static readonly FontFamily FontFamily = LoadFontFamily();
    private static readonly Color NoiseColor = Color.FromRgb(190, 190, 190);

    private readonly CaptchaOptions _options = options.Value;

    public CaptchaChallenge Generate(string captchaId)
    {
        var code = GenerateCode();
        cache.Set(CacheKey(captchaId), code, TimeSpan.FromMinutes(_options.ExpirationMinutes));
        return new CaptchaChallenge(RenderImage(code), code);
    }

    public bool Validate(string captchaId, string userInput)
    {
        var key = CacheKey(captchaId);
        if (!cache.TryGetValue(key, out string? expectedCode))
        {
            return false;
        }

        cache.Remove(key);
        return string.Equals(expectedCode, userInput.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    private string GenerateCode()
    {
        var chars = new char[_options.CodeLength];
        for (var i = 0; i < chars.Length; i++)
        {
            chars[i] = Alphabet[Random.Shared.Next(Alphabet.Length)];
        }

        return new string(chars);
    }

    private byte[] RenderImage(string code)
    {
        var font = FontFamily.CreateFont(_options.ImageHeight * 0.5f, FontStyle.Bold);
        var slotWidth = _options.ImageWidth / (float)code.Length;

        using var image = new Image<Rgba32>(_options.ImageWidth, _options.ImageHeight);
        image.Mutate(ctx =>
        {
            ctx.Fill(Color.White);

            for (var i = 0; i < LinesCount; i++)
            {
                ctx.DrawLine(
                    NoiseColor,
                    2,
                    new PointF(Random.Shared.Next(_options.ImageWidth), Random.Shared.Next(_options.ImageHeight)),
                    new PointF(Random.Shared.Next(_options.ImageWidth), Random.Shared.Next(_options.ImageHeight))
                );
            }

            for (var i = 0; i < code.Length; i++)
            {
                var pivot = new PointF(slotWidth * i + slotWidth / 2, _options.ImageHeight / 2f);
                var drawingOptions = new DrawingOptions
                {
                    Transform = Matrix3x2Extensions.CreateRotationDegrees(Random.Shared.Next(-25, 26), pivot),
                };
                var textOptions = new RichTextOptions(font)
                {
                    Origin = pivot,
                    HorizontalAlignment = HorizontalAlignment.Center,
                    VerticalAlignment = VerticalAlignment.Center,
                };

                ctx.DrawText(drawingOptions, textOptions, code[i].ToString(), Brushes.Solid(Color.Black), null);
            }
        });

        using var stream = new MemoryStream();
        image.SaveAsPng(stream);
        return stream.ToArray();
    }

    private static FontFamily LoadFontFamily()
    {
        using var stream = typeof(CaptchaImageChallengeService).Assembly.GetManifestResourceStream(FontResourceName)
            ?? throw new InvalidOperationException($"Embedded CAPTCHA font resource '{FontResourceName}' not found.");

        return new FontCollection().Add(stream);
    }

    private static string CacheKey(string captchaId) => $"captcha:{captchaId}";
}
