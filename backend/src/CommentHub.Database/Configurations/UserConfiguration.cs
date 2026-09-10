using CommentHub.Database.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CommentHub.Database.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_Users_UserName_Alphanumeric",
            """ "UserName" ~ '^[A-Za-z0-9]+$' """
        ));

        builder.HasKey(user => user.Id);

        builder.Property(user => user.Id)
            .UseIdentityAlwaysColumn();

        builder.Property(user => user.UserName)
            .HasMaxLength(64)
            .IsRequired();

        // citext gives case-insensitive comparison: Ivan@mail.com and ivan@mail.com
        // are the same user, with no normalization needed on the application side.
        builder.Property(user => user.Email)
            .HasColumnType(PostgresColumnTypes.CaseInsensitiveText)
            .IsRequired();

        builder.Property(user => user.HomePage)
            .HasMaxLength(2048);

        builder.Property(user => user.CreatedAt)
            .HasDefaultValueSql("now()")
            .ValueGeneratedOnAdd();

        builder.HasIndex(user => user.Email)
            .IsUnique();

        // Sorting top-level comments by User Name goes through a JOIN to this table.
        builder.HasIndex(user => user.UserName);
    }
}
