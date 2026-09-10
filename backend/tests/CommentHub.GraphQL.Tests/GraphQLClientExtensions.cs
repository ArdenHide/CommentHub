using System.Net.Http.Json;
using System.Text.Json;

namespace CommentHub.GraphQL.Tests;

internal static class GraphQLClientExtensions
{
    public static async Task<JsonDocument> PostGraphQLAsync(
        this HttpClient client,
        string query,
        object? variables = null
    )
    {
        using var response = await client.PostAsJsonAsync("/graphql", new { query, variables });
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStreamAsync();
        return await JsonDocument.ParseAsync(body);
    }
}
