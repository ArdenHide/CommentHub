using CommentHub.Database.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CommentHub.Database.Configurations;

public class CommentConfiguration : IEntityTypeConfiguration<Comment>
{
    public void Configure(EntityTypeBuilder<Comment> builder)
    {
        // Top-level comment: no parent, no root, depth 0.
        // Reply: both parent and root are set, depth is greater than zero.
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_Comments_Hierarchy",
            """
            ("ParentId" IS NULL AND "RootId" IS NULL AND "Depth" = 0)
            OR ("ParentId" IS NOT NULL AND "RootId" IS NOT NULL AND "Depth" > 0)
            """
        ));

        builder.HasKey(comment => comment.Id);

        builder.Property(comment => comment.Id)
            .UseIdentityAlwaysColumn();

        builder.Property(comment => comment.Depth)
            .HasDefaultValue(0);

        builder.Property(comment => comment.TextHtml)
            .IsRequired();

        builder.Property(comment => comment.CreatedAt)
            .HasDefaultValueSql("now()")
            .ValueGeneratedOnAdd();

        builder.HasOne(comment => comment.User)
            .WithMany(user => user.Comments)
            .HasForeignKey(comment => comment.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(comment => comment.Parent)
            .WithMany(comment => comment.Replies)
            .HasForeignKey(comment => comment.ParentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(comment => comment.Root)
            .WithMany()
            .HasForeignKey(comment => comment.RootId)
            .OnDelete(DeleteBehavior.Restrict);

        // Top-level comments page, default sort order LIFO.
        // The index is partial — it covers only a small fraction of the rows;
        // PostgreSQL scans it in both directions, so it serves ASC and DESC alike.
        builder.HasIndex(comment => new { comment.CreatedAt, comment.Id })
            .IsDescending(true, true)
            .HasFilter(""" "ParentId" IS NULL """)
            .HasDatabaseName("IX_Comments_Roots_CreatedAt_Id");

        builder.HasIndex(comment => new { comment.ParentId, comment.CreatedAt, comment.Id })
            .HasFilter(""" "ParentId" IS NOT NULL """)
            .HasDatabaseName("IX_Comments_Replies_ParentId_CreatedAt_Id");
    }
}
