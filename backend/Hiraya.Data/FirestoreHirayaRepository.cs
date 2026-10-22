using System.Text.Json;
using System.Text.Json.Serialization;
using Google.Apis.Auth.OAuth2;
using Google.Cloud.Firestore;
using Hiraya.Shared.Models;
using Hiraya.Shared.Security;
using Hiraya.Shared.Services;
using Hiraya.Shared.Services.Firebase;
using Microsoft.Extensions.Logging;

namespace Hiraya.Data;

public class FirestoreHirayaRepository : IHirayaRepository
{
    public const string ProjectId = "hiraya-kids-learning";

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
        WriteIndented = false,
    };
    private readonly FirestoreDb _db;
    private readonly ILogger<FirestoreHirayaRepository> _logger;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private HirayaDatabase? _cache;
    private DateTime _cacheAt = DateTime.MinValue;
    private static readonly TimeSpan CacheFor = TimeSpan.FromMinutes(10);

    public FirestoreHirayaRepository(ILogger<FirestoreHirayaRepository> logger)
    {
        _logger = logger;
        _db = Build();
    }

    public bool UsingFirebase => true;

    internal FirestoreDb Database => _db;

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
            var before = _cache;
            await mutator(db);
            await SaveUnlockedAsync(db, before, ct);
            _cache = Clone(db);
            _cacheAt = DateTime.UtcNow;
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
            await SaveUnlockedAsync(database, _cache, ct);
            _cache = Clone(database);
            _cacheAt = DateTime.UtcNow;
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

    public void InvalidateCache()
    {
        _cache = null;
        _cacheAt = DateTime.MinValue;
    }

    public async Task<bool> PingAsync(CancellationToken ct = default)
    {
        var snap = await _db.Collection("settings").Document("center").GetSnapshotAsync(ct);
        return snap.Exists;
    }

    public async Task<HirayaUser?> FindUserAsync(string? userId, string? login, CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(userId))
        {
            var snap = await _db.Collection("users").Document(userId.Trim()).GetSnapshotAsync(ct);
            if (snap.Exists)
            {
                try
                {
                    var found = FromDoc<HirayaUser>(snap);
                    if (found is not null)
                        return found;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Could not read Firestore user {UserId}.", userId);
                }
            }
        }

        var key = (login ?? "").Trim();
        if (key.Length == 0)
            return null;
        var users = await LoadList<HirayaUser>("users", ct);
        return LoginIdentity.Choose(users, key);
    }

    private async Task<HirayaDatabase> LoadUnlockedAsync(CancellationToken ct)
    {
        if (_cache is not null && DateTime.UtcNow - _cacheAt < CacheFor)
            return Clone(_cache);
        var users = LoadList<HirayaUser>("users", ct);
        var teacherProfiles = LoadList<TeacherProfile>("teacherProfiles", ct);
        var students = LoadList<Student>("students", ct);
        var programs = LoadList<LearningProgram>("programs", ct);
        var classes = LoadList<LearningClass>("classes", ct);
        var enrollments = LoadList<Enrollment>("enrollments", ct);
        var enrollmentApplications = LoadList<EnrollmentApplication>("enrollmentApplications", ct);
        var attendance = LoadList<AttendanceRecord>("attendance", ct);
        var reports = LoadList<ProgressReport>("reports", ct);
        var schedules = LoadList<Schedule>("schedules", ct);
        var teacherWorkShifts = LoadList<TeacherWorkShift>("teacherWorkShifts", ct);
        var teacherRoleOptions = LoadList<TeacherRoleOption>("teacherRoleOptions", ct);
        var news = LoadList<NewsItem>("news", ct);
        var leaveRequests = LoadList<LeaveRequest>("leaveRequests", ct);
        var payments = LoadList<Payment>("payments", ct);
        var centerExpenses = LoadList<CenterExpense>("centerExpenses", ct);
        var openingBalances = LoadList<OpeningBalance>("openingBalances", ct);
        var alerts = LoadList<SystemAlert>("alerts", ct);
        var auditLogs = LoadList<AuditLogEntry>("auditLogs", ct);
        var rolePermissions = LoadList<RolePermission>("rolePermissions", ct);
        var roles = LoadList<AppRole>("roles", ct);
        var rooms = LoadList<CenterRoom>("rooms", ct);
        var learningModules = LoadList<LearningModule>("learningModules", ct);
        var learningModuleVersions = LoadList<LearningModuleVersion>("learningModuleVersions", ct);
        var parentStudents = LoadList<ParentStudent>("parentStudents", ct);
        var accountInvitations = LoadList<AccountInvitation>("accountInvitations", ct);
        var studentOps = LoadList<StudentOpsRecord>("studentOps", ct);
        var centerHolidays = LoadList<CenterHoliday>("centerHolidays", ct);
        var teacherDuties = LoadList<TeacherDuty>("teacherDuties", ct);
        var websiteGallery = LoadList<WebsiteGalleryItem>("websiteGallery", ct);
        var staffTasks = LoadList<StaffTask>("staffTasks", ct);
        var sessionPackages = LoadList<SessionPackage>("sessionPackages", ct);
        var sessionHistory = LoadList<SessionHistoryEntry>("sessionHistory", ct);
        var teacherComments = LoadList<TeacherComment>("teacherComments", ct);
        var teacherNotes = LoadList<TeacherAdminNote>("teacherNotes", ct);
        var studentDocuments = LoadList<StudentDocument>("studentDocuments", ct);
        var chatGroups = LoadList<ChatGroup>("chatGroups", ct);
        var settingsTask = _db.Collection("settings").Document("center").GetSnapshotAsync(ct);
        await Task.WhenAll(
            users, teacherProfiles, students, programs, classes, enrollments, enrollmentApplications,
            attendance, reports, schedules, teacherWorkShifts, teacherRoleOptions, news, leaveRequests,
            payments, centerExpenses, openingBalances, alerts, auditLogs, rolePermissions, roles, rooms,
            learningModules, learningModuleVersions, parentStudents, accountInvitations, studentOps,
            centerHolidays, teacherDuties, websiteGallery, staffTasks, sessionPackages, sessionHistory,
            teacherComments, teacherNotes, studentDocuments, chatGroups, settingsTask);
        var db = new HirayaDatabase
        {
            Users = users.Result,
            TeacherProfiles = teacherProfiles.Result,
            Students = students.Result,
            Programs = programs.Result,
            Classes = classes.Result,
            Enrollments = enrollments.Result,
            EnrollmentApplications = enrollmentApplications.Result,
            Attendance = attendance.Result,
            Reports = reports.Result,
            Schedules = schedules.Result,
            TeacherWorkShifts = teacherWorkShifts.Result,
            TeacherRoleOptions = teacherRoleOptions.Result,
            News = news.Result,
            LeaveRequests = leaveRequests.Result,
            Payments = payments.Result,
            CenterExpenses = centerExpenses.Result,
            OpeningBalances = openingBalances.Result,
            Alerts = alerts.Result,
            AuditLogs = auditLogs.Result,
            RolePermissions = rolePermissions.Result,
            Roles = roles.Result,
            Rooms = rooms.Result,
            LearningModules = learningModules.Result,
            LearningModuleVersions = learningModuleVersions.Result,
            ParentStudents = parentStudents.Result,
            AccountInvitations = accountInvitations.Result,
            StudentOps = studentOps.Result,
            CenterHolidays = centerHolidays.Result,
            TeacherDuties = teacherDuties.Result,
            WebsiteGallery = websiteGallery.Result,
            StaffTasks = staffTasks.Result,
            SessionPackages = sessionPackages.Result,
            SessionHistory = sessionHistory.Result,
            TeacherComments = teacherComments.Result,
            TeacherNotes = teacherNotes.Result,
            StudentDocuments = studentDocuments.Result,
            ChatGroups = chatGroups.Result,
        };
        var settings = settingsTask.Result;
        if (settings.Exists)
            db.Settings = FromDoc<CenterSettings>(settings) ?? db.Settings;
        _cache = Clone(db);
        _cacheAt = DateTime.UtcNow;
        return db;
    }

    private async Task SaveUnlockedAsync(HirayaDatabase database, HirayaDatabase? before, CancellationToken ct)
    {
        var writer = new BatchWriter(_db, ct);
        try
        {
            await WriteList(writer, "users", database.Users, before?.Users, u => u.UserId);
            await WriteList(writer, "teacherProfiles", database.TeacherProfiles, before?.TeacherProfiles, x => x.ProfileId);
            await WriteList(writer, "students", database.Students, before?.Students, x => x.StudentId);
            await WriteList(writer, "programs", database.Programs, before?.Programs, x => x.ProgramId);
            await WriteList(writer, "classes", database.Classes, before?.Classes, x => x.ClassId);
            await WriteList(writer, "enrollments", database.Enrollments, before?.Enrollments, x => x.EnrollmentId);
            await WriteList(writer, "enrollmentApplications", database.EnrollmentApplications, before?.EnrollmentApplications, x => x.ApplicationId);
            await WriteList(writer, "attendance", database.Attendance, before?.Attendance, x => x.AttendanceId);
            await WriteList(writer, "reports", database.Reports, before?.Reports, x => x.ReportId);
            await WriteList(writer, "schedules", database.Schedules, before?.Schedules, x => x.ScheduleId);
            await WriteList(writer, "teacherWorkShifts", database.TeacherWorkShifts, before?.TeacherWorkShifts, x => x.ShiftId);
            await WriteList(writer, "teacherRoleOptions", database.TeacherRoleOptions, before?.TeacherRoleOptions, x => x.RoleId);
            await WriteList(writer, "news", database.News, before?.News, x => x.NewsId);
            await WriteList(writer, "leaveRequests", database.LeaveRequests, before?.LeaveRequests, x => x.LeaveId);
            await WriteList(writer, "payments", database.Payments, before?.Payments, x => x.PaymentId);
            await WriteList(writer, "centerExpenses", database.CenterExpenses, before?.CenterExpenses, x => x.ExpenseId);
            await WriteList(writer, "openingBalances", database.OpeningBalances, before?.OpeningBalances, x => x.OpeningId);
            await WriteList(writer, "alerts", database.Alerts, before?.Alerts, x => x.AlertId);
            await WriteList(writer, "auditLogs", database.AuditLogs, before?.AuditLogs, x => x.AuditId);
            await WriteList(writer, "rolePermissions", database.RolePermissions, before?.RolePermissions, x => x.PermissionId);
            await WriteList(writer, "roles", database.Roles, before?.Roles, x => x.RoleId);
            await WriteList(writer, "rooms", database.Rooms, before?.Rooms, x => x.RoomId);
            await WriteList(writer, "learningModules", database.LearningModules, before?.LearningModules, x => x.ModuleId);
            await WriteList(writer, "learningModuleVersions", database.LearningModuleVersions, before?.LearningModuleVersions, x => x.VersionId);
            await WriteList(writer, "parentStudents", database.ParentStudents, before?.ParentStudents, x => x.ParentStudentId);
            await WriteList(writer, "accountInvitations", database.AccountInvitations, before?.AccountInvitations, x => x.InvitationId);
            await WriteList(writer, "studentOps", database.StudentOps, before?.StudentOps, x => x.StudentId);
            await WriteList(writer, "centerHolidays", database.CenterHolidays, before?.CenterHolidays, x => x.HolidayId);
            await WriteList(writer, "teacherDuties", database.TeacherDuties, before?.TeacherDuties, x => x.DutyId);
            await WriteList(writer, "websiteGallery", database.WebsiteGallery, before?.WebsiteGallery, x => x.ItemId);
            await WriteList(writer, "staffTasks", database.StaffTasks, before?.StaffTasks, x => x.TaskId);
            await WriteList(writer, "sessionPackages", database.SessionPackages, before?.SessionPackages, x => x.PackageId);
            await WriteList(writer, "sessionHistory", database.SessionHistory, before?.SessionHistory, x => x.HistoryId);
            await WriteList(writer, "teacherComments", database.TeacherComments, before?.TeacherComments, x => x.CommentId);
            await WriteList(writer, "teacherNotes", database.TeacherNotes, before?.TeacherNotes, x => x.NoteId);
            await WriteList(writer, "studentDocuments", database.StudentDocuments, before?.StudentDocuments, x => x.DocumentId);
            await WriteList(writer, "chatGroups", database.ChatGroups, before?.ChatGroups, x => x.GroupId);
            var settingsJson = JsonSerializer.Serialize(database.Settings, Json);
            if (before is null || settingsJson != JsonSerializer.Serialize(before.Settings, Json))
                await writer.SetAsync(_db.Collection("settings").Document("center"), ToMapFromJson(settingsJson));
            await writer.FlushAsync();
        }
        catch
        {
            // A partial write leaves Firestore ahead of the cache; reload it on the next request.
            _cache = null;
            throw;
        }
        _logger.LogInformation("Saved {Count} changed Firestore documents.", writer.Total);
    }

    private async Task<List<T>> LoadList<T>(string collection, CancellationToken ct)
    {
        var snap = await _db.Collection(collection).GetSnapshotAsync(ct);
        var list = new List<T>(snap.Count);
        foreach (var doc in snap.Documents)
        {
            try
            {
                var item = FromDoc<T>(doc);
                if (item is not null)
                    list.Add(item);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Skipped unreadable Firestore document {Collection}/{DocumentId}.", collection, doc.Id);
            }
        }
        return list;
    }

    private async Task WriteList<T>(BatchWriter writer, string collection, IEnumerable<T> rows, IEnumerable<T>? previousRows, Func<T, string> idOf)
    {
        Dictionary<string, string>? previous = null;
        if (previousRows is not null)
        {
            previous = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var row in previousRows)
            {
                var id = (idOf(row) ?? "").Trim();
                if (id.Length > 0)
                    previous[id] = JsonSerializer.Serialize(row, Json);
            }
        }

        var keep = new HashSet<string>(StringComparer.Ordinal);
        foreach (var row in rows)
        {
            var id = (idOf(row) ?? "").Trim();
            if (id.Length == 0 || !keep.Add(id))
                continue;
            var json = JsonSerializer.Serialize(row, Json);
            if (previous is not null && previous.TryGetValue(id, out var old) && old == json)
                continue;
            await writer.SetAsync(_db.Collection(collection).Document(id), ToMapFromJson(json));
        }

        if (previous is not null)
        {
            foreach (var id in previous.Keys)
            {
                if (!keep.Contains(id))
                    await writer.DeleteAsync(_db.Collection(collection).Document(id));
            }
            return;
        }

        var existing = await _db.Collection(collection).GetSnapshotAsync(writer.Token);
        foreach (var doc in existing.Documents)
        {
            if (!keep.Contains(doc.Id))
                await writer.DeleteAsync(doc.Reference);
        }
    }

    private sealed class BatchWriter(FirestoreDb db, CancellationToken ct)
    {
        private WriteBatch? _batch;
        private int _pending;

        public CancellationToken Token => ct;
        public int Total { get; private set; }

        public Task SetAsync(DocumentReference doc, Dictionary<string, object> data)
        {
            (_batch ??= db.StartBatch()).Set(doc, data);
            return CountAsync();
        }

        public Task DeleteAsync(DocumentReference doc)
        {
            (_batch ??= db.StartBatch()).Delete(doc);
            return CountAsync();
        }

        public async Task FlushAsync()
        {
            if (_batch is null || _pending == 0)
                return;
            await _batch.CommitAsync(ct);
            _batch = null;
            _pending = 0;
        }

        private async Task CountAsync()
        {
            _pending++;
            Total++;
            if (_pending >= 400)
                await FlushAsync();
        }
    }

    private static T? FromDoc<T>(DocumentSnapshot doc)
    {
        var plain = ToPlain(doc.ToDictionary()) as Dictionary<string, object> ?? new Dictionary<string, object>();
        if (plain.TryGetValue("passwordHash", out var hash) && hash is string stored && stored.Length > 0)
            plain.TryAdd("password", stored);
        var json = JsonSerializer.Serialize(plain);
        return JsonSerializer.Deserialize<T>(json, Json);
    }

    private static Dictionary<string, object> ToMapFromJson(string json)
    {
        using var parsed = JsonDocument.Parse(json);
        return (ToPlain(parsed.RootElement) as Dictionary<string, object>) ?? new Dictionary<string, object>();
    }

    private static object? ToPlain(object? value)
    {
        if (value is JsonElement el)
            return ToPlain(el);
        if (value is string text)
        {
            var trimmed = text.Trim();
            if ((trimmed.StartsWith('[') && trimmed.EndsWith(']')) ||
                (trimmed.StartsWith('{') && trimmed.EndsWith('}')))
            {
                try
                {
                    using var nested = JsonDocument.Parse(trimmed);
                    return ToPlain(nested.RootElement);
                }
                catch (JsonException)
                {
                    return text;
                }
            }
            return text;
        }
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
                var text = el.GetString();
                if (!string.IsNullOrWhiteSpace(text))
                {
                    var trimmed = text.Trim();
                    if ((trimmed.StartsWith('[') && trimmed.EndsWith(']')) ||
                        (trimmed.StartsWith('{') && trimmed.EndsWith('}')))
                    {
                        try
                        {
                            using var nested = JsonDocument.Parse(trimmed);
                            return ToPlain(nested.RootElement);
                        }
                        catch (JsonException)
                        {
                            return text;
                        }
                    }
                }
                return text;
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
