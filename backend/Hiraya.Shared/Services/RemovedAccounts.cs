using Hiraya.Shared.Models;

namespace Hiraya.Shared.Services;

/// <summary>
/// Remembers permanently deleted accounts so an older desktop or website copy cannot restore them.
/// </summary>
public static class RemovedAccounts
{
    public static void Remember(HirayaDatabase db, string? userId) =>
        RememberToken(db, (userId ?? "").Trim());

    public static void Remember(HirayaDatabase db, HirayaUser user)
    {
        Remember(db, user.UserId);
        RememberToken(db, MailToken(user.Email));
        RememberToken(db, MailToken(user.PersonalEmail));
        RememberToken(db, NameToken(user.Fullname));
    }

    /// <summary>
    /// A deleted teacher must not be hired again from the same application, even with a new id.
    /// </summary>
    public static bool BlocksImport(HirayaDatabase db, string? userId, string? email, string? name)
    {
        var ids = Ids(db);
        if (ids.Count == 0)
            return false;
        var linked = (userId ?? "").Trim();
        if (linked.Length > 0 && ids.Contains(linked))
            return true;
        var mail = MailToken(email);
        if (mail.Length > 0 && ids.Contains(mail))
            return true;
        var person = NameToken(name);
        return person.Length > 0 && ids.Contains(person);
    }

    public static bool BlocksIdentity(HirayaDatabase db, string? userId, string? email, string? personalEmail)
    {
        var ids = Ids(db);
        if (ids.Count == 0)
            return false;
        var linked = (userId ?? "").Trim();
        if (linked.Length > 0 && ids.Contains(linked))
            return true;
        var mail = MailToken(email);
        if (mail.Length > 0 && ids.Contains(mail))
            return true;
        var personal = MailToken(personalEmail);
        return personal.Length > 0 && ids.Contains(personal);
    }

    public static void Preserve(CenterSettings? previous, CenterSettings? next)
    {
        if (next is null)
            return;
        var ids = Parse(previous?.RemovedUserIds);
        foreach (var id in Parse(next.RemovedUserIds))
            ids.Add(id);
        next.RemovedUserIds = string.Join(",", ids);
    }

    public static void Strip(HirayaDatabase db)
    {
        db.Settings ??= new CenterSettings();
        var ids = Parse(db.Settings.RemovedUserIds);
        if (ids.Count == 0)
            return;
        var gone = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var user in db.Users)
        {
            if (ids.Contains(user.UserId ?? "") ||
                ids.Contains(MailToken(user.Email)) ||
                ids.Contains(MailToken(user.PersonalEmail)))
                gone.Add(user.UserId ?? "");
        }
        foreach (var id in ids)
        {
            if (!id.StartsWith("mail:", StringComparison.OrdinalIgnoreCase) &&
                !id.StartsWith("name:", StringComparison.OrdinalIgnoreCase))
                gone.Add(id);
        }
        gone.Remove("");
        db.EnrollmentApplications.RemoveAll(app =>
            string.Equals(app.ApplicationKind, "teacher", StringComparison.OrdinalIgnoreCase) &&
            BlocksImport(db, app.StudentNumber, app.ParentEmail, app.StudentFullname));
        if (gone.Count == 0)
            return;
        db.Users.RemoveAll(user => gone.Contains(user.UserId ?? ""));
        db.TeacherProfiles.RemoveAll(profile => gone.Contains(profile.UserId ?? ""));
    }

    private static void RememberToken(HirayaDatabase db, string token)
    {
        if (token.Length == 0)
            return;
        db.Settings ??= new CenterSettings();
        var ids = Parse(db.Settings.RemovedUserIds);
        if (!ids.Add(token))
            return;
        db.Settings.RemovedUserIds = string.Join(",", ids);
        db.Settings.UpdatedAt = DateTime.UtcNow.ToString("o");
    }

    private static HashSet<string> Ids(HirayaDatabase db) => Parse(db.Settings?.RemovedUserIds);

    private static string MailToken(string? email)
    {
        var mail = (email ?? "").Trim().ToLowerInvariant();
        return mail.Length == 0 ? "" : "mail:" + mail;
    }

    private static string NameToken(string? name)
    {
        var person = System.Text.RegularExpressions.Regex.Replace((name ?? "").Replace(',', ' ').Trim().ToLowerInvariant(), @"\s+", " ");
        return person.Length < 2 ? "" : "name:" + person;
    }

    private static HashSet<string> Parse(string? packed)
    {
        var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var part in (packed ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (part.Length > 0)
                ids.Add(part);
        }
        return ids;
    }
}
