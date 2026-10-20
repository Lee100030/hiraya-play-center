using Hiraya.Shared.Models;
using Hiraya.Shared.Services;
using Hiraya.Shared.Services.Firebase;

namespace Hiraya.Api;

public static class EnrollmentApi
{
    public static void Map(WebApplication app)
    {
        app.MapPost("/api/enrollment/applications/{id}/approve", async (
            string id,
            ApproveEnrollmentBody? body,
            HttpRequest request,
            IHirayaRepository repo,
            EnrollmentService enroll) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null) return Results.Unauthorized();
            try
            {
                await enroll.ApproveApplicationAsync(id, actor, body?.ClassId);
                var data = await repo.LoadAsync();
                return Results.Json(StoreSanitizer.VisibleTo(data, actor), JsonDefaults.Options);
            }
            catch (UnauthorizedAccessException)
            {
                return Results.Json(new { error = "You are not allowed to approve enrollment applications." }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });

        app.MapPost("/api/enrollment/applications/{id}/reject", async (
            string id,
            HttpRequest request,
            IHirayaRepository repo,
            EnrollmentService enroll) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null) return Results.Unauthorized();
            try
            {
                await enroll.RejectApplicationAsync(id, actor);
                var data = await repo.LoadAsync();
                return Results.Json(StoreSanitizer.VisibleTo(data, actor), JsonDefaults.Options);
            }
            catch (UnauthorizedAccessException)
            {
                return Results.Json(new { error = "You are not allowed to reject enrollment applications." }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });

        app.MapPost("/api/enrollment/applications/{id}/interview", async (
            string id,
            InterviewBody? body,
            HttpRequest request,
            IHirayaRepository repo,
            EnrollmentService enroll) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null) return Results.Unauthorized();
            try
            {
                await enroll.ScheduleTeacherInterviewAsync(id, actor, body?.When ?? "", body?.Place ?? "", body?.Instructions);
                var data = await repo.LoadAsync();
                return Results.Json(StoreSanitizer.VisibleTo(data, actor), JsonDefaults.Options);
            }
            catch (UnauthorizedAccessException)
            {
                return Results.Json(new { error = "You are not allowed to schedule interviews." }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });

        app.MapPost("/api/enrollment/teachers/import", async (
            HttpRequest request,
            IHirayaRepository repo,
            EnrollmentService enroll) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null) return Results.Unauthorized();
            try
            {
                await enroll.ImportApprovedTeachersAsync(actor);
                var data = await repo.LoadAsync();
                return Results.Json(StoreSanitizer.VisibleTo(data, actor), JsonDefaults.Options);
            }
            catch (UnauthorizedAccessException)
            {
                return Results.Json(new { error = "You are not allowed to import approved teachers." }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });

        app.MapPost("/api/enrollment/applications/delete", async (
            DeleteApplicationsBody? body,
            HttpRequest request,
            IHirayaRepository repo,
            EnrollmentService enroll) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null) return Results.Unauthorized();
            try
            {
                await enroll.DeleteApplicationsAsync(body?.Ids ?? [], actor);
                var data = await repo.LoadAsync();
                return Results.Json(StoreSanitizer.VisibleTo(data, actor), JsonDefaults.Options);
            }
            catch (UnauthorizedAccessException)
            {
                return Results.Json(new { error = "You are not allowed to delete applications." }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });

        app.MapPost("/api/enrollment/applications/{id}/cancel", async (
            string id,
            HttpRequest request,
            IHirayaRepository repo,
            EnrollmentService enroll) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null) return Results.Unauthorized();
            try
            {
                await enroll.CancelApplicationAsync(id, actor);
                var data = await repo.LoadAsync();
                return Results.Json(StoreSanitizer.VisibleTo(data, actor), JsonDefaults.Options);
            }
            catch (UnauthorizedAccessException)
            {
                return Results.Json(new { error = "You are not allowed to cancel enrollment applications." }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });
    }
}

public sealed class ApproveEnrollmentBody
{
    public string? ClassId { get; set; }
}

public sealed class InterviewBody
{
    public string When { get; set; } = "";
    public string Place { get; set; } = "";
    public string? Instructions { get; set; }
}

public sealed class DeleteApplicationsBody
{
    public List<string> Ids { get; set; } = new();
}
