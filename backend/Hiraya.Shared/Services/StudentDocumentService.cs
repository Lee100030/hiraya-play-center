using Hiraya.Shared.Models;
using Hiraya.Shared.Services.Firebase;

namespace Hiraya.Shared.Services;

public class StudentDocumentService
{
    private static readonly HashSet<string> Kinds = new(StringComparer.OrdinalIgnoreCase)
    {
        "birth_certificate", "medical_record", "immunization", "assessment", "id", "other"
    };

    private readonly IHirayaAppPaths _paths;
    private readonly IHirayaRepository _repo;

    public StudentDocumentService(IHirayaAppPaths paths, IHirayaRepository repo)
    {
        _paths = paths;
        _repo = repo;
    }

    public string Root => Path.Combine(_paths.DataDirectory, "media", "student-files");

    public async Task<StudentDocument> SaveAsync(
        string studentId,
        string kind,
        string? title,
        string fileName,
        Stream content,
        long length,
        string uploadedBy)
    {
        var db = await _repo.LoadAsync();
        WorkflowOps.EnsureLists(db);
        if (db.Students.All(s => s.StudentId != studentId))
            throw new InvalidOperationException("That student was not found.");

        LearningModuleRules.EnsureUploadAllowed(db.Settings, fileName, length);
        var original = LearningModuleRules.SafeFileName(fileName);
        var ext = Path.GetExtension(original).ToLowerInvariant();
        if (ext is ".jpeg" or ".jpe" or ".jfif")
            ext = ".jpg";

        using var ms = new MemoryStream();
        await content.CopyToAsync(ms);
        var bytes = ms.ToArray();
        if (bytes.Length == 0)
            throw new InvalidOperationException("The selected file was empty.");

        var id = IdFactory.New("sdoc");
        var folder = Path.Combine(Root, studentId);
        Directory.CreateDirectory(folder);
        var relative = Path.Combine("media", "student-files", studentId, id + ext).Replace('\\', '/');
        var full = Path.Combine(_paths.DataDirectory, relative.Replace('/', Path.DirectorySeparatorChar));
        await File.WriteAllBytesAsync(full, bytes);

        var kindId = Kinds.Contains(kind) ? kind.Trim().ToLowerInvariant() : "other";
        var row = new StudentDocument
        {
            DocumentId = id,
            StudentId = studentId,
            Kind = kindId,
            Title = string.IsNullOrWhiteSpace(title) ? original : title.Trim(),
            OriginalName = original,
            StoredPath = relative,
            ContentType = LearningModuleRules.ContentType(ext),
            SizeBytes = bytes.Length,
            UploadedBy = uploadedBy,
            CreatedAt = DateTime.UtcNow.ToString("o")
        };
        db.StudentDocuments.Add(row);
        await _repo.SaveAsync(db);
        return row;
    }

    public async Task RemoveAsync(string studentId, string documentId)
    {
        var db = await _repo.LoadAsync();
        WorkflowOps.EnsureLists(db);
        var row = db.StudentDocuments.FirstOrDefault(d => d.DocumentId == documentId && d.StudentId == studentId);
        if (row is null)
            return;
        db.StudentDocuments.Remove(row);
        await _repo.SaveAsync(db);
        var full = Path.Combine(_paths.DataDirectory, row.StoredPath.Replace('/', Path.DirectorySeparatorChar));
        try
        {
            if (File.Exists(full))
                File.Delete(full);
        }
        catch
        {
            /* leftover file is ok */
        }
    }

    public string? AbsolutePath(StudentDocument row)
    {
        var full = Path.Combine(_paths.DataDirectory, row.StoredPath.Replace('/', Path.DirectorySeparatorChar));
        return File.Exists(full) ? full : null;
    }
}
