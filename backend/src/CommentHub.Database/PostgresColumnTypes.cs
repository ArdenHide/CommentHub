namespace CommentHub.Database;

/// <summary>
/// PostgreSQL-specific column/extension type names, kept in one place so the raw
/// server-side identifiers don't show up as unexplained string literals in configs.
/// </summary>
internal static class PostgresColumnTypes
{
    /// <summary>
    /// The "citext" (case-insensitive text) extension type. Requires the "citext"
    /// extension to be enabled on the database — see
    /// <see cref="CommentHubDbContext.OnModelCreating"/>.
    /// </summary>
    public const string CaseInsensitiveText = "citext";
}
