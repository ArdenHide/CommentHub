namespace CommentHub.GraphQL.Realtime;

/// <summary>
/// Raised after a comment has been persisted. Carries only identifiers: consumers
/// re-read whatever data they need from the database at processing time.
/// </summary>
public sealed record CommentAddedEvent(long CommentId, long? ParentId, long RootId);
