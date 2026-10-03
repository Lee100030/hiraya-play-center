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
        var center = string.IsNullOrWhiteSpace(centerName) ? "Hiraya Kids Learning Center" : centerName.Trim();
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

    public static (string Subject, string Text, string Html) EnrollmentAccepted(
        string centerName,
        string parentName,
        string studentName,
        string program,
        string? activateUrl,
        DateTimeOffset? expiresAt,
        bool needsActivation = false)
    {
        var center = string.IsNullOrWhiteSpace(centerName) ? "Hiraya Kids Learning Center" : centerName.Trim();
        var parent = string.IsNullOrWhiteSpace(parentName) ? "there" : parentName.Trim();
        var student = string.IsNullOrWhiteSpace(studentName) ? "your child" : studentName.Trim();
        var lane = string.IsNullOrWhiteSpace(program) ? "the selected program" : program.Trim();
        var subject = $"{center}: enrollment accepted for {student}";
        var status =
            $"{student}'s enrollment application has been accepted for {lane}. " +
            "This is not a payment receipt. Tuition is still paid at the learning center, and the remaining balance is tuition minus approved payments.";
        var next = needsActivation
            ? (string.IsNullOrWhiteSpace(activateUrl)
                ? "Next step: a parent portal account was created and is waiting for a one-time password setup link. This email does not include a password. You cannot sign in until that link is sent from the public site address."
                : "Next step: set your parent portal password with the one-time link below. The link does not contain a password.")
            : "Next step: sign in to the parent portal with the account you already use. You will see only your own child or children.";
        var when = expiresAt.HasValue
            ? $"This link can be used once and expires on {expiresAt.Value.ToLocalTime():MMM d, yyyy h:mm tt}."
            : "";
        var text =
            $"Hello {parent},\n\n{status}\n\nParent: {parent}\nStudent: {student}\nProgram: {lane}\nStatus: accepted, payment still due at the center\n\n{next}\n" +
            (string.IsNullOrWhiteSpace(activateUrl) ? "" : $"\n{activateUrl}\n{when}\n") +
            $"\nIf you did not expect this message, contact {center}.\n";
        var link = string.IsNullOrWhiteSpace(activateUrl)
            ? ""
            : $"<p><a href=\"{System.Net.WebUtility.HtmlEncode(activateUrl)}\">Set your parent portal password</a></p>" +
              $"<p>{System.Net.WebUtility.HtmlEncode(when)}</p>";
        var html =
            $"<p>Hello {System.Net.WebUtility.HtmlEncode(parent)},</p>" +
            $"<p>{System.Net.WebUtility.HtmlEncode(status)}</p>" +
            "<ul>" +
            $"<li>Parent: {System.Net.WebUtility.HtmlEncode(parent)}</li>" +
            $"<li>Student: {System.Net.WebUtility.HtmlEncode(student)}</li>" +
            $"<li>Program: {System.Net.WebUtility.HtmlEncode(lane)}</li>" +
            "<li>Status: accepted, payment still due at the center</li>" +
            "</ul>" +
            $"<p>{System.Net.WebUtility.HtmlEncode(next)}</p>" +
            link +
            $"<p>If you did not expect this message, contact {System.Net.WebUtility.HtmlEncode(center)}.</p>";
        return (subject, text, html);
    }

    public static (string Subject, string Text, string Html) TeacherInterview(
        string centerName,
        string applicantName,
        string when,
        string place,
        string instructions)
    {
        var center = string.IsNullOrWhiteSpace(centerName) ? "Hiraya Kids Learning Center" : centerName.Trim();
        var name = string.IsNullOrWhiteSpace(applicantName) ? "there" : applicantName.Trim();
        var subject = $"{center}: interview scheduled";
        var body =
            $"Your teacher application is now at the interview stage. This is not a job offer.\n\n" +
            $"Applicant: {name}\nWhen: {when}\nWhere: {place}\n{instructions}";
        var text = $"Hello {name},\n\n{body}\n\nIf you did not apply, contact {center}.\n";
        var html =
            $"<p>Hello {System.Net.WebUtility.HtmlEncode(name)},</p>" +
            $"<p>{System.Net.WebUtility.HtmlEncode("Your teacher application is now at the interview stage. This is not a job offer.")}</p>" +
            "<ul>" +
            $"<li>Applicant: {System.Net.WebUtility.HtmlEncode(name)}</li>" +
            $"<li>When: {System.Net.WebUtility.HtmlEncode(when)}</li>" +
            $"<li>Where: {System.Net.WebUtility.HtmlEncode(place)}</li>" +
            $"</ul><p>{System.Net.WebUtility.HtmlEncode(instructions)}</p>" +
            $"<p>If you did not apply, contact {System.Net.WebUtility.HtmlEncode(center)}.</p>";
        return (subject, text, html);
    }

    public static (string Subject, string Text, string Html) ApplicationReceived(
        string centerName,
        string applicantName,
        string subjectLine,
        string body)
    {
        var center = string.IsNullOrWhiteSpace(centerName) ? "Hiraya Kids Learning Center" : centerName.Trim();
        var name = string.IsNullOrWhiteSpace(applicantName) ? "there" : applicantName.Trim();
        var subject = $"{center}: {subjectLine}";
        var text = $"Hello {name},\n\n{body}\n\nThis message is not an acceptance.\nIf you did not submit this, contact {center}.\n";
        var html =
            $"<p>Hello {System.Net.WebUtility.HtmlEncode(name)},</p>" +
            $"<p>{System.Net.WebUtility.HtmlEncode(body)}</p>" +
            "<p>This message is not an acceptance.</p>" +
            $"<p>If you did not submit this, contact {System.Net.WebUtility.HtmlEncode(center)}.</p>";
        return (subject, text, html);
    }
}
