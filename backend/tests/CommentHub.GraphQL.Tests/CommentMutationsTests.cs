using CommentHub.Database.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CommentHub.GraphQL.Tests;

[Collection(PostgresCollection.Name)]
public sealed class CommentMutationsTests(PostgresFixture postgres) : IAsyncLifetime
{
    private readonly PostgresFixture _postgres = postgres;
    private CommentHubApiFactory _factory = null!;
    private HttpClient _client = null!;

    public async ValueTask InitializeAsync()
    {
        await using var dbContext = _postgres.CreateDbContext();
        await dbContext.Comments.ExecuteDeleteAsync();
        await dbContext.Users.ExecuteDeleteAsync();

        _factory = new CommentHubApiFactory(_postgres.ConnectionString);
        _client = _factory.CreateClient();
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
    }

    private const string Mutation = """
        mutation($input: AddCommentInput!) {
          addComment(input: $input) {
            comment {
              id
              textHtml
              user { userName homePage avatarSeed }
            }
            errors { field code message }
          }
        }
        """;

    private static object BuildInput(
        string userName = "alice",
        string email = "alice@example.com",
        string? homePage = null,
        string text = "hello",
        long? parentId = null
    ) => new { userName, email, homePage, text, parentId };

    [Fact]
    public async Task Creates_a_top_level_comment_and_a_new_user()
    {
        var input = BuildInput(text: "<strong>hi</strong>");

        using var result = await _client.PostGraphQLAsync(Mutation, new { input });
        var payload = result.RootElement.GetProperty("data").GetProperty("addComment");

        Assert.Empty(payload.GetProperty("errors").EnumerateArray());
        var comment = payload.GetProperty("comment");
        Assert.Equal("<strong>hi</strong>", comment.GetProperty("textHtml").GetString());
        Assert.Equal("alice", comment.GetProperty("user").GetProperty("userName").GetString());

        await using var dbContext = _postgres.CreateDbContext();
        var saved = await dbContext.Comments.Include(c => c.User).SingleAsync();
        Assert.Null(saved.ParentId);
        Assert.Null(saved.RootId);
        Assert.Equal(0, saved.Depth);
        Assert.Equal("alice@example.com", saved.User.Email);
    }

    [Fact]
    public async Task Creates_a_reply_with_inherited_root_and_incremented_depth()
    {
        var rootId = await CreateCommentAsync(BuildInput(text: "<i>root</i>"));
        var replyId = await CreateCommentAsync(BuildInput(email: "bob@example.com", userName: "bob", text: "<i>reply</i>", parentId: rootId));

        var grandChildInput = BuildInput(email: "carl@example.com", userName: "carl", text: "<i>grandchild</i>", parentId: replyId);
        using var result = await _client.PostGraphQLAsync(Mutation, new { input = grandChildInput });
        var comment = result.RootElement.GetProperty("data").GetProperty("addComment").GetProperty("comment");
        var grandChildId = comment.GetProperty("id").GetInt64();

        await using var dbContext = _postgres.CreateDbContext();
        var grandChild = await dbContext.Comments.SingleAsync(c => c.Id == grandChildId);

        Assert.Equal(replyId, grandChild.ParentId);
        Assert.Equal(rootId, grandChild.RootId);
        Assert.Equal(2, grandChild.Depth);
    }

    [Fact]
    public async Task Reuses_the_existing_user_and_does_not_overwrite_their_data_on_email_match()
    {
        await CreateCommentAsync(BuildInput(userName: "alice", email: "alice@example.com", homePage: "https://alice.example.com"));

        var input = BuildInput(userName: "notalice", email: "ALICE@example.com", homePage: "https://evil.example.com", text: "<code>second</code>");
        using var result = await _client.PostGraphQLAsync(Mutation, new { input });
        var comment = result.RootElement.GetProperty("data").GetProperty("addComment").GetProperty("comment");

        Assert.Equal("alice", comment.GetProperty("user").GetProperty("userName").GetString());
        Assert.Equal("https://alice.example.com", comment.GetProperty("user").GetProperty("homePage").GetString());

        await using var dbContext = _postgres.CreateDbContext();
        Assert.Equal(1, await dbContext.Users.CountAsync());
        Assert.Equal(2, await dbContext.Comments.CountAsync());
    }

    [Theory]
    [InlineData("userName", "not latin", "alice@example.com", null, "<p>ok</p>")]
    [InlineData("email", "alice", "not-an-email", null, "<p>ok</p>")]
    [InlineData("homePage", "alice", "alice@example.com", "not a url", "<p>ok</p>")]
    [InlineData("text", "alice", "alice@example.com", null, "")]
    [InlineData("text", "alice", "alice@example.com", null, "<script>alert(1)</script>")]
    [InlineData("text", "alice", "alice@example.com", null, "<p>unclosed")]
    [InlineData("text", "alice", "alice@example.com", null, "<a onclick=\"evil()\">x</a>")]
    [InlineData("text", "alice", "alice@example.com", null, "<a href=\"javascript:alert(1)\">x</a>")]
    public async Task Rejects_invalid_input_without_persisting_anything(
        string expectedField,
        string userName,
        string email,
        string? homePage,
        string text
    )
    {
        var input = BuildInput(userName: userName, email: email, homePage: homePage, text: text);

        using var result = await _client.PostGraphQLAsync(Mutation, new { input });
        var payload = result.RootElement.GetProperty("data").GetProperty("addComment");

        Assert.Equal(System.Text.Json.JsonValueKind.Null, payload.GetProperty("comment").ValueKind);
        var errors = payload.GetProperty("errors").EnumerateArray().ToArray();
        Assert.NotEmpty(errors);
        Assert.Contains(errors, error => error.GetProperty("field").GetString() == expectedField);

        await using var dbContext = _postgres.CreateDbContext();
        Assert.Equal(0, await dbContext.Comments.CountAsync());
    }

    [Fact]
    public async Task Rejects_a_reply_to_a_nonexistent_parent()
    {
        var input = BuildInput(parentId: 999999);

        using var result = await _client.PostGraphQLAsync(Mutation, new { input });
        var payload = result.RootElement.GetProperty("data").GetProperty("addComment");

        Assert.Equal(System.Text.Json.JsonValueKind.Null, payload.GetProperty("comment").ValueKind);
        var errors = payload.GetProperty("errors").EnumerateArray().ToArray();
        Assert.Contains(errors, error => error.GetProperty("field").GetString() == "parentId");

        await using var dbContext = _postgres.CreateDbContext();
        Assert.Equal(0, await dbContext.Comments.CountAsync());
    }

    private async Task<long> CreateCommentAsync(object input)
    {
        using var result = await _client.PostGraphQLAsync(Mutation, new { input });
        return result.RootElement.GetProperty("data").GetProperty("addComment").GetProperty("comment").GetProperty("id").GetInt64();
    }
}
