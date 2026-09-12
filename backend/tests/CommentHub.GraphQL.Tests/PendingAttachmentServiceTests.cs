using CommentHub.Database.Entities;
using CommentHub.GraphQL.Configuration;
using CommentHub.GraphQL.Services;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Xunit;

namespace CommentHub.GraphQL.Tests;

public sealed class PendingAttachmentServiceTests : IDisposable
{
    private readonly string _rootPath = Directory.CreateTempSubdirectory("commenthub-attachments-").FullName;

    public void Dispose() => Directory.Delete(_rootPath, recursive: true);

    private (PendingAttachmentService Service, IAttachmentStorageService Storage) CreateService()
    {
        var environment = new TestHostEnvironment(_rootPath);
        var storage = new AttachmentStorageService(environment, Options.Create(new AttachmentOptions { RootPath = _rootPath }));
        var cache = new MemoryCache(new MemoryCacheOptions());
        var service = new PendingAttachmentService(cache, storage, Options.Create(new AttachmentOptions { PendingExpirationMinutes = 15 }));
        return (service, storage);
    }

    private static PendingAttachment MakeAttachment(string token, string storagePath) => new()
    {
        Token = token,
        Kind = AttachmentKind.Text,
        StoragePath = storagePath,
        OriginalName = "notes.txt",
        ContentType = "text/plain",
        SizeBytes = 3,
    };

    [Fact]
    public async Task Put_then_get_returns_the_same_attachment()
    {
        var (service, storage) = CreateService();
        var storagePath = storage.GenerateStoragePath(".txt");
        await storage.SaveAsync(storagePath, [1, 2, 3], CancellationToken.None);

        var attachment = MakeAttachment(Guid.NewGuid().ToString("N"), storagePath);
        service.Put(attachment);

        var found = service.Get(attachment.Token);
        Assert.NotNull(found);
        Assert.Equal(attachment.StoragePath, found!.StoragePath);
    }

    [Fact]
    public async Task Consume_removes_the_entry_but_keeps_the_file_on_disk()
    {
        var (service, storage) = CreateService();
        var storagePath = storage.GenerateStoragePath(".txt");
        await storage.SaveAsync(storagePath, [1, 2, 3], CancellationToken.None);

        var attachment = MakeAttachment(Guid.NewGuid().ToString("N"), storagePath);
        service.Put(attachment);

        var consumed = service.Consume(attachment.Token);

        Assert.NotNull(consumed);
        Assert.Null(service.Get(attachment.Token));
        Assert.True(File.Exists(storage.ResolveAbsolutePath(storagePath)));
    }

    [Fact]
    public async Task Cancel_removes_the_entry_and_deletes_the_file_from_disk()
    {
        var (service, storage) = CreateService();
        var storagePath = storage.GenerateStoragePath(".txt");
        await storage.SaveAsync(storagePath, [1, 2, 3], CancellationToken.None);

        var attachment = MakeAttachment(Guid.NewGuid().ToString("N"), storagePath);
        service.Put(attachment);

        service.Cancel(attachment.Token);

        Assert.Null(service.Get(attachment.Token));
        Assert.False(File.Exists(storage.ResolveAbsolutePath(storagePath)));
    }

    private sealed class TestHostEnvironment(string contentRootPath) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "CommentHub.GraphQL.Tests";
        public string ContentRootPath { get; set; } = contentRootPath;
        public IFileProvider ContentRootFileProvider { get; set; } = null!;
    }
}
