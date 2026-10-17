using Google.Cloud.Firestore;
using Hiraya.Shared;
using Hiraya.Shared.Services;
using Hiraya.Shared.Services.Firebase;

namespace Hiraya.Data;

/// <summary>
/// Resume bytes stay out of the in-memory center store. Firestore keeps them in small chunks
/// so a redeploy does not erase the file an admin or the desktop app opens later.
/// </summary>
public sealed class TeacherResumeStore
{
    public const int MaxBytes = 5 * 1024 * 1024;
    private const int ChunkBytes = 700_000;

    private readonly FirestoreDb? _firestore;
    private readonly string _root;

    public TeacherResumeStore(IHirayaRepository repo, IHirayaAppPaths paths)
    {
        if (repo is FirestoreHirayaRepository firestore)
            _firestore = firestore.Database;
        _root = Path.Combine(paths.DataDirectory, "media", "teacher-resumes");
    }

    public static string SafeName(string? fileName)
    {
        var safe = LearningModuleRules.SafeFileName(fileName);
        return string.Equals(safe, "module.bin", StringComparison.Ordinal) ? "resume.pdf" : safe;
    }

    public static bool AllowedExtension(string fileName)
    {
        var ext = Path.GetExtension(SafeName(fileName)).ToLowerInvariant();
        return ext is ".pdf" or ".doc" or ".docx";
    }

    public async Task SaveAsync(string applicationId, byte[] bytes, CancellationToken ct = default)
    {
        if (_firestore is not null)
        {
            var doc = _firestore.Collection("teacherResumes").Document(applicationId);
            var parts = (int)Math.Ceiling(bytes.Length / (double)ChunkBytes);
            await doc.SetAsync(new Dictionary<string, object>
            {
                ["size"] = bytes.Length,
                ["parts"] = parts,
                ["savedAt"] = DateTime.UtcNow.ToString("o"),
            }, cancellationToken: ct);
            var collection = doc.Collection("parts");
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
            return;
        }

        Directory.CreateDirectory(_root);
        await File.WriteAllBytesAsync(Path.Combine(_root, applicationId + ".bin"), bytes, ct);
    }

    public async Task<byte[]?> ReadAsync(string applicationId, CancellationToken ct = default)
    {
        if (_firestore is not null)
        {
            var doc = _firestore.Collection("teacherResumes").Document(applicationId);
            var snap = await doc.GetSnapshotAsync(ct);
            if (!snap.Exists)
                return null;
            var parts = snap.ContainsField("parts") ? Convert.ToInt32(snap.GetValue<object>("parts")) : 0;
            if (parts <= 0)
                return null;
            using var output = new MemoryStream();
            for (var index = 0; index < parts; index++)
            {
                var part = await doc.Collection("parts").Document(index.ToString()).GetSnapshotAsync(ct);
                if (!part.Exists || !part.ContainsField("data"))
                    return null;
                output.Write(part.GetValue<byte[]>("data"));
            }
            return output.ToArray();
        }

        var path = Path.Combine(_root, applicationId + ".bin");
        return File.Exists(path) ? await File.ReadAllBytesAsync(path, ct) : null;
    }

    public async Task DeleteAsync(string applicationId, CancellationToken ct = default)
    {
        if (_firestore is not null)
        {
            var doc = _firestore.Collection("teacherResumes").Document(applicationId);
            var parts = await doc.Collection("parts").GetSnapshotAsync(ct);
            foreach (var part in parts.Documents)
                await part.Reference.DeleteAsync(cancellationToken: ct);
            await doc.DeleteAsync(cancellationToken: ct);
            return;
        }

        var path = Path.Combine(_root, applicationId + ".bin");
        if (File.Exists(path))
            File.Delete(path);
    }
}
