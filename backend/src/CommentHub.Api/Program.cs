using CommentHub.Database;
using CommentHub.Database.DependencyInjection;
using CommentHub.Database.Seeding;
using CommentHub.GraphQL.DependencyInjection;
using CommentHub.GraphQL.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

builder.Services.AddCommentHubDatabase(builder.Configuration);
builder.AddCommentHubGraphQL();
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy => policy
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()));

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
app.MapGraphQL();

app.Run();
