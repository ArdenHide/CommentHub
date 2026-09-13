using System.Threading.Channels;
using CommentHub.Database;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CommentHub.GraphQL.Realtime;

/// <summary>
/// Drains <see cref="CommentAddedEvent"/>s off the channel: invalidates the top-level comments
/// cache and pushes the new comment to every connected client over SignalR. Runs for the whole
/// lifetime of the host; a failure processing one event is logged and never stops the loop.
/// </summary>
public sealed class CommentEventWorker(
    ChannelReader<CommentAddedEvent> reader,
    IDbContextFactory<CommentHubDbContext> dbContextFactory,
    ICommentsCache cache,
    IHubContext<CommentsHub, ICommentsClient> hub,
    ILogger<CommentEventWorker> logger
) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var commentAdded in reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await ProcessAsync(commentAdded, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Failed to process {Event}.", commentAdded);
            }
        }
    }

    private async Task ProcessAsync(CommentAddedEvent commentAdded, CancellationToken cancellationToken)
    {
        if (commentAdded.ParentId is null)
        {
            cache.InvalidateTopLevel();
        }

        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);
        var comment = await dbContext.Comments
            .AsNoTracking()
            .Include(c => c.User)
            .Include(c => c.Attachments)
            .FirstOrDefaultAsync(c => c.Id == commentAdded.CommentId, cancellationToken);

        if (comment is null)
        {
            return;
        }

        await hub.Clients.All.CommentAdded(CommentBroadcastDto.From(comment));
    }
}
