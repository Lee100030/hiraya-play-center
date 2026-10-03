using Hiraya.Shared.Models;
using Microsoft.Extensions.Logging;

namespace Hiraya.Shared.Services;

public sealed record SessionParentMail(string To, string Subject, string Text, string Html);

public static class SessionNoticeMail
{
    private static readonly AsyncLocal<List<SessionParentMail>?> Pending = new();

    public static void Begin() => Pending.Value = [];

    public static void Clear() => Pending.Value = null;

    public static void QueueSessionChanges(HirayaDatabase before, HirayaDatabase after)
    {
        WorkflowOps.EnsureLists(before);
        WorkflowOps.EnsureLists(after);
        var studentIds = before.SessionPackages.Select(p => p.StudentId)
            .Concat(after.SessionPackages.Select(p => p.StudentId))
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.OrdinalIgnoreCase);

        foreach (var studentId in studentIds)
        {
            var prior = PackageFor(before, studentId);
            var next = PackageFor(after, studentId);
            if (SameBalance(prior, next))
                continue;
            Notify(after, studentId, prior, next);
        }
    }

    public static List<SessionParentMail> Take()
    {
        var pending = Pending.Value ?? [];
        Pending.Value = null;
        return pending;
    }

    public static async Task SendAsync(IReadOnlyList<SessionParentMail> pending, IEmailSender email, ILogger logger, CancellationToken ct = default)
    {
        if (pending.Count == 0 || !email.IsConfigured)
            return;
        foreach (var mail in pending)
        {
            try
            {
                await email.SendAsync(mail.To, mail.Subject, mail.Text, mail.Html, ct: ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not email a session notice to {To}.", mail.To);
            }
        }
    }

    public static Task SendPendingAsync(IEmailSender email, ILogger logger, CancellationToken ct = default) =>
        SendAsync(Take(), email, logger, ct);

    private static void Notify(HirayaDatabase db, string studentId, SessionPackage? prior, SessionPackage? next)
    {
        var student = db.Students.FirstOrDefault(s => string.Equals(s.StudentId, studentId, StringComparison.OrdinalIgnoreCase));
        var child = ChildName(student);
        var program = ProgramName(db, next?.ProgramId ?? prior?.ProgramId);
        var copy = Describe(child, prior, next);
        var center = string.IsNullOrWhiteSpace(db.Settings.CenterName)
            ? "Hiraya Kids Learning Center"
            : db.Settings.CenterName.Trim();
        var package = next ?? prior;
        var message = new HirayaEmailMessage
        {
            CenterName = center,
            Headline = copy.Headline,
            Intro = copy.Intro,
            Rows =
            [
                new("Student", child),
                new("Program", program),
                new("Status", StatusLabel(next?.Status ?? prior?.Status)),
                new("Total sessions", package is null ? "" : package.TotalSessions.ToString()),
                new("Used sessions", package is null ? "" : package.UsedSessions.ToString()),
                new("Sessions left", package is null ? "0" : Math.Max(0, package.RemainingSessions).ToString()),
                new("Start date", next?.StartDate ?? prior?.StartDate),
                new("Expiration", next?.ExpirationDate ?? prior?.ExpirationDate)
            ],
            Reference = package?.PackageId,
            ActionLabel = "View sessions",
            ActionUrl = HirayaEmailLayout.PublicUrl(db.Settings.Website),
            Contact = HirayaEmailLayout.ContactFrom(db.Settings)
        };
        var subject = $"{center} · {copy.Headline}";
        var text = HirayaEmailLayout.Plain(message);
        var html = HirayaEmailLayout.Html(message);

        foreach (var parent in Parents(db, student))
        {
            NotificationService.Push(db, parent.UserId, copy.Intro, NotificationKinds.Session, copy.Title, "/sessions");
            var alert = db.Alerts.LastOrDefault(a => string.Equals(a.RecipientId, parent.UserId, StringComparison.OrdinalIgnoreCase));
            if (alert != null)
                alert.RelatedRecordId = package?.PackageId ?? studentId;
            if (Pending.Value is not null && TryDeliveryAddress(parent, out var to))
                Pending.Value.Add(new SessionParentMail(to, subject, text, html));
        }
    }

    private static (string Title, string Headline, string Intro) Describe(string child, SessionPackage? prior, SessionPackage? next)
    {
        if (next is null)
        {
            var suspended = string.Equals(prior?.Status, SessionPackageStatuses.Suspended, StringComparison.OrdinalIgnoreCase);
            return suspended
                ? ("Session package suspended", "The session package is suspended", $"{child}'s session package is suspended, so sessions are not being used.")
                : ("No session package", "No session package", $"{child} does not have a session package.");
        }

        var left = Math.Max(0, next.RemainingSessions);
        var total = Math.Max(0, next.TotalSessions);
        var status = (next.Status ?? "").Trim().ToLowerInvariant();
        if (status == SessionPackageStatuses.Expired)
            return ("Session package expired", "The session package has expired", $"{child}'s session package has expired. {left} of {total} sessions were still unused.");
        if (left <= 0 || status == SessionPackageStatuses.Completed)
            return ("No sessions left", "No sessions left", $"{child} has used all {total} sessions. None are left.");
        if (left <= 2 || status == SessionPackageStatuses.AlmostFinished)
            return ("Sessions are almost finished", "Sessions are almost finished", $"{child} has {left} of {total} sessions left.");
        if (prior != null && next.UsedSessions > prior.UsedSessions)
            return ("A session was used", "A session was used", $"A session was used for {child}. {left} of {total} sessions are left.");
        if (prior is null)
            return ("Session package added", "A session package was added", $"{child} has a session package of {total} sessions. {left} are left.");
        return ("Session package updated", "The session package was updated", $"{child} now has {left} of {total} sessions left.");
    }

    private static bool SameBalance(SessionPackage? prior, SessionPackage? next)
    {
        if (prior is null && next is null)
            return true;
        if (prior is null || next is null)
            return false;
        return prior.TotalSessions == next.TotalSessions
            && prior.UsedSessions == next.UsedSessions
            && prior.RemainingSessions == next.RemainingSessions
            && string.Equals(prior.Status ?? "", next.Status ?? "", StringComparison.OrdinalIgnoreCase)
            && string.Equals((prior.StartDate ?? "").Trim(), (next.StartDate ?? "").Trim(), StringComparison.Ordinal)
            && string.Equals((prior.ExpirationDate ?? "").Trim(), (next.ExpirationDate ?? "").Trim(), StringComparison.Ordinal)
            && string.Equals(prior.ProgramId ?? "", next.ProgramId ?? "", StringComparison.OrdinalIgnoreCase);
    }

    private static SessionPackage? PackageFor(HirayaDatabase db, string studentId) =>
        db.SessionPackages
            .Where(p => string.Equals(p.StudentId, studentId, StringComparison.OrdinalIgnoreCase) &&
                        !string.Equals(p.Status, SessionPackageStatuses.Suspended, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefault();

    private static IEnumerable<HirayaUser> Parents(HirayaDatabase db, Student? student)
    {
        if (student is null)
            yield break;
        var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(student.ParentId))
            ids.Add(student.ParentId);
        foreach (var link in db.ParentStudents.Where(l => l.IsActive && string.Equals(l.StudentId, student.StudentId, StringComparison.OrdinalIgnoreCase)))
        {
            if (!string.IsNullOrWhiteSpace(link.ParentId))
                ids.Add(link.ParentId);
        }
        foreach (var user in db.Users)
        {
            if (ids.Contains(user.UserId) && user.Role == UserRoles.Parent)
                yield return user;
        }
    }

    private static bool TryDeliveryAddress(HirayaUser user, out string email)
    {
        if (PersonalMailbox.TryNormalize(user.PersonalEmail, out email, out _))
            return true;
        if (PersonalMailbox.TryNormalize(user.Email, out email, out _))
            return true;
        email = "";
        return false;
    }

    private static string ChildName(Student? student)
    {
        if (student is null)
            return "Your child";
        var parts = new[] { student.FirstName, student.MiddleName, student.LastName }.Where(x => !string.IsNullOrWhiteSpace(x));
        var name = string.Join(' ', parts).Trim();
        if (!string.IsNullOrWhiteSpace(name))
            return name;
        return string.IsNullOrWhiteSpace(student.Fullname) ? "Your child" : student.Fullname.Trim();
    }

    private static string ProgramName(HirayaDatabase db, string? programId)
    {
        if (string.IsNullOrWhiteSpace(programId))
            return "";
        var program = db.Programs.FirstOrDefault(p => string.Equals(p.ProgramId, programId, StringComparison.OrdinalIgnoreCase));
        return program is null || string.IsNullOrWhiteSpace(program.Name) ? "" : program.Name.Trim();
    }

    private static string StatusLabel(string? status)
    {
        var value = (status ?? "").Trim().Replace('_', ' ');
        if (value.Length == 0)
            return "";
        return char.ToUpperInvariant(value[0]) + value[1..];
    }
}
