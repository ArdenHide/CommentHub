using CommentHub.GraphQL.Configuration;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using SkiaSharp;

namespace CommentHub.GraphQL.Services;

public sealed class CaptchaImageChallengeService(IMemoryCache cache, IOptions<CaptchaOptions> options)
    : ICaptchaChallengeService
{
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    private const int LinesCount = 20;

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
        using var bitmap = new SKBitmap(_options.ImageWidth, _options.ImageHeight);
        using var canvas = new SKCanvas(bitmap);
        canvas.Clear(SKColors.White);

        using var noisePaint = new SKPaint { Color = new SKColor(190, 190, 190), StrokeWidth = 2 };
        for (var i = 0; i < LinesCount; i++)
        {
            canvas.DrawLine(
                Random.Shared.Next(_options.ImageWidth),
                Random.Shared.Next(_options.ImageHeight),
                Random.Shared.Next(_options.ImageWidth),
                Random.Shared.Next(_options.ImageHeight),
                noisePaint
            );
        }

        using var typeface = SKTypeface.FromFamilyName("Arial", SKFontStyle.Bold) ?? SKTypeface.Default;
        using var font = new SKFont(typeface, _options.ImageHeight * 0.5f);
        using var textPaint = new SKPaint { Color = SKColors.Black, IsAntialias = true };

        var slotWidth = _options.ImageWidth / (float)code.Length;
        for (var i = 0; i < code.Length; i++)
        {
            canvas.Save();
            canvas.Translate(slotWidth * i + slotWidth / 2, _options.ImageHeight / 2f + font.Size / 3);
            canvas.RotateDegrees(Random.Shared.Next(-25, 26));
            canvas.DrawText(code[i].ToString(), 0, 0, SKTextAlign.Center, font, textPaint);
            canvas.Restore();
        }

        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Png, 100);
        return data.ToArray();
    }

    private static string CacheKey(string captchaId) => $"captcha:{captchaId}";
}
