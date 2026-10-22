using Hiraya.Shared;
using Hiraya.Shared.Models;
using Hiraya.Shared.Security;
using Hiraya.Shared.Services.Firebase;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Hiraya.Shared.Services;

public class ParentCreateRequest
{
    public string FirstName { get; set; } = "";
    public string MiddleName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Email { get; set; } = "";
    public string PersonalEmail { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Address { get; set; } = "";
    public string Notes { get; set; } = "";
    public string Password { get; set; } = "";
    public string ConfirmPassword { get; set; } = "";
    public string AdminPassword { get; set; } = "";
    public string Relationship { get; set; } = FamilyRelationships.Guardian;
    public string? StudentId { get; set; }
}

public class ParentInviteResult
{
    public HirayaUser Parent { get; init; } = new();
    public string Token { get; init; } = "";
    public string ExpiresAt { get; init; } = "";
    public string ActivateUrl { get; init; } = "";
    public bool EmailSent { get; init; }
    public string? EmailError { get; init; }
}

public class ParentAccountService
{
    private readonly IHirayaRepository _repository;
    private readonly IEmailSender? _email;
    private readonly HirayaSmtpOptions _smtp;
    private readonly ILogger<ParentAccountService>? _logger;

    public ParentAccountService(
        IHirayaRepository repository,
        IEmailSender? email = null,
        IOptions<HirayaSmtpOptions>? smtp = null,
        ILogger<ParentAccountService>? logger = null)
    {
        _repository = repository;
        _email = email;
        _smtp = HirayaSmtpOptions.Resolved(smtp?.Value ?? new HirayaSmtpOptions());
        _logger = logger;
    }

    public async Task<ParentInviteResult> CreateAsync(ParentCreateRequest input, HirayaUser actor)
    {
        EnsureAdmin(actor);
        ParentInviteResult? result = null;
        await _repository.MutateAsync(async db =>
        {
            FamilyAccess.EnsureLegacyLinks(db);
            var email = input.Email.Trim();
            ValidateProfile(input.FirstName, input.LastName, email, input.Phone, input.Address);
            if (db.Users.Any(u => string.Equals(u.Email, email, StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException("That email is already used.");
            RequirePassword(input.Password, input.ConfirmPassword);

            var now = DateTime.UtcNow.ToString("o");
            var user = new HirayaUser
            {
                UserId = IdFactory.New("usr"),
                FirstName = input.FirstName.Trim(),
                MiddleName = input.MiddleName.Trim(),
                LastName = input.LastName.Trim(),
                Email = email,
                PersonalEmail = PersonalMailbox.KeepOrReplace(input.PersonalEmail, ""),
                Phone = input.Phone.Trim(),
                Address = input.Address.Trim(),
                Notes = input.Notes.Trim(),
                Role = UserRoles.Parent,
                Status = AccountStatuses.Active,
                Password = PasswordHasher.Hash(input.Password.Trim()),
                CreatedAt = now,
                UpdatedAt = now
            };
            user.SyncDisplayName();
            db.Users.Add(user);

            if (!string.IsNullOrWhiteSpace(input.StudentId))
            {
                EnsureStudent(db, input.StudentId);
                FamilyAccess.UpsertLink(db, user.UserId, input.StudentId, input.Relationship);
            }

            AuditService.Append(db, actor, AuditModules.Parents, "create", "user", user.UserId,
                $"{actor.Fullname} created and activated parent account {user.Fullname}.");
            result = new ParentInviteResult { Parent = ClonePublic(user) };
            await Task.CompletedTask;
        });
        return result!;
    }

    public async Task UpdateProfileAsync(string parentUserId, ParentCreateRequest input, HirayaUser actor)
    {
        EnsureAdmin(actor);
        await _repository.MutateAsync(async db =>
        {
            var user = RequireParent(db, parentUserId);
            var email = input.Email.Trim();
            ValidateProfile(input.FirstName, input.LastName, email, input.Phone, input.Address);
            if (db.Users.Any(u =>
                    u.UserId != parentUserId &&
                    string.Equals(u.Email, email, StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException("That email is already used.");

            user.FirstName = input.FirstName.Trim();
            user.MiddleName = input.MiddleName.Trim();
            user.LastName = input.LastName.Trim();
            user.Email = email;
            user.PersonalEmail = PersonalMailbox.KeepOrReplace(input.PersonalEmail, user.PersonalEmail);
            user.Phone = input.Phone.Trim();
            user.Address = input.Address.Trim();
            user.Notes = input.Notes.Trim();
            user.UpdatedAt = DateTime.UtcNow.ToString("o");
            user.SyncDisplayName();
            AuditService.Append(db, actor, AuditModules.Parents, "update", "user", user.UserId,
                $"{actor.Fullname} updated parent {user.Fullname}.");
            await Task.CompletedTask;
        });
    }

    public async Task AssignChildAsync(string parentUserId, string studentId, string relationship, HirayaUser actor)
    {
        EnsureAdmin(actor);
        await _repository.MutateAsync(async db =>
        {
            var parent = RequireParent(db, parentUserId);
            EnsureStudent(db, studentId);
            FamilyAccess.UpsertLink(db, parent.UserId, studentId, relationship);
            AuditService.Append(db, actor, AuditModules.Parents, "assign_child", "parent_student", studentId,
                $"{actor.Fullname} assigned {StudentNames.Display(db.Students.First(s => s.StudentId == studentId))} to {parent.Fullname}.");
            await Task.CompletedTask;
        });
    }

    public async Task RemoveChildAsync(string parentUserId, string studentId, HirayaUser actor)
    {
        EnsureAdmin(actor);
        await _repository.MutateAsync(async db =>
        {
            var parent = RequireParent(db, parentUserId);
            FamilyAccess.DeactivateLink(db, parent.UserId, studentId);
            AuditService.Append(db, actor, AuditModules.Parents, "remove_child", "parent_student", studentId,
                $"{actor.Fullname} removed child access for {parent.Fullname}.");
            await Task.CompletedTask;
        });
    }

    public async Task SetActiveAsync(string parentUserId, bool active, HirayaUser actor)
    {
        EnsureAdmin(actor);
        await _repository.MutateAsync(async db =>
        {
            var user = RequireParent(db, parentUserId);
            if (active)
            {
                user.Status = AccountStatuses.Active;
            }
            else
            {
                user.Status = AccountStatuses.Deactivated;
            }

            user.UpdatedAt = DateTime.UtcNow.ToString("o");
            AuditService.Append(db, actor, AuditModules.Parents, active ? "reactivate" : "deactivate",
                "user", user.UserId, $"{actor.Fullname} set {user.Fullname} to {user.Status}.");
            await Task.CompletedTask;
        });
    }

    public async Task DeleteAsync(string parentUserId, HirayaUser actor)
    {
        EnsureAdmin(actor);
        await _repository.MutateAsync(async db =>
        {
            var user = RequireParent(db, parentUserId);
            if (string.Equals(actor.UserId, user.UserId, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("You cannot delete the account you are signed in with.");

            var name = string.IsNullOrWhiteSpace(user.Fullname) ? user.Email : user.Fullname;
            foreach (var link in db.ParentStudents.Where(l => l.ParentId == user.UserId).ToList())
                FamilyAccess.DeactivateLink(db, user.UserId, link.StudentId);
            db.ParentStudents.RemoveAll(l => l.ParentId == user.UserId);
            db.AccountInvitations.RemoveAll(i => i.UserId == user.UserId);
            db.Alerts.RemoveAll(a => a.RecipientId == user.UserId);
            db.Users.RemoveAll(u => u.UserId == user.UserId);
            AuditService.Append(db, actor, AuditModules.Parents, "delete", "user", parentUserId,
                $"{actor.Fullname} deleted parent account {name}.");
            await Task.CompletedTask;
        });
    }

    public async Task<int> ActivateAllAsync(HirayaUser actor)
    {
        EnsureAdmin(actor);
        var count = 0;
        await _repository.MutateAsync(async db =>
        {
            foreach (var user in db.Users.Where(u => u.Role == UserRoles.Parent))
            {
                if (AccountStatuses.AllowsPortalLogin(user.Status))
                    continue;
                if (string.Equals(user.Status, AccountStatuses.PendingActivation, StringComparison.OrdinalIgnoreCase))
                    continue;
                user.Status = AccountStatuses.Active;
                user.UpdatedAt = DateTime.UtcNow.ToString("o");
                count++;
            }

            if (count > 0)
            {
                AuditService.Append(db, actor, AuditModules.Parents, "activate_all", "user", "",
                    $"{actor.Fullname} activated {count} parent account{(count == 1 ? "" : "s")}.");
            }

            await Task.CompletedTask;
        });
        return count;
    }

    public async Task SetPasswordAsync(string parentUserId, string password, string confirm, HirayaUser actor, string? adminPassword = null)
    {
        EnsureAdmin(actor);
        PasswordHasher.RequireAdminConfirmation(actor.Password, adminPassword);
        RequirePassword(password, confirm);
        await _repository.MutateAsync(async db =>
        {
            var user = RequireParent(db, parentUserId);
            user.Password = PasswordHasher.Hash(password.Trim());
            user.Status = string.Equals(user.Status, AccountStatuses.Deactivated, StringComparison.OrdinalIgnoreCase)
                ? AccountStatuses.Deactivated
                : AccountStatuses.Active;
            user.UpdatedAt = DateTime.UtcNow.ToString("o");
            foreach (var old in db.AccountInvitations.Where(i => i.UserId == user.UserId && string.IsNullOrWhiteSpace(i.UsedAt)))
                old.UsedAt = DateTime.UtcNow.ToString("o");
            AuditService.Append(db, actor, AuditModules.Parents, "set_password", "user", user.UserId,
                $"{actor.Fullname} set portal access for {user.Fullname}.");
            await Task.CompletedTask;
        });
    }

    public async Task<ParentInviteResult> ResetAccessAsync(string parentUserId, HirayaUser actor)
    {
        EnsureAdmin(actor);
        ParentInviteResult? result = null;
        await _repository.MutateAsync(async db =>
        {
            var user = RequireParent(db, parentUserId);
            user.Status = AccountStatuses.PendingActivation;
            user.Password = PasswordHasher.Hash(InvitationTokens.NewToken());
            user.UpdatedAt = DateTime.UtcNow.ToString("o");
            var invite = IssueInvitation(db, user.UserId, InvitationKinds.Reset);
            AuditService.Append(db, actor, AuditModules.Parents, "reset_access", "user", user.UserId,
                $"{actor.Fullname} reset portal access for {user.Fullname}.");
            result = new ParentInviteResult { Parent = ClonePublic(user), Token = invite.Token, ExpiresAt = invite.ExpiresAt };
            await Task.CompletedTask;
        });
        return await DeliverInvitationAsync(result!, reset: true);
    }

    public async Task ActivateAsync(string token, string password, string confirm)
    {
        var confirmToUse = string.IsNullOrWhiteSpace(confirm) ? password : confirm;
        var problem = PasswordRules.ValidateNew("", password, confirmToUse);
        if (problem != null)
            throw new InvalidOperationException(problem);

        await _repository.MutateAsync(async db =>
        {
            FamilyAccess.EnsureLegacyLinks(db);
            var hash = InvitationTokens.Hash(token);
            var invite = db.AccountInvitations.FirstOrDefault(i =>
                string.Equals(i.TokenHash, hash, StringComparison.OrdinalIgnoreCase));
            if (invite == null || !string.IsNullOrWhiteSpace(invite.UsedAt))
                throw new InvalidOperationException("This invitation is not valid.");
            if (!DateTime.TryParse(invite.ExpiresAt, out var expires) || expires < DateTime.UtcNow)
                throw new InvalidOperationException("This invitation has expired.");

            var user = db.Users.FirstOrDefault(u => u.UserId == invite.UserId)
                       ?? throw new InvalidOperationException("This invitation is not valid.");
            if (user.Role != UserRoles.Parent)
                throw new InvalidOperationException("This invitation is not valid.");
            if (string.Equals(user.Status, AccountStatuses.Deactivated, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(user.Status, AccountStatuses.Archived, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("This account is deactivated. Contact the learning center.");

            user.Password = PasswordHasher.Hash(password);
            user.Status = AccountStatuses.Active;
            user.UpdatedAt = DateTime.UtcNow.ToString("o");
            invite.UsedAt = DateTime.UtcNow.ToString("o");
            foreach (var other in db.AccountInvitations.Where(i =>
                         i.UserId == user.UserId && i.InvitationId != invite.InvitationId && string.IsNullOrWhiteSpace(i.UsedAt)))
                other.UsedAt = invite.UsedAt;

            AuditService.Append(db, user, AuditModules.Auth, "activate", "user", user.UserId,
                $"{user.Fullname} activated a parent account.");
            await Task.CompletedTask;
        });
    }

    public static void RejectParentRelationshipChange(HirayaUser actor)
    {
        if (actor.Role == UserRoles.Parent || actor.Role == UserRoles.Teacher || actor.Role == UserRoles.Student)
            throw new UnauthorizedAccessException("Only an administrator can change family relationships.");
    }

    public async Task NotifyEnrollmentAcceptedAsync(EnrollmentApprovalNotice notice)
    {
        if (string.IsNullOrWhiteSpace(notice.ParentUserId))
            return;

        string? token = null;
        string? expiresAt = null;
        if (notice.ParentNeedsActivation)
        {
            await _repository.MutateAsync(db =>
            {
                var parent = db.Users.FirstOrDefault(u =>
                    string.Equals(u.UserId, notice.ParentUserId, StringComparison.OrdinalIgnoreCase) &&
                    u.Role == UserRoles.Parent);
                if (parent is null ||
                    !string.Equals(parent.Status, AccountStatuses.PendingActivation, StringComparison.OrdinalIgnoreCase))
                    return Task.CompletedTask;
                var invite = IssueInvitation(db, parent.UserId, InvitationKinds.Activate);
                token = invite.Token;
                expiresAt = invite.ExpiresAt;
                return Task.CompletedTask;
            });
        }

        var canEmail = CanSendMail();
        var activateUrl = token is null || !CanIncludeActivationLink() ? "" : ActivationUrl(token);
        var center = await CenterNameAsync();
        var emailSent = false;
        if (canEmail && !string.IsNullOrWhiteSpace(notice.ParentEmail))
        {
            DateTimeOffset? expires = DateTimeOffset.TryParse(expiresAt, out var when) ? when : null;
            var (subject, text, html) = InvitationEmail.EnrollmentAccepted(
                center,
                notice.ParentName,
                notice.StudentName,
                notice.Program,
                string.IsNullOrWhiteSpace(activateUrl) ? null : activateUrl,
                string.IsNullOrWhiteSpace(activateUrl) ? null : expires,
                notice.ParentNeedsActivation,
                await ContactAsync());
            try
            {
                await _email!.SendAsync(notice.ParentEmail, subject, text, html);
                emailSent = true;
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Could not email enrollment acceptance to {Email}.", notice.ParentEmail);
            }
        }

        var adminNote = emailSent
            ? $"Enrollment accepted for {notice.StudentName} ({notice.Program}). {notice.ParentName} was emailed. The message does not include a password and does not confirm payment."
            : $"Enrollment accepted for {notice.StudentName} ({notice.Program}). Parent account {notice.ParentEmail} is waiting for portal access. Email was not sent because outbound mail or the public site address is not ready. No password was emailed.";
        await _repository.MutateAsync(db =>
        {
            NotificationService.PushToUsers(
                db,
                NotificationService.Recipients(db, NotificationAudiences.Admins).Select(u => u.UserId),
                adminNote,
                NotificationKinds.Enrollment,
                "Enrollment accepted",
                "enrollment");
            return Task.CompletedTask;
        });
    }

    public async Task<bool> NotifyPortalReadyAsync(PortalReadyNotice notice)
    {
        var sent = false;
        if (CanSendMail() && !string.IsNullOrWhiteSpace(notice.To))
        {
            var center = await CenterNameAsync();
            var (subject, text, html) = InvitationEmail.PortalReady(
                center,
                notice.Name,
                notice.Teacher,
                notice.LoginEmail,
                notice.Password,
                notice.ApkUrl,
                notice.StudentName,
                notice.Program,
                await ContactAsync());
            try
            {
                await _email!.SendAsync(notice.To, subject, text, html);
                sent = true;
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Could not email portal access to {Email}.", notice.To);
            }
        }

        var who = string.IsNullOrWhiteSpace(notice.Name) ? notice.To : notice.Name;
        var adminNote = sent
            ? $"{who} was emailed a Hiraya sign-in and the phone app link."
            : $"{who} was approved, but the sign-in email could not be sent.";
        await _repository.MutateAsync(db =>
        {
            NotificationService.PushToUsers(
                db,
                NotificationService.Recipients(db, NotificationAudiences.Admins).Select(u => u.UserId),
                adminNote,
                NotificationKinds.Enrollment,
                sent ? "Sign-in email sent" : "Sign-in email not sent",
                "enrollment");
            return Task.CompletedTask;
        });
        return sent;
    }

    public async Task NotifyTeacherInterviewAsync(string email, string name, string when, string place, string instructions)
    {
        if (!CanSendMail() || string.IsNullOrWhiteSpace(email))
            return;
        var center = await CenterNameAsync();
        var (subject, text, html) = InvitationEmail.TeacherInterview(center, name, when, place, instructions, await ContactAsync());
        try
        {
            await _email!.SendAsync(email.Trim(), subject, text, html);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Could not email the teacher interview notice to {Email}.", email);
        }
    }

    public async Task NotifyApplicationReceivedAsync(string email, string name, string subjectLine, string body)
    {
        if (!CanSendMail() || string.IsNullOrWhiteSpace(email))
            return;
        var center = await CenterNameAsync();
        var (subject, text, html) = InvitationEmail.ApplicationReceived(center, name, subjectLine, body, await ContactAsync());
        try
        {
            await _email!.SendAsync(email.Trim(), subject, text, html);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Could not email application receipt to {Email}.", email);
        }
    }

    private bool CanSendMail() =>
        _smtp.Enabled && _email is { IsConfigured: true };

    private bool CanIncludeActivationLink()
    {
        if (!CanSendMail())
            return false;
        if (!Uri.TryCreate(_smtp.PublicBaseUrl, UriKind.Absolute, out var uri))
            return false;
        var host = uri.Host;
        return !host.Equals("localhost", StringComparison.OrdinalIgnoreCase) &&
               host != "127.0.0.1" &&
               host != "::1" &&
               host != "0.0.0.0";
    }

    private async Task<ParentInviteResult> DeliverInvitationAsync(ParentInviteResult invite, bool reset)
    {
        var url = ActivationUrl(invite.Token);
        var sent = false;
        string? emailError = null;
        if (_smtp.Enabled && _email is { IsConfigured: true })
        {
            var expires = DateTimeOffset.TryParse(invite.ExpiresAt, out var when)
                ? when
                : DateTimeOffset.UtcNow.Add(InvitationTokens.DefaultLifetime);
            var center = await CenterNameAsync();
            var (subject, text, html) = InvitationEmail.ParentActivation(
                center, invite.Parent.Fullname, url, expires, reset, await ContactAsync());
            try
            {
                if (!PersonalMailbox.TryRecipient(invite.Parent.PersonalEmail, invite.Parent.Email, out var to, out var addressError))
                {
                    emailError = addressError;
                }
                else
                {
                    await _email.SendAsync(to, subject, text, html);
                    sent = true;
                }
            }
            catch (Exception ex)
            {
                emailError = ex.Message;
                _logger?.LogWarning(ex, "Could not email parent invitation to {Email}.", invite.Parent.Email);
            }
        }

        return new ParentInviteResult
        {
            Parent = invite.Parent,
            Token = invite.Token,
            ExpiresAt = invite.ExpiresAt,
            ActivateUrl = url,
            EmailSent = sent,
            EmailError = sent ? null : emailError
        };
    }

    private async Task<HirayaEmailContact> ContactAsync()
    {
        try
        {
            var db = await _repository.LoadAsync();
            return HirayaEmailLayout.ContactFrom(db.Settings);
        }
        catch
        {
            return HirayaEmailLayout.ContactFrom(null);
        }
    }

    private async Task<string> CenterNameAsync()
    {
        try
        {
            var db = await _repository.LoadAsync();
            return string.IsNullOrWhiteSpace(db.Settings.CenterName)
                ? _smtp.FromName
                : db.Settings.CenterName;
        }
        catch
        {
            return _smtp.FromName;
        }
    }

    private string ActivationUrl(string token)
    {
        var root = _smtp.PublicBaseUrl.TrimEnd('/');
        return $"{root}/activate?token={Uri.EscapeDataString(token)}";
    }

    private static void RequirePassword(string password, string confirm)
    {
        var problem = PasswordRules.ValidateNew("", password, confirm);
        if (problem != null)
            throw new InvalidOperationException(problem);
    }

    private static void EnsureAdmin(HirayaUser actor)
    {
        if (!Navigation.CanManageStudents(actor.Role))
            throw new UnauthorizedAccessException("Only an administrator can manage parent accounts.");
    }

    private static HirayaUser RequireParent(HirayaDatabase db, string parentUserId)
    {
        FamilyAccess.EnsureLegacyLinks(db);
        var user = db.Users.FirstOrDefault(u => string.Equals(u.UserId, parentUserId, StringComparison.OrdinalIgnoreCase))
                   ?? throw new InvalidOperationException("Parent account was not found.");
        if (user.Role != UserRoles.Parent)
            throw new InvalidOperationException("That account is not a parent.");
        return user;
    }

    private static void EnsureStudent(HirayaDatabase db, string studentId)
    {
        if (db.Students.All(s => s.StudentId != studentId))
            throw new InvalidOperationException("Student was not found.");
    }

    private static void ValidateProfile(string first, string last, string email, string phone, string address)
    {
        if (string.IsNullOrWhiteSpace(first) || string.IsNullOrWhiteSpace(last))
            throw new InvalidOperationException("First name and last name are required.");
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            throw new InvalidOperationException("A valid email is required.");
        var digits = new string((phone ?? "").Where(char.IsDigit).ToArray());
        if (digits.Length < 7)
            throw new InvalidOperationException("A valid phone number is required.");
        if (string.IsNullOrWhiteSpace(address))
            throw new InvalidOperationException("Address is required.");
    }

    private static (string Token, string ExpiresAt) IssueInvitation(HirayaDatabase db, string userId, string kind)
    {
        var now = DateTime.UtcNow;
        foreach (var old in db.AccountInvitations.Where(i => i.UserId == userId && string.IsNullOrWhiteSpace(i.UsedAt)))
            old.UsedAt = now.ToString("o");

        var token = InvitationTokens.NewToken();
        var expires = now.Add(InvitationTokens.DefaultLifetime).ToString("o");
        db.AccountInvitations.Add(new AccountInvitation
        {
            InvitationId = IdFactory.New("inv"),
            UserId = userId,
            TokenHash = InvitationTokens.Hash(token),
            Kind = kind,
            ExpiresAt = expires,
            CreatedAt = now.ToString("o")
        });
        return (token, expires);
    }

    private static HirayaUser ClonePublic(HirayaUser user)
    {
        var copy = StoreSanitizer.PublicCopy(new HirayaDatabase { Users = [user] }).Users[0];
        return copy;
    }
}
