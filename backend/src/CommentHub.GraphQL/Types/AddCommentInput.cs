namespace CommentHub.GraphQL.Types;

public sealed record AddCommentInput(
    string UserName,
    string Email,
    string? HomePage,
    string Text,
    long? ParentId,
    string CaptchaId,
    string CaptchaCode
);
