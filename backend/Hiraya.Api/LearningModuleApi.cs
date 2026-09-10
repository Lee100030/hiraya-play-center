using Hiraya.Shared.Models;
using Hiraya.Shared.Security;
using Hiraya.Shared.Services;
using Hiraya.Shared.Services.Firebase;

namespace Hiraya.Api;

public static class LearningModuleApi
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/modules", async (HttpRequest request, LearningModuleService modules, IHirayaRepository repo, bool hidden) =>
        {
            var actor = await ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            if (!Navigation.CanViewLearningModules(actor.Role))
                return Results.Json(new { error = "Forbidden" }, statusCode: StatusCodes.Status403Forbidden);
            var db = await repo.LoadAsync();
            var list = LearningModuleService.Visible(db, actor, hidden && Navigation.CanManageLearningModules(actor.Role)).ToList();
            return Results.Json(list, JsonDefaults.Options);
        });

        app.MapGet("/api/modules/{id}", async (string id, HttpRequest request, IHirayaRepository repo) =>
        {
            var actor = await ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            var db = await repo.LoadAsync();
            var module = LearningModuleService.Find(db, id);
            if (module is null)
                return Results.NotFound();
            if (!LearningModuleService.CanAccess(db, actor, module) && !Navigation.CanManageLearningModules(actor.Role))
                return Results.Json(new { error = "Forbidden" }, statusCode: StatusCodes.Status403Forbidden);
            return Results.Json(module, JsonDefaults.Options);
        });

        app.MapGet("/api/modules/{id}/versions", async (string id, HttpRequest request, IHirayaRepository repo) =>
        {
            var actor = await ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            var db = await repo.LoadAsync();
            var module = LearningModuleService.Find(db, id);
            if (module is null)
                return Results.NotFound();
            if (!Navigation.CanManageLearningModules(actor.Role))
                return Results.Json(new { error = "Forbidden" }, statusCode: StatusCodes.Status403Forbidden);
            var versions = db.LearningModuleVersions.Where(v => v.ModuleId == id).OrderByDescending(v => v.CreatedAt).ToList();
            return Results.Json(versions, JsonDefaults.Options);
        });

        app.MapPost("/api/modules", async (HttpRequest request, LearningModuleService modules, IHirayaRepository repo) =>
        {
            var actor = await ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            if (!Navigation.CanManageLearningModules(actor.Role))
                return Results.Json(new { error = "Forbidden" }, statusCode: StatusCodes.Status403Forbidden);
            try
            {
                var form = await request.ReadFormAsync();
                var db = await repo.LoadAsync();
                byte[]? bytes = null;
                string? fileName = null;
                var upload = form.Files.GetFile("file");
                if (upload is { Length: > 0 })
                {
                    LearningModuleRules.EnsureUploadAllowed(db.Settings, upload.FileName, upload.Length);
                    await using var stream = upload.OpenReadStream();
                    using var ms = new MemoryStream();
                    await stream.CopyToAsync(ms);
                    bytes = ms.ToArray();
                    fileName = upload.FileName;
                }

                var input = new LearningModuleSaveRequest
                {
                    ModuleId = form["moduleId"].ToString(),
                    Title = form["title"].ToString(),
                    Description = form["description"].ToString(),
                    ProgramId = form["programId"].ToString(),
                    Subject = form["subject"].ToString(),
                    GradeLevel = form["gradeLevel"].ToString(),
                    ModuleType = form["moduleType"].ToString(),
                    ClassIds = form["classIds"].ToString().Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList(),
                    Version = form["version"].ToString(),
                    ChangeDescription = form["changeDescription"].ToString(),
                    Publish = bool.TryParse(form["publish"], out var publish) && publish,
                    NotifyTeachers = !bool.TryParse(form["notifyTeachers"], out var notify) || notify
                };
                var saved = await modules.SaveAsync(input, actor, bytes, fileName);
                return Results.Json(saved, JsonDefaults.Options);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        }).DisableAntiforgery();

        app.MapPost("/api/modules/{id}/status", async (string id, StatusBody body, HttpRequest request, LearningModuleService modules, IHirayaRepository repo) =>
        {
            var actor = await ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            if (!Navigation.CanManageLearningModules(actor.Role))
                return Results.Json(new { error = "Forbidden" }, statusCode: StatusCodes.Status403Forbidden);
            try
            {
                await modules.SetStatusAsync(id, body.Status, actor);
                return Results.NoContent();
            }
            catch (UnauthorizedAccessException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });

        app.MapDelete("/api/modules/{id}", async (string id, HttpRequest request, LearningModuleService modules, IHirayaRepository repo) =>
        {
            var actor = await ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            if (!Navigation.CanManageLearningModules(actor.Role))
                return Results.Json(new { error = "Forbidden" }, statusCode: StatusCodes.Status403Forbidden);
            try
            {
                await modules.DeleteAsync(id, actor);
                return Results.NoContent();
            }
            catch (UnauthorizedAccessException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });

        app.MapPost("/api/modules/{id}/file-ticket", async (string id, HttpRequest request, IHirayaRepository repo, SessionTokenOptions tokens) =>
        {
            var actor = await ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            var db = await repo.LoadAsync();
            var module = LearningModuleService.Find(db, id);
            if (module is null)
                return Results.NotFound();
            if (!LearningModuleService.CanAccess(db, actor, module) && !Navigation.CanManageLearningModules(actor.Role))
                return Results.Json(new { error = "Forbidden" }, statusCode: StatusCodes.Status403Forbidden);
            var token = FileTickets.Issue(actor.UserId, id, tokens.Secret, stamp: SessionTokens.PasswordStamp(actor.Password));
            return Results.Json(new { token }, JsonDefaults.Options);
        });

        app.MapGet("/api/modules/{id}/file", async (string id, HttpRequest request, LearningModuleService modules, IHirayaRepository repo, SessionTokenOptions tokens, string? versionId, bool inline) =>
        {
            var actor = await ActorForFileAsync(id, request, repo, tokens);
            if (actor is null)
                return Results.Unauthorized();
            try
            {
                var file = await modules.OpenFileAsync(id, actor, versionId, auditDownload: !inline);
                return inline
                    ? Results.File(file.Bytes, file.ContentType)
                    : Results.File(file.Bytes, file.ContentType, file.FileName);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });
    }

    private static Task<HirayaUser?> ActorAsync(HttpRequest request, IHirayaRepository repo) =>
        ParentPortalApi.ActorAsync(request, repo);

    private static async Task<HirayaUser?> ActorForFileAsync(string moduleId, HttpRequest request, IHirayaRepository repo, SessionTokenOptions tokens)
    {
        var file = request.Query["file"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(file))
        {
            var ticket = FileTickets.TryRead(file, tokens.Secret);
            if (ticket is null || !string.Equals(ticket.ModuleId, moduleId, StringComparison.Ordinal))
                return null;
            var db = await repo.LoadAsync();
            var user = db.Users.FirstOrDefault(u => u.UserId == ticket.UserId);
            if (user is null || !AccountStatuses.AllowsPortalLogin(user.Status))
                return null;
            if (!string.Equals(ticket.Stamp, SessionTokens.PasswordStamp(user.Password), StringComparison.Ordinal))
                return null;
            return user;
        }

        return await ActorAsync(request, repo);
    }

    private sealed class StatusBody
    {
        public string Status { get; set; } = "";
    }
}
