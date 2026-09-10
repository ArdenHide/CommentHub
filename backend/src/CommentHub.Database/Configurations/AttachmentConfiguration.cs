using CommentHub.Database.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CommentHub.Database.Configurations;

public class AttachmentConfiguration : IEntityTypeConfiguration<Attachment>
{
    public void Configure(EntityTypeBuilder<Attachment> builder)
    {
        builder.ToTable(table =>
        {
            table.HasCheckConstraint("CK_Attachments_SizeBytes_Positive", """ "SizeBytes" > 0 """);

            // Dimensions only exist for images and stay within the 320x240 limit from the spec.
            table.HasCheckConstraint(
                "CK_Attachments_Dimensions",
                """
                ("Kind" = 1 AND "Width" IS NOT NULL AND "Width" <= 320
                             AND "Height" IS NOT NULL AND "Height" <= 240)
                OR ("Kind" <> 1 AND "Width" IS NULL AND "Height" IS NULL)
                """
            );
        });

        builder.HasKey(attachment => attachment.Id);

        builder.Property(attachment => attachment.Id)
            .UseIdentityAlwaysColumn();

        builder.Property(attachment => attachment.Kind)
            .HasConversion<short>();

        builder.Property(attachment => attachment.StoragePath)
            .HasMaxLength(512)
            .IsRequired();

        builder.Property(attachment => attachment.OriginalName)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(attachment => attachment.ContentType)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(attachment => attachment.CreatedAt)
            .HasDefaultValueSql("now()")
            .ValueGeneratedOnAdd();

        builder.HasOne(attachment => attachment.Comment)
            .WithMany(comment => comment.Attachments)
            .HasForeignKey(attachment => attachment.CommentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(attachment => attachment.StoragePath)
            .IsUnique();
    }
}
