using CommentHub.Database;
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
        int take = 25
    )
    {
        var query = dbContext.Comments
            .Where(comment => comment.ParentId == null)
            .Include(comment => comment.User)
            .OrderByDescending(comment => comment.CreatedAt)
            .ThenByDescending(comment => comment.Id);

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query.Skip(skip).Take(take).ToListAsync(cancellationToken);

        return new CommentPage(items, totalCount);
    }
}
