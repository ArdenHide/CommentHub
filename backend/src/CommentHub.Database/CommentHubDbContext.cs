using CommentHub.Database.Entities;
using Microsoft.EntityFrameworkCore;

namespace CommentHub.Database;

public class CommentHubDbContext(DbContextOptions<CommentHubDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<Comment> Comments => Set<Comment>();

    public DbSet<Attachment> Attachments => Set<Attachment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension(PostgresColumnTypes.CaseInsensitiveText);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CommentHubDbContext).Assembly);
    }
}
