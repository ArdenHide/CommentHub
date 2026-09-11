using CommentHub.Database.Entities;

namespace CommentHub.GraphQL.Types;

public sealed record AddCommentPayload(Comment? Comment, IReadOnlyList<UserError> Errors);
