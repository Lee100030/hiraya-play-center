using Hiraya.Shared.Models;

namespace Hiraya.Shared.Services;

public static class WorkflowOps
{
    public static void EnsureLists(HirayaDatabase db)
    {
        db.StaffTasks ??= [];
        db.CenterExpenses ??= [];
        db.OpeningBalances ??= [];
        db.SessionPackages ??= [];
        db.SessionHistory ??= [];
        db.TeacherComments ??= [];
        db.TeacherNotes ??= [];
        db.StudentDocuments ??= [];
        db.ChatGroups ??= [];
        db.News ??= [];
        db.Alerts ??= [];
        db.Schedules ??= [];
    }

    public static IEnumerable<string> TeacherIdList(string? packed) =>
        (packed ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    public static bool TaskAssignedTo(StaffTask task, string teacherId) =>
        TeacherIdList(task.TeacherIds).Contains(teacherId);

    public static bool ScheduleAssignedTo(Schedule schedule, string teacherId) =>
        TeacherIdList(schedule.TeacherId).Contains(teacherId);

    public static void RecalculatePackage(SessionPackage package, DateTime? now = null)
    {
        var clock = now ?? DateTime.UtcNow;
        package.TotalSessions = Math.Max(0, package.TotalSessions);
        package.UsedSessions = Math.Clamp(package.UsedSessions, 0, package.TotalSessions);
        package.RemainingSessions = Math.Max(0, package.TotalSessions - package.UsedSessions);
        if (string.Equals(package.Status, SessionPackageStatuses.Suspended, StringComparison.OrdinalIgnoreCase))
            return;
        if (!string.IsNullOrWhiteSpace(package.ExpirationDate) &&
            DateTime.TryParse(package.ExpirationDate, out var expires) &&
            expires.Date < clock.Date &&
            package.RemainingSessions > 0)
        {
            package.Status = SessionPackageStatuses.Expired;
            return;
        }
        if (package.RemainingSessions <= 0)
            package.Status = SessionPackageStatuses.Completed;
        else if (package.RemainingSessions <= 2)
            package.Status = SessionPackageStatuses.AlmostFinished;
        else
            package.Status = SessionPackageStatuses.Active;
    }

    public static SessionPackage? ActivePackageFor(HirayaDatabase db, string studentId) =>
        db.SessionPackages
            .Where(p => string.Equals(p.StudentId, studentId, StringComparison.OrdinalIgnoreCase) &&
                        !string.Equals(p.Status, SessionPackageStatuses.Suspended, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefault();

    public static bool ConsumeSession(
        HirayaDatabase db,
        string studentId,
        HirayaUser? actor,
        string? scheduleId = null,
        string? attendanceId = null,
        string note = "Session completed")
    {
        EnsureLists(db);
        var package = ActivePackageFor(db, studentId);
        if (package is null || package.RemainingSessions <= 0)
            return false;
        if (!string.IsNullOrWhiteSpace(attendanceId) &&
            db.SessionHistory.Any(h => h.AttendanceId == attendanceId && h.Action == "used"))
            return false;

        package.UsedSessions += 1;
        RecalculatePackage(package);
        package.UpdatedAt = DateTime.UtcNow.ToString("o");
        db.SessionHistory.Add(new SessionHistoryEntry
        {
            HistoryId = IdFactory.New("sh"),
            PackageId = package.PackageId,
            StudentId = studentId,
            ScheduleId = scheduleId ?? "",
            AttendanceId = attendanceId ?? "",
            Action = "used",
            Note = note,
            ActorId = actor?.UserId ?? "",
            CreatedAt = DateTime.UtcNow.ToString("o")
        });

        return true;
    }

    public static bool NewsVisibleTo(HirayaDatabase db, NewsItem news, HirayaUser user)
    {
        if (!news.IsPublished || string.Equals(news.Status, "archived", StringComparison.OrdinalIgnoreCase))
            return false;
        if (!string.IsNullOrWhiteSpace(news.ExpiresAt) &&
            DateTime.TryParse(news.ExpiresAt, out var expires) &&
            expires < DateTime.UtcNow)
            return false;

        var audience = string.IsNullOrWhiteSpace(news.Audience) ? NotificationAudiences.Everyone : news.Audience;
        if (audience is NotificationAudiences.Everyone or "all")
            return true;
        if (audience is NotificationAudiences.Teachers)
            return user.Role == UserRoles.Teacher || UserRoles.IsAdmin(user.Role);
        if (audience is NotificationAudiences.Parents)
            return user.Role == UserRoles.Parent || UserRoles.IsAdmin(user.Role);
        if (audience is NotificationAudiences.Admins)
            return UserRoles.IsAdmin(user.Role);
        if (audience is NotificationAudiences.User)
            return user.UserId == news.AudienceId || UserRoles.IsAdmin(user.Role);
        if (audience == "class")
        {
            if (UserRoles.IsAdmin(user.Role)) return true;
            if (user.Role == UserRoles.Teacher)
                return db.Classes.Any(c => c.ClassId == news.AudienceId && c.TeacherId == user.UserId);
            if (user.Role == UserRoles.Parent)
            {
                var kids = FamilyAccess.AuthorizedStudentIds(db, user);
                return db.Enrollments.Any(e => e.ClassId == news.AudienceId && kids.Contains(e.StudentId));
            }
        }
        if (audience == "program")
        {
            if (UserRoles.IsAdmin(user.Role)) return true;
            if (user.Role == UserRoles.Teacher)
                return db.Classes.Any(c => c.ProgramId == news.AudienceId && c.TeacherId == user.UserId);
            if (user.Role == UserRoles.Parent)
            {
                var kids = FamilyAccess.AuthorizedStudentIds(db, user);
                return db.Enrollments.Any(e => e.ProgramId == news.AudienceId && kids.Contains(e.StudentId))
                       || db.Students.Any(s => kids.Contains(s.StudentId) && db.Programs.Any(p => p.ProgramId == news.AudienceId));
            }
        }
        return UserRoles.IsAdmin(user.Role);
    }

    public static IEnumerable<string> AudienceUserIds(HirayaDatabase db, string audience, string audienceId)
    {
        if (audience is NotificationAudiences.Everyone or "all")
            return db.Users.Where(u => u.Role is UserRoles.Teacher or UserRoles.Parent or UserRoles.SuperAdmin)
                .Select(u => u.UserId);
        if (audience is NotificationAudiences.Teachers)
            return db.Users.Where(u => u.Role == UserRoles.Teacher).Select(u => u.UserId);
        if (audience is NotificationAudiences.Parents)
            return db.Users.Where(u => u.Role == UserRoles.Parent).Select(u => u.UserId);
        if (audience is NotificationAudiences.User && !string.IsNullOrWhiteSpace(audienceId))
            return [audienceId];
        if (audience == "class")
        {
            var teacher = db.Classes.FirstOrDefault(c => c.ClassId == audienceId)?.TeacherId;
            var studentIds = db.Enrollments.Where(e => e.ClassId == audienceId).Select(e => e.StudentId).ToHashSet();
            var parents = db.ParentStudents.Where(l => l.IsActive && studentIds.Contains(l.StudentId)).Select(l => l.ParentId);
            return parents.Concat(string.IsNullOrWhiteSpace(teacher) ? Array.Empty<string>() : [teacher!]);
        }
        if (audience == "program")
        {
            var classIds = db.Classes.Where(c => c.ProgramId == audienceId).Select(c => c.ClassId).ToHashSet();
            var teachers = db.Classes.Where(c => c.ProgramId == audienceId).Select(c => c.TeacherId);
            var studentIds = db.Enrollments.Where(e => classIds.Contains(e.ClassId) || e.ProgramId == audienceId)
                .Select(e => e.StudentId).ToHashSet();
            var parents = db.ParentStudents.Where(l => l.IsActive && studentIds.Contains(l.StudentId)).Select(l => l.ParentId);
            return teachers.Concat(parents).Where(id => !string.IsNullOrWhiteSpace(id));
        }
        return [];
    }

    public static void AfterAdminSave(HirayaDatabase before, HirayaDatabase after, HirayaUser actor)
    {
        EnsureLists(before);
        EnsureLists(after);
        EnrollmentService.MaterializeNewlyApproved(before, after, actor);
        foreach (var package in after.SessionPackages)
            RecalculatePackage(package);

        var beforeSchedules = before.Schedules.ToDictionary(s => s.ScheduleId);
        foreach (var schedule in after.Schedules)
        {
            if (schedule.Kind == ScheduleKinds.TeacherTask)
                continue;
            var priorTeachers = beforeSchedules.TryGetValue(schedule.ScheduleId, out var priorSchedule)
                ? TeacherIdList(priorSchedule.TeacherId).ToHashSet(StringComparer.OrdinalIgnoreCase)
                : new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var assignedTeachers = TeacherIdList(schedule.TeacherId).ToList();
            foreach (var teacherId in assignedTeachers.Where(id => !priorTeachers.Contains(id)))
            {
                NotificationService.Push(
                    after,
                    teacherId,
                    $"A schedule was assigned: {schedule.Title}.",
                    NotificationKinds.Schedule,
                    "Schedule assigned",
                    "/schedule");
                var alert = after.Alerts.LastOrDefault(a => a.RecipientId == teacherId);
                if (alert != null) alert.RelatedRecordId = schedule.ScheduleId;
            }
            if (!beforeSchedules.ContainsKey(schedule.ScheduleId))
                NotifyParentsForSchedule(after, schedule);
        }

        var beforeTasks = before.StaffTasks.ToDictionary(t => t.TaskId);
        foreach (var task in after.StaffTasks)
        {
            if (beforeTasks.ContainsKey(task.TaskId))
                continue;
            foreach (var teacherId in TeacherIdList(task.TeacherIds))
            {
                NotificationService.Push(
                    after,
                    teacherId,
                    $"A task was assigned: {task.Title}.",
                    NotificationKinds.Task,
                    "Task assigned",
                    "/tasks");
                var alert = after.Alerts.LastOrDefault(a => a.RecipientId == teacherId);
                if (alert != null) alert.RelatedRecordId = task.TaskId;
            }
        }

        var beforeNews = before.News.ToDictionary(n => n.NewsId);
        foreach (var news in after.News)
        {
            var wasPublished = beforeNews.TryGetValue(news.NewsId, out var prior) && prior.IsPublished;
            if (!news.IsPublished || wasPublished)
                continue;
            foreach (var userId in AudienceUserIds(after, news.Audience, news.AudienceId).Distinct())
            {
                NotificationService.Push(
                    after,
                    userId,
                    news.Title,
                    NotificationKinds.Announcement,
                    "Announcement",
                    "/announcements");
                var alert = after.Alerts.LastOrDefault(a => a.RecipientId == userId);
                if (alert != null) alert.RelatedRecordId = news.NewsId;
            }
        }

        ConsumeNewPresentAttendance(before, after, actor);
        SessionNoticeMail.QueueSessionChanges(before, after);
    }

    public static void ConsumeNewPresentAttendance(HirayaDatabase before, HirayaDatabase after, HirayaUser actor)
    {
        EnsureLists(before);
        EnsureLists(after);
        before.Attendance ??= [];
        after.Attendance ??= [];
        var beforeById = before.Attendance.ToDictionary(a => a.AttendanceId);
        foreach (var row in after.Attendance.Where(a =>
                     a.Kind != AttendanceKinds.Employee &&
                     AttendanceStatuses.IsPresentLike(a.Status)))
        {
            beforeById.TryGetValue(row.AttendanceId, out var prior);
            if (prior != null && AttendanceStatuses.IsPresentLike(prior.Status))
                continue;
            ConsumeSession(after, row.StudentId, actor, attendanceId: row.AttendanceId);
            NotifyParentsForAttendance(after, row, actor);
        }
    }

    private static void NotifyParentsForAttendance(HirayaDatabase db, AttendanceRecord row, HirayaUser actor)
    {
        var student = db.Students.FirstOrDefault(s => s.StudentId == row.StudentId);
        var childName = student is null
            ? "your child"
            : $"{student.FirstName} {student.LastName}".Trim();
        if (string.IsNullOrWhiteSpace(childName) || childName == "")
            childName = string.IsNullOrWhiteSpace(student?.Fullname) ? "your child" : student!.Fullname.Trim();
        var status = AttendanceStatuses.IsPresentLike(row.Status)
            ? "present"
            : (string.IsNullOrWhiteSpace(row.Status) ? "updated" : row.Status);
        var teacherLabel = string.IsNullOrWhiteSpace(actor.Fullname)
            ? $"{actor.FirstName} {actor.LastName}".Trim()
            : actor.Fullname.Trim();
        if (string.IsNullOrWhiteSpace(teacherLabel))
            teacherLabel = "The center";

        var parentIds = db.ParentStudents
            .Where(l => l.IsActive && l.StudentId == row.StudentId)
            .Select(l => l.ParentId)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(student?.ParentId))
            parentIds.Add(student.ParentId);

        foreach (var parentId in parentIds)
        {
            if (string.Equals(parentId, actor.UserId, StringComparison.OrdinalIgnoreCase))
                continue;
            NotificationService.Push(
                db,
                parentId,
                $"{childName} was marked {status} today by {teacherLabel}.",
                NotificationKinds.Attendance,
                "Attendance update",
                "/attendance");
            var alert = db.Alerts.LastOrDefault(a => a.RecipientId == parentId);
            if (alert != null) alert.RelatedRecordId = row.AttendanceId;
        }
    }

    public static void AfterTeacherSave(HirayaDatabase before, HirayaDatabase after, HirayaUser actor)
    {
        EnsureLists(before);
        EnsureLists(after);
        var beforeTasks = before.StaffTasks.ToDictionary(t => t.TaskId);
        foreach (var task in after.StaffTasks.Where(t => TaskAssignedTo(t, actor.UserId)))
        {
            beforeTasks.TryGetValue(task.TaskId, out var prior);
            if (prior is null) continue;
            if (prior.Status == task.Status) continue;
            if (task.Status is StaffTaskStatuses.Completed or StaffTaskStatuses.Submitted)
            {
                task.CompletedAt = string.IsNullOrWhiteSpace(task.CompletedAt) ? DateTime.UtcNow.ToString("o") : task.CompletedAt;
                task.CompletedBy = actor.UserId;
                foreach (var admin in after.Users.Where(u => UserRoles.IsAdmin(u.Role)))
                {
                    NotificationService.Push(
                        after,
                        admin.UserId,
                        $"{actor.Fullname} marked “{task.Title}” as {task.Status.Replace('_', ' ')}.",
                        NotificationKinds.Task,
                        "Task update",
                        "/tasks");
                    var alert = after.Alerts.LastOrDefault(a => a.RecipientId == admin.UserId);
                    if (alert != null) alert.RelatedRecordId = task.TaskId;
                }
            }
        }

        ConsumeNewPresentAttendance(before, after, actor);
        SessionNoticeMail.QueueSessionChanges(before, after);
    }

    private static void NotifyParentsForSchedule(HirayaDatabase db, Schedule schedule)
    {
        var studentIds = new HashSet<string>();
        if (!string.IsNullOrWhiteSpace(schedule.StudentId))
            studentIds.Add(schedule.StudentId);
        foreach (var enrollment in db.Enrollments.Where(e => e.ClassId == schedule.ClassId && !string.IsNullOrWhiteSpace(schedule.ClassId)))
            studentIds.Add(enrollment.StudentId);
        foreach (var parentId in db.ParentStudents.Where(l => l.IsActive && studentIds.Contains(l.StudentId)).Select(l => l.ParentId).Distinct())
        {
            NotificationService.Push(
                db,
                parentId,
                $"A class schedule was posted: {schedule.Title}.",
                NotificationKinds.Schedule,
                "Child schedule",
                "/schedule");
        }
    }
}
