using CommentHub.Database;
using CommentHub.Database.Entities;
using Microsoft.EntityFrameworkCore;

namespace CommentHub.GraphQL.DataLoaders;

public static class CommentDataLoaders
{
    [DataLoader]
    public static async Task<Dictionary<long, List<Comment>>> GetRepliesByParentIdAsync(
        IReadOnlyList<long> parentIds,
        CommentHubDbContext dbContext,
        CancellationToken cancellationToken
    )
    {
        var replies = await dbContext.Comments
            .Where(comment => comment.ParentId.HasValue && parentIds.Contains(comment.ParentId.Value))
            .Include(comment => comment.User)
            .Include(comment => comment.Attachments)
            .OrderBy(comment => comment.CreatedAt)
            .ThenBy(comment => comment.Id)
            .ToListAsync(cancellationToken);

        return replies
            .GroupBy(comment => comment.ParentId!.Value)
            .ToDictionary(group => group.Key, group => group.ToList());
    }
}
