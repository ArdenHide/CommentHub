namespace CommentHub.GraphQL.Types;

public sealed record UserError(string Field, string Code, string Message);
