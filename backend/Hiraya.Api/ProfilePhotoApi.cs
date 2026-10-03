using Hiraya.Shared;
using Hiraya.Shared.Models;
using Hiraya.Shared.Services;
using Hiraya.Shared.Services.Firebase;

namespace Hiraya.Api;

public static class ProfilePhotoApi
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/media/profile/{userId}", async (string userId, HttpRequest request, IHirayaRepository repo, ProfilePhotoService photos, IHirayaAppPaths paths) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            var db = await repo.LoadAsync();
            var user = db.Users.FirstOrDefault(u => u.UserId == userId);
            var path = user?.ProfileImagePath;
            if (string.IsNullOrWhiteSpace(path))
            {
                var student = db.Students.FirstOrDefault(s => s.StudentId == userId);
                path = student?.ProfileImagePath;
            }
            if (string.IsNullOrWhiteSpace(path))
                return Results.NotFound();
            var relative = path.Replace('/', Path.DirectorySeparatorChar);
            var full = Path.Combine(paths.DataDirectory, relative);
            if (!File.Exists(full))
            {
                var byName = Directory.Exists(photos.Root)
                    ? Directory.GetFiles(photos.Root, userId + ".*").FirstOrDefault()
                    : null;
                if (string.IsNullOrWhiteSpace(byName) || !File.Exists(byName))
                    return Results.NotFound();
                full = byName;
            }

            var ext = Path.GetExtension(full).ToLowerInvariant();
            var mime = ext switch
            {
                ".png" => "image/png",
                ".webp" => "image/webp",
                ".gif" => "image/gif",
                ".bmp" => "image/bmp",
                _ => "image/jpeg"
            };
            var bytes = await File.ReadAllBytesAsync(full);
            return Results.Bytes(bytes, mime);
        });

        app.MapPost("/api/users/{userId}/photo", async (string userId, HttpRequest request, IHirayaRepository repo, ProfilePhotoService photos) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            if (!CanEditPhoto(actor, userId))
                return Results.Json(new { error = "You cannot change that profile photo." }, statusCode: StatusCodes.Status403Forbidden);

            if (!request.HasFormContentType)
                return Results.Json(new { error = "Upload an image file." }, statusCode: StatusCodes.Status400BadRequest);
            var form = await request.ReadFormAsync();
            var file = form.Files.GetFile("file") ?? form.Files.FirstOrDefault();
            if (file is null || file.Length == 0)
                return Results.Json(new { error = "Choose a photo to upload." }, statusCode: StatusCodes.Status400BadRequest);

            try
            {
                await using var stream = file.OpenReadStream();
                var stored = await photos.SaveAsync(userId, file.FileName, stream, file.Length);
                return Results.Json(new { profileImagePath = stored, userId });
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        }).DisableAntiforgery();

        app.MapPost("/api/staff/{userId}/photo", async (string userId, HttpRequest request, IHirayaRepository repo, ProfilePhotoService photos) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            if (!CanEditPhoto(actor, userId))
                return Results.Json(new { error = "You cannot change that profile photo." }, statusCode: StatusCodes.Status403Forbidden);

            if (!request.HasFormContentType)
                return Results.Json(new { error = "Upload an image file." }, statusCode: StatusCodes.Status400BadRequest);
            var form = await request.ReadFormAsync();
            var file = form.Files.GetFile("file") ?? form.Files.FirstOrDefault();
            if (file is null || file.Length == 0)
                return Results.Json(new { error = "Choose a photo to upload." }, statusCode: StatusCodes.Status400BadRequest);

            try
            {
                await using var stream = file.OpenReadStream();
                var stored = await photos.SaveAsync(userId, file.FileName, stream, file.Length);
                return Results.Json(new { profileImagePath = stored, userId }, JsonDefaults.Options);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        }).DisableAntiforgery();

        app.MapDelete("/api/users/{userId}/photo", async (string userId, HttpRequest request, IHirayaRepository repo, ProfilePhotoService photos) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            if (!CanEditPhoto(actor, userId))
                return Results.Json(new { error = "You cannot change that profile photo." }, statusCode: StatusCodes.Status403Forbidden);
            await photos.RemoveAsync(userId);
            return Results.NoContent();
        }).DisableAntiforgery();

        app.MapPost("/api/students/{studentId}/photo", async (string studentId, HttpRequest request, IHirayaRepository repo, ProfilePhotoService photos) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            if (!Navigation.CanManageStudents(actor.Role))
                return Results.Json(new { error = "Only Super Admin can change a student photo." }, statusCode: StatusCodes.Status403Forbidden);
            if (!request.HasFormContentType)
                return Results.Json(new { error = "Upload an image file." }, statusCode: StatusCodes.Status400BadRequest);
            var form = await request.ReadFormAsync();
            var file = form.Files.GetFile("file") ?? form.Files.FirstOrDefault();
            if (file is null || file.Length == 0)
                return Results.Json(new { error = "Choose a photo to upload." }, statusCode: StatusCodes.Status400BadRequest);
            try
            {
                await using var stream = file.OpenReadStream();
                var stored = await photos.SaveStudentAsync(studentId, file.FileName, stream, file.Length);
                return Results.Json(new { profileImagePath = stored, studentId });
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        }).DisableAntiforgery();

        app.MapDelete("/api/students/{studentId}/photo", async (string studentId, HttpRequest request, IHirayaRepository repo, ProfilePhotoService photos) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            if (!Navigation.CanManageStudents(actor.Role))
                return Results.Json(new { error = "Only Super Admin can change a student photo." }, statusCode: StatusCodes.Status403Forbidden);
            await photos.RemoveStudentAsync(studentId);
            return Results.NoContent();
        }).DisableAntiforgery();
    }

    private static bool CanEditPhoto(HirayaUser actor, string userId)
    {
        if (string.Equals(actor.UserId, userId, StringComparison.OrdinalIgnoreCase))
            return true;
        return Navigation.CanManageStaff(actor.Role) || Navigation.CanManageStudents(actor.Role);
    }
}
