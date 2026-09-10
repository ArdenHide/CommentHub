namespace CommentHub.Database.Entities;

/// <summary>
/// A comment author. The application has no sign-up: the user is identified by the
/// e-mail typed into the form and is reused on subsequent submissions.
/// </summary>
public class User
{
    public long Id { get; set; }

    /// <summary>Latin letters and digits only — also enforced by a CHECK constraint.</summary>
    public required string UserName { get; set; }

    /// <summary>The user's identity. Case-insensitive (citext) and unique.</summary>
    public required string Email { get; set; }

    public string? HomePage { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<Comment> Comments { get; set; } = [];
}
