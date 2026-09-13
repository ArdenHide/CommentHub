using CommentHub.GraphQL.Queries;
using CommentHub.GraphQL.Types;

namespace CommentHub.GraphQL.Realtime;

public interface ICommentsCache
{
    Task<CommentPage> GetOrCreateTopLevelAsync(
        CommentSortField sortBy,
        bool descending,
        int skip,
        int take,
        Func<Task<CommentPage>> factory
    );

    void InvalidateTopLevel();
}
