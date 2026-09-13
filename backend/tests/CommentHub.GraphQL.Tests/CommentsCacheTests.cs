using CommentHub.GraphQL.Queries;
using CommentHub.GraphQL.Realtime;
using CommentHub.GraphQL.Types;
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace CommentHub.GraphQL.Tests;

public sealed class CommentsCacheTests
{
    private static CommentsCache CreateCache() => new(new MemoryCache(new MemoryCacheOptions()));

    private static Task<CommentPage> EmptyPage() => Task.FromResult(new CommentPage([], 0));

    [Fact]
    public async Task Does_not_recompute_the_same_query_before_invalidation()
    {
        var cache = CreateCache();
        var factoryCalls = 0;

        Task<CommentPage> Factory()
        {
            factoryCalls++;
            return EmptyPage();
        }

        await cache.GetOrCreateTopLevelAsync(CommentSortField.CreatedAt, true, 0, 25, Factory);
        await cache.GetOrCreateTopLevelAsync(CommentSortField.CreatedAt, true, 0, 25, Factory);

        Assert.Equal(1, factoryCalls);
    }

    [Fact]
    public async Task Recomputes_after_invalidation()
    {
        var cache = CreateCache();
        var factoryCalls = 0;

        Task<CommentPage> Factory()
        {
            factoryCalls++;
            return EmptyPage();
        }

        await cache.GetOrCreateTopLevelAsync(CommentSortField.CreatedAt, true, 0, 25, Factory);
        cache.InvalidateTopLevel();
        await cache.GetOrCreateTopLevelAsync(CommentSortField.CreatedAt, true, 0, 25, Factory);

        Assert.Equal(2, factoryCalls);
    }

    [Fact]
    public async Task Treats_different_sort_or_page_parameters_as_independent_entries()
    {
        var cache = CreateCache();
        var factoryCalls = 0;

        Task<CommentPage> Factory()
        {
            factoryCalls++;
            return EmptyPage();
        }

        await cache.GetOrCreateTopLevelAsync(CommentSortField.CreatedAt, true, 0, 25, Factory);
        await cache.GetOrCreateTopLevelAsync(CommentSortField.UserName, true, 0, 25, Factory);
        await cache.GetOrCreateTopLevelAsync(CommentSortField.CreatedAt, false, 0, 25, Factory);
        await cache.GetOrCreateTopLevelAsync(CommentSortField.CreatedAt, true, 25, 25, Factory);

        Assert.Equal(4, factoryCalls);
    }
}
