namespace CommentHub.Database.Entities;

/// <summary>
/// Metadata of a file attached to a comment. The bytes themselves live on disk at
/// <see cref="StoragePath"/> — the database only holds the description.
/// </summary>
public class Attachment
{
    public long Id { get; set; }

    public long CommentId { get; set; }

    public Comment Comment { get; set; } = null!;

    public AttachmentKind Kind { get; set; }

    /// <summary>Relative path within the file storage, unique.</summary>
    public required string StoragePath { get; set; }

    /// <summary>File name the user uploaded the file under.</summary>
    public required string OriginalName { get; set; }

    public required string ContentType { get; set; }

    public int SizeBytes { get; set; }

    /// <summary>Set only for <see cref="AttachmentKind.Image"/>.</summary>
    public int? Width { get; set; }

    /// <summary>Set only for <see cref="AttachmentKind.Image"/>.</summary>
    public int? Height { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
