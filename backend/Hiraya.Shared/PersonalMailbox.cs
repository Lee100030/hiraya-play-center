namespace Hiraya.Shared;

public static class PersonalMailbox
{
    public static bool TryNormalize(string? raw, out string email, out string error)
    {
        email = (raw ?? "").Trim();
        error = "";
        if (string.IsNullOrWhiteSpace(email))
        {
            error = "Enter a personal email. The Hiraya account address is only for sign-in.";
            return false;
        }

        var at = email.IndexOf('@');
        if (at <= 0 || at != email.LastIndexOf('@') || at >= email.Length - 1 || email.Contains(' '))
        {
            error = "Enter a valid personal email, for example name@gmail.com.";
            return false;
        }

        var domain = email[(at + 1)..];
        if (!domain.Contains('.') || domain.StartsWith('.') || domain.EndsWith('.') || domain.Contains(".."))
        {
            error = "Enter a valid personal email, for example name@gmail.com.";
            return false;
        }

        if (domain.EndsWith(".local", StringComparison.OrdinalIgnoreCase) ||
            domain.EndsWith(".invalid", StringComparison.OrdinalIgnoreCase) ||
            domain.EndsWith(".test", StringComparison.OrdinalIgnoreCase) ||
            domain.EndsWith(".example", StringComparison.OrdinalIgnoreCase) ||
            domain.Equals("localhost", StringComparison.OrdinalIgnoreCase))
        {
            error = "That address cannot receive mail. Enter their personal email, such as a Gmail address. Hiraya sends the message from its own mailbox.";
            return false;
        }

        email = email.ToLowerInvariant();
        return true;
    }

    public static string KeepOrReplace(string? incoming, string? existing)
    {
        var raw = (incoming ?? "").Trim();
        if (string.IsNullOrWhiteSpace(raw))
            return (existing ?? "").Trim();
        if (!TryNormalize(raw, out var email, out var error))
            throw new InvalidOperationException(error);
        return email;
    }
}
