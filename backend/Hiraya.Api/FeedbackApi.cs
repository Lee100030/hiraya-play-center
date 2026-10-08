using Hiraya.Shared.Models;
using Hiraya.Shared.Services;
using Hiraya.Shared.Services.Firebase;

namespace Hiraya.Api;

public class ParentFeedbackRequest
{
    /// <summary>center | teacher</summary>
    public string TargetType { get; set; } = "center";
    public string TeacherId { get; set; } = "";
    public int Rating { get; set; }
    public string Message { get; set; } = "";
}

public static class FeedbackApi
{
    public const string BrandName = "Hiraya Kids Learning Center";

    public static void Map(WebApplication app)
    {
        app.MapPost("/api/feedback", async (
            ParentFeedbackRequest body,
            HttpRequest request,
            IHirayaRepository repo) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            if (!UserRoles.IsParent(actor.Role))
                return Results.Json(new { error = "Only parents can send this feedback." }, statusCode: StatusCodes.Status403Forbidden);

            try
            {
                await SubmitAsync(body ?? new ParentFeedbackRequest(), actor, repo);
                return Results.Json(new { ok = true });
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
        });
    }

    private static async Task SubmitAsync(ParentFeedbackRequest input, HirayaUser actor, IHirayaRepository repo)
    {
        var message = (input.Message ?? "").Trim();
        if (message.Length < 3)
            throw new InvalidOperationException("Write a short message so we know how to help.");

        var targetType = (input.TargetType ?? "center").Trim().ToLowerInvariant();
        if (targetType is not ("center" or "teacher"))
            throw new InvalidOperationException("Choose the center or a teacher.");

        var rating = Math.Clamp(input.Rating, 0, 5);

        await repo.MutateAsync(async db =>
        {
            FamilyAccess.EnsureLegacyLinks(db);
            var parentName = DisplayName(actor);
            var recipients = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            string title;
            string body;

            if (targetType == "center")
            {
                title = "Center feedback";
                body = rating > 0
                    ? $"{parentName} rated {BrandName} {rating}/5:\n{message}"
                    : $"{parentName} sent feedback for {BrandName}:\n{message}";
                foreach (var admin in db.Users.Where(u => UserRoles.IsAdmin(u.Role) && IsActive(u)))
                    recipients.Add(admin.UserId);
            }
            else
            {
                var teacherId = (input.TeacherId ?? "").Trim();
                var teacher = db.Users.FirstOrDefault(u =>
                    string.Equals(u.UserId, teacherId, StringComparison.OrdinalIgnoreCase) &&
                    (u.Role == UserRoles.Teacher || u.Role == UserRoles.Staff))
                    ?? throw new InvalidOperationException("Select a teacher.");
                if (!TeacherLinkedToParent(db, actor, teacher.UserId))
                    throw new UnauthorizedAccessException("That teacher is not linked to your children.");

                var teacherName = DisplayName(teacher);
                title = "Teacher feedback";
                body = rating > 0
                    ? $"{parentName} rated {teacherName} {rating}/5:\n{message}"
                    : $"{parentName} sent feedback for {teacherName}:\n{message}";
                recipients.Add(teacher.UserId);
                foreach (var admin in db.Users.Where(u => UserRoles.IsAdmin(u.Role) && IsActive(u)))
                    recipients.Add(admin.UserId);
            }

            if (recipients.Count == 0)
                throw new InvalidOperationException("No one is available to receive this feedback yet.");

            NotificationService.PushToUsers(
                db,
                recipients,
                body,
                NotificationKinds.Announcement,
                title,
                "feedback");

            AuditService.Append(db, actor, AuditModules.Announcements, "feedback",
                targetType, input.TeacherId ?? "", $"Parent feedback ({targetType}) from {parentName}.");
            await Task.CompletedTask;
        });
    }

    private static bool TeacherLinkedToParent(HirayaDatabase db, HirayaUser parent, string teacherId)
    {
        var kids = FamilyAccess.AuthorizedStudentIds(db, parent);
        if (kids.Count == 0) return false;
        foreach (var enrollment in db.Enrollments.Where(e => kids.Contains(e.StudentId)))
        {
            var status = (enrollment.Status ?? "").ToLowerInvariant();
            if (status is not ("active" or "pending" or "approved")) continue;
            if (string.Equals(enrollment.TeacherId, teacherId, StringComparison.OrdinalIgnoreCase))
                return true;
            var cls = db.Classes.FirstOrDefault(c => c.ClassId == enrollment.ClassId);
            if (cls != null && string.Equals(cls.TeacherId, teacherId, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        foreach (var schedule in db.Schedules.Where(s => kids.Contains(s.StudentId)))
        {
            foreach (var id in NotificationService.PackedIds(schedule.TeacherId))
            {
                if (string.Equals(id, teacherId, StringComparison.OrdinalIgnoreCase))
                    return true;
            }
        }
        return false;
    }

    private static bool IsActive(HirayaUser user)
    {
        var status = (user.Status ?? "active").Trim().ToLowerInvariant();
        return status is "active" or "pending";
    }

    private static string DisplayName(HirayaUser user)
    {
        var parts = new[] { user.FirstName, user.MiddleName, user.LastName }
            .Where(x => !string.IsNullOrWhiteSpace(x));
        var name = string.Join(' ', parts).Trim();
        if (!string.IsNullOrWhiteSpace(name)) return name;
        if (!string.IsNullOrWhiteSpace(user.Fullname)) return user.Fullname.Trim();
        return user.Email?.Trim() ?? user.UserId;
    }
}
