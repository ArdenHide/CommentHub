using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace CommentHub.GraphQL.Tests;

public sealed class CommentHubApiFactory(string connectionString, string? attachmentsRootPath = null) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureAppConfiguration((_, config) =>
        {
            var settings = new Dictionary<string, string?>
            {
                ["ConnectionStrings:CommentHub"] = connectionString,
                ["SeedDevData"] = "false",
            };

            if (attachmentsRootPath is not null)
            {
                settings["Attachments:RootPath"] = attachmentsRootPath;
            }

            config.AddInMemoryCollection(settings);
        });
    }
}
