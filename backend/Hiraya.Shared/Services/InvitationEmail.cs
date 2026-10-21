namespace Hiraya.Shared.Services;

public static class InvitationEmail
{
    public static (string Subject, string Text, string Html) ParentActivation(
        string centerName,
        string parentName,
        string activateUrl,
        DateTimeOffset expiresAt,
        bool reset,
        HirayaEmailContact? contact = null)
    {
        var center = Center(centerName);
        var name = string.IsNullOrWhiteSpace(parentName) ? "there" : parentName.Trim();
        var when = expiresAt.ToLocalTime().ToString("MMM d, yyyy h:mm tt");
        var subject = reset
            ? $"{center} · Reset your parent portal access"
            : $"{center} · Activate your parent portal account";
        var headline = reset ? "Reset your parent portal access" : "Activate your parent portal account";
        var intro = reset
            ? $"Hello {name}. An administrator reset access for your parent portal account. Create a new password with the button below. This message does not contain a password."
            : $"Hello {name}. An administrator created a parent portal account for you. Activate it by creating a password with the button below. This message does not contain a password.";
        var message = new HirayaEmailMessage
        {
            CenterName = center,
            Headline = headline,
            Intro = intro,
            Rows =
            [
                new("Parent", name),
                new("Status", reset ? "Password reset requested" : "Waiting for activation"),
                new("Link expires", when)
            ],
            ActionLabel = reset ? "Create a new password" : "Activate your account",
            ActionUrl = string.IsNullOrWhiteSpace(activateUrl) ? null : activateUrl.Trim(),
            Contact = contact
        };
        return (subject, HirayaEmailLayout.Plain(message), HirayaEmailLayout.Html(message));
    }

    public static (string Subject, string Text, string Html) EnrollmentAccepted(
        string centerName,
        string parentName,
        string studentName,
        string program,
        string? activateUrl,
        DateTimeOffset? expiresAt,
        bool needsActivation = false,
        HirayaEmailContact? contact = null)
    {
        var center = Center(centerName);
        var parent = string.IsNullOrWhiteSpace(parentName) ? "there" : parentName.Trim();
        var student = string.IsNullOrWhiteSpace(studentName) ? "your child" : studentName.Trim();
        var lane = string.IsNullOrWhiteSpace(program) ? "" : program.Trim();
        var subject = $"{center} · Enrollment accepted for {student}";
        var intro = needsActivation
            ? $"Hello {parent}. {student}'s enrollment application has been accepted. This is not a payment receipt. Tuition is still paid at the learning center."
            : $"Hello {parent}. {student}'s enrollment application has been accepted. This is not a payment receipt. Tuition is still paid at the learning center, and you can sign in with the parent account you already use.";
        var when = expiresAt.HasValue
            ? expiresAt.Value.ToLocalTime().ToString("MMM d, yyyy h:mm tt")
            : "";
        var rows = new List<HirayaEmailRow>
        {
            new("Parent", parent),
            new("Student", student),
            new("Program", lane),
            new("Status", "Accepted. Tuition is still due at the center.")
        };
        if (needsActivation)
            rows.Add(new("Next step", string.IsNullOrWhiteSpace(activateUrl)
                ? "A one-time password link is still being prepared. You cannot sign in until that link is sent."
                : "Set your parent portal password with the button below. The link does not contain a password."));
        if (!string.IsNullOrWhiteSpace(when))
            rows.Add(new("Link expires", when));

        var message = new HirayaEmailMessage
        {
            CenterName = center,
            Headline = "Enrollment accepted",
            Intro = intro,
            Rows = rows,
            ActionLabel = string.IsNullOrWhiteSpace(activateUrl) ? null : "Set your parent portal password",
            ActionUrl = string.IsNullOrWhiteSpace(activateUrl) ? null : activateUrl.Trim(),
            Contact = contact
        };
        return (subject, HirayaEmailLayout.Plain(message), HirayaEmailLayout.Html(message));
    }

    public static (string Subject, string Text, string Html) PortalReady(
        string centerName,
        string recipientName,
        bool teacher,
        string loginEmail,
        string? password,
        string apkUrl,
        string? studentName,
        string? program,
        HirayaEmailContact? contact = null)
    {
        var center = Center(centerName);
        var name = string.IsNullOrWhiteSpace(recipientName) ? "there" : recipientName.Trim();
        var subject = teacher
            ? $"{center} · Your teacher account is ready"
            : $"{center} · Enrollment accepted";
        var intro = teacher
            ? $"Hello {name}. Your teacher application was approved. Sign in on the Hiraya phone app with the account below, then install the app from the link."
            : $"Hello {name}. The enrollment was accepted. This is not a payment receipt. Tuition is still paid at the learning center. Sign in on the Hiraya phone app with the account below, then install the app from the link.";
        var rows = new List<HirayaEmailRow>
        {
            new(teacher ? "Teacher" : "Parent", name),
            new("Sign-in email", loginEmail.Trim()),
            new("Password", string.IsNullOrWhiteSpace(password) ? "Use the password you already have." : password.Trim()),
            new("Phone app", apkUrl.Trim())
        };
        if (!teacher && !string.IsNullOrWhiteSpace(studentName))
            rows.Insert(1, new HirayaEmailRow("Student", studentName.Trim()));
        if (!string.IsNullOrWhiteSpace(program))
            rows.Add(new HirayaEmailRow("Program", program.Trim()));
        var message = new HirayaEmailMessage
        {
            CenterName = center,
            Headline = teacher ? "Your teacher account is ready" : "Enrollment accepted",
            Intro = intro,
            Rows = rows,
            ActionLabel = "Install the phone app",
            ActionUrl = apkUrl.Trim(),
            Contact = contact
        };
        return (subject, HirayaEmailLayout.Plain(message), HirayaEmailLayout.Html(message));
    }

    public static (string Subject, string Text, string Html) TeacherInterview(
        string centerName,
        string applicantName,
        string when,
        string place,
        string instructions,
        HirayaEmailContact? contact = null)
    {
        var center = Center(centerName);
        var name = string.IsNullOrWhiteSpace(applicantName) ? "there" : applicantName.Trim();
        var subject = $"{center} · Interview scheduled";
        var message = new HirayaEmailMessage
        {
            CenterName = center,
            Headline = "Interview scheduled",
            Intro = $"Hello {name}. Your teacher application is now at the interview stage. This is not a job offer.",
            Rows =
            [
                new("Applicant", name),
                new("When", when),
                new("Where", place),
                new("Instructions", instructions),
                new("Status", "Interview scheduled. Not accepted yet.")
            ],
            Contact = contact
        };
        return (subject, HirayaEmailLayout.Plain(message), HirayaEmailLayout.Html(message));
    }

    public static (string Subject, string Text, string Html) ApplicationReceived(
        string centerName,
        string applicantName,
        string subjectLine,
        string body,
        HirayaEmailContact? contact = null)
    {
        var center = Center(centerName);
        var name = string.IsNullOrWhiteSpace(applicantName) ? "there" : applicantName.Trim();
        var line = string.IsNullOrWhiteSpace(subjectLine) ? "we received your application" : subjectLine.Trim();
        var headline = char.ToUpperInvariant(line[0]) + line[1..];
        var subject = $"{center} · {headline}";
        var message = new HirayaEmailMessage
        {
            CenterName = center,
            Headline = headline,
            Intro = $"Hello {name}. {body.Trim()} This message is not an acceptance.",
            Rows =
            [
                new("Applicant", name),
                new("Status", "Waiting for review")
            ],
            Contact = contact
        };
        return (subject, HirayaEmailLayout.Plain(message), HirayaEmailLayout.Html(message));
    }

    private static string Center(string? centerName) =>
        string.IsNullOrWhiteSpace(centerName) ? "Hiraya Kids Learning Center" : centerName.Trim();
}
