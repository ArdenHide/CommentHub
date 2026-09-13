using System.Text.Json;
using CommentHub.GraphQL.Services;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CommentHub.GraphQL.Tests;

[Collection(PostgresCollection.Name)]
public sealed class CommentRealtimeTests(PostgresFixture postgres) : IAsyncLifetime
{
    private readonly PostgresFixture _postgres = postgres;
    private CommentHubApiFactory _factory = null!;
    private HttpClient _client = null!;
    private ICaptchaChallengeService _captcha = null!;

    public async ValueTask InitializeAsync()
    {
        await using var dbContext = _postgres.CreateDbContext();
        await dbContext.Comments.ExecuteDeleteAsync();
        await dbContext.Users.ExecuteDeleteAsync();

        _factory = new CommentHubApiFactory(_postgres.ConnectionString);
        _client = _factory.CreateClient();
        _captcha = _factory.Services.GetRequiredService<ICaptchaChallengeService>();
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
    }

    private const string AddCommentMutation = """
        mutation($input: AddCommentInput!) {
          addComment(input: $input) {
            comment { id }
            errors { field code message }
          }
        }
        """;

    private object BuildInput(string userName = "alice", string email = "alice@example.com", string text = "hello")
    {
        var captchaId = Guid.NewGuid().ToString();
        var challenge = _captcha.Generate(captchaId);
        return new
        {
            userName,
            email,
            homePage = (string?)null,
            text,
            parentId = (long?)null,
            captchaId,
            captchaCode = challenge.Code,
            attachmentToken = (string?)null,
        };
    }

    // TestServer has no real socket to upgrade, so the WebSocket transport doesn't apply here;
    // long-polling exercises the same hub/DTO wire format over plain HTTP requests.
    private async Task<HubConnection> ConnectAsync()
    {
        var connection = new HubConnectionBuilder()
            .WithUrl(new Uri(_client.BaseAddress!, "/hubs/comments"), options =>
            {
                options.HttpMessageHandlerFactory = _ => _factory.Server.CreateHandler();
                options.Transports = HttpTransportType.LongPolling;
            })
            .Build();

        await connection.StartAsync();
        return connection;
    }

    [Fact]
    public async Task Broadcasts_the_new_comment_to_connected_clients()
    {
        await using var connection = await ConnectAsync();
        var received = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        connection.On<JsonElement>("CommentAdded", dto => received.TrySetResult(dto));

        var input = BuildInput(text: "<i>hi</i>");
        using var result = await _client.PostGraphQLAsync(AddCommentMutation, new { input });
        var commentId = result.RootElement.GetProperty("data").GetProperty("addComment")
            .GetProperty("comment").GetProperty("id").GetInt64();

        var completed = await Task.WhenAny(received.Task, Task.Delay(TimeSpan.FromSeconds(10)));
        Assert.True(completed == received.Task, "Timed out waiting for the CommentAdded broadcast.");

        var dto = await received.Task;
        Assert.Equal(commentId, dto.GetProperty("id").GetInt64());
        Assert.Equal(JsonValueKind.Null, dto.GetProperty("parentId").ValueKind);
        Assert.Equal("<i>hi</i>", dto.GetProperty("textHtml").GetString());
        Assert.Equal("alice", dto.GetProperty("user").GetProperty("userName").GetString());
    }

    [Fact]
    public async Task Invalidates_the_top_level_cache_so_a_new_comment_is_visible_immediately()
    {
        const string commentsQuery = "{ comments { totalCount } }";
        using var before = await _client.PostGraphQLAsync(commentsQuery);
        var countBefore = before.RootElement.GetProperty("data").GetProperty("comments").GetProperty("totalCount").GetInt32();

        var input = BuildInput();
        using var result = await _client.PostGraphQLAsync(AddCommentMutation, new { input });
        Assert.Empty(result.RootElement.GetProperty("data").GetProperty("addComment").GetProperty("errors").EnumerateArray());

        var deadline = DateTime.UtcNow.AddSeconds(10);
        var countAfter = countBefore;
        while (DateTime.UtcNow < deadline && countAfter == countBefore)
        {
            using var page = await _client.PostGraphQLAsync(commentsQuery);
            countAfter = page.RootElement.GetProperty("data").GetProperty("comments").GetProperty("totalCount").GetInt32();
            if (countAfter == countBefore)
            {
                await Task.Delay(50);
            }
        }

        Assert.Equal(countBefore + 1, countAfter);
    }
}
