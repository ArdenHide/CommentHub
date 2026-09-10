using CommentHub.Database.DependencyInjection;
using CommentHub.GraphQL.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCommentHubDatabase(builder.Configuration);
builder.AddCommentHubGraphQL();

var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapGraphQL();

app.Run();
