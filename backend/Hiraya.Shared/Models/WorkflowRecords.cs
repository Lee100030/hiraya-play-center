namespace Hiraya.Shared.Models;

public static class StaffTaskStatuses
{
    public const string Assigned = "assigned";
    public const string InProgress = "in_progress";
    public const string Submitted = "submitted";
    public const string Completed = "completed";
    public const string Overdue = "overdue";
    public const string Cancelled = "cancelled";

    public static readonly string[] All =
        [Assigned, InProgress, Submitted, Completed, Overdue, Cancelled];
}

public class StaffTask
{
    public string TaskId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Priority { get; set; } = "normal";
    public string DueAt { get; set; } = "";
    public string TeacherIds { get; set; } = "";
    public string ClassId { get; set; } = "";
    public string StudentId { get; set; } = "";
    public string Status { get; set; } = StaffTaskStatuses.Assigned;
    public string Response { get; set; } = "";
    public string AttachmentName { get; set; } = "";
    public string AssignedBy { get; set; } = "";
    public string CompletedAt { get; set; } = "";
    public string CompletedBy { get; set; } = "";
    public string CreatedAt { get; set; } = "";
    public string UpdatedAt { get; set; } = "";
}

public static class SessionPackageStatuses
{
    public const string Active = "active";
    public const string AlmostFinished = "almost_finished";
    public const string Completed = "completed";
    public const string Expired = "expired";
    public const string Suspended = "suspended";
}

public class SessionPackage
{
    public string PackageId { get; set; } = "";
    public string StudentId { get; set; } = "";
    public string ProgramId { get; set; } = "";
    public int TotalSessions { get; set; }
    public int UsedSessions { get; set; }
    public int RemainingSessions { get; set; }
    public string StartDate { get; set; } = "";
    public string ExpirationDate { get; set; } = "";
    public string Status { get; set; } = SessionPackageStatuses.Active;
    public string CreatedAt { get; set; } = "";
    public string UpdatedAt { get; set; } = "";
}

public class SessionHistoryEntry
{
    public string HistoryId { get; set; } = "";
    public string PackageId { get; set; } = "";
    public string StudentId { get; set; } = "";
    public string ScheduleId { get; set; } = "";
    public string AttendanceId { get; set; } = "";
    public string Action { get; set; } = "";
    public string Note { get; set; } = "";
    public string ActorId { get; set; } = "";
    public string CreatedAt { get; set; } = "";
}

public class TeacherComment
{
    public string CommentId { get; set; } = "";
    public string TeacherId { get; set; } = "";
    public string CreatedBy { get; set; } = "";
    public string Content { get; set; } = "";
    public string Visibility { get; set; } = "teacher";
    public string Status { get; set; } = "active";
    public string Reply { get; set; } = "";
    public string CreatedAt { get; set; } = "";
    public string UpdatedAt { get; set; } = "";
}

public class TeacherAdminNote
{
    public string NoteId { get; set; } = "";
    public string TeacherId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Content { get; set; } = "";
    public string Priority { get; set; } = "normal";
    public string ReminderDate { get; set; } = "";
    public string Visibility { get; set; } = "private";
    public string Status { get; set; } = "open";
    public string CreatedBy { get; set; } = "";
    public string CreatedAt { get; set; } = "";
    public string UpdatedAt { get; set; } = "";
}
