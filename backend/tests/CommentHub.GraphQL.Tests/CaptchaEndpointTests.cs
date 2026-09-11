using Xunit;

namespace CommentHub.GraphQL.Tests;

[Collection(PostgresCollection.Name)]
public sealed class CaptchaEndpointTests(PostgresFixture postgres) : IAsyncLifetime
{
    private readonly PostgresFixture _postgres = postgres;
    private CommentHubApiFactory _factory = null!;
    private HttpClient _client = null!;

    public ValueTask InitializeAsync()
    {
        _factory = new CommentHubApiFactory(_postgres.ConnectionString);
        _client = _factory.CreateClient();
        return ValueTask.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
    }

    [Fact]
    public async Task Returns_a_png_image_for_a_freshly_requested_captcha_id()
    {
        using var response = await _client.GetAsync($"/captcha/{Guid.NewGuid()}");

        response.EnsureSuccessStatusCode();
        Assert.Equal("image/png", response.Content.Headers.ContentType?.MediaType);

        var bytes = await response.Content.ReadAsByteArrayAsync();
        Assert.True(bytes.Length > 0);
    }
}
