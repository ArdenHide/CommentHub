using CommentHub.GraphQL.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace CommentHub.GraphQL.Services;

public sealed class AttachmentStorageService : IAttachmentStorageService
{
    private readonly string _rootPath;

    public AttachmentStorageService(IHostEnvironment environment, IOptions<AttachmentOptions> options)
    {
        _rootPath = System.IO.Path.IsPathRooted(options.Value.RootPath)
            ? options.Value.RootPath
            : System.IO.Path.Combine(environment.ContentRootPath, options.Value.RootPath);

        Directory.CreateDirectory(_rootPath);
    }

    public string GenerateStoragePath(string extension) => $"{Guid.NewGuid():N}{extension}";

    public string ResolveAbsolutePath(string storagePath) => System.IO.Path.Combine(_rootPath, storagePath);

    public async Task SaveAsync(string storagePath, byte[] content, CancellationToken cancellationToken)
        => await File.WriteAllBytesAsync(ResolveAbsolutePath(storagePath), content, cancellationToken);

    public void TryDelete(string storagePath)
    {
        try
        {
            File.Delete(ResolveAbsolutePath(storagePath));
        }
        catch (IOException)
        {
        }
        catch (UnauthorizedAccessException)
        {
        }
    }
}
