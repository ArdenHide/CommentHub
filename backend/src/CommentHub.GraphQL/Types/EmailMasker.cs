namespace CommentHub.GraphQL.Types;

/// <summary>
/// Reduces an e-mail to a display-safe form (e.g. "j***@example.com") for the public,
/// unauthenticated demo — full addresses are never sent to GraphQL clients.
/// </summary>
public static class EmailMasker
{
    public static string Mask(string email)
    {
        var atIndex = email.IndexOf('@');
        if (atIndex <= 0)
        {
            return "***";
        }

        var localPart = email[..atIndex];
        var domain = email[(atIndex + 1)..];
        var maskedLocal = localPart.Length <= 1 ? "*" : $"{localPart[0]}***";

        return $"{maskedLocal}@{domain}";
    }
}
