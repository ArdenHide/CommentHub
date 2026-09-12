using System.Net.Http.Json;
using System.Text.Json;
using CommentHub.Database.Entities;
using CommentHub.GraphQL.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CommentHub.GraphQL.Tests;

[Collection(PostgresCollection.Name)]
public sealed class CommentMutationsTests(PostgresFixture postgres) : IAsyncLifetime
{
    private readonly PostgresFixture _postgres = postgres;
    private string _attachmentsRootPath = null!;
    private CommentHubApiFactory _factory = null!;
    private HttpClient _client = null!;
    private ICaptchaChallengeService _captcha = null!;

    public async ValueTask InitializeAsync()
    {
        await using var dbContext = _postgres.CreateDbContext();
        await dbContext.Comments.ExecuteDeleteAsync();
        await dbContext.Users.ExecuteDeleteAsync();

        _attachmentsRootPath = Directory.CreateTempSubdirectory("commenthub-attachments-").FullName;
        _factory = new CommentHubApiFactory(_postgres.ConnectionString, _attachmentsRootPath);
        _client = _factory.CreateClient();
        _captcha = _factory.Services.GetRequiredService<ICaptchaChallengeService>();
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
        Directory.Delete(_attachmentsRootPath, recursive: true);
    }

    private const string Mutation = """
        mutation($input: AddCommentInput!) {
          addComment(input: $input) {
            comment {
              id
              textHtml
              user { userName homePage avatarSeed }
              attachment { id kind originalName contentType sizeBytes width height }
            }
            errors { field code message }
          }
        }
        """;

    private object BuildInput(
        string userName = "alice",
        string email = "alice@example.com",
        string? homePage = null,
        string text = "hello",
        long? parentId = null,
        (string Id, string Code)? captcha = null,
        string? attachmentToken = null
    )
    {
        var (captchaId, captchaCode) = captcha ?? GenerateValidCaptcha();
        return new { userName, email, homePage, text, parentId, captchaId, captchaCode, attachmentToken };
    }

    private async Task<string> UploadTextAttachmentAsync()
    {
        using var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent("hello world"u8.ToArray()), "file", "notes.txt");

        using var response = await _client.PostAsync("/attachments", content);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        return body!.RootElement.GetProperty("token").GetString()!;
    }

    private (string Id, string Code) GenerateValidCaptcha()
    {
        var id = Guid.NewGuid().ToString();
        var challenge = _captcha.Generate(id);
        return (id, challenge.Code);
    }

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

    [Fact]
    public async Task Stamps_links_with_rel_nofollow_ugc_regardless_of_what_was_submitted()
    {
        var input = BuildInput(text: "<a href=\"https://example.com\">link</a>");

        using var result = await _client.PostGraphQLAsync(Mutation, new { input });
        var comment = result.RootElement.GetProperty("data").GetProperty("addComment").GetProperty("comment");

        Assert.Equal(
            "<a href=\"https://example.com\" rel=\"nofollow ugc\">link</a>",
            comment.GetProperty("textHtml").GetString()
        );
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
    [InlineData("text", "alice", "alice@example.com", null, "<a href=\"https://example.com\" rel=\"dofollow\">x</a>")]
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
    public async Task Rejects_an_incorrect_captcha_code_without_persisting_anything()
    {
        var input = BuildInput(captcha: (Guid.NewGuid().ToString(), "wrong-code"));

        using var result = await _client.PostGraphQLAsync(Mutation, new { input });
        var payload = result.RootElement.GetProperty("data").GetProperty("addComment");

        Assert.Equal(System.Text.Json.JsonValueKind.Null, payload.GetProperty("comment").ValueKind);
        var errors = payload.GetProperty("errors").EnumerateArray().ToArray();
        Assert.Contains(
            errors,
            error =>
                error.GetProperty("field").GetString() == "captchaCode"
                && error.GetProperty("code").GetString() == "CAPTCHA_INVALID"
        );

        await using var dbContext = _postgres.CreateDbContext();
        Assert.Equal(0, await dbContext.Comments.CountAsync());
    }

    [Fact]
    public async Task Rejects_reusing_an_already_spent_captcha_code()
    {
        var captcha = GenerateValidCaptcha();
        await CreateCommentAsync(BuildInput(captcha: captcha));

        var input = BuildInput(email: "bob@example.com", userName: "bob", captcha: captcha);
        using var result = await _client.PostGraphQLAsync(Mutation, new { input });
        var payload = result.RootElement.GetProperty("data").GetProperty("addComment");

        var errors = payload.GetProperty("errors").EnumerateArray().ToArray();
        Assert.Contains(errors, error => error.GetProperty("field").GetString() == "captchaCode");

        await using var dbContext = _postgres.CreateDbContext();
        Assert.Equal(1, await dbContext.Comments.CountAsync());
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

    [Fact]
    public async Task Creates_a_comment_with_an_uploaded_attachment()
    {
        var token = await UploadTextAttachmentAsync();
        var input = BuildInput(attachmentToken: token);

        using var result = await _client.PostGraphQLAsync(Mutation, new { input });
        var comment = result.RootElement.GetProperty("data").GetProperty("addComment").GetProperty("comment");

        var attachment = comment.GetProperty("attachment");
        Assert.Equal("TEXT", attachment.GetProperty("kind").GetString());
        Assert.Equal("notes.txt", attachment.GetProperty("originalName").GetString());
        Assert.Equal(11, attachment.GetProperty("sizeBytes").GetInt32());

        await using var dbContext = _postgres.CreateDbContext();
        var saved = await dbContext.Comments.Include(c => c.Attachments).SingleAsync();
        Assert.Single(saved.Attachments);
        Assert.Equal(saved.Id, saved.Attachments.Single().CommentId);
    }

    [Fact]
    public async Task Rejects_a_missing_or_expired_attachment_token()
    {
        var input = BuildInput(attachmentToken: "does-not-exist");

        using var result = await _client.PostGraphQLAsync(Mutation, new { input });
        var payload = result.RootElement.GetProperty("data").GetProperty("addComment");

        Assert.Equal(System.Text.Json.JsonValueKind.Null, payload.GetProperty("comment").ValueKind);
        var errors = payload.GetProperty("errors").EnumerateArray().ToArray();
        Assert.Contains(
            errors,
            error =>
                error.GetProperty("field").GetString() == "attachmentToken"
                && error.GetProperty("code").GetString() == "ATTACHMENT_EXPIRED"
        );

        await using var dbContext = _postgres.CreateDbContext();
        Assert.Equal(0, await dbContext.Comments.CountAsync());
    }

    [Fact]
    public async Task Keeps_an_uploaded_attachment_usable_after_a_failed_submission_attempt()
    {
        var token = await UploadTextAttachmentAsync();

        var badAttempt = BuildInput(attachmentToken: token, captcha: (Guid.NewGuid().ToString(), "wrong-code"));
        using var badResult = await _client.PostGraphQLAsync(Mutation, new { input = badAttempt });
        var badPayload = badResult.RootElement.GetProperty("data").GetProperty("addComment");
        Assert.Equal(System.Text.Json.JsonValueKind.Null, badPayload.GetProperty("comment").ValueKind);

        var goodAttempt = BuildInput(attachmentToken: token);
        using var goodResult = await _client.PostGraphQLAsync(Mutation, new { input = goodAttempt });
        var comment = goodResult.RootElement.GetProperty("data").GetProperty("addComment").GetProperty("comment");

        Assert.Equal("TEXT", comment.GetProperty("attachment").GetProperty("kind").GetString());
    }

    private async Task<long> CreateCommentAsync(object input)
    {
        using var result = await _client.PostGraphQLAsync(Mutation, new { input });
        return result.RootElement.GetProperty("data").GetProperty("addComment").GetProperty("comment").GetProperty("id").GetInt64();
    }
}
