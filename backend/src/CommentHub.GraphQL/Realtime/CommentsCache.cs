using CommentHub.GraphQL.Queries;
using CommentHub.GraphQL.Types;
using Microsoft.Extensions.Caching.Memory;

namespace CommentHub.GraphQL.Realtime;

public sealed class CommentsCache(IMemoryCache cache) : ICommentsCache
{
    private static readonly TimeSpan EntryLifetime = TimeSpan.FromMinutes(5);

    private int _generation;

    public Task<CommentPage> GetOrCreateTopLevelAsync(
        CommentSortField sortBy,
        bool descending,
        int skip,
        int take,
        Func<Task<CommentPage>> factory
    )
    {
        var key = BuildKey(sortBy, descending, skip, take);
        return cache.GetOrCreateAsync(key, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = EntryLifetime;
            return factory();
        })!;
    }

    public void InvalidateTopLevel() => Interlocked.Increment(ref _generation);

    private string BuildKey(CommentSortField sortBy, bool descending, int skip, int take)
        => $"comments:list:v{Volatile.Read(ref _generation)}:{sortBy}:{descending}:{skip}:{take}";
}
