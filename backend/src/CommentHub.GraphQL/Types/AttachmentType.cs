using CommentHub.Database.Entities;

namespace CommentHub.GraphQL.Types;

[ObjectType<Attachment>]
public static partial class AttachmentType
{
    static partial void Configure(IObjectTypeDescriptor<Attachment> descriptor)
    {
        descriptor.BindFieldsExplicitly();

        descriptor.Field(attachment => attachment.Id);
        descriptor.Field(attachment => attachment.Kind);
        descriptor.Field(attachment => attachment.OriginalName);
        descriptor.Field(attachment => attachment.ContentType);
        descriptor.Field(attachment => attachment.SizeBytes);
        descriptor.Field(attachment => attachment.Width);
        descriptor.Field(attachment => attachment.Height);

        // StoragePath is intentionally not exposed: clients build the download URL from Id.
    }
}
