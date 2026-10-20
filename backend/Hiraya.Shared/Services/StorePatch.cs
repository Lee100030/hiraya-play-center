using Hiraya.Shared.Models;
using Hiraya.Shared.Services.Firebase;

namespace Hiraya.Shared.Services;

public sealed class StorePatchRequest
{
    public List<string> Collections { get; set; } = new();
    public HirayaDatabase Upserts { get; set; } = new();
    public Dictionary<string, List<string>> Deletes { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public static class StorePatch
{
    public static async Task<HirayaDatabase> ApplyThroughAsync(
        IHirayaRepository repo,
        StorePatchRequest patch,
        HirayaUser actor,
        CancellationToken ct = default)
    {
        HirayaDatabase result = new();
        await repo.MutateAsync(db =>
        {
            var before = Clone(db);
            Apply(db, patch);
            result = StoreSanitizer.MergeStoreWrite(before, db, actor);
            CopyOnto(db, result);
            return Task.CompletedTask;
        }, ct);
        return result;
    }

    public static void Apply(HirayaDatabase target, StorePatchRequest patch)
    {
        WorkflowOps.EnsureLists(target);
        WorkflowOps.EnsureLists(patch.Upserts);
        foreach (var raw in patch.Collections.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            var name = (raw ?? "").Trim().ToLowerInvariant();
            if (name.Length == 0)
                continue;
            if (name == "settings")
            {
                var previous = target.Settings;
                target.Settings = patch.Upserts.Settings ?? target.Settings;
                RemovedAccounts.Preserve(previous, target.Settings);
                if (string.IsNullOrWhiteSpace(target.Settings.SettingsId))
                    target.Settings.SettingsId = "center";
                continue;
            }
            var deletes = Deletes(patch, name);
            switch (name)
            {
                case "users": ApplyRows(target.Users, patch.Upserts.Users, deletes, x => x.UserId); break;
                case "teacherprofiles": ApplyRows(target.TeacherProfiles, patch.Upserts.TeacherProfiles, deletes, x => x.ProfileId); break;
                case "students": ApplyRows(target.Students, patch.Upserts.Students, deletes, x => x.StudentId); break;
                case "programs": ApplyRows(target.Programs, patch.Upserts.Programs, deletes, x => x.ProgramId); break;
                case "classes": ApplyRows(target.Classes, patch.Upserts.Classes, deletes, x => x.ClassId); break;
                case "enrollments": ApplyRows(target.Enrollments, patch.Upserts.Enrollments, deletes, x => x.EnrollmentId); break;
                case "enrollmentapplications": ApplyRows(target.EnrollmentApplications, patch.Upserts.EnrollmentApplications, deletes, x => x.ApplicationId); break;
                case "attendance": ApplyRows(target.Attendance, patch.Upserts.Attendance, deletes, x => x.AttendanceId); break;
                case "reports": ApplyRows(target.Reports, patch.Upserts.Reports, deletes, x => x.ReportId); break;
                case "schedules": ApplyRows(target.Schedules, patch.Upserts.Schedules, deletes, x => x.ScheduleId); break;
                case "teacherworkshifts": ApplyRows(target.TeacherWorkShifts, patch.Upserts.TeacherWorkShifts, deletes, x => x.ShiftId); break;
                case "teacherroleoptions": ApplyRows(target.TeacherRoleOptions, patch.Upserts.TeacherRoleOptions, deletes, x => x.RoleId); break;
                case "news": ApplyRows(target.News, patch.Upserts.News, deletes, x => x.NewsId); break;
                case "leaverequests": ApplyRows(target.LeaveRequests, patch.Upserts.LeaveRequests, deletes, x => x.LeaveId); break;
                case "payments": ApplyRows(target.Payments, patch.Upserts.Payments, deletes, x => x.PaymentId); break;
                case "centerexpenses": ApplyRows(target.CenterExpenses, patch.Upserts.CenterExpenses, deletes, x => x.ExpenseId); break;
                case "openingbalances": ApplyRows(target.OpeningBalances, patch.Upserts.OpeningBalances, deletes, x => x.OpeningId); break;
                case "alerts": ApplyRows(target.Alerts, patch.Upserts.Alerts, deletes, x => x.AlertId); break;
                case "auditlogs": ApplyRows(target.AuditLogs, patch.Upserts.AuditLogs, deletes, x => x.AuditId); break;
                case "rolepermissions": ApplyRows(target.RolePermissions, patch.Upserts.RolePermissions, deletes, x => x.PermissionId); break;
                case "roles": ApplyRows(target.Roles, patch.Upserts.Roles, deletes, x => x.RoleId); break;
                case "rooms": ApplyRows(target.Rooms, patch.Upserts.Rooms, deletes, x => x.RoomId); break;
                case "learningmodules": ApplyRows(target.LearningModules, patch.Upserts.LearningModules, deletes, x => x.ModuleId); break;
                case "learningmoduleversions": ApplyRows(target.LearningModuleVersions, patch.Upserts.LearningModuleVersions, deletes, x => x.VersionId); break;
                case "parentstudents": ApplyRows(target.ParentStudents, patch.Upserts.ParentStudents, deletes, x => x.ParentStudentId); break;
                case "accountinvitations": ApplyRows(target.AccountInvitations, patch.Upserts.AccountInvitations, deletes, x => x.InvitationId); break;
                case "studentops": ApplyRows(target.StudentOps, patch.Upserts.StudentOps, deletes, x => x.StudentId); break;
                case "centerholidays": ApplyRows(target.CenterHolidays, patch.Upserts.CenterHolidays, deletes, x => x.HolidayId); break;
                case "teacherduties": ApplyRows(target.TeacherDuties, patch.Upserts.TeacherDuties, deletes, x => x.DutyId); break;
                case "websitegallery": ApplyRows(target.WebsiteGallery, patch.Upserts.WebsiteGallery, deletes, x => x.ItemId); break;
                case "stafftasks": ApplyRows(target.StaffTasks, patch.Upserts.StaffTasks, deletes, x => x.TaskId); break;
                case "sessionpackages": ApplyRows(target.SessionPackages, patch.Upserts.SessionPackages, deletes, x => x.PackageId); break;
                case "sessionhistory": ApplyRows(target.SessionHistory, patch.Upserts.SessionHistory, deletes, x => x.HistoryId); break;
                case "teachercomments": ApplyRows(target.TeacherComments, patch.Upserts.TeacherComments, deletes, x => x.CommentId); break;
                case "teachernotes": ApplyRows(target.TeacherNotes, patch.Upserts.TeacherNotes, deletes, x => x.NoteId); break;
                case "studentdocuments": ApplyRows(target.StudentDocuments, patch.Upserts.StudentDocuments, deletes, x => x.DocumentId); break;
                case "chatgroups": ApplyRows(target.ChatGroups, patch.Upserts.ChatGroups, deletes, x => x.GroupId); break;
            }
        }
        RemovedAccounts.Strip(target);
    }

    private static List<string> Deletes(StorePatchRequest patch, string name)
    {
        foreach (var pair in patch.Deletes)
        {
            if (!string.Equals(pair.Key, name, StringComparison.OrdinalIgnoreCase) || pair.Value is null)
                continue;
            return pair.Value;
        }
        return [];
    }

    private static void ApplyRows<T>(List<T> target, List<T>? upserts, List<string> deletes, Func<T, string?> id)
    {
        var drop = new HashSet<string>(deletes.Where(x => !string.IsNullOrWhiteSpace(x)), StringComparer.OrdinalIgnoreCase);
        if (drop.Count > 0)
            target.RemoveAll(row => drop.Contains(id(row) ?? ""));
        foreach (var row in upserts ?? [])
        {
            var key = (id(row) ?? "").Trim();
            if (key.Length == 0)
                continue;
            var index = target.FindIndex(item => string.Equals(id(item), key, StringComparison.OrdinalIgnoreCase));
            if (index >= 0)
                target[index] = row;
            else
                target.Add(row);
        }
    }

    private static void CopyOnto(HirayaDatabase target, HirayaDatabase source)
    {
        target.Users = source.Users;
        target.TeacherProfiles = source.TeacherProfiles;
        target.Students = source.Students;
        target.Programs = source.Programs;
        target.Classes = source.Classes;
        target.Enrollments = source.Enrollments;
        target.EnrollmentApplications = source.EnrollmentApplications;
        target.Attendance = source.Attendance;
        target.Reports = source.Reports;
        target.Schedules = source.Schedules;
        target.TeacherWorkShifts = source.TeacherWorkShifts;
        target.TeacherRoleOptions = source.TeacherRoleOptions;
        target.News = source.News;
        target.LeaveRequests = source.LeaveRequests;
        target.Payments = source.Payments;
        target.CenterExpenses = source.CenterExpenses;
        target.OpeningBalances = source.OpeningBalances;
        target.Alerts = source.Alerts;
        target.AuditLogs = source.AuditLogs;
        target.RolePermissions = source.RolePermissions;
        target.Roles = source.Roles;
        target.Rooms = source.Rooms;
        target.LearningModules = source.LearningModules;
        target.LearningModuleVersions = source.LearningModuleVersions;
        target.ParentStudents = source.ParentStudents;
        target.AccountInvitations = source.AccountInvitations;
        target.StudentOps = source.StudentOps;
        target.CenterHolidays = source.CenterHolidays;
        target.TeacherDuties = source.TeacherDuties;
        target.WebsiteGallery = source.WebsiteGallery;
        target.StaffTasks = source.StaffTasks;
        target.SessionPackages = source.SessionPackages;
        target.SessionHistory = source.SessionHistory;
        target.TeacherComments = source.TeacherComments;
        target.TeacherNotes = source.TeacherNotes;
        target.StudentDocuments = source.StudentDocuments;
        target.ChatGroups = source.ChatGroups;
        target.Settings = source.Settings;
    }

    private static HirayaDatabase Clone(HirayaDatabase db)
    {
        var json = System.Text.Json.JsonSerializer.Serialize(db, JsonDefaults.Options);
        return System.Text.Json.JsonSerializer.Deserialize<HirayaDatabase>(json, JsonDefaults.Options) ?? new HirayaDatabase();
    }
}
