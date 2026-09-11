using CommentHub.Database.DependencyInjection;
using CommentHub.GraphQL.DependencyInjection;

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

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapGraphQL();

app.Run();
