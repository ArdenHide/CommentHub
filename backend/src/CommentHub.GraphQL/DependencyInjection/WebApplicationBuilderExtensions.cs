using CommentHub.Database;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Hosting;
using HotChocolate.Execution.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CommentHub.GraphQL.DependencyInjection;

public static class WebApplicationBuilderExtensions
{
    public static IRequestExecutorBuilder AddCommentHubGraphQL(this WebApplicationBuilder builder)
        => builder
            .AddGraphQL()
            .RegisterDbContextFactory<CommentHubDbContext>()
            .AddGraphQLTypes();
}
