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
    }
}
