namespace CommentHub.GraphQL.Services;

public sealed record CaptchaChallenge(byte[] ImageBytes, string Code);

public interface ICaptchaChallengeService
{
    CaptchaChallenge Generate(string captchaId);

    bool Validate(string captchaId, string userInput);
}
