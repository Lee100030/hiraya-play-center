namespace Hiraya.Shared.Services;

public static class InvitationEmail
{
    public static (string Subject, string Text, string Html) ParentActivation(
        string centerName,
        string parentName,
        string activateUrl,
        DateTimeOffset expiresAt,
        bool reset)
    {
        var center = string.IsNullOrWhiteSpace(centerName) ? "HIRAYA Learning Center" : centerName.Trim();
        var name = string.IsNullOrWhiteSpace(parentName) ? "there" : parentName.Trim();
        var when = expiresAt.ToLocalTime().ToString("MMM d, yyyy h:mm tt");
        var subject = reset
            ? $"{center}: reset your parent portal access"
            : $"{center}: activate your parent portal account";
        var intro = reset
            ? "An administrator reset access for your parent portal account. Create a new password using the link below."
            : "An administrator created a parent portal account for you. Activate it by creating a password using the link below.";
        var text =
            $"Hello {name},\n\n{intro}\n\n{activateUrl}\n\nThis link can be used once and expires on {when}.\nIf you did not expect this message, contact {center}.\n";
        var html =
            $"<p>Hello {System.Net.WebUtility.HtmlEncode(name)},</p>" +
            $"<p>{System.Net.WebUtility.HtmlEncode(intro)}</p>" +
            $"<p><a href=\"{System.Net.WebUtility.HtmlEncode(activateUrl)}\">Activate your account</a></p>" +
            $"<p>This link can be used once and expires on {System.Net.WebUtility.HtmlEncode(when)}.</p>" +
            $"<p>If you did not expect this message, contact {System.Net.WebUtility.HtmlEncode(center)}.</p>";
        return (subject, text, html);
    }
}
