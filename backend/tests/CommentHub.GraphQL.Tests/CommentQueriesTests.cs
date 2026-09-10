using CommentHub.Database.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CommentHub.GraphQL.Tests;

[Collection(PostgresCollection.Name)]
public sealed class CommentQueriesTests(PostgresFixture postgres) : IAsyncLifetime
{
    private readonly PostgresFixture _postgres = postgres;
    private CommentHubApiFactory _factory = null!;
    private HttpClient _client = null!;

    public async ValueTask InitializeAsync()
    {
        await ResetAndSeedAsync();

        _factory = new CommentHubApiFactory(_postgres.ConnectionString);
        _client = _factory.CreateClient();
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
    }

    private async Task ResetAndSeedAsync()
    {
        await using var dbContext = _postgres.CreateDbContext();

        await dbContext.Comments.ExecuteDeleteAsync();
        await dbContext.Users.ExecuteDeleteAsync();

        var alice = new User { UserName = "alice", Email = "alice@example.com" };
        var bob = new User { UserName = "bob", Email = "bob@example.com", HomePage = "https://bob.example.com" };
        dbContext.Users.AddRange(alice, bob);
        await dbContext.SaveChangesAsync();

        var now = DateTimeOffset.UtcNow;

        var root1 = new Comment { User = alice, TextHtml = "<p>root1</p>", CreatedAt = now.AddMinutes(-3) };
        dbContext.Comments.Add(root1);
        await dbContext.SaveChangesAsync();

        var reply1 = new Comment
        {
            User = bob,
            ParentId = root1.Id,
            RootId = root1.Id,
            Depth = 1,
            TextHtml = "<p>reply1</p>",
            CreatedAt = now.AddSeconds(-150),
        };
        var reply2 = new Comment
        {
            User = alice,
            ParentId = root1.Id,
            RootId = root1.Id,
            Depth = 1,
            TextHtml = "<p>reply2</p>",
            CreatedAt = now.AddSeconds(-120),
        };
        var reply3 = new Comment
        {
            User = bob,
            ParentId = root1.Id,
            RootId = root1.Id,
            Depth = 1,
            TextHtml = "<p>reply3</p>",
            CreatedAt = now.AddSeconds(-90),
        };
        dbContext.Comments.AddRange(reply1, reply2, reply3);
        await dbContext.SaveChangesAsync();

        var reply1A = new Comment
        {
            User = alice,
            ParentId = reply1.Id,
            RootId = root1.Id,
            Depth = 2,
            TextHtml = "<p>reply1a</p>",
            CreatedAt = now.AddSeconds(-60),
        };
        dbContext.Comments.Add(reply1A);

        var root2 = new Comment { User = bob, TextHtml = "<p>root2</p>", CreatedAt = now };
        dbContext.Comments.Add(root2);

        await dbContext.SaveChangesAsync();
    }

    [Fact]
    public async Task Comments_query_is_reachable_through_the_host()
    {
        using var result = await _client.PostGraphQLAsync("{ __typename }");

        Assert.Equal("Query", result.RootElement.GetProperty("data").GetProperty("__typename").GetString());
    }

    [Fact]
    public async Task Comments_are_paginated_lifo_with_full_reply_tree()
    {
        const string query = """
            query($skip: Int) {
              comments(skip: $skip, take: 1) {
                totalCount
                items {
                  textHtml
                  user { userName homePage }
                  replies(take: 5) {
                    totalCount
                    items { textHtml replies(take: 5) { items { textHtml } } }
                  }
                }
              }
            }
            """;

        using var page1 = await _client.PostGraphQLAsync(query, new { skip = 0 });
        var page1Comments = page1.RootElement.GetProperty("data").GetProperty("comments");
        var page1Items = page1Comments.GetProperty("items").EnumerateArray().ToArray();

        Assert.Equal(2, page1Comments.GetProperty("totalCount").GetInt32());
        Assert.Single(page1Items);
        var root2Node = page1Items[0];
        Assert.Equal("<p>root2</p>", root2Node.GetProperty("textHtml").GetString());
        Assert.Empty(root2Node.GetProperty("replies").GetProperty("items").EnumerateArray());

        using var page2 = await _client.PostGraphQLAsync(query, new { skip = 1 });
        var page2Items = page2.RootElement.GetProperty("data").GetProperty("comments")
            .GetProperty("items").EnumerateArray().ToArray();

        Assert.Single(page2Items);
        var root1Node = page2Items[0];
        Assert.Equal("<p>root1</p>", root1Node.GetProperty("textHtml").GetString());

        var root1Replies = root1Node.GetProperty("replies");
        Assert.Equal(3, root1Replies.GetProperty("totalCount").GetInt32());
        var root1ReplyItems = root1Replies.GetProperty("items").EnumerateArray().ToArray();
        Assert.Equal(3, root1ReplyItems.Length);
        Assert.Equal("<p>reply1</p>", root1ReplyItems[0].GetProperty("textHtml").GetString());
        Assert.Equal("<p>reply2</p>", root1ReplyItems[1].GetProperty("textHtml").GetString());
        Assert.Equal("<p>reply3</p>", root1ReplyItems[2].GetProperty("textHtml").GetString());

        var reply1Replies = root1ReplyItems[0].GetProperty("replies").GetProperty("items").EnumerateArray().ToArray();
        Assert.Single(reply1Replies);
        Assert.Equal("<p>reply1a</p>", reply1Replies[0].GetProperty("textHtml").GetString());
    }

    [Fact]
    public async Task Replies_are_paginated_when_there_are_more_than_requested()
    {
        const string query = """
            query($repliesSkip: Int) {
              comments(take: 2) {
                items {
                  textHtml
                  replies(skip: $repliesSkip, take: 2) {
                    totalCount
                    items { textHtml }
                  }
                }
              }
            }
            """;

        using var page1 = await _client.PostGraphQLAsync(query, new { repliesSkip = 0 });
        var root1Node1 = FindItemByText(page1, "<p>root1</p>");
        var page1Replies = root1Node1.GetProperty("replies");
        var page1Items = page1Replies.GetProperty("items").EnumerateArray().ToArray();

        Assert.Equal(3, page1Replies.GetProperty("totalCount").GetInt32());
        Assert.Equal(2, page1Items.Length);
        Assert.Equal("<p>reply1</p>", page1Items[0].GetProperty("textHtml").GetString());
        Assert.Equal("<p>reply2</p>", page1Items[1].GetProperty("textHtml").GetString());

        using var page2 = await _client.PostGraphQLAsync(query, new { repliesSkip = 2 });
        var root1Node2 = FindItemByText(page2, "<p>root1</p>");
        var page2Items = root1Node2.GetProperty("replies").GetProperty("items").EnumerateArray().ToArray();

        Assert.Single(page2Items);
        Assert.Equal("<p>reply3</p>", page2Items[0].GetProperty("textHtml").GetString());
    }

    private static System.Text.Json.JsonElement FindItemByText(System.Text.Json.JsonDocument response, string textHtml)
        => response.RootElement.GetProperty("data").GetProperty("comments").GetProperty("items")
            .EnumerateArray()
            .Single(item => item.GetProperty("textHtml").GetString() == textHtml);

    [Fact]
    public async Task User_type_does_not_expose_email()
    {
        using var result = await _client.PostGraphQLAsync(
            """{ __type(name: "User") { fields { name } } }"""
        );

        var fieldNames = result.RootElement
            .GetProperty("data")
            .GetProperty("__type")
            .GetProperty("fields")
            .EnumerateArray()
            .Select(field => field.GetProperty("name").GetString())
            .ToArray();

        Assert.DoesNotContain("email", fieldNames);
        Assert.Contains("userName", fieldNames);
    }
}
