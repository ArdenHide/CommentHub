using CommentHub.Database;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace CommentHub.GraphQL.Tests;

public sealed class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:17-alpine")
        .WithDatabase("commenthub")
        .WithUsername("commenthub")
        .WithPassword("commenthub")
        .Build();

    public string ConnectionString => _container.GetConnectionString();

    public async ValueTask InitializeAsync()
    {
        await _container.StartAsync();

        await using var dbContext = CreateDbContext();
        await dbContext.Database.MigrateAsync();
    }

    public CommentHubDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<CommentHubDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;

        return new CommentHubDbContext(options);
    }

    public async ValueTask DisposeAsync() => await _container.DisposeAsync();
}

[CollectionDefinition(Name)]
public sealed class PostgresCollection : ICollectionFixture<PostgresFixture>
{
    public const string Name = "Postgres";
}
