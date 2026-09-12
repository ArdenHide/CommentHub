using CommentHub.Database.Entities;
using CommentHub.GraphQL.DataLoaders;

namespace CommentHub.GraphQL.Types;

[ObjectType<Comment>]
public static partial class CommentType
{
    static partial void Configure(IObjectTypeDescriptor<Comment> descriptor)
    {
        descriptor.BindFieldsExplicitly();

        descriptor.Field(comment => comment.Id);
        descriptor.Field(comment => comment.TextHtml);
        descriptor.Field(comment => comment.CreatedAt);
        descriptor.Field(comment => comment.User).Type<NonNullType<UserType>>();

        descriptor
            .Field("attachment")
            .Resolve(context => context.Parent<Comment>().Attachments.FirstOrDefault());
    }

    public static async Task<CommentPage> GetRepliesAsync(
        [Parent] Comment comment,
        IRepliesByParentIdDataLoader repliesByParentId,
        CancellationToken cancellationToken,
        int skip = 0,
        int take = 5,
        bool descending = false
    )
    {
        var allReplies = await repliesByParentId.LoadAsync(comment.Id, cancellationToken) ?? [];
        IEnumerable<Comment> ordered = descending ? allReplies.AsEnumerable().Reverse() : allReplies;

        return new CommentPage(ordered.Skip(skip).Take(take).ToList(), allReplies.Count);
    }
}
