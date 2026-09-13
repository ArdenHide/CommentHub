namespace CommentHub.GraphQL.Realtime;

public interface ICommentEventPublisher
{
    void Publish(CommentAddedEvent commentAdded);
}
