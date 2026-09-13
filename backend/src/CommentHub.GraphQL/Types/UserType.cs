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
            .Resolve(context => AvatarSeedCalculator.Compute(context.Parent<User>().Email));

        descriptor
            .Field("maskedEmail")
            .Type<NonNullType<StringType>>()
            .Resolve(context => EmailMasker.Mask(context.Parent<User>().Email));
    }
}
