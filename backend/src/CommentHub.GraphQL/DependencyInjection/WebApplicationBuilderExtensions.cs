using System.Threading.Channels;
using CommentHub.Database;
using CommentHub.GraphQL.Configuration;
using CommentHub.GraphQL.Realtime;
using CommentHub.GraphQL.Services;
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

        builder.Services.AddMemoryCache();
        builder.Services.AddOptions<CaptchaOptions>().BindConfiguration(CaptchaOptions.SectionName);
        builder.Services.AddSingleton<ICaptchaChallengeService, CaptchaImageChallengeService>();

        builder.Services.AddOptions<AttachmentOptions>().BindConfiguration(AttachmentOptions.SectionName);
        builder.Services.AddSingleton<IAttachmentStorageService, AttachmentStorageService>();
        builder.Services.AddSingleton<IPendingAttachmentService, PendingAttachmentService>();
        builder.Services.AddSingleton<IAttachmentProcessingService, AttachmentProcessingService>();

        builder.Services.AddCommentHubRealtime();

        return builder
            .AddGraphQL()
            .RegisterDbContextFactory<CommentHubDbContext>()
            .AddGraphQLTypes();
    }

    private static void AddCommentHubRealtime(this IServiceCollection services)
    {
        var channel = Channel.CreateBounded<CommentAddedEvent>(
            new BoundedChannelOptions(1000) { FullMode = BoundedChannelFullMode.DropOldest, SingleReader = true }
        );
        services.AddSingleton(channel.Reader);
        services.AddSingleton(channel.Writer);

        services.AddSingleton<ICommentEventPublisher, CommentEventPublisher>();
        services.AddSingleton<ICommentsCache, CommentsCache>();
        services.AddHostedService<CommentEventWorker>();
        services.AddSignalR();
    }
}
