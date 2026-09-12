using Microsoft.AspNetCore.Http;

namespace CommentHub.GraphQL.Services;

public sealed record AttachmentProcessingResult(bool Success, PendingAttachment? Attachment, string? ErrorCode, string? ErrorMessage)
{
    public static AttachmentProcessingResult Ok(PendingAttachment attachment) => new(true, attachment, null, null);

    public static AttachmentProcessingResult Fail(string code, string message) => new(false, null, code, message);
}

public interface IAttachmentProcessingService
{
    Task<AttachmentProcessingResult> ProcessAsync(IFormFile file, CancellationToken cancellationToken);
}
