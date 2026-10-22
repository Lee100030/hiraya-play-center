using Google.Cloud.Firestore;
using Hiraya.Shared.Services;
using Hiraya.Shared.Services.Firebase;

namespace Hiraya.Data;

/// <summary>
/// Module bytes stay out of the center document. Firestore keeps them in small chunks
/// so a new API container can still open the file on the phone.
/// </summary>
public sealed class FirestoreModuleFileStore : ILearningModuleBytes
{
    private const int ChunkBytes = 700_000;

    private readonly FirestoreDb? _firestore;

    public FirestoreModuleFileStore(IHirayaRepository repo)
    {
        if (repo is FirestoreHirayaRepository firestore)
            _firestore = firestore.Database;
    }

    public async Task SaveAsync(string moduleId, string versionId, byte[] bytes, CancellationToken ct = default)
    {
        if (_firestore is null || bytes.Length == 0)
            return;
        var version = VersionDoc(moduleId, versionId);
        var parts = (int)Math.Ceiling(bytes.Length / (double)ChunkBytes);
        await version.SetAsync(new Dictionary<string, object>
        {
            ["size"] = bytes.Length,
            ["parts"] = parts,
            ["savedAt"] = DateTime.UtcNow.ToString("o"),
        }, cancellationToken: ct);
        var collection = version.Collection("parts");
        for (var index = 0; index < parts; index++)
        {
            var start = index * ChunkBytes;
            var length = Math.Min(ChunkBytes, bytes.Length - start);
            var slice = new byte[length];
            Buffer.BlockCopy(bytes, start, slice, 0, length);
            await collection.Document(index.ToString()).SetAsync(new Dictionary<string, object>
            {
                ["data"] = Blob.CopyFrom(slice),
            }, cancellationToken: ct);
        }
    }

    public async Task<byte[]?> ReadAsync(string moduleId, string versionId, CancellationToken ct = default)
    {
        if (_firestore is null || string.IsNullOrWhiteSpace(moduleId) || string.IsNullOrWhiteSpace(versionId))
            return null;
        var version = VersionDoc(moduleId, versionId);
        var snap = await version.GetSnapshotAsync(ct);
        if (!snap.Exists)
            return null;
        var parts = snap.ContainsField("parts") ? Convert.ToInt32(snap.GetValue<object>("parts")) : 0;
        if (parts <= 0)
            return null;
        using var output = new MemoryStream();
        for (var index = 0; index < parts; index++)
        {
            var part = await version.Collection("parts").Document(index.ToString()).GetSnapshotAsync(ct);
            if (!part.Exists || !part.ContainsField("data"))
                return null;
            output.Write(part.GetValue<byte[]>("data"));
        }
        return output.ToArray();
    }

    public async Task DeleteModuleAsync(string moduleId, CancellationToken ct = default)
    {
        if (_firestore is null || string.IsNullOrWhiteSpace(moduleId))
            return;
        var module = _firestore.Collection("moduleFiles").Document(Safe(moduleId));
        var versions = await module.Collection("versions").GetSnapshotAsync(ct);
        foreach (var version in versions.Documents)
        {
            var parts = await version.Reference.Collection("parts").GetSnapshotAsync(ct);
            foreach (var part in parts.Documents)
                await part.Reference.DeleteAsync(cancellationToken: ct);
            await version.Reference.DeleteAsync(cancellationToken: ct);
        }
    }

    private DocumentReference VersionDoc(string moduleId, string versionId) =>
        _firestore!.Collection("moduleFiles").Document(Safe(moduleId)).Collection("versions").Document(Safe(versionId));

    private static string Safe(string id)
    {
        var value = string.Concat((id ?? "").Where(c => char.IsLetterOrDigit(c) || c is '_' or '-'));
        return string.IsNullOrWhiteSpace(value) ? "file" : value;
    }
}
