namespace CommentHub.Database.Entities;

/// <summary>Type of an attachment. Stored as <c>smallint</c>.</summary>
public enum AttachmentKind : short
{
    /// <summary>JPG, GIF or PNG, at most 320x240 after downscaling.</summary>
    Image = 1,

    /// <summary>TXT file of at most 100 KB.</summary>
    Text = 2
}
