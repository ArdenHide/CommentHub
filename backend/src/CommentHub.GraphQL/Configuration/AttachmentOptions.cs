namespace CommentHub.GraphQL.Configuration;

public sealed class AttachmentOptions
{
    public const string SectionName = "Attachments";

    public string RootPath { get; set; } = "App_Data/attachments";

    public int MaxImageSourceBytes { get; set; } = 8 * 1024 * 1024;

    public int MaxImageWidth { get; set; } = 320;

    public int MaxImageHeight { get; set; } = 240;

    public int MaxTextBytes { get; set; } = 100 * 1024;

    public int PendingExpirationMinutes { get; set; } = 15;
}
