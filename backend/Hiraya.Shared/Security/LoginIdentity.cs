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
