using Microsoft.AspNetCore.SignalR;

namespace CommentHub.GraphQL.Realtime;

/// <summary>
/// Push-only: clients never call hub methods, they just listen. Every connection joins no
/// group and receives every broadcast; each client filters by <see cref="CommentBroadcastDto.ParentId"/>
/// locally to decide whether an update is relevant to what it currently has rendered.
/// </summary>
public sealed class CommentsHub : Hub<ICommentsClient>;

public interface ICommentsClient
{
    Task CommentAdded(CommentBroadcastDto comment);
}
