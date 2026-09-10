using CommentHub.Database.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCommentHubDatabase(builder.Configuration);

var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();
