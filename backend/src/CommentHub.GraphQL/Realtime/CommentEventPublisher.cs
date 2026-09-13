using System.Threading.Channels;
using Microsoft.Extensions.Logging;

namespace CommentHub.GraphQL.Realtime;

public sealed class CommentEventPublisher(ChannelWriter<CommentAddedEvent> writer, ILogger<CommentEventPublisher> logger)
    : ICommentEventPublisher
{
    public void Publish(CommentAddedEvent commentAdded)
    {
        if (!writer.TryWrite(commentAdded))
        {
            logger.LogWarning("Dropped {Event}: realtime channel is full.", commentAdded);
        }
    }
}
