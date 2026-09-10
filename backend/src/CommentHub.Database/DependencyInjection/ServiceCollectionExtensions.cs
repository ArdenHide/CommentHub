using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CommentHub.Database.DependencyInjection;

public static class ServiceCollectionExtensions
{
    private const string ConnectionStringName = "CommentHub";

    /// <summary>
    /// Registers <see cref="CommentHubDbContext"/> so the calling project does not need
    /// to know which database provider is used underneath.
    /// </summary>
    public static IServiceCollection AddCommentHubDatabase(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        var connectionString = configuration.GetConnectionString(ConnectionStringName)
            ?? throw new InvalidOperationException(
                $"Connection string '{ConnectionStringName}' is not configured."
            );

        services.AddDbContext<CommentHubDbContext>(options => options.UseNpgsql(connectionString));

        return services;
    }
}
