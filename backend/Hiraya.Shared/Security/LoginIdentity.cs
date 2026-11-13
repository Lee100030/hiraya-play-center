namespace Hiraya.Shared.Security;

using Hiraya.Shared.Models;

/// <summary>
/// Phone and desktop sign-in keys. Parents often type hommer@hiraya while the
/// record is username hommer or email hommer@hiraya.local.
/// </summary>
public static class LoginIdentity
{
    public static bool Matches(HirayaUser user, string? login)
    {
        var key = (login ?? "").Trim();
        if (key.Length == 0 || user is null)
            return false;

        if (EqualsKey(user.Email, key) ||
            EqualsKey(user.Username, key) ||
            EqualsKey(user.Fullname, key) ||
            EqualsKey(user.PersonalEmail, key))
            return true;

        var at = key.IndexOf('@');
        if (at <= 0)
            return EmailPrefixMatch(user.Email, key) || EmailPrefixMatch(user.PersonalEmail, key);

        var local = key[..at];
        return EqualsKey(user.Username, local) ||
               EqualsKey(LocalPart(user.Email), local) ||
               EqualsKey(LocalPart(user.PersonalEmail), local) ||
               EmailPrefixMatch(user.Email, key) ||
               EmailPrefixMatch(user.PersonalEmail, key);
    }

    /// <summary>
    /// Prefer the account that can sign in. An inactive loose match must not hide the real username.
    /// </summary>
    public static HirayaUser? Choose(IEnumerable<HirayaUser> users, string? login) =>
        Candidates(users, login).FirstOrDefault();

    /// <summary>
    /// Every account the key could mean, best first. One email can belong to a teacher
    /// and a parent account, so sign-in checks the password against each one.
    /// </summary>
    public static List<HirayaUser> Candidates(IEnumerable<HirayaUser> users, string? login)
    {
        var key = (login ?? "").Trim();
        if (key.Length == 0)
            return new List<HirayaUser>();
        return users
            .Where(user => Matches(user, key))
            .OrderBy(user => Rank(user, key))
            .ThenBy(user => user.UserId, StringComparer.Ordinal)
            .ToList();
    }

    static int Rank(HirayaUser user, string key)
    {
        var exactUsername = EqualsKey(user.Username, key);
        var exactEmail = EqualsKey(user.Email, key) || EqualsKey(user.PersonalEmail, key);
        var canSignIn = AccountStatuses.AllowsPortalLogin(user.Status);
        if (exactUsername && canSignIn) return 0;
        if (exactEmail && canSignIn) return 1;
        if (canSignIn) return 2;
        if (exactUsername) return 3;
        if (exactEmail) return 4;
        return 5;
    }

    public static string LocalPart(string? value)
    {
        var text = (value ?? "").Trim();
        var at = text.IndexOf('@');
        return at > 0 ? text[..at] : text;
    }

    static bool EqualsKey(string? value, string key) =>
        !string.IsNullOrWhiteSpace(value) &&
        string.Equals(value.Trim(), key, StringComparison.OrdinalIgnoreCase);

    static bool EmailPrefixMatch(string? email, string key)
    {
        var stored = (email ?? "").Trim();
        if (stored.Length == 0 || key.Length == 0)
            return false;
        if (!stored.Contains('@', StringComparison.Ordinal))
            return false;
        if (string.Equals(stored, key, StringComparison.OrdinalIgnoreCase))
            return true;
        return stored.StartsWith(key + ".", StringComparison.OrdinalIgnoreCase);
    }
}
