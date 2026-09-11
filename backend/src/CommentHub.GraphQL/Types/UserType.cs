using System.Security.Cryptography;
using System.Text;
using CommentHub.Database.Entities;

namespace CommentHub.GraphQL.Types;

public class UserType : ObjectType<User>
{
    protected override void Configure(IObjectTypeDescriptor<User> descriptor)
    {
        descriptor.BindFieldsExplicitly();

        descriptor.Field(user => user.Id);
        descriptor.Field(user => user.UserName);
        descriptor.Field(user => user.HomePage);

        descriptor
            .Field("avatarSeed")
            .Type<NonNullType<StringType>>()
            .Resolve(context => ComputeAvatarSeed(context.Parent<User>().Email));
    }

    /// <summary>
    /// A stable, non-reversible identifier for the user's avatar, derived from their
    /// e-mail without exposing it. Intended as the seed for client-side identicon generation.
    /// </summary>
    private static string ComputeAvatarSeed(string email)
    {
        var normalized = email.Trim().ToLowerInvariant();
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(normalized));

        return Convert.ToHexStringLower(hash);
    }
}
