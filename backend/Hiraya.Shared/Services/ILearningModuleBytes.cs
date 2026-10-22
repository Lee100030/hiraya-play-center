namespace Hiraya.Shared.Services;

/// <summary>
/// Durable copy of a learning-module file. The disk copy is only a fallback.
/// </summary>
public interface ILearningModuleBytes
{
    Task SaveAsync(string moduleId, string versionId, byte[] bytes, CancellationToken ct = default);
    Task<byte[]?> ReadAsync(string moduleId, string versionId, CancellationToken ct = default);
    Task DeleteModuleAsync(string moduleId, CancellationToken ct = default);
}

public sealed class MissingModuleBytes : ILearningModuleBytes
{
    public Task SaveAsync(string moduleId, string versionId, byte[] bytes, CancellationToken ct = default) =>
        Task.CompletedTask;

    public Task<byte[]?> ReadAsync(string moduleId, string versionId, CancellationToken ct = default) =>
        Task.FromResult<byte[]?>(null);

    public Task DeleteModuleAsync(string moduleId, CancellationToken ct = default) =>
        Task.CompletedTask;
}
