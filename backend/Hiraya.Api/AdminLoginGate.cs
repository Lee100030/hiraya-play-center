using Hiraya.Shared.Models;
using Hiraya.Shared.Security;
using Hiraya.Shared.Services;
using Hiraya.Shared.Services.Firebase;

namespace Hiraya.Api;

public static class AdminLoginGate
{
    public static void Map(WebApplication app)
    {
        app.MapPost("/api/auth/login/otp", ConfirmAsync);
        app.MapPost("/api/auth/login/otp/resend", ResendAsync);
    }

    public static async Task<IResult> BeginAsync(HirayaUser user, IEmailSender email, LoginOtpChallenges otps, ILogger logger)
    {
        if (!email.IsConfigured)
            return MailUnavailable();
        if (!otps.TryIssue(user.UserId, SessionTokens.PasswordStamp(user.Password), out var challenge, out var code, out var error))
            return Results.Json(new { error }, statusCode: StatusCodes.Status429TooManyRequests);
        return await DeliverAsync(email, otps, logger, challenge, code);
    }

    public static void NotePhoneSignIn(IHirayaRepository repo, HirayaUser whoUser)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                await repo.MutateAsync(async db =>
                {
                    var name = string.IsNullOrWhiteSpace(whoUser.Fullname) ? whoUser.Username : whoUser.Fullname.Trim();
                    var who = string.IsNullOrWhiteSpace(whoUser.Email) ? name : $"{name} ({whoUser.Email})";
                    var message = $"{who} signed in on the phone.";
                    AuditService.Append(db, whoUser, AuditModules.Auth, "login", "user", whoUser.UserId, message);
                    var admins = NotificationService.Recipients(db, NotificationAudiences.Admins);
                    NotificationService.PushToUsers(db, admins.Select(admin => admin.UserId), message, "mobile-login", "Phone sign-in");
                    await Task.CompletedTask;
                });
            }
            catch
            {
                // Phone sign-in must not wait on a full store rewrite.
            }
        });
    }

    private static async Task<IResult> ConfirmAsync(
        LoginOtpBody body,
        HttpRequest request,
        IHirayaRepository repo,
        LoginOtpChallenges otps,
        SessionTokenOptions tokens,
        PublicRequestThrottle throttle)
    {
        var host = ParentPortalApi.ClientHost(request);
        var challenge = (body.Challenge ?? "").Trim();
        if (!throttle.Allow($"login-otp-ip:{host}", 30, TimeSpan.FromMinutes(10)) ||
            (!string.IsNullOrWhiteSpace(challenge) && !throttle.Allow($"login-otp:{challenge}", 12, TimeSpan.FromMinutes(10))))
            return Results.Json(new { error = LoginOtpChallenges.TooMany }, statusCode: StatusCodes.Status429TooManyRequests);

        var problem = otps.Consume(challenge, body.Code ?? "", out var userId, out var stamp);
        if (problem != null)
        {
            var status = problem == LoginOtpChallenges.TooMany
                ? StatusCodes.Status429TooManyRequests
                : StatusCodes.Status400BadRequest;
            return Results.Json(new { error = problem }, statusCode: status);
        }

        var live = string.IsNullOrWhiteSpace(userId) ? null : await repo.FindUserAsync(userId, null);
        if (live is null || !UserRoles.IsAdmin(live.Role) || !AccountStatuses.AllowsPortalLogin(live.Status))
            return Results.Json(new { error = "This account cannot sign in." }, statusCode: StatusCodes.Status401Unauthorized);
        if (!string.Equals(stamp, SessionTokens.PasswordStamp(live.Password), StringComparison.Ordinal))
            return Results.Json(new { error = LoginOtpChallenges.SignInAgain }, statusCode: StatusCodes.Status400BadRequest);

        var fromPhone = string.Equals(body.Client, "mobile", StringComparison.OrdinalIgnoreCase)
                        || string.Equals(request.Headers["X-Hiraya-Client"], "mobile", StringComparison.OrdinalIgnoreCase);
        if (fromPhone)
            NotePhoneSignIn(repo, live);

        var token = SessionTokens.Issue(live.UserId, tokens.Secret, stamp: SessionTokens.PasswordStamp(live.Password));
        return Results.Json(new AuthSession { User = AccountService.ClonePublic(live), Token = token }, JsonDefaults.Options);
    }

    private static async Task<IResult> ResendAsync(
        LoginOtpBody body,
        HttpRequest request,
        IEmailSender email,
        LoginOtpChallenges otps,
        PublicRequestThrottle throttle,
        ILoggerFactory logs)
    {
        var host = ParentPortalApi.ClientHost(request);
        var challenge = (body.Challenge ?? "").Trim();
        if (!throttle.Allow($"login-otp-resend-ip:{host}", 20, TimeSpan.FromMinutes(15)) ||
            (!string.IsNullOrWhiteSpace(challenge) && !throttle.Allow($"login-otp-resend:{challenge}", 6, TimeSpan.FromMinutes(15))))
            return Results.Json(new { error = LoginOtpChallenges.TooMany }, statusCode: StatusCodes.Status429TooManyRequests);
        if (!email.IsConfigured)
            return MailUnavailable();
        if (!otps.TryResend(challenge, out var code, out var error))
        {
            var status = error == LoginOtpChallenges.TooMany
                ? StatusCodes.Status429TooManyRequests
                : StatusCodes.Status400BadRequest;
            return Results.Json(new { error }, statusCode: status);
        }
        return await DeliverAsync(email, otps, logs.CreateLogger("Hiraya.Api"), challenge, code);
    }

    private static async Task<IResult> DeliverAsync(
        IEmailSender email,
        LoginOtpChallenges otps,
        ILogger logger,
        string challenge,
        string code)
    {
        try
        {
            await email.SendAsync(
                LoginOtpChallenges.Mailbox,
                "HIRAYA · Admin sign-in code",
                $"Your Hiraya admin sign-in code is {code}. It expires in 10 minutes. If you did not try to sign in, ignore this message.");
        }
        catch (Exception ex)
        {
            otps.Drop(challenge);
            logger.LogWarning(ex, "Admin sign-in code email failed.");
            return MailUnavailable();
        }

        return Results.Json(new
        {
            otpRequired = true,
            challenge,
            sentTo = LoginOtpChallenges.Mailbox
        }, JsonDefaults.Options);
    }

    private static IResult MailUnavailable() =>
        Results.Json(new { error = LoginOtpChallenges.MailFailed }, statusCode: StatusCodes.Status503ServiceUnavailable);

    public sealed class LoginOtpBody
    {
        public string? Challenge { get; set; }
        public string? Code { get; set; }
        public string? Client { get; set; }
    }
}
