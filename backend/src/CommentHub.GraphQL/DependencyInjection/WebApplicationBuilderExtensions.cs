using CommentHub.Database;
using CommentHub.GraphQL.Types;
using CommentHub.GraphQL.Validation;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Hosting;
using FluentValidation;
using HotChocolate.Execution.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CommentHub.GraphQL.DependencyInjection;

public static class WebApplicationBuilderExtensions
{
    public static IRequestExecutorBuilder AddCommentHubGraphQL(this WebApplicationBuilder builder)
    {
        builder.Services.AddScoped<IValidator<AddCommentInput>, AddCommentInputValidator>();

        return builder
            .AddGraphQL()
            .RegisterDbContextFactory<CommentHubDbContext>()
            .AddGraphQLTypes();
    }
}
