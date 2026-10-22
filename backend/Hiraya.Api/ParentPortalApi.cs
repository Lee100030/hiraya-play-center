using Hiraya.Shared.Models;
using Hiraya.Shared.Services;
using Hiraya.Shared.Services.Firebase;
using Hiraya.Shared.Security;
using Microsoft.Extensions.DependencyInjection;

namespace Hiraya.Api;

public static class ParentPortalApi
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/parent/profile", async (HttpRequest request, IHirayaRepository repo) =>
        {
            var actor = await ActorAsync(request, repo);
            if (actor is null)
                return SessionExpired();
            if (!UserRoles.IsParent(actor.Role))
                return Forbidden("This parent page is only for parent accounts.");
            return Results.Json(StoreSanitizer.PublicCopy(new HirayaDatabase { Users = [actor] }).Users[0], JsonDefaults.Options);
        });

        app.MapGet("/api/parent/children", async (HttpRequest request, IHirayaRepository repo) =>
        {
            var actor = await ActorAsync(request, repo);
            if (actor is null)
                return SessionExpired();
            if (!UserRoles.IsParent(actor.Role))
                return Forbidden("This parent page is only for parent accounts.");
            var db = await repo.LoadAsync();
            var parentId = request.Query["parentId"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(parentId) &&
                !string.Equals(parentId, actor.UserId, StringComparison.OrdinalIgnoreCase))
                return Forbidden("You can only view your own children.");
            return Results.Json(FamilyPortal.VisibleStudents(db, actor), JsonDefaults.Options);
        });

        app.MapGet("/api/parent/children/{studentId}", async (string studentId, HttpRequest request, IHirayaRepository repo) =>
            await ChildResourceAsync(request, repo, studentId, db =>
            {
                var student = db.Students.FirstOrDefault(s => s.StudentId == studentId);
                return student is null ? Results.NotFound() : Results.Json(FamilyPortal.ForFamilyView(student), JsonDefaults.Options);
            }));

        app.MapGet("/api/parent/children/{studentId}/attendance", async (string studentId, HttpRequest request, IHirayaRepository repo) =>
            await ChildResourceAsync(request, repo, studentId, db =>
                Results.Json(db.Attendance.Where(a => a.StudentId == studentId && a.Kind != AttendanceKinds.Employee).ToList(), JsonDefaults.Options)));

        app.MapGet("/api/parent/children/{studentId}/progress", async (string studentId, HttpRequest request, IHirayaRepository repo) =>
            await ChildResourceAsync(request, repo, studentId, (db, actor) =>
                Results.Json(ProgressService.Visible(db, actor).Where(r => r.StudentId == studentId).ToList(), JsonDefaults.Options)));

        app.MapGet("/api/parent/children/{studentId}/schedule", async (string studentId, HttpRequest request, IHirayaRepository repo) =>
            await ChildResourceAsync(request, repo, studentId, (db, actor) =>
                Results.Json(FamilyPortal.FamilyCalendar(db, actor, studentId), JsonDefaults.Options)));

        app.MapGet("/api/parent/children/{studentId}/payments", async (string studentId, HttpRequest request, IHirayaRepository repo) =>
            await ChildResourceAsync(request, repo, studentId, (db, actor) =>
                Results.Json(PaymentService.Visible(db, actor).Where(p => PaymentService.ResolveStudentId(db, p) == studentId).ToList(), JsonDefaults.Options)));

        app.MapPost("/api/parent/children", () =>
            Forbidden("Children are linked by the center. Ask Hiraya staff to connect your child to this parent account."));
        app.MapDelete("/api/parent/children/{studentId}", (string studentId) =>
            Forbidden("Children cannot be removed from the phone app. Ask Hiraya staff if a child should be unlinked."));

        app.MapGet("/api/parents/{parentId}/children", async (string parentId, HttpRequest request, IHirayaRepository repo) =>
        {
            var actor = await ActorAsync(request, repo);
            if (actor is null)
                return SessionExpired();
            if (!Navigation.CanManageStudents(actor.Role))
                return Forbidden("Only the center can look up another family's children.");
            var db = await repo.LoadAsync();
            var parent = db.Users.FirstOrDefault(u => u.UserId == parentId && UserRoles.IsParent(u.Role));
            if (parent is null)
                return Results.NotFound();
            return Results.Json(FamilyPortal.VisibleStudents(db, parent), JsonDefaults.Options);
        });

        app.MapPost("/api/admin/parents", async (ParentCreateRequest body, HttpRequest request, IHirayaRepository repo, ParentAccountService parents) =>
        {
            var actor = await ActorAsync(request, repo);
            if (actor is null)
                return SessionExpired();
            try
            {
                var created = await parents.CreateAsync(body, actor);
                return Results.Json(created, JsonDefaults.Options);
            }
            catch (UnauthorizedAccessException)
            {
                return Forbidden();
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });

        app.MapPut("/api/admin/parents/{parentId}", async (string parentId, ParentCreateRequest body, HttpRequest request, IHirayaRepository repo, ParentAccountService parents) =>
        {
            var actor = await ActorAsync(request, repo);
            if (actor is null)
                return SessionExpired();
            try
            {
                await parents.UpdateProfileAsync(parentId, body, actor);
                if (!string.IsNullOrWhiteSpace(body.Password))
                    await parents.SetPasswordAsync(parentId, body.Password, body.ConfirmPassword, actor, body.AdminPassword);
                var data = await repo.LoadAsync();
                return Results.Json(StoreSanitizer.VisibleTo(data, actor), JsonDefaults.Options);
            }
            catch (UnauthorizedAccessException)
            {
                return Forbidden();
            }
            catch (InvalidOperationException ex)
            {
                return ParentWriteError(ex);
            }
        });

        app.MapPost("/api/admin/parents/{parentId}/update", async (string parentId, ParentCreateRequest body, HttpRequest request, IHirayaRepository repo, ParentAccountService parents) =>
        {
            var actor = await ActorAsync(request, repo);
            if (actor is null)
                return SessionExpired();
            try
            {
                await parents.UpdateProfileAsync(parentId, body, actor);
                if (!string.IsNullOrWhiteSpace(body.Password))
                    await parents.SetPasswordAsync(parentId, body.Password, body.ConfirmPassword, actor, body.AdminPassword);
                var data = await repo.LoadAsync();
                return Results.Json(StoreSanitizer.VisibleTo(data, actor), JsonDefaults.Options);
            }
            catch (UnauthorizedAccessException)
            {
                return Forbidden();
            }
            catch (InvalidOperationException ex)
            {
                return ParentWriteError(ex);
            }
        });

        app.MapPost("/api/admin/parents/{parentId}/active", async (string parentId, ParentActiveBody body, HttpRequest request, IHirayaRepository repo, ParentAccountService parents) =>
        {
            var actor = await ActorAsync(request, repo);
            if (actor is null)
                return SessionExpired();
            try
            {
                await parents.SetActiveAsync(parentId, body.Active, actor);
                var data = await repo.LoadAsync();
                return Results.Json(StoreSanitizer.VisibleTo(data, actor), JsonDefaults.Options);
            }
            catch (UnauthorizedAccessException)
            {
                return Forbidden();
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });

        app.MapDelete("/api/admin/parents/{parentId}", async (string parentId, HttpRequest request, IHirayaRepository repo, ParentAccountService parents) =>
        {
            var actor = await ActorAsync(request, repo);
            if (actor is null)
                return SessionExpired();
            try
            {
                await parents.DeleteAsync(parentId, actor);
                var data = await repo.LoadAsync();
                return Results.Json(StoreSanitizer.VisibleTo(data, actor), JsonDefaults.Options);
            }
            catch (UnauthorizedAccessException)
            {
                return Forbidden();
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });

        app.MapPost("/api/admin/parents/{parentId}/children", async (string parentId, AssignChildBody body, HttpRequest request, IHirayaRepository repo, ParentAccountService parents) =>
        {
            var actor = await ActorAsync(request, repo);
            if (actor is null)
                return SessionExpired();
            try
            {
                await parents.AssignChildAsync(parentId, body.StudentId, body.Relationship, actor);
                return Results.NoContent();
            }
            catch (UnauthorizedAccessException)
            {
                return Forbidden();
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });

        app.MapDelete("/api/admin/parents/{parentId}/children/{studentId}", async (string parentId, string studentId, HttpRequest request, IHirayaRepository repo, ParentAccountService parents) =>
        {
            var actor = await ActorAsync(request, repo);
            if (actor is null)
                return SessionExpired();
            try
            {
                await parents.RemoveChildAsync(parentId, studentId, actor);
                return Results.NoContent();
            }
            catch (UnauthorizedAccessException)
            {
                return Forbidden();
            }
        });

        app.MapPost("/api/auth/activate", async (HttpRequest request, ActivateBody body, ParentAccountService parents, PublicRequestThrottle throttle) =>
        {
            if (!throttle.Allow($"activate:{ClientHost(request)}", 10, TimeSpan.FromMinutes(15)))
                return Results.Json(new { error = "Too many activation attempts. Please wait and try again." }, statusCode: StatusCodes.Status429TooManyRequests);
            try
            {
                await parents.ActivateAsync(body.Token, body.Password, body.ConfirmPassword);
                return Results.NoContent();
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });
    }

    private static async Task<IResult> ChildResourceAsync(
        HttpRequest request,
        IHirayaRepository repo,
        string studentId,
        Func<HirayaDatabase, IResult> ok) =>
        await ChildResourceAsync(request, repo, studentId, (db, _) => ok(db));

    private static async Task<IResult> ChildResourceAsync(
        HttpRequest request,
        IHirayaRepository repo,
        string studentId,
        Func<HirayaDatabase, HirayaUser, IResult> ok)
    {
        var actor = await ActorAsync(request, repo);
        if (actor is null)
            return SessionExpired();
        if (!UserRoles.IsParent(actor.Role))
            return Forbidden("This parent page is only for parent accounts.");
        var db = await repo.LoadAsync();
        if (!FamilyAccess.CanViewStudent(db, actor, studentId))
            return Forbidden("That child is not linked to this parent account.");
        return ok(db, actor);
    }

    internal static async Task<HirayaUser?> ActorAsync(HttpRequest request, IHirayaRepository repo)
    {
        var tokens = request.HttpContext.RequestServices.GetService<SessionTokenOptions>();
        var packed = request.Headers["X-Hiraya-Session"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(packed))
            packed = request.Query["session"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(packed) && request.HasFormContentType)
        {
            try
            {
                var form = await request.ReadFormAsync();
                packed = form["session"].FirstOrDefault();
            }
            catch (InvalidOperationException)
            {
                packed = null;
            }
        }
        var ticket = tokens is null ? null : SessionTokens.TryRead(packed, tokens.Secret);
        if (ticket is null)
            return null;
        SessionGate? gate = null;
        try
        {
            gate = request.HttpContext.RequestServices.GetService<SessionGate>();
        }
        catch
        {
            gate = null;
        }
        try
        {
            if (gate is not null && await gate.IsRevokedAsync(ticket.Jti, request.HttpContext.RequestAborted))
                return null;
        }
        catch
        {
            // Firestore has no Neon revoke table; a failed check must not block a valid session.
        }
        var user = await repo.FindUserAsync(ticket.UserId, null);
        if (user is null || !AccountStatuses.AllowsPortalLogin(user.Status))
            return null;
        if (!string.Equals(ticket.Stamp, SessionTokens.PasswordStamp(user.Password), StringComparison.Ordinal))
            return null;
        return user;
    }

    /// <summary>
    /// Confirms the session token in this process. It does not read Firestore.
    /// </summary>
    internal static async Task<bool> HasSessionAsync(HttpRequest request)
    {
        var tokens = request.HttpContext.RequestServices.GetService<SessionTokenOptions>();
        var packed = request.Headers["X-Hiraya-Session"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(packed))
            packed = request.Query["session"].FirstOrDefault();
        var ticket = tokens is null ? null : SessionTokens.TryRead(packed, tokens.Secret);
        if (ticket is null)
            return false;
        var gate = request.HttpContext.RequestServices.GetService<SessionGate>();
        if (gate is not null && await gate.IsRevokedAsync(ticket.Jti, request.HttpContext.RequestAborted))
            return false;
        return true;
    }

    private static IResult SessionExpired() =>
        Results.Json(new { error = "Your session expired. Sign out and sign in, then save again." }, statusCode: StatusCodes.Status401Unauthorized);

    private static IResult ParentWriteError(InvalidOperationException ex)
    {
        var notFound = ex.Message.Contains("not found", StringComparison.OrdinalIgnoreCase);
        return Results.Json(new { error = ex.Message }, statusCode: notFound ? StatusCodes.Status404NotFound : StatusCodes.Status400BadRequest);
    }

    private static IResult Forbidden(string? message = null) =>
        Results.Json(
            new { error = string.IsNullOrWhiteSpace(message) ? "You do not have access to that on this account." : message },
            statusCode: StatusCodes.Status403Forbidden);

    internal static string ClientHost(HttpRequest request) =>
        request.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    public sealed class AssignChildBody
    {
        public string StudentId { get; set; } = "";
        public string Relationship { get; set; } = FamilyRelationships.Guardian;
    }

    public sealed class ParentActiveBody
    {
        public bool Active { get; set; }
    }

    public sealed class ActivateBody
    {
        public string Token { get; set; } = "";
        public string Password { get; set; } = "";
        public string ConfirmPassword { get; set; } = "";
    }
}
