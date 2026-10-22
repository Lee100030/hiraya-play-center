using System.Text.Json;
using Google.Apis.Auth.OAuth2;
using Google.Cloud.Firestore;
using Hiraya.Shared.Models;
using Microsoft.Extensions.Logging;

namespace Hiraya.Data;

public partial class FirestoreHirayaRepository
{
    public const string MobileProjectId = "hiraya-mobile";
    public const string DesktopProjectId = "hiraya-desktop";
    public const string WebsiteProjectId = "hiraya-website";

    private readonly List<Replica> _replicas = new();
    private static readonly AsyncLocal<FirestoreDb?> LoadSource = new();

    public IReadOnlyList<string> ReplicaProjects => _replicas.Select(replica => replica.ProjectId).ToArray();

    private void BindReplicas()
    {
        AddReplica("mobile", MobileProjectId, "FIREBASE_SERVICE_ACCOUNT_MOBILE");
        AddReplica("desktop", DesktopProjectId, "FIREBASE_SERVICE_ACCOUNT_DESKTOP");
        AddReplica("website", WebsiteProjectId, "FIREBASE_SERVICE_ACCOUNT_WEBSITE");
    }

    private void AddReplica(string name, string fallbackProjectId, string envVar)
    {
        var json = Environment.GetEnvironmentVariable(envVar);
        if (string.IsNullOrWhiteSpace(json))
            return;
        try
        {
            var projectId = ProjectFromJson(json, fallbackProjectId);
            var credential = GoogleCredential.FromJson(json);
            var db = new FirestoreDbBuilder { ProjectId = projectId, Credential = credential }.Build();
            _replicas.Add(new Replica(name, projectId, db));
            _logger.LogInformation("Firestore replica {Name} uses project {ProjectId}.", name, projectId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Ignored {Env}. The center project is still used for {Name}.", envVar, name);
        }
    }

    private static string ProjectFromJson(string json, string fallback)
    {
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("project_id", out var id))
            {
                var text = id.GetString()?.Trim();
                if (!string.IsNullOrWhiteSpace(text))
                    return text;
            }
        }
        catch (System.Text.Json.JsonException)
        {
            /* The caller reports a bad key. */
        }
        return fallback;
    }

    private async Task<FirestoreDb> ChooseReadDatabaseAsync(CancellationToken ct)
    {
        var name = HirayaClientContext.Client;
        var replica = _replicas.FirstOrDefault(item => item.Name == name);
        if (replica is null)
            return _db;
        try
        {
            var center = await replica.Db.Collection("settings").Document("center").GetSnapshotAsync(ct);
            if (center.Exists)
                return replica.Db;
        }
        catch (Exception ex) when (IsQuota(ex))
        {
            _logger.LogWarning("Replica {ProjectId} is out of Firestore reads. This request will not use the center quota.", replica.ProjectId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not read replica {ProjectId}. Using the center.", replica.ProjectId);
        }
        return _db;
    }

    private async Task CopyChangesAsync(IReadOnlyList<DocWrite> changes, CancellationToken ct)
    {
        if (_replicas.Count == 0)
            return;
        foreach (var replica in _replicas)
        {
            var batch = Coalesce(replica.Pending.Concat(changes));
            replica.Pending.Clear();
            if (batch.Count == 0)
                continue;
            try
            {
                await ApplyWritesAsync(replica.Db, batch, ct);
            }
            catch (Exception ex)
            {
                replica.Pending.AddRange(batch);
                _logger.LogWarning(ex, "Could not copy {Count} documents to {ProjectId}. They will be tried again on the next save.", batch.Count, replica.ProjectId);
            }
        }
    }

    /// <summary>
    /// Copies the center into each empty app project. A quota error stops the copy
    /// before it writes, so an exhausted day does not start the seed.
    /// </summary>
    public async Task SeedReplicasAsync(CancellationToken ct = default)
    {
        if (_replicas.Count == 0)
            return;
        foreach (var replica in _replicas)
        {
            if (!await ReplicaNeedsSeedAsync(replica, ct))
                continue;
            await _gate.WaitAsync(ct);
            try
            {
                if (_cache is null)
                    await LoadUnlockedAsync(ct);
                if (_cache is null)
                    continue;
                await WriteSnapshotAsync(replica, Clone(_cache), ct);
                _logger.LogInformation("Seeded Firestore replica {ProjectId}.", replica.ProjectId);
            }
            catch (Exception ex) when (IsQuota(ex))
            {
                _logger.LogWarning("Stopped seeding {ProjectId} because Firestore quota is exhausted.", replica.ProjectId);
                return;
            }
            finally
            {
                _gate.Release();
            }
        }
    }

    private async Task<bool> ReplicaNeedsSeedAsync(Replica replica, CancellationToken ct)
    {
        try
        {
            var marker = await replica.Db.Collection("settings").Document("replicaSeed").GetSnapshotAsync(ct);
            if (marker.Exists && marker.TryGetValue("done", out bool done) && done)
                return false;
            return true;
        }
        catch (Exception ex) when (IsQuota(ex))
        {
            _logger.LogWarning("Skipped seeding {ProjectId} because Firestore quota is exhausted.", replica.ProjectId);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Skipped seeding {ProjectId}.", replica.ProjectId);
            return false;
        }
    }

    private async Task WriteSnapshotAsync(Replica replica, HirayaDatabase db, CancellationToken ct)
    {
        var writes = new List<DocWrite>();
        Collect(writes, "users", db.Users, x => x.UserId);
        Collect(writes, "teacherProfiles", db.TeacherProfiles, x => x.ProfileId);
        Collect(writes, "students", db.Students, x => x.StudentId);
        Collect(writes, "programs", db.Programs, x => x.ProgramId);
        Collect(writes, "classes", db.Classes, x => x.ClassId);
        Collect(writes, "enrollments", db.Enrollments, x => x.EnrollmentId);
        Collect(writes, "enrollmentApplications", db.EnrollmentApplications, x => x.ApplicationId);
        Collect(writes, "attendance", db.Attendance, x => x.AttendanceId);
        Collect(writes, "reports", db.Reports, x => x.ReportId);
        Collect(writes, "schedules", db.Schedules, x => x.ScheduleId);
        Collect(writes, "teacherWorkShifts", db.TeacherWorkShifts, x => x.ShiftId);
        Collect(writes, "teacherRoleOptions", db.TeacherRoleOptions, x => x.RoleId);
        Collect(writes, "news", db.News, x => x.NewsId);
        Collect(writes, "leaveRequests", db.LeaveRequests, x => x.LeaveId);
        Collect(writes, "payments", db.Payments, x => x.PaymentId);
        Collect(writes, "centerExpenses", db.CenterExpenses, x => x.ExpenseId);
        Collect(writes, "openingBalances", db.OpeningBalances, x => x.OpeningId);
        Collect(writes, "alerts", db.Alerts, x => x.AlertId);
        Collect(writes, "auditLogs", db.AuditLogs, x => x.AuditId);
        Collect(writes, "rolePermissions", db.RolePermissions, x => x.PermissionId);
        Collect(writes, "roles", db.Roles, x => x.RoleId);
        Collect(writes, "rooms", db.Rooms, x => x.RoomId);
        Collect(writes, "learningModules", db.LearningModules, x => x.ModuleId);
        Collect(writes, "learningModuleVersions", db.LearningModuleVersions, x => x.VersionId);
        Collect(writes, "parentStudents", db.ParentStudents, x => x.ParentStudentId);
        Collect(writes, "accountInvitations", db.AccountInvitations, x => x.InvitationId);
        Collect(writes, "studentOps", db.StudentOps, x => x.StudentId);
        Collect(writes, "centerHolidays", db.CenterHolidays, x => x.HolidayId);
        Collect(writes, "teacherDuties", db.TeacherDuties, x => x.DutyId);
        Collect(writes, "websiteGallery", db.WebsiteGallery, x => x.ItemId);
        Collect(writes, "staffTasks", db.StaffTasks, x => x.TaskId);
        Collect(writes, "sessionPackages", db.SessionPackages, x => x.PackageId);
        Collect(writes, "sessionHistory", db.SessionHistory, x => x.HistoryId);
        Collect(writes, "teacherComments", db.TeacherComments, x => x.CommentId);
        Collect(writes, "teacherNotes", db.TeacherNotes, x => x.NoteId);
        Collect(writes, "studentDocuments", db.StudentDocuments, x => x.DocumentId);
        Collect(writes, "chatGroups", db.ChatGroups, x => x.GroupId);
        writes.Add(new DocWrite("settings", "center", ToMapFromJson(JsonSerializer.Serialize(db.Settings, Json))));
        writes.Add(new DocWrite("settings", "replicaSeed", new Dictionary<string, object>
        {
            ["done"] = true,
            ["source"] = ProjectId,
            ["seededAt"] = DateTime.UtcNow.ToString("o"),
        }));
        await ApplyWritesAsync(replica.Db, writes, ct);
    }

    private void Collect<T>(List<DocWrite> writes, string collection, IEnumerable<T>? rows, Func<T, string> idOf)
    {
        if (rows is null)
            return;
        foreach (var row in rows)
        {
            var id = (idOf(row) ?? "").Trim();
            if (id.Length == 0)
                continue;
            writes.Add(new DocWrite(collection, id, ToMapFromJson(JsonSerializer.Serialize(row, Json))));
        }
    }

    private static async Task ApplyWritesAsync(FirestoreDb db, IReadOnlyList<DocWrite> writes, CancellationToken ct)
    {
        if (writes.Count == 0)
            return;
        var writer = new BatchWriter(db, ct);
        foreach (var write in writes)
        {
            var doc = db.Collection(write.Collection).Document(write.Id);
            if (write.Data is null)
                await writer.DeleteAsync(doc);
            else
                await writer.SetAsync(doc, write.Data);
        }
        await writer.FlushAsync();
    }

    private static List<DocWrite> Coalesce(IEnumerable<DocWrite> writes)
    {
        var map = new Dictionary<string, DocWrite>(StringComparer.Ordinal);
        foreach (var write in writes)
            map[$"{write.Collection}\n{write.Id}"] = write;
        return map.Values.ToList();
    }

    private static bool IsQuota(Exception ex)
    {
        for (var cur = ex; cur is not null; cur = cur.InnerException)
        {
            if (cur is Grpc.Core.RpcException rpc && rpc.StatusCode == Grpc.Core.StatusCode.ResourceExhausted)
                return true;
            if (cur.Message.Contains("Quota exceeded", StringComparison.OrdinalIgnoreCase)
                || cur.Message.Contains("ResourceExhausted", StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    private sealed class Replica(string name, string projectId, FirestoreDb db)
    {
        public string Name { get; } = name;
        public string ProjectId { get; } = projectId;
        public FirestoreDb Db { get; } = db;
        public List<DocWrite> Pending { get; } = new();
    }

    private sealed record DocWrite(string Collection, string Id, Dictionary<string, object>? Data);
}
