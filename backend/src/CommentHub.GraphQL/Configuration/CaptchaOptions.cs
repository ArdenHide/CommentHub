namespace CommentHub.GraphQL.Configuration;

public sealed class CaptchaOptions
{
    public const string SectionName = "Captcha";

    public int CodeLength { get; set; } = 6;

    public int ImageWidth { get; set; } = 160;

    public int ImageHeight { get; set; } = 60;

    public int ExpirationMinutes { get; set; } = 5;
}
