namespace CommentHub.Database.Entities;

/// <summary>
/// A comment. The tree is stored through <see cref="ParentId"/>, while <see cref="RootId"/>
/// and <see cref="Depth"/> are denormalized so that a whole thread can be fetched with a
/// single query instead of a recursive CTE. A comment never changes its parent, so these
/// fields are written once on creation and cannot drift out of sync.
/// </summary>
public class Comment
{
    public long Id { get; set; }

    public long UserId { get; set; }

    public User User { get; set; } = null!;

    /// <summary><c>null</c> for a top-level comment.</summary>
    public long? ParentId { get; set; }

    public Comment? Parent { get; set; }

    /// <summary><c>null</c> when the comment is itself the root of a thread.</summary>
    public long? RootId { get; set; }

    public Comment? Root { get; set; }

    /// <summary>0 for a top-level comment, otherwise <c>Parent.Depth + 1</c>.</summary>
    public int Depth { get; set; }

    /// <summary>Already sanitized XHTML: unsafe markup never reaches the database.</summary>
    public required string TextHtml { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<Comment> Replies { get; set; } = [];

    public ICollection<Attachment> Attachments { get; set; } = [];
}
