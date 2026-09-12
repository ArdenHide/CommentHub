using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace CommentHub.GraphQL.Tests;

[Collection(PostgresCollection.Name)]
public sealed class AttachmentUploadEndpointTests(PostgresFixture postgres) : IAsyncLifetime
{
    private readonly PostgresFixture _postgres = postgres;
    private string _rootPath = null!;
    private CommentHubApiFactory _factory = null!;
    private HttpClient _client = null!;

    public ValueTask InitializeAsync()
    {
        _rootPath = Directory.CreateTempSubdirectory("commenthub-attachments-").FullName;
        _factory = new CommentHubApiFactory(_postgres.ConnectionString, _rootPath);
        _client = _factory.CreateClient();
        return ValueTask.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
        Directory.Delete(_rootPath, recursive: true);
    }

    private static MultipartFormDataContent BuildUpload(byte[] bytes, string fileName, string contentType)
    {
        var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(bytes);
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(contentType);
        content.Add(fileContent, "file", fileName);
        return content;
    }

    [Fact]
    public async Task Uploading_a_valid_text_file_returns_a_token_and_preview_metadata()
    {
        using var response = await _client.PostAsync("/attachments", BuildUpload("hello world"u8.ToArray(), "notes.txt", "text/plain"));

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.Equal("TEXT", body!.RootElement.GetProperty("kind").GetString());
        Assert.False(string.IsNullOrEmpty(body.RootElement.GetProperty("token").GetString()));
        Assert.Equal(11, body.RootElement.GetProperty("sizeBytes").GetInt32());
    }

    [Fact]
    public async Task Pending_attachment_can_be_downloaded_right_after_upload()
    {
        var bytes = "hello world"u8.ToArray();
        using var uploadResponse = await _client.PostAsync("/attachments", BuildUpload(bytes, "notes.txt", "text/plain"));
        var body = await uploadResponse.Content.ReadFromJsonAsync<JsonDocument>();
        var token = body!.RootElement.GetProperty("token").GetString();

        using var downloadResponse = await _client.GetAsync($"/attachments/pending/{token}");

        downloadResponse.EnsureSuccessStatusCode();
        Assert.Equal(bytes, await downloadResponse.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Cancelling_a_pending_attachment_deletes_it_and_the_file_on_disk()
    {
        var bytes = "hello world"u8.ToArray();
        using var uploadResponse = await _client.PostAsync("/attachments", BuildUpload(bytes, "notes.txt", "text/plain"));
        var body = await uploadResponse.Content.ReadFromJsonAsync<JsonDocument>();
        var token = body!.RootElement.GetProperty("token").GetString();

        using var deleteResponse = await _client.DeleteAsync($"/attachments/pending/{token}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        using var downloadResponse = await _client.GetAsync($"/attachments/pending/{token}");
        Assert.Equal(HttpStatusCode.NotFound, downloadResponse.StatusCode);
        Assert.Empty(Directory.EnumerateFiles(_rootPath, "*", SearchOption.AllDirectories));
    }

    [Fact]
    public async Task Rejects_an_unsupported_file_type_with_a_400_and_an_error_code()
    {
        using var response = await _client.PostAsync("/attachments", BuildUpload("whatever"u8.ToArray(), "document.pdf", "application/pdf"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.Equal("UNSUPPORTED_TYPE", body!.RootElement.GetProperty("code").GetString());
    }
}
