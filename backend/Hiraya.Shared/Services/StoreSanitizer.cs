using Hiraya.Shared.Models;

namespace Hiraya.Shared.Services;

public static class StoreSanitizer
{
    public static HirayaDatabase PublicCopy(HirayaDatabase source)
    {
        var json = System.Text.Json.JsonSerializer.Serialize(source, Firebase.JsonDefaults.Options);
        var copy = System.Text.Json.JsonSerializer.Deserialize<HirayaDatabase>(json, Firebase.JsonDefaults.Options)
                   ?? new HirayaDatabase();
        foreach (var user in copy.Users)
            user.Password = null;
        foreach (var invite in copy.AccountInvitations)
            invite.TokenHash = "";
        return copy;
    }

    public static HirayaDatabase VisibleTo(HirayaDatabase source, HirayaUser actor)
    {
        var copy = PublicCopy(source);
        WorkflowOps.EnsureLists(copy);
        if (Navigation.IsFamilyRole(actor.Role))
            return ForFamily(copy, actor);
        if (actor.Role == UserRoles.Teacher)
            return ForTeacher(copy, actor);
        if (actor.Role == UserRoles.Staff)
            return ForStaff(copy, actor);
        return copy;
    }

    private static HirayaDatabase ForFamily(HirayaDatabase copy, HirayaUser actor)
    {
        var ids = FamilyAccess.AuthorizedStudentIds(copy, actor);
        copy.Students = copy.Students.Where(s => ids.Contains(s.StudentId)).ToList();
        copy.ParentStudents = copy.ParentStudents.Where(l =>
            l.IsActive &&
            (l.ParentId == actor.UserId || ids.Contains(l.StudentId))).ToList();
        copy.Enrollments = copy.Enrollments.Where(e => ids.Contains(e.StudentId)).ToList();
        copy.Attendance = copy.Attendance.Where(a => ids.Contains(a.StudentId)).ToList();
        copy.Reports = copy.Reports.Where(r => ids.Contains(r.StudentId) && r.Status == ProgressStatuses.Published).ToList();
        copy.Payments = copy.Payments.Where(p => ids.Contains(p.StudentId)).ToList();
        copy.CenterExpenses = [];
        copy.OpeningBalances = [];
        copy.StudentOps = copy.StudentOps.Where(o => ids.Contains(o.StudentId)).ToList();
        var classIds = copy.Enrollments.Select(e => e.ClassId).ToHashSet();
        copy.Classes = copy.Classes.Where(c => classIds.Contains(c.ClassId)).ToList();
        var teacherIds = copy.Classes.Select(c => c.TeacherId).Where(id => !string.IsNullOrWhiteSpace(id)).ToHashSet();
        var coParentIds = copy.ParentStudents
            .Where(l => l.IsActive && ids.Contains(l.StudentId) && l.ParentId != actor.UserId)
            .Select(l => l.ParentId)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var student in copy.Students)
        {
            if (!string.IsNullOrWhiteSpace(student.ParentId) &&
                !string.Equals(student.ParentId, actor.UserId, StringComparison.OrdinalIgnoreCase))
                coParentIds.Add(student.ParentId);
        }
        var adminIds = copy.Users
            .Where(u => UserRoles.IsAdmin(u.Role))
            .Select(u => u.UserId)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        copy.Users = copy.Users.Where(u =>
            u.UserId == actor.UserId ||
            teacherIds.Contains(u.UserId) ||
            coParentIds.Contains(u.UserId) ||
            adminIds.Contains(u.UserId)).ToList();
        copy.Schedules = copy.Schedules.Where(s =>
            classIds.Contains(s.ClassId) || ids.Contains(s.StudentId)).ToList();
        copy.EnrollmentApplications = [];
        copy.AuditLogs = [];
        copy.AccountInvitations = [];
        copy.TeacherProfiles = [];
        copy.TeacherWorkShifts = [];
        copy.LeaveRequests = [];
        copy.TeacherDuties = [];
        copy.LearningModuleVersions = [];
        copy.LearningModules = LearningModuleService.Visible(copy, actor).ToList();
        copy.WebsiteGallery = [];
        copy.StaffTasks = [];
        copy.SessionPackages = copy.SessionPackages.Where(p => ids.Contains(p.StudentId)).ToList();
        copy.SessionHistory = copy.SessionHistory.Where(h => ids.Contains(h.StudentId)).ToList();
        copy.News = copy.News.Where(n => WorkflowOps.NewsVisibleTo(copy, n, actor)).ToList();
        copy.TeacherComments = [];
        copy.TeacherNotes = [];
        copy.StudentDocuments = copy.StudentDocuments.Where(d => ids.Contains(d.StudentId)).ToList();
        copy.ChatGroups = copy.ChatGroups
            .Where(g => NotificationService.PackedIds(g.MemberIds).Contains(actor.UserId) &&
                        !string.Equals(g.Status, "archived", StringComparison.OrdinalIgnoreCase))
            .ToList();
        copy.Alerts = copy.Alerts.Where(a =>
            a.RecipientId == actor.UserId || a.RecipientId == "everyone").ToList();
        foreach (var student in copy.Students)
        {
            student.Notes = "";
            student.QrCode = "";
        }
        foreach (var report in copy.Reports)
            report.History = [];
        return copy;
    }

    private static HirayaDatabase ForTeacher(HirayaDatabase copy, HirayaUser actor)
    {
        var ids = FamilyAccess.AssignedStudentIdsForTeacher(copy, actor.UserId);
        var classIds = copy.Classes
            .Where(c => c.TeacherId == actor.UserId)
            .Select(c => c.ClassId)
            .ToHashSet();
        foreach (var enrollment in copy.Enrollments.Where(e => ids.Contains(e.StudentId)))
            classIds.Add(enrollment.ClassId);

        copy.Users = copy.Users.Where(u =>
            u.UserId == actor.UserId ||
            u.Role == UserRoles.Teacher ||
            UserRoles.IsAdmin(u.Role)).ToList();
        copy.Students = copy.Students.Where(s => ids.Contains(s.StudentId)).ToList();
        copy.ParentStudents = copy.ParentStudents.Where(l => l.IsActive && ids.Contains(l.StudentId)).ToList();
        copy.Enrollments = copy.Enrollments.Where(e => ids.Contains(e.StudentId)).ToList();
        copy.Attendance = copy.Attendance.Where(a =>
            a.Kind == AttendanceKinds.Employee
                ? a.EmployeeId == actor.UserId || a.RecordedBy == actor.UserId
                : ids.Contains(a.StudentId)).ToList();
        copy.Reports = copy.Reports.Where(r => ids.Contains(r.StudentId)).ToList();
        copy.Payments = copy.Payments
            .Where(p =>
                string.Equals(p.EnrollmentId, "teacher", StringComparison.OrdinalIgnoreCase) &&
                string.Equals(p.StudentId, actor.UserId, StringComparison.OrdinalIgnoreCase))
            .Select(p =>
            {
                p.AccountNumber = "";
                p.FromAccountNumber = "";
                return p;
            })
            .ToList();
        copy.CenterExpenses = [];
        copy.OpeningBalances = [];
        copy.StudentOps = [];
        copy.Classes = copy.Classes.Where(c => classIds.Contains(c.ClassId)).ToList();
        copy.Schedules = copy.Schedules.Where(s =>
            WorkflowOps.ScheduleAssignedTo(s, actor.UserId) ||
            classIds.Contains(s.ClassId) ||
            ids.Contains(s.StudentId)).ToList();
        copy.EnrollmentApplications = [];
        copy.AuditLogs = [];
        copy.AccountInvitations = [];
        copy.RolePermissions = [];
        copy.Roles = [];
        copy.TeacherProfiles = copy.TeacherProfiles.Where(p => p.UserId == actor.UserId).ToList();
        copy.TeacherWorkShifts = copy.TeacherWorkShifts.Where(s => s.TeacherId == actor.UserId).ToList();
        copy.LeaveRequests = copy.LeaveRequests.Where(l => l.TeacherId == actor.UserId).ToList();
        copy.TeacherDuties = copy.TeacherDuties.Where(d => d.TeacherId == actor.UserId).ToList();
        copy.WebsiteGallery = [];
        copy.Alerts = copy.Alerts.Where(a => a.RecipientId == actor.UserId).ToList();
        copy.StaffTasks = copy.StaffTasks.Where(t => WorkflowOps.TaskAssignedTo(t, actor.UserId)).ToList();
        copy.SessionPackages = copy.SessionPackages.Where(p => ids.Contains(p.StudentId)).ToList();
        copy.SessionHistory = copy.SessionHistory.Where(h => ids.Contains(h.StudentId)).ToList();
        copy.News = copy.News.Where(n => WorkflowOps.NewsVisibleTo(copy, n, actor)).ToList();
        copy.TeacherComments = copy.TeacherComments.Where(c =>
            c.TeacherId == actor.UserId &&
            c.Status != "archived" &&
            (c.Visibility == "teacher" || c.CreatedBy == actor.UserId)).ToList();
        copy.TeacherNotes = copy.TeacherNotes.Where(n =>
            n.TeacherId == actor.UserId &&
            n.Visibility == "teacher" &&
            n.Status != "archived").ToList();
        copy.StudentDocuments = copy.StudentDocuments.Where(d => ids.Contains(d.StudentId)).ToList();
        copy.ChatGroups = copy.ChatGroups
            .Where(g => NotificationService.PackedIds(g.MemberIds).Contains(actor.UserId) &&
                        !string.Equals(g.Status, "archived", StringComparison.OrdinalIgnoreCase))
            .ToList();
        return copy;
    }

    private static HirayaDatabase ForStaff(HirayaDatabase copy, HirayaUser actor)
    {
        copy.Users = copy.Users.Where(u =>
            u.UserId == actor.UserId ||
            UserRoles.IsAdmin(u.Role) ||
            Navigation.IsEmployeeRole(u.Role)).ToList();
        copy.EnrollmentApplications = [];
        copy.CenterExpenses = [];
        copy.OpeningBalances = [];
        copy.AuditLogs = [];
        copy.AccountInvitations = [];
        copy.RolePermissions = [];
        copy.Roles = [];
        copy.Reports = copy.Reports.Where(r => r.Status == ProgressStatuses.Published).ToList();
        copy.Alerts = copy.Alerts.Where(a => a.RecipientId == actor.UserId).ToList();
        copy.WebsiteGallery = [];
        copy.TeacherComments = [];
        copy.TeacherNotes = [];
        copy.ChatGroups = copy.ChatGroups
            .Where(g => NotificationService.PackedIds(g.MemberIds).Contains(actor.UserId) &&
                        !string.Equals(g.Status, "archived", StringComparison.OrdinalIgnoreCase))
            .ToList();
        return copy;
    }

    public static HirayaDatabase MergeStoreWrite(HirayaDatabase current, HirayaDatabase incoming, HirayaUser? actor)
    {
        if (actor is null)
            throw new UnauthorizedAccessException("Sign in is required to save center data.");
        WorkflowOps.EnsureLists(current);
        WorkflowOps.EnsureLists(incoming);
        if (Navigation.IsFamilyRole(actor.Role))
            return MergeFamilyWrite(CloneKeepSecrets(current), incoming, actor);
        if (actor.Role == UserRoles.Teacher)
            return MergeTeacherWrite(CloneKeepSecrets(current), incoming, actor);
        if (actor.Role == UserRoles.Staff)
            return MergeStaffWrite(CloneKeepSecrets(current), incoming, actor);

        FamilyAccess.EnsureLegacyLinks(current);
        FamilyAccess.EnsureLegacyLinks(incoming);
        ProductAccounts.RequireParentOnEveryStudent(current, incoming);

        foreach (var user in incoming.Users)
        {
            if (string.IsNullOrWhiteSpace(user.Password))
            {
                var prior = current.Users.FirstOrDefault(u => u.UserId == user.UserId);
                if (prior != null)
                    user.Password = prior.Password;
            }
        }

        var admin = Navigation.CanManageStudents(actor.Role);
        if (!Navigation.CanManageSchedule(actor.Role))
            incoming.TeacherDuties = current.TeacherDuties;
        if (!Navigation.CanManageEnrollment(actor.Role))
            incoming.EnrollmentApplications = current.EnrollmentApplications;
        incoming.WebsiteGallery = current.WebsiteGallery;
        if (!admin)
        {
            incoming.ParentStudents = current.ParentStudents;
            incoming.AccountInvitations = current.AccountInvitations;
            foreach (var student in incoming.Students)
            {
                var prior = current.Students.FirstOrDefault(s => s.StudentId == student.StudentId);
                if (prior != null)
                    student.ParentId = prior.ParentId;
            }
        }
        else
        {
            foreach (var invite in incoming.AccountInvitations)
            {
                if (!string.IsNullOrWhiteSpace(invite.TokenHash))
                    continue;
                var prior = current.AccountInvitations.FirstOrDefault(i => i.InvitationId == invite.InvitationId);
                if (prior != null)
                    invite.TokenHash = prior.TokenHash;
            }
        }

        var previous = CloneKeepSecrets(current);
        foreach (var package in incoming.SessionPackages)
            WorkflowOps.RecalculatePackage(package);
        var priorSchedules = previous.Schedules.ToDictionary(s => s.ScheduleId);
        foreach (var schedule in incoming.Schedules.Where(s => s.Kind != ScheduleKinds.TeacherTask))
        {
            if (priorSchedules.TryGetValue(schedule.ScheduleId, out var prior) &&
                prior.StartAt == schedule.StartAt &&
                prior.EndAt == schedule.EndAt &&
                prior.TeacherId == schedule.TeacherId &&
                prior.Room == schedule.Room &&
                prior.Status == schedule.Status)
                continue;
            var issues = ScheduleService.DetectConflicts(incoming, schedule);
            if (issues.Count > 0)
                throw new InvalidOperationException(string.Join(" ", issues));
        }
        WorkflowOps.AfterAdminSave(previous, incoming, actor);
        StudentTuition.Enforce(previous, incoming);
        return incoming;
    }

    private static HirayaDatabase CloneKeepSecrets(HirayaDatabase source)
    {
        var json = System.Text.Json.JsonSerializer.Serialize(source, Firebase.JsonDefaults.Options);
        return System.Text.Json.JsonSerializer.Deserialize<HirayaDatabase>(json, Firebase.JsonDefaults.Options)
               ?? new HirayaDatabase();
    }

    private static HirayaDatabase MergeTeacherWrite(HirayaDatabase current, HirayaDatabase incoming, HirayaUser actor)
    {
        FamilyAccess.EnsureLegacyLinks(current);
        FamilyAccess.EnsureLegacyLinks(incoming);
        WorkflowOps.EnsureLists(current);
        WorkflowOps.EnsureLists(incoming);
        current = CloneKeepSecrets(current);
        var previous = CloneKeepSecrets(current);
        var allowed = FamilyAccess.AssignedStudentIdsForTeacher(current, actor.UserId);

        current.Attendance = MergeAttendance(current.Attendance, incoming.Attendance, allowed, actor.UserId);
        current.Reports = current.Reports.Where(r => !allowed.Contains(r.StudentId))
            .Concat(incoming.Reports.Where(r => allowed.Contains(r.StudentId)))
            .ToList();
        current.Alerts = current.Alerts.Where(a => a.RecipientId != actor.UserId)
            .Concat(incoming.Alerts.Where(a => a.RecipientId == actor.UserId))
            .ToList();
        current.LeaveRequests = current.LeaveRequests.Where(l => l.TeacherId != actor.UserId)
            .Concat(incoming.LeaveRequests.Where(l => l.TeacherId == actor.UserId))
            .ToList();
        current.TeacherWorkShifts = current.TeacherWorkShifts.Where(s => s.TeacherId != actor.UserId)
            .Concat(incoming.TeacherWorkShifts.Where(s => s.TeacherId == actor.UserId))
            .ToList();
        current.Schedules = current.Schedules
            .Where(s => !(s.Kind == ScheduleKinds.TeacherTask && s.TeacherId == actor.UserId))
            .Concat(incoming.Schedules.Where(s =>
                s.Kind == ScheduleKinds.TeacherTask && s.TeacherId == actor.UserId))
            .ToList();
        current.StaffTasks = current.StaffTasks
            .Where(t => !WorkflowOps.TaskAssignedTo(t, actor.UserId))
            .Concat(incoming.StaffTasks.Where(t => WorkflowOps.TaskAssignedTo(t, actor.UserId)))
            .ToList();
        OverlayStudentSessions(current, incoming, allowed);
        WorkflowOps.AfterTeacherSave(previous, current, actor);
        return current;
    }

    private static HirayaDatabase MergeFamilyWrite(HirayaDatabase current, HirayaDatabase incoming, HirayaUser actor)
    {
        current.Alerts = current.Alerts.Where(a => a.RecipientId != actor.UserId)
            .Concat(incoming.Alerts.Where(a => a.RecipientId == actor.UserId).Select(a =>
            {
                if (a.Read && string.IsNullOrWhiteSpace(a.ReadAt))
                    a.ReadAt = DateTime.UtcNow.ToString("o");
                return a;
            }))
            .ToList();
        return current;
    }

    private static HirayaDatabase MergeStaffWrite(HirayaDatabase current, HirayaDatabase incoming, HirayaUser actor)
    {
        FamilyAccess.EnsureLegacyLinks(current);
        FamilyAccess.EnsureLegacyLinks(incoming);
        var previous = CloneKeepSecrets(current);
        current.Payments = incoming.Payments;
        current.Attendance = incoming.Attendance;
        current.StudentOps = incoming.StudentOps;
        OverlayStudentSessions(current, incoming, null);
        StudentTuition.Enforce(previous, current);
        WorkflowOps.ConsumeNewPresentAttendance(previous, current, actor);
        SessionNoticeMail.QueueSessionChanges(previous, current);
        current.Alerts = current.Alerts.Where(a => a.RecipientId != actor.UserId)
            .Concat(incoming.Alerts.Where(a => a.RecipientId == actor.UserId))
            .ToList();
        return current;
    }

    /// <summary>
    /// One balance per student. Copy the incoming package and history for the allowed students
    /// so a class confirmation saved by the client is the same row the server keeps.
    /// A null allow-list copies every student (staff and admin-shaped writes).
    /// </summary>
    private static void OverlayStudentSessions(HirayaDatabase current, HirayaDatabase incoming, HashSet<string>? allowed)
    {
        WorkflowOps.EnsureLists(current);
        WorkflowOps.EnsureLists(incoming);
        bool Keep(string studentId) =>
            allowed is null || allowed.Contains(studentId);

        foreach (var package in incoming.SessionPackages.Where(p => Keep(p.StudentId)))
            WorkflowOps.RecalculatePackage(package);

        current.SessionPackages = current.SessionPackages
            .Where(p => !Keep(p.StudentId))
            .Concat(incoming.SessionPackages.Where(p => Keep(p.StudentId)))
            .ToList();
        current.SessionHistory = current.SessionHistory
            .Where(h => !Keep(h.StudentId))
            .Concat(incoming.SessionHistory.Where(h => Keep(h.StudentId)))
            .ToList();
    }

    private static List<AttendanceRecord> MergeAttendance(
        List<AttendanceRecord> current,
        List<AttendanceRecord> incoming,
        HashSet<string> allowed,
        string teacherId)
    {
        var keptStudents = current.Where(a => a.Kind != AttendanceKinds.Employee && !allowed.Contains(a.StudentId));
        var overlayStudents = incoming.Where(a => a.Kind != AttendanceKinds.Employee && allowed.Contains(a.StudentId));
        var keptEmployees = current.Where(a =>
            a.Kind == AttendanceKinds.Employee &&
            a.EmployeeId != teacherId &&
            a.RecordedBy != teacherId);
        var overlayEmployees = incoming.Where(a =>
            a.Kind == AttendanceKinds.Employee &&
            (a.EmployeeId == teacherId || a.RecordedBy == teacherId));
        return keptStudents.Concat(overlayStudents).Concat(keptEmployees).Concat(overlayEmployees).ToList();
    }
}

public sealed class LoginRequest
{
    public string Login { get; set; } = "";
    public string Password { get; set; } = "";
    public string Client { get; set; } = "";
}

public sealed class PasswordChangeRequest
{
    public string UserId { get; set; } = "";
    public string CurrentPassword { get; set; } = "";
    public string NewPassword { get; set; } = "";
    public string ConfirmPassword { get; set; } = "";
}
