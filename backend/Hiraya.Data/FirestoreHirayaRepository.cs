using System.Text.Json;
using Google.Apis.Auth.OAuth2;
using Google.Cloud.Firestore;
using Hiraya.Shared.Models;
using Hiraya.Shared.Services;
using Hiraya.Shared.Services.Firebase;
using Microsoft.Extensions.Logging;

namespace Hiraya.Data;

public class FirestoreHirayaRepository : IHirayaRepository
{
    public const string ProjectId = "hiraya-kids-learning";

    private static readonly JsonSerializerOptions Json = JsonDefaults.Options;
    private readonly FirestoreDb _db;
    private readonly ILogger<FirestoreHirayaRepository> _logger;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private HirayaDatabase? _cache;

    public FirestoreHirayaRepository(ILogger<FirestoreHirayaRepository> logger)
    {
        _logger = logger;
        _db = Build();
    }

    public bool UsingFirebase => true;

    public static bool IsConfigured()
    {
        if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("FIREBASE_SERVICE_ACCOUNT")))
            return true;
        if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS"))
            && File.Exists(Environment.GetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS")))
            return true;
        return File.Exists(Path.Combine(AppContext.BaseDirectory, "firebase-adminsdk.json"))
               || File.Exists("firebase-adminsdk.json");
    }

    public async Task MutateAsync(Func<HirayaDatabase, Task> mutator, CancellationToken ct = default)
    {
        await _gate.WaitAsync(ct);
        try
        {
            var db = await LoadUnlockedAsync(ct);
            await mutator(db);
            await SaveUnlockedAsync(db, ct);
            _cache = Clone(db);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<HirayaDatabase> LoadAsync(CancellationToken ct = default)
    {
        await _gate.WaitAsync(ct);
        try
        {
            var data = await LoadUnlockedAsync(ct);
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
            _cache = Clone(database);
        }
        finally
        {
            _gate.Release();
        }
    }

    public Task SetItemAsync<T>(string collection, string id, T item, CancellationToken ct = default) =>
        MutateAsync(_ => Task.CompletedTask, ct);

    public Task DeleteItemAsync(string collection, string id, CancellationToken ct = default) =>
        MutateAsync(_ => Task.CompletedTask, ct);

    public void InvalidateCache() => _cache = null;

    public async Task<bool> PingAsync(CancellationToken ct = default)
    {
        var snap = await _db.Collection("settings").Document("center").GetSnapshotAsync(ct);
        return snap.Exists;
    }

    private async Task<HirayaDatabase> LoadUnlockedAsync(CancellationToken ct)
    {
        if (_cache is not null)
            return Clone(_cache);
        var db = new HirayaDatabase
        {
            Users = await LoadList<HirayaUser>("users", ct),
            TeacherProfiles = await LoadList<TeacherProfile>("teacherProfiles", ct),
            Students = await LoadList<Student>("students", ct),
            Programs = await LoadList<LearningProgram>("programs", ct),
            Classes = await LoadList<LearningClass>("classes", ct),
            Enrollments = await LoadList<Enrollment>("enrollments", ct),
            EnrollmentApplications = await LoadList<EnrollmentApplication>("enrollmentApplications", ct),
            Attendance = await LoadList<AttendanceRecord>("attendance", ct),
            Reports = await LoadList<ProgressReport>("reports", ct),
            Schedules = await LoadList<Schedule>("schedules", ct),
            TeacherWorkShifts = await LoadList<TeacherWorkShift>("teacherWorkShifts", ct),
            TeacherRoleOptions = await LoadList<TeacherRoleOption>("teacherRoleOptions", ct),
            News = await LoadList<NewsItem>("news", ct),
            LeaveRequests = await LoadList<LeaveRequest>("leaveRequests", ct),
            Payments = await LoadList<Payment>("payments", ct),
            CenterExpenses = await LoadList<CenterExpense>("centerExpenses", ct),
            OpeningBalances = await LoadList<OpeningBalance>("openingBalances", ct),
            Alerts = await LoadList<SystemAlert>("alerts", ct),
            AuditLogs = await LoadList<AuditLogEntry>("auditLogs", ct),
            RolePermissions = await LoadList<RolePermission>("rolePermissions", ct),
            Roles = await LoadList<AppRole>("roles", ct),
            Rooms = await LoadList<CenterRoom>("rooms", ct),
            LearningModules = await LoadList<LearningModule>("learningModules", ct),
            LearningModuleVersions = await LoadList<LearningModuleVersion>("learningModuleVersions", ct),
            ParentStudents = await LoadList<ParentStudent>("parentStudents", ct),
            AccountInvitations = await LoadList<AccountInvitation>("accountInvitations", ct),
            StudentOps = await LoadList<StudentOpsRecord>("studentOps", ct),
            CenterHolidays = await LoadList<CenterHoliday>("centerHolidays", ct),
            TeacherDuties = await LoadList<TeacherDuty>("teacherDuties", ct),
            WebsiteGallery = await LoadList<WebsiteGalleryItem>("websiteGallery", ct),
            StaffTasks = await LoadList<StaffTask>("staffTasks", ct),
            SessionPackages = await LoadList<SessionPackage>("sessionPackages", ct),
            SessionHistory = await LoadList<SessionHistoryEntry>("sessionHistory", ct),
            TeacherComments = await LoadList<TeacherComment>("teacherComments", ct),
            TeacherNotes = await LoadList<TeacherAdminNote>("teacherNotes", ct),
            StudentDocuments = await LoadList<StudentDocument>("studentDocuments", ct),
            ChatGroups = await LoadList<ChatGroup>("chatGroups", ct),
        };
        var settings = await _db.Collection("settings").Document("center").GetSnapshotAsync(ct);
        if (settings.Exists)
            db.Settings = FromDoc<CenterSettings>(settings) ?? db.Settings;
        _cache = Clone(db);
        return db;
    }

    private async Task SaveUnlockedAsync(HirayaDatabase database, CancellationToken ct)
    {
        await WriteList("users", database.Users, u => u.UserId, ct);
        await WriteList("teacherProfiles", database.TeacherProfiles, x => x.ProfileId, ct);
        await WriteList("students", database.Students, x => x.StudentId, ct);
        await WriteList("programs", database.Programs, x => x.ProgramId, ct);
        await WriteList("classes", database.Classes, x => x.ClassId, ct);
        await WriteList("enrollments", database.Enrollments, x => x.EnrollmentId, ct);
        await WriteList("enrollmentApplications", database.EnrollmentApplications, x => x.ApplicationId, ct);
        await WriteList("attendance", database.Attendance, x => x.AttendanceId, ct);
        await WriteList("reports", database.Reports, x => x.ReportId, ct);
        await WriteList("schedules", database.Schedules, x => x.ScheduleId, ct);
        await WriteList("teacherWorkShifts", database.TeacherWorkShifts, x => x.ShiftId, ct);
        await WriteList("teacherRoleOptions", database.TeacherRoleOptions, x => x.RoleId, ct);
        await WriteList("news", database.News, x => x.NewsId, ct);
        await WriteList("leaveRequests", database.LeaveRequests, x => x.LeaveId, ct);
        await WriteList("payments", database.Payments, x => x.PaymentId, ct);
        await WriteList("centerExpenses", database.CenterExpenses, x => x.ExpenseId, ct);
        await WriteList("openingBalances", database.OpeningBalances, x => x.OpeningId, ct);
        await WriteList("alerts", database.Alerts, x => x.AlertId, ct);
        await WriteList("auditLogs", database.AuditLogs, x => x.AuditId, ct);
        await WriteList("rolePermissions", database.RolePermissions, x => x.PermissionId, ct);
        await WriteList("roles", database.Roles, x => x.RoleId, ct);
        await WriteList("rooms", database.Rooms, x => x.RoomId, ct);
        await WriteList("learningModules", database.LearningModules, x => x.ModuleId, ct);
        await WriteList("learningModuleVersions", database.LearningModuleVersions, x => x.VersionId, ct);
        await WriteList("parentStudents", database.ParentStudents, x => x.ParentStudentId, ct);
        await WriteList("accountInvitations", database.AccountInvitations, x => x.InvitationId, ct);
        await WriteList("studentOps", database.StudentOps, x => x.StudentId, ct);
        await WriteList("centerHolidays", database.CenterHolidays, x => x.HolidayId, ct);
        await WriteList("teacherDuties", database.TeacherDuties, x => x.DutyId, ct);
        await WriteList("websiteGallery", database.WebsiteGallery, x => x.ItemId, ct);
        await WriteList("staffTasks", database.StaffTasks, x => x.TaskId, ct);
        await WriteList("sessionPackages", database.SessionPackages, x => x.PackageId, ct);
        await WriteList("sessionHistory", database.SessionHistory, x => x.HistoryId, ct);
        await WriteList("teacherComments", database.TeacherComments, x => x.CommentId, ct);
        await WriteList("teacherNotes", database.TeacherNotes, x => x.NoteId, ct);
        await WriteList("studentDocuments", database.StudentDocuments, x => x.DocumentId, ct);
        await WriteList("chatGroups", database.ChatGroups, x => x.GroupId, ct);
        await _db.Collection("settings").Document("center").SetAsync(ToMap(database.Settings), cancellationToken: ct);
        _logger.LogInformation("Saved Hiraya store to Cloud Firestore.");
    }

    private async Task<List<T>> LoadList<T>(string collection, CancellationToken ct)
    {
        var snap = await _db.Collection(collection).GetSnapshotAsync(ct);
        var list = new List<T>(snap.Count);
        foreach (var doc in snap.Documents)
        {
            var item = FromDoc<T>(doc);
            if (item is not null)
                list.Add(item);
        }
        return list;
    }

    private async Task WriteList<T>(string collection, IEnumerable<T> rows, Func<T, string> idOf, CancellationToken ct)
    {
        var keep = new HashSet<string>(StringComparer.Ordinal);
        WriteBatch? batch = null;
        var n = 0;
        async Task Flush()
        {
            if (batch is null || n == 0)
                return;
            await batch.CommitAsync(ct);
            batch = null;
            n = 0;
        }

        foreach (var row in rows)
        {
            var id = (idOf(row) ?? "").Trim();
            if (id.Length == 0)
                continue;
            keep.Add(id);
            batch ??= _db.StartBatch();
            batch.Set(_db.Collection(collection).Document(id), ToMap(row));
            n++;
            if (n >= 400)
                await Flush();
        }

        var existing = await _db.Collection(collection).GetSnapshotAsync(ct);
        foreach (var doc in existing.Documents)
        {
            if (keep.Contains(doc.Id))
                continue;
            batch ??= _db.StartBatch();
            batch.Delete(doc.Reference);
            n++;
            if (n >= 400)
                await Flush();
        }
        await Flush();
    }

    private static T? FromDoc<T>(DocumentSnapshot doc)
    {
        var json = JsonSerializer.Serialize(ToPlain(doc.ToDictionary()));
        return JsonSerializer.Deserialize<T>(json, Json);
    }

    private static Dictionary<string, object> ToMap<T>(T value)
    {
        using var parsed = JsonDocument.Parse(JsonSerializer.Serialize(value, Json));
        return (ToPlain(parsed.RootElement) as Dictionary<string, object>) ?? new Dictionary<string, object>();
    }

    private static object? ToPlain(object? value)
    {
        if (value is JsonElement el)
            return ToPlain(el);
        if (value is Dictionary<string, object> dict)
        {
            var copy = new Dictionary<string, object>();
            foreach (var pair in dict)
            {
                var nested = ToPlain(pair.Value);
                if (nested is not null)
                    copy[pair.Key] = nested;
            }
            return copy;
        }
        return value;
    }

    private static object? ToPlain(JsonElement el)
    {
        switch (el.ValueKind)
        {
            case JsonValueKind.Object:
                var map = new Dictionary<string, object>();
                foreach (var prop in el.EnumerateObject())
                {
                    var nested = ToPlain(prop.Value);
                    if (nested is not null)
                        map[prop.Name] = nested;
                }
                return map;
            case JsonValueKind.Array:
                return el.EnumerateArray().Select(ToPlain).Where(x => x is not null).Cast<object>().ToList();
            case JsonValueKind.String:
                return el.GetString();
            case JsonValueKind.Number:
                if (el.TryGetInt64(out var i))
                    return i;
                return el.GetDouble();
            case JsonValueKind.True:
                return true;
            case JsonValueKind.False:
                return false;
            default:
                return null;
        }
    }

    private static HirayaDatabase Clone(HirayaDatabase db)
    {
        var json = JsonSerializer.Serialize(db, Json);
        return JsonSerializer.Deserialize<HirayaDatabase>(json, Json) ?? new HirayaDatabase();
    }

    private static FirestoreDb Build()
    {
        var project = Environment.GetEnvironmentVariable("HIRAYA_FIRESTORE_PROJECT")?.Trim();
        if (string.IsNullOrWhiteSpace(project))
            project = ProjectId;
        var json = Environment.GetEnvironmentVariable("FIREBASE_SERVICE_ACCOUNT");
        if (!string.IsNullOrWhiteSpace(json))
        {
            var cred = GoogleCredential.FromJson(json);
            return new FirestoreDbBuilder { ProjectId = project, Credential = cred }.Build();
        }
        var path = Environment.GetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS");
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
        {
            var local = Path.Combine(AppContext.BaseDirectory, "firebase-adminsdk.json");
            path = File.Exists(local) ? local : "firebase-adminsdk.json";
        }
        if (File.Exists(path))
        {
            Environment.SetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS", Path.GetFullPath(path));
        }
        return FirestoreDb.Create(project);
    }
}
