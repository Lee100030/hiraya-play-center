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
        copy.Users = copy.Users.Where(u => u.UserId == actor.UserId).ToList();
        copy.Students = copy.Students.Where(s => ids.Contains(s.StudentId)).ToList();
        copy.ParentStudents = copy.ParentStudents.Where(l =>
            l.IsActive &&
            (l.ParentId == actor.UserId || ids.Contains(l.StudentId))).ToList();
        copy.Enrollments = copy.Enrollments.Where(e => ids.Contains(e.StudentId)).ToList();
        copy.Attendance = copy.Attendance.Where(a => ids.Contains(a.StudentId)).ToList();
        copy.Reports = copy.Reports.Where(r => ids.Contains(r.StudentId) && r.Status == ProgressStatuses.Published).ToList();
        copy.Payments = copy.Payments.Where(p => ids.Contains(p.StudentId)).ToList();
        copy.StudentOps = copy.StudentOps.Where(o => ids.Contains(o.StudentId)).ToList();
        var classIds = copy.Enrollments.Select(e => e.ClassId).ToHashSet();
        copy.Classes = copy.Classes.Where(c => classIds.Contains(c.ClassId)).ToList();
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
        copy.LearningModules = copy.LearningModules.Where(m => m.Status == LearningModuleStatuses.Published).ToList();
        copy.WebsiteGallery = [];
        copy.MakeupRequests = copy.MakeupRequests.Where(r => ids.Contains(r.StudentId)).ToList();
        copy.CertificateRequests = copy.CertificateRequests.Where(r => ids.Contains(r.StudentId)).ToList();
        copy.FormSubmissions = copy.FormSubmissions.Where(s => ids.Contains(s.StudentId)).ToList();
        copy.StaffTasks = [];
        foreach (var student in copy.Students)
        {
            student.Notes = "";
            student.QrCode = "";
        }
        foreach (var report in copy.Reports)
            report.History = [];
        copy.Alerts = copy.Alerts.Where(a => a.RecipientId == actor.UserId).ToList();
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

        copy.Users = copy.Users.Where(u => u.UserId == actor.UserId).ToList();
        copy.Students = copy.Students.Where(s => ids.Contains(s.StudentId)).ToList();
        copy.ParentStudents = copy.ParentStudents.Where(l => l.IsActive && ids.Contains(l.StudentId)).ToList();
        copy.Enrollments = copy.Enrollments.Where(e => ids.Contains(e.StudentId)).ToList();
        copy.Attendance = copy.Attendance.Where(a =>
            a.Kind == AttendanceKinds.Employee
                ? a.EmployeeId == actor.UserId || a.RecordedBy == actor.UserId
                : ids.Contains(a.StudentId)).ToList();
        copy.Reports = copy.Reports.Where(r => ids.Contains(r.StudentId)).ToList();
        copy.Payments = [];
        copy.StudentOps = [];
        copy.Classes = copy.Classes.Where(c => classIds.Contains(c.ClassId)).ToList();
        copy.Schedules = copy.Schedules.Where(s =>
            classIds.Contains(s.ClassId) || ids.Contains(s.StudentId)).ToList();
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
        copy.MakeupRequests = copy.MakeupRequests.Where(r => ids.Contains(r.StudentId)).ToList();
        copy.CertificateRequests = copy.CertificateRequests.Where(r => ids.Contains(r.StudentId)).ToList();
        copy.FormSubmissions = copy.FormSubmissions.Where(s => ids.Contains(s.StudentId)).ToList();
        copy.StaffTasks = copy.StaffTasks.Where(t => t.TeacherId == actor.UserId).ToList();
        return copy;
    }

    private static HirayaDatabase ForStaff(HirayaDatabase copy, HirayaUser actor)
    {
        copy.Users = copy.Users.Where(u =>
            u.UserId == actor.UserId ||
            UserRoles.IsAdmin(u.Role) ||
            Navigation.IsEmployeeRole(u.Role)).ToList();
        copy.EnrollmentApplications = [];
        copy.AuditLogs = [];
        copy.AccountInvitations = [];
        copy.RolePermissions = [];
        copy.Roles = [];
        copy.Reports = copy.Reports.Where(r => r.Status == ProgressStatuses.Published).ToList();
        copy.Alerts = copy.Alerts.Where(a => a.RecipientId == actor.UserId).ToList();
        copy.WebsiteGallery = [];
        return copy;
    }

    public static HirayaDatabase MergeStoreWrite(HirayaDatabase current, HirayaDatabase incoming, HirayaUser? actor)
    {
        if (actor is null)
            throw new UnauthorizedAccessException("Sign in is required to save center data.");
        if (Navigation.IsFamilyRole(actor.Role))
            throw new UnauthorizedAccessException("Family accounts cannot update the center store.");
        if (actor.Role == UserRoles.Teacher)
            return MergeTeacherWrite(CloneKeepSecrets(current), incoming, actor);
        if (actor.Role == UserRoles.Staff)
            return MergeStaffWrite(CloneKeepSecrets(current), incoming, actor);

        FamilyAccess.EnsureLegacyLinks(current);
        FamilyAccess.EnsureLegacyLinks(incoming);

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
        current.StaffTasks = current.StaffTasks.Where(t => t.TeacherId != actor.UserId)
            .Concat(incoming.StaffTasks.Where(t => t.TeacherId == actor.UserId))
            .ToList();
        current.MakeupRequests = current.MakeupRequests.Where(r => !allowed.Contains(r.StudentId))
            .Concat(incoming.MakeupRequests.Where(r => allowed.Contains(r.StudentId)))
            .ToList();
        return current;
    }

    private static HirayaDatabase MergeStaffWrite(HirayaDatabase current, HirayaDatabase incoming, HirayaUser actor)
    {
        FamilyAccess.EnsureLegacyLinks(current);
        FamilyAccess.EnsureLegacyLinks(incoming);
        current.Payments = incoming.Payments;
        current.Attendance = incoming.Attendance;
        current.StudentOps = incoming.StudentOps;
        current.Alerts = current.Alerts.Where(a => a.RecipientId != actor.UserId)
            .Concat(incoming.Alerts.Where(a => a.RecipientId == actor.UserId))
            .ToList();
        return current;
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
    public string Username { get; set; } = "";
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";

    public string ResolvedLogin =>
        !string.IsNullOrWhiteSpace(Login) ? Login.Trim()
        : !string.IsNullOrWhiteSpace(Username) ? Username.Trim()
        : (Email ?? "").Trim();
}

public sealed class PasswordChangeRequest
{
    public string UserId { get; set; } = "";
    public string CurrentPassword { get; set; } = "";
    public string NewPassword { get; set; } = "";
    public string ConfirmPassword { get; set; } = "";
}
