using Hiraya.Shared.Models;
using Hiraya.Shared.Services;
using Hiraya.Shared.Services.Firebase;

namespace Hiraya.Api;

public static class StudentDocumentApi
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/media/student-files/{documentId}", async (
            string documentId,
            HttpRequest request,
            IHirayaRepository repo,
            StudentDocumentService files) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            var db = await repo.LoadAsync();
            WorkflowOps.EnsureLists(db);
            var row = db.StudentDocuments.FirstOrDefault(d => d.DocumentId == documentId);
            if (row is null)
                return Results.NotFound();
            if (!FamilyAccess.CanViewStudent(db, actor, row.StudentId))
                return Results.Json(new { error = "You cannot open that student file." }, statusCode: StatusCodes.Status403Forbidden);
            var full = files.AbsolutePath(row);
            if (string.IsNullOrWhiteSpace(full))
                return Results.NotFound();
            var bytes = await File.ReadAllBytesAsync(full);
            var mime = string.IsNullOrWhiteSpace(row.ContentType) ? "application/octet-stream" : row.ContentType;
            return Results.File(bytes, mime, row.OriginalName);
        });

        app.MapPost("/api/students/{studentId}/files", async (
            string studentId,
            HttpRequest request,
            IHirayaRepository repo,
            StudentDocumentService files) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            if (!Navigation.CanManageStudents(actor.Role))
                return Results.Json(new { error = "Only Super Admin can store student files." }, statusCode: StatusCodes.Status403Forbidden);
            if (!request.HasFormContentType)
                return Results.Json(new { error = "Upload a file." }, statusCode: StatusCodes.Status400BadRequest);
            var form = await request.ReadFormAsync();
            var file = form.Files.GetFile("file") ?? form.Files.FirstOrDefault();
            if (file is null || file.Length == 0)
                return Results.Json(new { error = "Choose a file to upload." }, statusCode: StatusCodes.Status400BadRequest);
            try
            {
                await using var stream = file.OpenReadStream();
                var stored = await files.SaveAsync(
                    studentId,
                    form["kind"].ToString(),
                    form["title"].ToString(),
                    file.FileName,
                    stream,
                    file.Length,
                    actor.UserId);
                return Results.Json(new { documentId = stored.DocumentId, studentId });
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        }).DisableAntiforgery();

        app.MapDelete("/api/students/{studentId}/files/{documentId}", async (
            string studentId,
            string documentId,
            HttpRequest request,
            IHirayaRepository repo,
            StudentDocumentService files) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            if (!Navigation.CanManageStudents(actor.Role))
                return Results.Json(new { error = "Only Super Admin can remove student files." }, statusCode: StatusCodes.Status403Forbidden);
            await files.RemoveAsync(studentId, documentId);
            return Results.NoContent();
        }).DisableAntiforgery();
    }
}
