using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Hiraya.Shared;
using Hiraya.Shared.Models;
using Hiraya.Shared.Security;
using Hiraya.Shared.Services.Firebase;
using Microsoft.Extensions.Options;

namespace Hiraya.Shared.Services;

public class StaffSaveRequest
{
    public string UserId { get; set; } = "";
    public string ProfileId { get; set; } = "";
    public string Fullname { get; set; } = "";
    public string Email { get; set; } = "";
    public string PersonalEmail { get; set; } = "";
    public string Password { get; set; } = "";
    public string ConfirmPassword { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Address { get; set; } = "";
    public string Notes { get; set; } = "";
    public string FirstName { get; set; } = "";
    public string MiddleName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Role { get; set; } = UserRoles.Teacher;
    public string EmployeeCode { get; set; } = "";
    public string Position { get; set; } = "";
    public string Specialty { get; set; } = "";
    public string Bio { get; set; } = "";
    public string Status { get; set; } = "active";
    public string HireDate { get; set; } = "";
}

public class StaffService
{
    private readonly IHirayaRepository _repository;
    private readonly IHttpClientFactory? _http;
    private readonly HirayaApiOptions _api;
    private readonly HirayaActorContext _actor;

    public StaffService(IHirayaRepository repository)
        : this(repository, null, null, null)
    {
    }

    public StaffService(
        IHirayaRepository repository,
        IHttpClientFactory? http,
        IOptions<HirayaApiOptions>? api,
        HirayaActorContext? actor)
    {
        _repository = repository;
        _http = http;
        _api = api?.Value ?? new HirayaApiOptions();
        _actor = actor ?? new HirayaActorContext();
    }

    private bool UseRemote => _http is not null && _api.UseRemoteStore;

    public static void EnsureDefaultSpecialties(HirayaDatabase db)
    {
        foreach (var name in TeacherRoleCatalog.Defaults)
        {
            if (db.TeacherRoleOptions.Any(r => string.Equals(r.Name, name, StringComparison.OrdinalIgnoreCase)))
                continue;
            db.TeacherRoleOptions.Add(new TeacherRoleOption
            {
                RoleId = IdFactory.New("trole"),
                Name = name
            });
        }
    }

    public async Task AddSpecialtyAsync(string name, HirayaUser actor)
    {
        if (!Navigation.CanManageStaff(actor.Role))
            throw new UnauthorizedAccessException("You cannot manage teachers or staff.");
        var trimmed = name.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new InvalidOperationException("Enter a specialization name.");
        if (await TryRemoteAsync(HttpMethod.Post, "api/staff/specialties", new StaffSpecialtyBody { Name = trimmed }))
            return;

        await _repository.MutateAsync(async db =>
        {
            ApplySpecialty(db, trimmed);
            await Task.CompletedTask;
        });
    }

    public async Task<string> SaveAsync(StaffSaveRequest input, HirayaUser? actor = null)
    {
        if (!Navigation.CanManageStaff(actor?.Role))
            throw new UnauthorizedAccessException("You cannot manage teachers or staff.");
        var fullname = input.Fullname.Trim();
        var email = EnsureLoginEmail(input.Email);
        if (string.IsNullOrWhiteSpace(fullname))
            throw new InvalidOperationException("Full name is required.");
        if (string.IsNullOrWhiteSpace(input.Role) ||
            string.Equals(input.Role, UserRoles.Staff, StringComparison.OrdinalIgnoreCase))
            input.Role = UserRoles.Teacher;
        if (!Navigation.IsEmployeeRole(input.Role))
            throw new InvalidOperationException("Teachers are the only staff accounts. Parents are created in Parent Monitoring.");
        EnsurePassword(input, requireForNew: string.IsNullOrWhiteSpace(input.UserId));
        if (await TryRemoteAsync(HttpMethod.Put, "api/staff", input))
            return string.IsNullOrWhiteSpace(input.UserId) ? email : input.UserId;

        var userId = "";
        await _repository.MutateAsync(async db =>
        {
            userId = ApplySave(db, input, actor);
            await Task.CompletedTask;
        });
        return userId;
    }

    public Task ArchiveAsync(string userId, HirayaUser? actor = null) =>
        SetActiveAsync(userId, false, actor);

    public Task RestoreAsync(string userId, HirayaUser? actor = null) =>
        SetActiveAsync(userId, true, actor);

    public async Task SetActiveAsync(string userId, bool active, HirayaUser? actor = null)
    {
        if (!Navigation.CanManageStaff(actor?.Role))
            throw new UnauthorizedAccessException("You cannot manage teachers or staff.");
        if (await TryRemoteAsync(HttpMethod.Post, "api/staff/active", new StaffActiveBody { UserId = userId, Active = active }))
            return;

        await _repository.MutateAsync(async db =>
        {
            if (active)
                ApplyRestore(db, userId, actor);
            else
                ApplyArchive(db, userId, actor);
            await Task.CompletedTask;
        });
    }

    internal static string EnsureLoginEmail(string? email)
    {
        var value = (email ?? "").Trim();
        var at = value.IndexOf('@');
        if (at <= 0 || at != value.LastIndexOf('@') || at >= value.Length - 1 || value.Contains(' '))
            throw new InvalidOperationException("Enter a sign-in email that includes @, for example teacher@hiraya.local.");
        return value;
    }

    internal static string EnsurePassword(StaffSaveRequest input, bool requireForNew)
    {
        var password = (input.Password ?? "").Trim();
        var confirm = (input.ConfirmPassword ?? "").Trim();
        if (string.IsNullOrWhiteSpace(password))
        {
            if (requireForNew)
                throw new InvalidOperationException($"Password is required and must be at least {PasswordRules.MinimumLength} characters.");
            return "";
        }

        if (password.Length < PasswordRules.MinimumLength)
            throw new InvalidOperationException($"Password must be at least {PasswordRules.MinimumLength} characters.");
        if (!string.Equals(password, confirm, StringComparison.Ordinal))
            throw new InvalidOperationException("Password and confirmation do not match.");
        return password;
    }

    internal static void ApplySpecialty(HirayaDatabase db, string trimmed)
    {
        EnsureDefaultSpecialties(db);
        if (!db.TeacherRoleOptions.Any(r => string.Equals(r.Name, trimmed, StringComparison.OrdinalIgnoreCase)))
        {
            db.TeacherRoleOptions.Add(new TeacherRoleOption
            {
                RoleId = IdFactory.New("trole"),
                Name = trimmed
            });
        }
    }

    public static string NormalizeProgramSpecialty(string? raw)
    {
        var text = (raw ?? "").Trim();
        if (string.IsNullOrWhiteSpace(text)) return "";
        var lower = text.ToLowerInvariant();
        (string Id, string[] Aliases)[] lanes =
        [
            ("playgroup", ["playgroup", "play group", "play-group"]),
            ("prekinder", ["pre-kinder", "prekinder", "pre kinder", "pre-kindergarten", "prekindergarten", "preschool", "pre-school", "pre school"]),
            ("kinder", ["kindergarten", "kinder"]),
            ("nursery", ["nursery"]),
            ("grade1", ["grade 1", "grade1", "grade-1", "g1"]),
            ("grade2", ["grade 2", "grade2", "grade-2", "g2"]),
            ("grade3", ["grade 3", "grade3", "grade-3", "g3"]),
            ("aba", ["aba", "ava", "therapist", "aba therapist"]),
            ("tutorial", ["tutorial"])
        ];
        if (lower is "preschool") return "prekinder";
        foreach (var lane in lanes)
        {
            if (string.Equals(lane.Id, lower, StringComparison.OrdinalIgnoreCase))
                return lane.Id;
        }
        // Longest aliases first so "pre-kinder" wins over "kinder" and "grade 1" over partials.
        var ranked = lanes
            .SelectMany(lane => lane.Aliases.Select(alias => (lane.Id, Alias: alias)))
            .OrderByDescending(x => x.Alias.Length);
        foreach (var (id, alias) in ranked)
        {
            if (AliasMatches(lower, alias))
                return id;
        }
        return text;
    }

    static bool AliasMatches(string text, string alias)
    {
        if (string.Equals(text, alias, StringComparison.OrdinalIgnoreCase))
            return true;
        var escaped = Regex.Escape(alias).Replace("\\ ", "\\s+");
        return Regex.IsMatch(text, $@"(?:^|[^a-z0-9]){escaped}(?![a-z0-9])", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    }

    internal static string ApplySave(HirayaDatabase db, StaffSaveRequest input, HirayaUser? actor)
    {
        var fullname = (input.Fullname ?? "").Trim();
        var email = EnsureLoginEmail(input.Email);
        var role = string.IsNullOrWhiteSpace(input.Role) ? UserRoles.Teacher : input.Role.Trim();
        var userId = string.IsNullOrWhiteSpace(input.UserId) ? IdFactory.New("usr") : input.UserId.Trim();
        var profileId = string.IsNullOrWhiteSpace(input.ProfileId) ? IdFactory.New("tprof") : input.ProfileId.Trim();
        var existing = db.Users.FirstOrDefault(u => u.UserId == userId);

        if (db.Users.Any(u =>
                u.UserId != userId &&
                string.Equals(u.Email, email, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("That email is already used by another account.");

        var normalizedName = Regex.Replace((fullname ?? "").Trim().ToLowerInvariant(), @"\s+", " ");
        if (!string.IsNullOrWhiteSpace(normalizedName) &&
            (role == UserRoles.Teacher || role == UserRoles.Staff) &&
            db.Users.Any(u =>
                u.UserId != userId &&
                (u.Role == UserRoles.Teacher || u.Role == UserRoles.Staff) &&
                string.Equals(
                    Regex.Replace((u.Fullname ?? "").Trim().ToLowerInvariant(), @"\s+", " "),
                    normalizedName,
                    StringComparison.Ordinal)))
            throw new InvalidOperationException("A teacher or staff member with that name already exists. Open their existing record instead of creating a duplicate.");

        var password = EnsurePassword(input, requireForNew: existing is null);
        string storedPassword;
        if (!string.IsNullOrWhiteSpace(password))
            storedPassword = PasswordHasher.Hash(password);
        else if (!string.IsNullOrWhiteSpace(existing?.Password))
            storedPassword = existing.Password!;
        else if (!string.IsNullOrWhiteSpace(input.UserId) && existing is not null)
            storedPassword = existing.Password ?? "";
        else
            throw new InvalidOperationException("Password is required for a new account.");

        EnsureDefaultSpecialties(db);
        var specialty = NormalizeProgramSpecialty(input.Specialty);

        var existingProfile = db.TeacherProfiles.FirstOrDefault(p => p.UserId == userId);
        var status = string.IsNullOrWhiteSpace(input.Status) ? "active" : input.Status.Trim();
        var phone = (input.Phone ?? "").Trim();
        var position = (input.Position ?? "").Trim();
        var employeeCode = (input.EmployeeCode ?? "").Trim();
        var bio = (input.Bio ?? "").Trim();

        db.Users.RemoveAll(u => u.UserId == userId);
        var saved = new HirayaUser
        {
            UserId = userId,
            Fullname = fullname,
            Email = email,
            PersonalEmail = PersonalMailbox.KeepOrReplace(input.PersonalEmail, existing?.PersonalEmail),
            Password = storedPassword,
            Role = role,
            Status = status,
            Phone = phone,
            Username = string.IsNullOrWhiteSpace(existing?.Username) ? email.Split('@')[0] : existing.Username,
            FirstName = string.IsNullOrWhiteSpace(input.FirstName) ? existing?.FirstName ?? "" : input.FirstName.Trim(),
            MiddleName = input.MiddleName?.Trim() ?? existing?.MiddleName ?? "",
            LastName = string.IsNullOrWhiteSpace(input.LastName) ? existing?.LastName ?? "" : input.LastName.Trim(),
            Address = string.IsNullOrWhiteSpace(input.Address) ? existing?.Address ?? "" : input.Address.Trim(),
            Notes = string.IsNullOrWhiteSpace(input.Notes) ? existing?.Notes ?? "" : input.Notes.Trim(),
            Position = string.IsNullOrWhiteSpace(position) ? existing?.Position ?? "" : position,
            ProfileImagePath = existing?.ProfileImagePath ?? "",
            CreatedAt = string.IsNullOrWhiteSpace(existing?.CreatedAt) ? DateTime.UtcNow.ToString("o") : existing!.CreatedAt,
            LastLoginAt = existing?.LastLoginAt ?? "",
            NotifyAttendance = existing?.NotifyAttendance ?? true,
            NotifyPayments = existing?.NotifyPayments ?? true,
            NotifySchedule = existing?.NotifySchedule ?? true,
            NotifyProgress = existing?.NotifyProgress ?? true,
            DateFormat = existing?.DateFormat ?? "MMM d, yyyy",
            TimeFormat = existing?.TimeFormat ?? "HH:mm",
            Theme = existing?.Theme ?? "system"
        };
        ApplyStaffDisplayName(saved, fullname);
        db.Users.Add(saved);

        db.TeacherProfiles.RemoveAll(p => p.ProfileId == profileId || p.UserId == userId);
        db.TeacherProfiles.Add(new TeacherProfile
        {
            ProfileId = profileId,
            UserId = userId,
            EmployeeCode = string.IsNullOrWhiteSpace(employeeCode)
                ? existingProfile?.EmployeeCode ?? userId.ToUpperInvariant()
                : employeeCode,
            Position = position,
            Specialty = specialty,
            Phone = phone,
            Bio = bio,
            HireDate = string.IsNullOrWhiteSpace(input.HireDate)
                ? existingProfile?.HireDate ?? DateTime.UtcNow.ToString("yyyy-MM-dd")
                : input.HireDate.Trim(),
            Status = status
        });

        AuditService.Append(db, actor, AuditModules.Staff,
            string.IsNullOrWhiteSpace(input.UserId) ? "create" : "update",
            "user", userId, $"Saved {fullname} ({role}).");
        return userId;
    }

    internal static void ApplyStaffDisplayName(HirayaUser saved, string fullname)
    {
        var parts = fullname.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length >= 1)
            saved.FirstName = parts[0];
        if (parts.Length >= 2)
            saved.LastName = string.Join(" ", parts.Skip(1));
        saved.SyncDisplayName();
        if (string.IsNullOrWhiteSpace(saved.FirstName) && string.IsNullOrWhiteSpace(saved.LastName))
            saved.Fullname = fullname;
    }

    public async Task DeleteAsync(string userId, HirayaUser? actor = null)
    {
        if (!Navigation.CanManageStaff(actor?.Role))
            throw new UnauthorizedAccessException("You cannot manage teachers or staff.");
        if (await TryRemoteAsync(HttpMethod.Post, "api/staff/delete", new StaffUserIdBody { UserId = userId }))
            return;

        await _repository.MutateAsync(async db =>
        {
            ApplyDelete(db, userId, actor);
            await Task.CompletedTask;
        });
    }

    internal static void ApplyDelete(HirayaDatabase db, string userId, HirayaUser? actor)
    {
        var user = db.Users.FirstOrDefault(u => u.UserId == userId)
                   ?? throw new InvalidOperationException("Account was not found.");
        if (!Navigation.IsEmployeeRole(user.Role))
            throw new InvalidOperationException("Only a teacher or staff account can be deleted here.");
        if (actor is not null && string.Equals(actor.UserId, userId, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("You cannot delete the account you are signed in with.");

        var name = user.Fullname;
        db.Users.RemoveAll(u => u.UserId == userId);
        db.TeacherProfiles.RemoveAll(p => p.UserId == userId);
        db.TeacherWorkShifts.RemoveAll(s => s.TeacherId == userId);
        db.LeaveRequests.RemoveAll(l => l.TeacherId == userId);
        db.TeacherDuties.RemoveAll(d => d.TeacherId == userId);
        foreach (var cls in db.Classes.Where(c => c.TeacherId == userId))
            cls.TeacherId = "";
        foreach (var enrollment in db.Enrollments.Where(e => e.TeacherId == userId))
            enrollment.TeacherId = "";
        foreach (var schedule in db.Schedules.Where(s => s.TeacherId == userId))
            schedule.TeacherId = "";
        db.Alerts.RemoveAll(a => a.RecipientId == userId);
        AuditService.Append(db, actor, AuditModules.Staff, "delete", "user", userId, $"Deleted {name}.");
    }

    internal static void ApplyArchive(HirayaDatabase db, string userId, HirayaUser? actor)
    {
        var user = db.Users.FirstOrDefault(u => u.UserId == userId);
        if (user != null)
            user.Status = AccountStatuses.Deactivated;
        foreach (var profile in db.TeacherProfiles.Where(p => p.UserId == userId))
            profile.Status = AccountStatuses.Deactivated;
        AuditService.Append(db, actor, AuditModules.Staff, "deactivate", "user", userId, $"Deactivated {user?.Fullname ?? userId}.");
    }

    internal static void ApplyRestore(HirayaDatabase db, string userId, HirayaUser? actor)
    {
        var user = db.Users.FirstOrDefault(u => u.UserId == userId)
                   ?? throw new InvalidOperationException("Account was not found.");
        user.Status = AccountStatuses.Active;
        foreach (var profile in db.TeacherProfiles.Where(p => p.UserId == userId))
            profile.Status = AccountStatuses.Active;
        AuditService.Append(db, actor, AuditModules.Staff, "activate", "user", userId, $"Activated {user.Fullname}.");
    }

    private async Task<bool> TryRemoteAsync(HttpMethod method, string path, object body)
    {
        if (!UseRemote)
            return false;
        if (string.IsNullOrWhiteSpace(_actor.SessionToken))
            throw new InvalidOperationException("Your session expired. Sign in again while Hiraya.Api is running, then save.");

        try
        {
            var client = _http!.CreateClient("hiraya-api");
            using var request = new HttpRequestMessage(method, path)
            {
                Content = JsonContent.Create(body, options: JsonDefaults.Options)
            };
            _actor.ApplyTo(request);
            using var response = await client.SendAsync(request);
            if (response.IsSuccessStatusCode)
            {
                _repository.InvalidateCache();
                return true;
            }

            var code = (int)response.StatusCode;
            if (code is 404 or 405)
                return false;

            var detail = await ReadErrorAsync(response);
            if (code is 401)
                throw new InvalidOperationException("Your session expired. Sign in again, then save.");
            if (code is 403)
                throw new InvalidOperationException(detail ?? "You are not allowed to save that change.");
            throw new InvalidOperationException(detail ?? $"Could not save the teacher (Hiraya.Api returned {code}). Keep Hiraya.Api running and try again.");
        }
        catch (InvalidOperationException)
        {
            throw;
        }
        catch (HttpRequestException)
        {
            throw new InvalidOperationException("Could not reach Hiraya.Api. Start the Hiraya.Api project and try again.");
        }
        catch (TaskCanceledException)
        {
            throw new InvalidOperationException("Hiraya.Api did not respond in time. Keep it running on http://127.0.0.1:5188 and try again.");
        }
    }

    private static async Task<string?> ReadErrorAsync(HttpResponseMessage response)
    {
        try
        {
            var payload = await response.Content.ReadFromJsonAsync<ErrorBody>(JsonDefaults.Options);
            return string.IsNullOrWhiteSpace(payload?.Error) ? null : payload.Error;
        }
        catch
        {
            return null;
        }
    }

    private sealed class ErrorBody
    {
        public string? Error { get; set; }
    }
}

public sealed class StaffUserIdBody
{
    public string UserId { get; set; } = "";
}

public sealed class StaffSpecialtyBody
{
    public string Name { get; set; } = "";
}

public sealed class StaffActiveBody
{
    public string UserId { get; set; } = "";
    public bool Active { get; set; }
}
