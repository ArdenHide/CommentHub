using CommentHub.Database.Entities;

namespace CommentHub.GraphQL.Services;

public sealed class PendingAttachment
{
    public required string Token { get; init; }

    public required AttachmentKind Kind { get; init; }

    public required string StoragePath { get; init; }

    public required string OriginalName { get; init; }

    public required string ContentType { get; init; }

    public required int SizeBytes { get; init; }

    public int? Width { get; init; }

    public int? Height { get; init; }

    /// <summary>
    /// Set by <see cref="IPendingAttachmentService.Consume"/> right before the entry is removed
    /// from the cache, so the eviction callback that deletes the file from disk can tell an
    /// attachment that became part of a saved comment apart from one that simply expired.
    /// </summary>
    public volatile bool Consumed;
}

public interface IPendingAttachmentService
{
    PendingAttachment Put(PendingAttachment attachment);

    PendingAttachment? Get(string token);

    /// <summary>Marks the attachment as used and removes it from the cache without deleting the file.</summary>
    PendingAttachment? Consume(string token);

    /// <summary>Removes the attachment from the cache; the file is deleted by the eviction callback.</summary>
    void Cancel(string token);
}
