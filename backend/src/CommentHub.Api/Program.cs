using CommentHub.Database;
using CommentHub.Database.DependencyInjection;
using CommentHub.Database.Seeding;
using CommentHub.GraphQL.DependencyInjection;
using CommentHub.GraphQL.Realtime;
using CommentHub.GraphQL.Services;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
var maxUploadBytes = builder.Configuration.GetValue("Attachments:MaxImageSourceBytes", 8 * 1024 * 1024) + 1024;

builder.Services.AddCommentHubDatabase(builder.Configuration);
builder.AddCommentHubGraphQL();
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy => policy
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()));

builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = maxUploadBytes);
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = maxUploadBytes);

var app = builder.Build();

app.UseCors();

if (app.Environment.IsDevelopment() && app.Configuration.GetValue<bool>("SeedDevData"))
{
    using var scope = app.Services.CreateScope();
    var dbContextFactory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<CommentHubDbContext>>();
    await using var dbContext = await dbContextFactory.CreateDbContextAsync();
    await DevDataSeeder.SeedAsync(dbContext);
}

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapGet(
    "/captcha/{captchaId}",
    (string captchaId, ICaptchaChallengeService captcha) => Results.Bytes(captcha.Generate(captchaId).ImageBytes, "image/png")
);

var attachments = app.MapGroup("/attachments");

attachments.MapPost("/", async (IFormFile file, IAttachmentProcessingService processor, CancellationToken cancellationToken) =>
{
    var result = await processor.ProcessAsync(file, cancellationToken);
    if (!result.Success)
    {
        return Results.BadRequest(new { code = result.ErrorCode, message = result.ErrorMessage });
    }

    var attachment = result.Attachment!;
    return Results.Ok(new
    {
        token = attachment.Token,
        kind = attachment.Kind.ToString().ToUpperInvariant(),
        originalName = attachment.OriginalName,
        contentType = attachment.ContentType,
        sizeBytes = attachment.SizeBytes,
        width = attachment.Width,
        height = attachment.Height,
        previewUrl = $"/attachments/pending/{attachment.Token}",
    });
}).DisableAntiforgery();

attachments.MapGet("/pending/{token}", (string token, IPendingAttachmentService pending, IAttachmentStorageService storage) =>
{
    var attachment = pending.Get(token);
    return attachment is null
        ? Results.NotFound()
        : Results.File(storage.ResolveAbsolutePath(attachment.StoragePath), attachment.ContentType);
});

attachments.MapDelete("/pending/{token}", (string token, IPendingAttachmentService pending) =>
{
    pending.Cancel(token);
    return Results.NoContent();
});

attachments.MapGet("/{id:long}", async (long id, IDbContextFactory<CommentHubDbContext> dbContextFactory, IAttachmentStorageService storage, CancellationToken cancellationToken) =>
{
    await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);
    var attachment = await dbContext.Attachments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
    return attachment is null
        ? Results.NotFound()
        : Results.File(storage.ResolveAbsolutePath(attachment.StoragePath), attachment.ContentType, attachment.OriginalName);
});

app.MapGraphQL();
app.MapHub<CommentsHub>("/hubs/comments");

app.Run();
