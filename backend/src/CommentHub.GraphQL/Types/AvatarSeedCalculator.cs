using System.Security.Cryptography;
using System.Text;

namespace CommentHub.GraphQL.Types;

/// <summary>
/// A stable, non-reversible identifier for a user's avatar, derived from their e-mail
/// without exposing it. Intended as the seed for client-side identicon generation.
/// Shared between <see cref="UserType"/> and the realtime broadcast DTO so both never drift.
/// </summary>
public static class AvatarSeedCalculator
{
    public static string Compute(string email)
    {
        var normalized = email.Trim().ToLowerInvariant();
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(normalized));

        return Convert.ToHexStringLower(hash);
    }
}
