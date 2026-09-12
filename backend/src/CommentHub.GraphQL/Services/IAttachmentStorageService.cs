namespace CommentHub.GraphQL.Services;

public interface IAttachmentStorageService
{
    /// <summary>Generates a new, unique storage path — never derived from user-supplied input.</summary>
    string GenerateStoragePath(string extension);

    string ResolveAbsolutePath(string storagePath);

    Task SaveAsync(string storagePath, byte[] content, CancellationToken cancellationToken);

    void TryDelete(string storagePath);
}
