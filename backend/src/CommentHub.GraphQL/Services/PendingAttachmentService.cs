using CommentHub.GraphQL.Configuration;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace CommentHub.GraphQL.Services;

public sealed class PendingAttachmentService(
    IMemoryCache cache,
    IAttachmentStorageService storage,
    IOptions<AttachmentOptions> options
) : IPendingAttachmentService
{
    private readonly AttachmentOptions _options = options.Value;

    public PendingAttachment Put(PendingAttachment attachment)
    {
        cache.Set(
            CacheKey(attachment.Token),
            attachment,
            new MemoryCacheEntryOptions()
                .SetAbsoluteExpiration(TimeSpan.FromMinutes(_options.PendingExpirationMinutes))
                .RegisterPostEvictionCallback(OnEvicted)
        );

        return attachment;
    }

    public PendingAttachment? Get(string token)
        => cache.TryGetValue(CacheKey(token), out PendingAttachment? attachment) ? attachment : null;

    public PendingAttachment? Consume(string token)
    {
        var key = CacheKey(token);
        if (!cache.TryGetValue(key, out PendingAttachment? attachment))
        {
            return null;
        }

        attachment!.Consumed = true;
        cache.Remove(key);
        return attachment;
    }

    public void Cancel(string token)
    {
        // Deletes synchronously rather than relying on the eviction callback, which the cache
        // may run on a background thread — a caller acting on an explicit cancellation expects
        // the file gone by the time this call returns. Deleting it again from the eviction
        // callback afterwards is harmless: a delete of an already-missing file is a no-op.
        var key = CacheKey(token);
        if (cache.TryGetValue(key, out PendingAttachment? attachment) && attachment is not null)
        {
            storage.TryDelete(attachment.StoragePath);
        }

        cache.Remove(key);
    }

    private void OnEvicted(object key, object? value, EvictionReason reason, object? state)
    {
        if (value is PendingAttachment { Consumed: false } attachment)
        {
            storage.TryDelete(attachment.StoragePath);
        }
    }

    private static string CacheKey(string token) => $"attachment:{token}";
}
