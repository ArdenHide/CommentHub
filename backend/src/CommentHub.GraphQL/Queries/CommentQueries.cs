using CommentHub.Database;
using CommentHub.Database.Entities;
using CommentHub.GraphQL.Types;
using Microsoft.EntityFrameworkCore;

namespace CommentHub.GraphQL.Queries;

[QueryType]
public static partial class CommentQueries
{
    public static async Task<CommentPage> GetCommentsAsync(
        CommentHubDbContext dbContext,
        CancellationToken cancellationToken,
        int skip = 0,
        int take = 25,
        CommentSortField sortBy = CommentSortField.CreatedAt,
        bool descending = true
    )
    {
        var query = dbContext.Comments
            .Where(comment => comment.ParentId == null)
            .Include(comment => comment.User)
            .Include(comment => comment.Attachments);

        var ordered = ApplySort(query, sortBy, descending);

        var totalCount = await ordered.CountAsync(cancellationToken);
        var items = await ordered.Skip(skip).Take(take).ToListAsync(cancellationToken);

        return new CommentPage(items, totalCount);
    }

    private static IOrderedQueryable<Comment> ApplySort(
        IQueryable<Comment> query,
        CommentSortField sortBy,
        bool descending
    )
    {
        IOrderedQueryable<Comment> ordered = sortBy switch
        {
            CommentSortField.UserName => descending
                ? query.OrderByDescending(comment => comment.User.UserName)
                : query.OrderBy(comment => comment.User.UserName),
            CommentSortField.Email => descending
                ? query.OrderByDescending(comment => comment.User.Email)
                : query.OrderBy(comment => comment.User.Email),
            _ => descending
                ? query.OrderByDescending(comment => comment.CreatedAt)
                : query.OrderBy(comment => comment.CreatedAt),
        };

        return descending
            ? ordered.ThenByDescending(comment => comment.Id)
            : ordered.ThenBy(comment => comment.Id);
    }

    public static async Task<Comment?> GetCommentAsync(
        long id,
        CommentHubDbContext dbContext,
        CancellationToken cancellationToken
    )
        => await dbContext.Comments
            .Include(comment => comment.User)
            .Include(comment => comment.Attachments)
            .FirstOrDefaultAsync(comment => comment.Id == id, cancellationToken);
}
