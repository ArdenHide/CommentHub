using CommentHub.GraphQL.Queries;
using CommentHub.GraphQL.Types;
using Microsoft.Extensions.Caching.Memory;

namespace CommentHub.GraphQL.Realtime;

/// <summary>
/// Caches the top-level comments list. Replies are never cached — <see cref="Types.CommentType.GetRepliesAsync"/>
/// always reads through a DataLoader straight from the database, so they can't go stale.
///
/// Invalidation is a generation counter rather than per-key removal: <see cref="IMemoryCache"/> is a
/// singleton shared with unrelated caches (CAPTCHA codes, pending attachments), so clearing it outright
/// would wipe those too, and enumerating/removing every sort/page combination isn't possible with
/// <see cref="IMemoryCache"/>. Bumping the generation just makes every previously cached key unreachable;
/// a short absolute expiration is kept as a backstop so orphaned entries still get collected.
/// </summary>
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
