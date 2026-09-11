using CommentHub.GraphQL.Configuration;
using CommentHub.GraphQL.Services;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Xunit;

namespace CommentHub.GraphQL.Tests;

public sealed class CaptchaImageChallengeServiceTests
{
    private static CaptchaImageChallengeService CreateService(CaptchaOptions? options = null)
        => new(new MemoryCache(new MemoryCacheOptions()), Options.Create(options ?? new CaptchaOptions()));

    [Fact]
    public void Generate_produces_a_non_empty_png_image_and_a_code_of_the_configured_length()
    {
        var service = CreateService(new CaptchaOptions { CodeLength = 7 });

        var challenge = service.Generate(Guid.NewGuid().ToString());

        Assert.Equal(7, challenge.Code.Length);
        Assert.True(challenge.ImageBytes.Length > 0);
        Assert.Equal(0x89, challenge.ImageBytes[0]);
        Assert.Equal((byte)'P', challenge.ImageBytes[1]);
        Assert.Equal((byte)'N', challenge.ImageBytes[2]);
        Assert.Equal((byte)'G', challenge.ImageBytes[3]);
    }

    [Fact]
    public void Generate_only_uses_digits_and_latin_letters()
    {
        var service = CreateService();

        var challenge = service.Generate(Guid.NewGuid().ToString());

        Assert.Matches("^[A-Za-z0-9]+$", challenge.Code);
    }

    [Fact]
    public void Validate_accepts_the_correct_code_case_insensitively()
    {
        var service = CreateService();
        var id = Guid.NewGuid().ToString();
        var challenge = service.Generate(id);

        Assert.True(service.Validate(id, challenge.Code.ToUpperInvariant()));
    }

    [Fact]
    public void Validate_rejects_an_incorrect_code()
    {
        var service = CreateService();
        var id = Guid.NewGuid().ToString();
        service.Generate(id);

        Assert.False(service.Validate(id, "wrong"));
    }

    [Fact]
    public void Validate_rejects_an_unknown_captcha_id()
    {
        var service = CreateService();

        Assert.False(service.Validate(Guid.NewGuid().ToString(), "anything"));
    }

    [Fact]
    public void Validate_can_only_be_used_once_per_generated_challenge()
    {
        var service = CreateService();
        var id = Guid.NewGuid().ToString();
        var challenge = service.Generate(id);

        Assert.True(service.Validate(id, challenge.Code));
        Assert.False(service.Validate(id, challenge.Code));
    }
}
