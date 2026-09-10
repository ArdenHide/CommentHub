using CommentHub.Database.Entities;

namespace CommentHub.GraphQL.Types;

public sealed record CommentPage(IReadOnlyList<Comment> Items, int TotalCount);
