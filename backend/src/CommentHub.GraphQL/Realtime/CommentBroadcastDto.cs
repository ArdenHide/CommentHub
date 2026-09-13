using CommentHub.Database.Entities;
using CommentHub.GraphQL.Types;

namespace CommentHub.GraphQL.Realtime;

/// <summary>
/// Mirrors the shape GraphQL clients already know from <c>Comment</c>/<c>User</c>/<c>Attachment</c>,
/// sent whole over the wire so a client never has to refetch just to render a live update.
/// </summary>
public sealed record CommentBroadcastDto(
    long Id,
    long? ParentId,
    long RootId,
    string TextHtml,
    DateTimeOffset CreatedAt,
    CommentUserDto User,
    CommentAttachmentDto? Attachment
)
{
    public static CommentBroadcastDto From(Comment comment) => new(
        comment.Id,
        comment.ParentId,
        comment.RootId ?? comment.Id,
        comment.TextHtml,
        comment.CreatedAt,
        CommentUserDto.From(comment.User),
        comment.Attachments.FirstOrDefault() is { } attachment ? CommentAttachmentDto.From(attachment) : null
    );
}

public sealed record CommentUserDto(string UserName, string? HomePage, string AvatarSeed, string MaskedEmail)
{
    public static CommentUserDto From(User user) => new(
        user.UserName,
        user.HomePage,
        AvatarSeedCalculator.Compute(user.Email),
        EmailMasker.Mask(user.Email)
    );
}

public sealed record CommentAttachmentDto(
    long Id,
    AttachmentKind Kind,
    string OriginalName,
    string ContentType,
    int SizeBytes,
    int? Width,
    int? Height
)
{
    public static CommentAttachmentDto From(Attachment attachment) => new(
        attachment.Id,
        attachment.Kind,
        attachment.OriginalName,
        attachment.ContentType,
        attachment.SizeBytes,
        attachment.Width,
        attachment.Height
    );
}
