using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CommentHub.Database.DependencyInjection;

public static class ServiceCollectionExtensions
{
    private const string ConnectionStringName = "CommentHub";

    public static IServiceCollection AddCommentHubDatabase(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        services.AddDbContextFactory<CommentHubDbContext>(options =>
        {
            var connectionString = configuration.GetConnectionString(ConnectionStringName)
                ?? throw new InvalidOperationException(
                    $"Connection string '{ConnectionStringName}' is not configured."
                );

            options.UseNpgsql(connectionString);
        });

        return services;
    }
}
