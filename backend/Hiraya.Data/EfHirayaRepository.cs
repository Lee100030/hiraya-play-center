using System.Text.Json;
using Hiraya.Shared.Models;
using Hiraya.Shared.Security;
using Hiraya.Shared.Services;
using Hiraya.Shared.Services.Firebase;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Hiraya.Data;

public class EfHirayaRepository : IHirayaRepository
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(20);

    private readonly IDbContextFactory<HirayaLearningCenterDbContext> _factory;
    private readonly ILogger<EfHirayaRepository> _logger;
    private readonly IEmailSender _email;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private HirayaDatabase? _cache;
    private DateTime _cacheAtUtc;

    public EfHirayaRepository(
        IDbContextFactory<HirayaLearningCenterDbContext> factory,
        ILogger<EfHirayaRepository> logger,
        IEmailSender email)
    {
        _factory = factory;
        _logger = logger;
        _email = email;
    }

    public bool UsingFirebase => false;

    public async Task MutateAsync(Func<HirayaDatabase, Task> mutator, CancellationToken ct = default)
    {
        await _gate.WaitAsync(ct);
        try
        {
            var current = await LoadUnlockedAsync(ct);
            var next = Clone(current);
            await mutator(next);
            await SaveChangedAsync(current, next, ct);
            Remember(next);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<HirayaDatabase> LoadAsync(CancellationToken ct = default)
    {
        var hit = SnapshotCache();
        if (hit is not null)
            return hit;
        await _gate.WaitAsync(ct);
        try
        {
            hit = SnapshotCache();
            if (hit is not null)
                return hit;
            var data = await LoadUnlockedAsync(ct);
            Remember(data);
            return Clone(data);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task SaveAsync(HirayaDatabase database, CancellationToken ct = default)
    {
        await _gate.WaitAsync(ct);
        try
        {
            await SaveUnlockedAsync(database, ct);
            Remember(database);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<HirayaDatabase> ApplyClientPatchAsync(StorePatchRequest patch, HirayaUser actor, CancellationToken ct = default)
    {
        HirayaDatabase merged;
        List<SessionParentMail> notices;
        await _gate.WaitAsync(ct);
        try
        {
            var current = await LoadUnlockedAsync(ct);
            var edited = Clone(current);
            StorePatch.Apply(edited, patch);
            SessionNoticeMail.Begin();
            try
            {
                merged = StoreSanitizer.MergeStoreWrite(current, edited, actor);
                await SaveChangedAsync(current, merged, ct);
                Remember(merged);
                notices = SessionNoticeMail.Take();
            }
            finally
            {
                SessionNoticeMail.Clear();
            }
        }
        finally
        {
            _gate.Release();
        }

        await SessionNoticeMail.SendAsync(notices, _email, _logger, ct);
        return merged;
    }

    public Task SetItemAsync<T>(string collection, string id, T item, CancellationToken ct = default) =>
        MutateAsync(_ => Task.CompletedTask, ct);

    public Task DeleteItemAsync(string collection, string id, CancellationToken ct = default) =>
        MutateAsync(_ => Task.CompletedTask, ct);

    public async Task<HirayaUser?> FindUserAsync(string? userId, string? login, CancellationToken ct = default)
    {
        await using var db = await _factory.CreateDbContextAsync(ct);
        if (!string.IsNullOrWhiteSpace(userId))
            return await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == userId, ct);

        var key = (login ?? "").Trim();
        if (key.Length == 0)
            return null;
        var lower = key.ToLower();
        var at = lower.IndexOf('@');
        var local = at > 0 ? lower[..at] : lower;
        var emailDot = at > 0 ? lower + "." : "";
        var candidates = await db.Users.AsNoTracking().Where(u =>
            (u.Email != null && u.Email.ToLower() == lower) ||
            (u.Username != null && u.Username.ToLower() == lower) ||
            (u.Fullname != null && u.Fullname.ToLower() == lower) ||
            (u.PersonalEmail != null && u.PersonalEmail.ToLower() == lower) ||
            (at > 0 && u.Username != null && u.Username.ToLower() == local) ||
            (at > 0 && u.Email != null && u.Email.ToLower().StartsWith(emailDot)) ||
            (at > 0 && u.PersonalEmail != null && u.PersonalEmail.ToLower().StartsWith(emailDot))).ToListAsync(ct);
        return LoginIdentity.Choose(candidates, key);
    }

    private async Task<HirayaDatabase> LoadUnlockedAsync(CancellationToken ct)
    {
        using var limiter = new SemaphoreSlim(8);
        async Task<List<T>> ReadAsync<T>(Func<HirayaLearningCenterDbContext, IQueryable<T>> query, bool optional) where T : class
        {
            await limiter.WaitAsync(ct);
            try
            {
                await using var db = await _factory.CreateDbContextAsync(ct);
                try
                {
                    return await query(db).AsNoTracking().ToListAsync(ct);
                }
                catch (Exception) when (optional && !ct.IsCancellationRequested)
                {
                    return [];
                }
            }
            finally
            {
                limiter.Release();
            }
        }

        async Task<CenterSettings> ReadSettingsAsync()
        {
            await limiter.WaitAsync(ct);
            try
            {
                await using var db = await _factory.CreateDbContextAsync(ct);
                return await db.Settings.AsNoTracking().OrderBy(s => s.SettingsId).FirstOrDefaultAsync(ct) ?? new CenterSettings();
            }
            finally
            {
                limiter.Release();
            }
        }

        var users = ReadAsync(db => db.Users, false);
        var roles = ReadAsync(db => db.Roles, false);
        var rolePermissions = ReadAsync(db => db.RolePermissions, false);
        var teacherProfiles = ReadAsync(db => db.TeacherProfiles, false);
        var students = ReadAsync(db => db.Students, false);
        var programs = ReadAsync(db => db.Programs, false);
        var classes = ReadAsync(db => db.Classes, false);
        var rooms = ReadAsync(db => db.Rooms, false);
        var enrollments = ReadAsync(db => db.Enrollments, false);
        var enrollmentApplications = ReadAsync(db => db.EnrollmentApplications, false);
        var attendance = ReadAsync(db => db.Attendance, false);
        var reports = ReadAsync(db => db.ProgressRecords, false);
        var schedules = ReadAsync(db => db.Schedules, false);
        var teacherWorkShifts = ReadAsync(db => db.TeacherWorkShifts, false);
        var teacherRoleOptions = ReadAsync(db => db.TeacherRoleOptions, false);
        var news = ReadAsync(db => db.News, false);
        var leaveRequests = ReadAsync(db => db.LeaveRequests, false);
        var payments = ReadAsync(db => db.Payments, false);
        var centerExpenses = ReadAsync(db => db.CenterExpenses, true);
        var openingBalances = ReadAsync(db => db.OpeningBalances, true);
        var alerts = ReadAsync(db => db.Notifications, false);
        var auditLogs = ReadAsync(db => db.AuditLogs, false);
        var learningModules = ReadAsync(db => db.LearningModules, false);
        var learningModuleVersions = ReadAsync(db => db.LearningModuleVersions, false);
        var parentStudents = ReadAsync(db => db.ParentStudents, false);
        var accountInvitations = ReadAsync(db => db.AccountInvitations, false);
        var studentOps = ReadAsync(db => db.StudentOps, false);
        var centerHolidays = ReadAsync(db => db.CenterHolidays, false);
        var teacherDuties = ReadAsync(db => db.TeacherDuties, false);
        var websiteGallery = ReadAsync(db => db.WebsiteGallery, false);
        var staffTasks = ReadAsync(db => db.StaffTasks, false);
        var sessionPackages = ReadAsync(db => db.SessionPackages, false);
        var sessionHistory = ReadAsync(db => db.SessionHistory, false);
        var teacherComments = ReadAsync(db => db.TeacherComments, true);
        var teacherNotes = ReadAsync(db => db.TeacherNotes, true);
        var studentDocuments = ReadAsync(db => db.StudentDocuments, true);
        var chatGroups = ReadAsync(db => db.ChatGroups, true);
        var settings = ReadSettingsAsync();
        await Task.WhenAll(
            users, roles, rolePermissions, teacherProfiles, students, programs, classes, rooms,
            enrollments, enrollmentApplications, attendance, reports, schedules, teacherWorkShifts,
            teacherRoleOptions, news, leaveRequests, payments, centerExpenses, openingBalances,
            alerts, auditLogs, learningModules, learningModuleVersions, parentStudents, accountInvitations,
            studentOps, centerHolidays, teacherDuties, websiteGallery, staffTasks, sessionPackages,
            sessionHistory, teacherComments, teacherNotes, studentDocuments, chatGroups, settings);

        var data = new HirayaDatabase
        {
            Users = await users,
            Roles = await roles,
            RolePermissions = await rolePermissions,
            TeacherProfiles = await teacherProfiles,
            Students = await students,
            Programs = await programs,
            Classes = await classes,
            Rooms = await rooms,
            Enrollments = await enrollments,
            EnrollmentApplications = await enrollmentApplications,
            Attendance = await attendance,
            Reports = await reports,
            Schedules = await schedules,
            TeacherWorkShifts = await teacherWorkShifts,
            TeacherRoleOptions = await teacherRoleOptions,
            News = await news,
            LeaveRequests = await leaveRequests,
            Payments = await payments,
            CenterExpenses = await centerExpenses,
            OpeningBalances = await openingBalances,
            Alerts = await alerts,
            AuditLogs = await auditLogs,
            LearningModules = await learningModules,
            LearningModuleVersions = await learningModuleVersions,
            ParentStudents = await parentStudents,
            AccountInvitations = await accountInvitations,
            StudentOps = await studentOps,
            CenterHolidays = await centerHolidays,
            TeacherDuties = await teacherDuties,
            WebsiteGallery = await websiteGallery,
            StaffTasks = await staffTasks,
            SessionPackages = await sessionPackages,
            SessionHistory = await sessionHistory,
            TeacherComments = await teacherComments,
            TeacherNotes = await teacherNotes,
            StudentDocuments = await studentDocuments,
            ChatGroups = await chatGroups,
            Settings = await settings
        };
        FamilyAccess.EnsureLegacyLinks(data);
        WorkflowOps.EnsureLists(data);
        PermissionCatalog.EnsureRows(data);
        EnsureRoles(data);
        EnsureRooms(data);
        return data;
    }

    private async Task SaveUnlockedAsync(HirayaDatabase incoming, CancellationToken ct)
    {
        var data = Clone(incoming);
        WorkflowOps.EnsureLists(data);
        EnsureRoles(data);
        EnsureRooms(data);
        PermissionCatalog.EnsureRows(data);
        if (string.IsNullOrWhiteSpace(data.Settings.SettingsId))
            data.Settings.SettingsId = "center";

        await using var probe = await _factory.CreateDbContextAsync(ct);
        var strategy = probe.Database.CreateExecutionStrategy();
        try
        {
            await strategy.ExecuteAsync(async () =>
            {
                await using var db = await _factory.CreateDbContextAsync(ct);
                await using var tx = await db.Database.BeginTransactionAsync(ct);
                var hashes = await db.Users.AsNoTracking().ToDictionaryAsync(u => u.UserId, u => u.Password, ct);
                foreach (var user in data.Users)
                {
                    if (string.IsNullOrWhiteSpace(user.Password) && hashes.TryGetValue(user.UserId, out var hash))
                        user.Password = hash;
                }

                await ReplaceAsync(db.Users, data.Users, ct);
                await ReplaceAsync(db.Roles, data.Roles, ct);
                await ReplaceAsync(db.RolePermissions, data.RolePermissions, ct);
                await ReplaceAsync(db.TeacherProfiles, data.TeacherProfiles, ct);
                await ReplaceAsync(db.Students, data.Students, ct);
                await ReplaceAsync(db.Programs, data.Programs, ct);
                await ReplaceAsync(db.Classes, data.Classes, ct);
                await ReplaceAsync(db.Rooms, data.Rooms, ct);
                await ReplaceAsync(db.Enrollments, data.Enrollments, ct);
                await ReplaceAsync(db.EnrollmentApplications, data.EnrollmentApplications, ct);
                await ReplaceAsync(db.Attendance, data.Attendance, ct);
                await ReplaceAsync(db.ProgressRecords, data.Reports, ct);
                await ReplaceAsync(db.Schedules, data.Schedules, ct);
                await ReplaceAsync(db.TeacherWorkShifts, data.TeacherWorkShifts, ct);
                await ReplaceAsync(db.TeacherRoleOptions, data.TeacherRoleOptions, ct);
                await ReplaceAsync(db.News, data.News, ct);
                await ReplaceAsync(db.LeaveRequests, data.LeaveRequests, ct);
                await ReplaceAsync(db.Payments, data.Payments, ct);
                await ReplaceAsync(db.CenterExpenses, data.CenterExpenses, ct);
                await ReplaceAsync(db.OpeningBalances, data.OpeningBalances, ct);
                await ReplaceAsync(db.Notifications, data.Alerts, ct);
                await ReplaceAsync(db.AuditLogs, data.AuditLogs, ct);
                await ReplaceAsync(db.LearningModules, data.LearningModules, ct);
                await ReplaceAsync(db.LearningModuleVersions, data.LearningModuleVersions, ct);
                await ReplaceAsync(db.ParentStudents, data.ParentStudents, ct);
                await ReplaceAsync(db.AccountInvitations, data.AccountInvitations, ct);
                await ReplaceAsync(db.StudentOps, data.StudentOps, ct);
                await ReplaceAsync(db.CenterHolidays, data.CenterHolidays, ct);
                await ReplaceAsync(db.TeacherDuties, data.TeacherDuties, ct);
                await ReplaceAsync(db.WebsiteGallery, data.WebsiteGallery, ct);
                await ReplaceAsync(db.StaffTasks, data.StaffTasks, ct);
                await ReplaceAsync(db.SessionPackages, data.SessionPackages, ct);
                await ReplaceAsync(db.SessionHistory, data.SessionHistory, ct);
                await ReplaceAsync(db.TeacherComments, data.TeacherComments, ct);
                await ReplaceAsync(db.TeacherNotes, data.TeacherNotes, ct);
                await ReplaceAsync(db.StudentDocuments, data.StudentDocuments, ct);
                await ReplaceAsync(db.ChatGroups, data.ChatGroups, ct);

                var settings = await db.Settings.ToListAsync(ct);
                db.Settings.RemoveRange(settings);
                db.Settings.Add(data.Settings);

                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed saving HLCMS store.");
            throw new InvalidOperationException(SaveFailureMessage(ex));
        }
    }

    private async Task SaveChangedAsync(HirayaDatabase before, HirayaDatabase after, CancellationToken ct)
    {
        WorkflowOps.EnsureLists(before);
        WorkflowOps.EnsureLists(after);
        foreach (var user in after.Users)
        {
            if (!string.IsNullOrWhiteSpace(user.Password))
                continue;
            var prior = before.Users.FirstOrDefault(item => item.UserId == user.UserId);
            if (prior != null)
                user.Password = prior.Password;
        }
        if (string.IsNullOrWhiteSpace(after.Settings.SettingsId))
            after.Settings.SettingsId = "center";

        await using var probe = await _factory.CreateDbContextAsync(ct);
        var strategy = probe.Database.CreateExecutionStrategy();
        try
        {
            await strategy.ExecuteAsync(async () =>
            {
                await using var db = await _factory.CreateDbContextAsync(ct);
                await using var tx = await db.Database.BeginTransactionAsync(ct);
                if (!Same(before.Users, after.Users)) await ReplaceAsync(db.Users, after.Users, ct);
                if (!Same(before.Roles, after.Roles)) await ReplaceAsync(db.Roles, after.Roles, ct);
                if (!Same(before.RolePermissions, after.RolePermissions)) await ReplaceAsync(db.RolePermissions, after.RolePermissions, ct);
                if (!Same(before.TeacherProfiles, after.TeacherProfiles)) await ReplaceAsync(db.TeacherProfiles, after.TeacherProfiles, ct);
                if (!Same(before.Students, after.Students)) await ReplaceAsync(db.Students, after.Students, ct);
                if (!Same(before.Programs, after.Programs)) await ReplaceAsync(db.Programs, after.Programs, ct);
                if (!Same(before.Classes, after.Classes)) await ReplaceAsync(db.Classes, after.Classes, ct);
                if (!Same(before.Rooms, after.Rooms)) await ReplaceAsync(db.Rooms, after.Rooms, ct);
                if (!Same(before.Enrollments, after.Enrollments)) await ReplaceAsync(db.Enrollments, after.Enrollments, ct);
                if (!Same(before.EnrollmentApplications, after.EnrollmentApplications)) await ReplaceAsync(db.EnrollmentApplications, after.EnrollmentApplications, ct);
                if (!Same(before.Attendance, after.Attendance)) await ReplaceAsync(db.Attendance, after.Attendance, ct);
                if (!Same(before.Reports, after.Reports)) await ReplaceAsync(db.ProgressRecords, after.Reports, ct);
                if (!Same(before.Schedules, after.Schedules)) await ReplaceAsync(db.Schedules, after.Schedules, ct);
                if (!Same(before.TeacherWorkShifts, after.TeacherWorkShifts)) await ReplaceAsync(db.TeacherWorkShifts, after.TeacherWorkShifts, ct);
                if (!Same(before.TeacherRoleOptions, after.TeacherRoleOptions)) await ReplaceAsync(db.TeacherRoleOptions, after.TeacherRoleOptions, ct);
                if (!Same(before.News, after.News)) await ReplaceAsync(db.News, after.News, ct);
                if (!Same(before.LeaveRequests, after.LeaveRequests)) await ReplaceAsync(db.LeaveRequests, after.LeaveRequests, ct);
                if (!Same(before.Payments, after.Payments)) await ReplaceAsync(db.Payments, after.Payments, ct);
                if (!Same(before.CenterExpenses, after.CenterExpenses)) await ReplaceAsync(db.CenterExpenses, after.CenterExpenses, ct);
                if (!Same(before.OpeningBalances, after.OpeningBalances)) await ReplaceAsync(db.OpeningBalances, after.OpeningBalances, ct);
                if (!Same(before.Alerts, after.Alerts)) await ReplaceAsync(db.Notifications, after.Alerts, ct);
                if (!Same(before.AuditLogs, after.AuditLogs)) await ReplaceAsync(db.AuditLogs, after.AuditLogs, ct);
                if (!Same(before.LearningModules, after.LearningModules)) await ReplaceAsync(db.LearningModules, after.LearningModules, ct);
                if (!Same(before.LearningModuleVersions, after.LearningModuleVersions)) await ReplaceAsync(db.LearningModuleVersions, after.LearningModuleVersions, ct);
                if (!Same(before.ParentStudents, after.ParentStudents)) await ReplaceAsync(db.ParentStudents, after.ParentStudents, ct);
                if (!Same(before.AccountInvitations, after.AccountInvitations)) await ReplaceAsync(db.AccountInvitations, after.AccountInvitations, ct);
                if (!Same(before.StudentOps, after.StudentOps)) await ReplaceAsync(db.StudentOps, after.StudentOps, ct);
                if (!Same(before.CenterHolidays, after.CenterHolidays)) await ReplaceAsync(db.CenterHolidays, after.CenterHolidays, ct);
                if (!Same(before.TeacherDuties, after.TeacherDuties)) await ReplaceAsync(db.TeacherDuties, after.TeacherDuties, ct);
                if (!Same(before.WebsiteGallery, after.WebsiteGallery)) await ReplaceAsync(db.WebsiteGallery, after.WebsiteGallery, ct);
                if (!Same(before.StaffTasks, after.StaffTasks)) await ReplaceAsync(db.StaffTasks, after.StaffTasks, ct);
                if (!Same(before.SessionPackages, after.SessionPackages)) await ReplaceAsync(db.SessionPackages, after.SessionPackages, ct);
                if (!Same(before.SessionHistory, after.SessionHistory)) await ReplaceAsync(db.SessionHistory, after.SessionHistory, ct);
                if (!Same(before.TeacherComments, after.TeacherComments)) await ReplaceAsync(db.TeacherComments, after.TeacherComments, ct);
                if (!Same(before.TeacherNotes, after.TeacherNotes)) await ReplaceAsync(db.TeacherNotes, after.TeacherNotes, ct);
                if (!Same(before.StudentDocuments, after.StudentDocuments)) await ReplaceAsync(db.StudentDocuments, after.StudentDocuments, ct);
                if (!Same(before.ChatGroups, after.ChatGroups)) await ReplaceAsync(db.ChatGroups, after.ChatGroups, ct);
                if (!Same(before.Settings, after.Settings))
                {
                    var settings = await db.Settings.ToListAsync(ct);
                    db.Settings.RemoveRange(settings);
                    db.Settings.Add(after.Settings);
                }
                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed saving HLCMS store patch.");
            throw new InvalidOperationException(SaveFailureMessage(ex));
        }
    }

    private static string SaveFailureMessage(Exception ex)
    {
        var detail = (ex.InnerException?.Message ?? ex.Message) ?? "";
        if (detail.Contains("23505", StringComparison.Ordinal) ||
            detail.Contains("unique", StringComparison.OrdinalIgnoreCase) ||
            detail.Contains("duplicate", StringComparison.OrdinalIgnoreCase))
            return "This email is already used at this center. Use a different parent email.";
        if (detail.Contains("22001", StringComparison.Ordinal) ||
            detail.Contains("too long", StringComparison.OrdinalIgnoreCase) ||
            detail.Contains("varying(191)", StringComparison.OrdinalIgnoreCase))
            return "Some application details were too long for an old database column. Neon is being updated. Close this window and try again in a few minutes.";
        return "The center could not save those changes on Neon PostgreSQL. Close this window, refresh, and try again.";
    }

    private static bool Same<T>(T before, T after) =>
        JsonSerializer.Serialize(before, JsonDefaults.Options) == JsonSerializer.Serialize(after, JsonDefaults.Options);

    private static async Task ReplaceAsync<T>(DbSet<T> set, List<T>? next, CancellationToken ct) where T : class
    {
        var current = await set.ToListAsync(ct);
        set.RemoveRange(current);
        if (next is { Count: > 0 })
            await set.AddRangeAsync(next, ct);
    }

    private static void EnsureRoles(HirayaDatabase data)
    {
        if (data.Roles.Count > 0)
            return;
        data.Roles = UserRoles.All.Select(code => new AppRole
        {
            RoleId = "role_" + code,
            Code = code,
            Name = Navigation.RoleLabel(code)
        }).ToList();
    }

    private static void EnsureRooms(HirayaDatabase data)
    {
        var names = data.Classes.Select(c => c.Room)
            .Concat(data.Schedules.Select(s => s.Room))
            .Concat(data.Rooms.Select(r => r.RoomName))
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        foreach (var name in names)
        {
            if (data.Rooms.Any(r => string.Equals(r.RoomName, name, StringComparison.OrdinalIgnoreCase)))
                continue;
            data.Rooms.Add(new CenterRoom
            {
                RoomId = IdFactory.New("room"),
                RoomName = name.Trim(),
                RoomNumber = name.Trim(),
                Status = "active"
            });
        }
    }

    private HirayaDatabase? SnapshotCache()
    {
        var cache = _cache;
        if (cache is null || DateTime.UtcNow - _cacheAtUtc >= CacheTtl)
            return null;
        return Clone(cache);
    }

    private void Remember(HirayaDatabase data)
    {
        _cache = Clone(data);
        _cacheAtUtc = DateTime.UtcNow;
    }

    private static HirayaDatabase Clone(HirayaDatabase db)
    {
        var json = JsonSerializer.Serialize(db, JsonDefaults.Options);
        return JsonSerializer.Deserialize<HirayaDatabase>(json, JsonDefaults.Options) ?? new HirayaDatabase();
    }
}
