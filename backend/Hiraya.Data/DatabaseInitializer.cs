using Hiraya.Shared.Models;
using Hiraya.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Hiraya.Data;

public static class DatabaseInitializer
{
    public static async Task InitializeAsync(HirayaLearningCenterDbContext db, ILogger logger)
    {
        try
        {
            if (db.Database.IsSqlServer())
            {
                await db.Database.EnsureCreatedAsync();
                logger.LogInformation("SQL Server schema is ready (EnsureCreated). MySQL EF migrations are not applied on MSSQL.");
            }
            else if (IsPostgres(db))
            {
                var connection = db.Database.GetConnectionString()
                    ?? throw new InvalidOperationException("PostgreSQL connection is missing.");
                var neonOptions = new DbContextOptionsBuilder<HirayaNeonDbContext>();
                neonOptions.UseNpgsql(connection, npgsql =>
                    npgsql.EnableRetryOnFailure(5, TimeSpan.FromSeconds(10), null));
                await using var neon = new HirayaNeonDbContext(neonOptions.Options);
                await neon.Database.MigrateAsync();
            }
            else
            {
                await db.Database.MigrateAsync();
            }
        }
        catch (Exception ex)
        {
            if (string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Production", StringComparison.OrdinalIgnoreCase))
            {
                logger.LogError(ex, "Migrate failed in Production. EnsureCreated was not used.");
                throw;
            }
            logger.LogWarning(ex, "Migrate failed; attempting EnsureCreated.");
            await db.Database.EnsureCreatedAsync();
        }

        await EnsureWorkflowSchemaAsync(db, logger);

        if (await db.Users.AnyAsync())
        {
            await BackfillParentStudentsAsync(db, logger);
            await BackfillCenterOperationsAsync(db, logger);
            await NormalizeProductAccountsAsync(db, logger);
            await NormalizeTeacherSpecialtiesAsync(db, logger);
            return;
        }

        if (string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Production", StringComparison.OrdinalIgnoreCase))
        {
            logger.LogWarning("Production database has no users. Development seed was not applied. Create the first administrator outside the seed.");
            return;
        }

        logger.LogInformation("Seeding hiraya_learning_center with development data.");
        var seed = SeedData.Create();
        PermissionCatalog.EnsureRows(seed);
        seed.Roles = UserRoles.All.Select(code => new AppRole
        {
            RoleId = "role_" + code,
            Code = code,
            Name = Navigation.RoleLabel(code)
        }).ToList();
        if (string.IsNullOrWhiteSpace(seed.Settings.SettingsId))
            seed.Settings.SettingsId = "center";

        db.Users.AddRange(seed.Users);
        db.Roles.AddRange(seed.Roles);
        db.RolePermissions.AddRange(seed.RolePermissions);
        db.TeacherProfiles.AddRange(seed.TeacherProfiles);
        db.Students.AddRange(seed.Students);
        db.Programs.AddRange(seed.Programs);
        db.Classes.AddRange(seed.Classes);
        db.Enrollments.AddRange(seed.Enrollments);
        db.EnrollmentApplications.AddRange(seed.EnrollmentApplications);
        db.Attendance.AddRange(seed.Attendance);
        db.ProgressRecords.AddRange(seed.Reports);
        db.Schedules.AddRange(seed.Schedules);
        db.TeacherWorkShifts.AddRange(seed.TeacherWorkShifts);
        db.TeacherRoleOptions.AddRange(seed.TeacherRoleOptions);
        db.News.AddRange(seed.News);
        db.LeaveRequests.AddRange(seed.LeaveRequests);
        db.Payments.AddRange(seed.Payments);
        db.Notifications.AddRange(seed.Alerts);
        db.AuditLogs.AddRange(seed.AuditLogs);
        db.LearningModules.AddRange(seed.LearningModules);
        db.LearningModuleVersions.AddRange(seed.LearningModuleVersions);
        db.ParentStudents.AddRange(seed.ParentStudents);
        db.AccountInvitations.AddRange(seed.AccountInvitations);
        db.StudentOps.AddRange(seed.StudentOps);
        db.CenterHolidays.AddRange(seed.CenterHolidays);
        db.TeacherDuties.AddRange(seed.TeacherDuties);
        db.Settings.Add(seed.Settings);
        if (seed.StaffTasks.Count > 0) db.StaffTasks.AddRange(seed.StaffTasks);
        if (seed.SessionPackages.Count > 0) db.SessionPackages.AddRange(seed.SessionPackages);
        if (seed.SessionHistory.Count > 0) db.SessionHistory.AddRange(seed.SessionHistory);
        await db.SaveChangesAsync();
        await NormalizeProductAccountsAsync(db, logger);
        await NormalizeTeacherSpecialtiesAsync(db, logger);
    }

    private static async Task NormalizeTeacherSpecialtiesAsync(HirayaLearningCenterDbContext db, ILogger logger)
    {
        try
        {
            var profiles = await db.TeacherProfiles.ToListAsync();
            var changed = 0;
            foreach (var profile in profiles)
            {
                var next = StaffService.NormalizeProgramSpecialty(profile.Specialty);
                if (next == profile.Specialty) continue;
                profile.Specialty = next;
                changed++;
            }
            if (changed > 0)
            {
                await db.SaveChangesAsync();
                logger.LogInformation("Normalized teacher specialties ({Count} records).", changed);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not normalize teacher specialties.");
        }
    }

    private static async Task NormalizeProductAccountsAsync(HirayaLearningCenterDbContext db, ILogger logger)
    {
        try
        {
            var data = new HirayaDatabase { Users = await db.Users.ToListAsync() };
            ProductAccounts.NormalizeDirectory(data);
            var changed = await db.SaveChangesAsync();
            if (changed > 0)
                logger.LogInformation("Normalized product accounts ({Count} changes).", changed);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not normalize Super Admin / teacher / parent accounts.");
        }
    }

    private static async Task BackfillParentStudentsAsync(HirayaLearningCenterDbContext db, ILogger logger)
    {
        try
        {
            if (await db.ParentStudents.AnyAsync())
                return;
            var now = DateTime.UtcNow.ToString("o");
            var students = await db.Students
                .Where(s => s.ParentId != "")
                .ToListAsync();
            foreach (var student in students)
            {
                db.ParentStudents.Add(new ParentStudent
                {
                    ParentStudentId = IdFactory.New("ps"),
                    ParentId = student.ParentId,
                    StudentId = student.StudentId,
                    Relationship = FamilyRelationships.Guardian,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now
                });
            }
            if (students.Count > 0)
            {
                await db.SaveChangesAsync();
                logger.LogInformation("Backfilled {Count} parent-student relationships from existing ParentId values.", students.Count);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not backfill parent-student relationships.");
        }
    }

    private static async Task BackfillCenterOperationsAsync(HirayaLearningCenterDbContext db, ILogger logger)
    {
        try
        {
            var data = new HirayaDatabase
            {
                Users = await db.Users.ToListAsync(),
                TeacherProfiles = await db.TeacherProfiles.ToListAsync(),
                Students = await db.Students.ToListAsync(),
                Programs = await db.Programs.ToListAsync(),
                Classes = await db.Classes.ToListAsync(),
                Schedules = await db.Schedules.ToListAsync(),
                StudentOps = await db.StudentOps.ToListAsync(),
                CenterHolidays = await db.CenterHolidays.ToListAsync(),
                TeacherDuties = await db.TeacherDuties.ToListAsync()
            };
            if (!CenterOperationsCatalog.RosterReady(data))
            {
                logger.LogInformation("Sample roster backfill was skipped because this center database does not already contain that roster.");
                return;
            }
            CenterOperationsCatalog.Ensure(data);

            var emails = db.Users.Local.Select(u => u.Email).ToHashSet(StringComparer.OrdinalIgnoreCase);
            foreach (var user in data.Users)
            {
                if (db.Entry(user).State != EntityState.Detached)
                    continue;
                if (emails.Contains(user.Email))
                    continue;
                db.Users.Add(user);
                emails.Add(user.Email);
            }

            AddDetached(db, data.TeacherProfiles);
            AddDetached(db, data.Students);
            AddDetached(db, data.Programs);
            AddDetached(db, data.Classes);
            AddDetached(db, data.Schedules);
            AddDetached(db, data.StudentOps);
            AddDetached(db, data.CenterHolidays);
            AddDetached(db, data.TeacherDuties);

            var added = await db.SaveChangesAsync();
            if (added > 0)
                logger.LogInformation("Backfilled center operations records ({Count} changes).", added);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not backfill center operations records.");
        }
    }

    private static async Task EnsureWorkflowSchemaAsync(HirayaLearningCenterDbContext db, ILogger logger)
    {
        try
        {
            if (IsPostgres(db))
            {
                await EnsurePostgresWorkflowSchemaAsync(db, logger);
                return;
            }

            await TryAddColumn(db, "users", "PersonalEmail", "varchar(191) NOT NULL DEFAULT ''");
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS staff_tasks (
                  TaskId varchar(191) NOT NULL,
                  Title varchar(191) NOT NULL,
                  Description text NOT NULL,
                  Priority varchar(191) NOT NULL,
                  DueAt varchar(191) NOT NULL,
                  TeacherIds text NOT NULL,
                  ClassId varchar(191) NOT NULL,
                  StudentId varchar(191) NOT NULL,
                  Status varchar(191) NOT NULL,
                  Response text NOT NULL,
                  AttachmentName varchar(191) NOT NULL,
                  AssignedBy varchar(191) NOT NULL,
                  CompletedAt varchar(191) NOT NULL,
                  CompletedBy varchar(191) NOT NULL,
                  CreatedAt varchar(191) NOT NULL,
                  UpdatedAt varchar(191) NOT NULL,
                  PRIMARY KEY (TaskId)
                );
                """);
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS session_packages (
                  PackageId varchar(191) NOT NULL,
                  StudentId varchar(191) NOT NULL,
                  ProgramId varchar(191) NOT NULL,
                  TotalSessions int NOT NULL,
                  UsedSessions int NOT NULL,
                  RemainingSessions int NOT NULL,
                  StartDate varchar(191) NOT NULL,
                  ExpirationDate varchar(191) NOT NULL,
                  Status varchar(191) NOT NULL,
                  CreatedAt varchar(191) NOT NULL,
                  UpdatedAt varchar(191) NOT NULL,
                  PRIMARY KEY (PackageId)
                );
                """);
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS session_history (
                  HistoryId varchar(191) NOT NULL,
                  PackageId varchar(191) NOT NULL,
                  StudentId varchar(191) NOT NULL,
                  ScheduleId varchar(191) NOT NULL,
                  AttendanceId varchar(191) NOT NULL,
                  Action varchar(191) NOT NULL,
                  Note text NOT NULL,
                  ActorId varchar(191) NOT NULL,
                  CreatedAt varchar(191) NOT NULL,
                  PRIMARY KEY (HistoryId)
                );
                """);
            await TryAddColumn(db, "announcements", "Audience", "varchar(64) NOT NULL DEFAULT 'everyone'");
            await TryAddColumn(db, "announcements", "AudienceId", "varchar(191) NOT NULL DEFAULT ''");
            await TryAddColumn(db, "announcements", "Priority", "varchar(32) NOT NULL DEFAULT 'normal'");
            await TryAddColumn(db, "announcements", "ExpiresAt", "varchar(191) NOT NULL DEFAULT ''");
            await TryAddColumn(db, "notifications", "RelatedRecordId", "varchar(191) NOT NULL DEFAULT ''");
            await TryAddColumn(db, "notifications", "ReadAt", "varchar(191) NOT NULL DEFAULT ''");
            await TryAddColumn(db, "schedules", "ProgramId", "varchar(191) NOT NULL DEFAULT ''");
            await TryAddColumn(db, "students", "ProfileImagePath", "varchar(512) NOT NULL DEFAULT ''");
            await TryAddColumn(db, "payments", "ReceivedBy", "varchar(191) NOT NULL DEFAULT ''");
            await TryAddColumn(db, "payments", "AccountNumber", "varchar(191) NOT NULL DEFAULT ''");
            await TryAddColumn(db, "payments", "FromAccountNumber", "varchar(191) NOT NULL DEFAULT ''");
            await TryAddColumn(db, "payments", "ReceiptPath", "varchar(512) NOT NULL DEFAULT ''");
            await TryAddColumn(db, "payments", "ReceiptName", "varchar(191) NOT NULL DEFAULT ''");
            await TryAddColumn(db, "student_ops", "TuitionFee", "decimal(18,2) NOT NULL DEFAULT 0");
            await TryAddColumn(db, "programs", "TuitionFee", "decimal(18,2) NOT NULL DEFAULT 0");
            await TryAddColumn(db, "programs", "PackageSessions", "int NOT NULL DEFAULT 0");
            await TryAddColumn(db, "payments", "IncomeBucket", "varchar(32) NOT NULL DEFAULT ''");
            await TryAddColumn(db, "enrollment_applications", "ApplicationKind", "varchar(32) NOT NULL DEFAULT 'student'");
            await TryAddColumn(db, "center_expenses", "Kind", "varchar(16) NOT NULL DEFAULT 'expense'");
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS center_expenses (
                  ExpenseId varchar(191) NOT NULL,
                  ExpenseDate varchar(191) NOT NULL,
                  Item varchar(191) NOT NULL,
                  Category varchar(64) NOT NULL,
                  Amount decimal(18,2) NOT NULL DEFAULT 0,
                  PaidTo varchar(191) NOT NULL,
                  PaidBy varchar(191) NOT NULL,
                  Note text NOT NULL,
                  CreatedAt varchar(191) NOT NULL,
                  UpdatedAt varchar(191) NOT NULL,
                  Kind varchar(16) NOT NULL DEFAULT 'expense',
                  PRIMARY KEY (ExpenseId)
                );
                """);
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS opening_balances (
                  OpeningId varchar(191) NOT NULL,
                  Month varchar(7) NOT NULL,
                  Amount decimal(18,2) NOT NULL DEFAULT 0,
                  Note text NOT NULL,
                  UpdatedAt varchar(191) NOT NULL,
                  PRIMARY KEY (OpeningId)
                );
                """);
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS teacher_comments (
                  CommentId varchar(191) NOT NULL,
                  TeacherId varchar(191) NOT NULL,
                  CreatedBy varchar(191) NOT NULL,
                  Content text NOT NULL,
                  Visibility varchar(191) NOT NULL,
                  Status varchar(191) NOT NULL,
                  Reply text NOT NULL,
                  CreatedAt varchar(191) NOT NULL,
                  UpdatedAt varchar(191) NOT NULL,
                  PRIMARY KEY (CommentId)
                );
                """);
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS teacher_notes (
                  NoteId varchar(191) NOT NULL,
                  TeacherId varchar(191) NOT NULL,
                  Title varchar(191) NOT NULL,
                  Content text NOT NULL,
                  Priority varchar(191) NOT NULL,
                  ReminderDate varchar(191) NOT NULL,
                  Visibility varchar(191) NOT NULL,
                  Status varchar(191) NOT NULL,
                  CreatedBy varchar(191) NOT NULL,
                  CreatedAt varchar(191) NOT NULL,
                  UpdatedAt varchar(191) NOT NULL,
                  PRIMARY KEY (NoteId)
                );
                """);
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS student_documents (
                  DocumentId varchar(191) NOT NULL,
                  StudentId varchar(191) NOT NULL,
                  Kind varchar(191) NOT NULL,
                  Title varchar(191) NOT NULL,
                  OriginalName varchar(191) NOT NULL,
                  StoredPath varchar(512) NOT NULL,
                  ContentType varchar(128) NOT NULL,
                  SizeBytes bigint NOT NULL,
                  UploadedBy varchar(191) NOT NULL,
                  CreatedAt varchar(191) NOT NULL,
                  PRIMARY KEY (DocumentId)
                );
                """);
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS chat_groups (
                  GroupId varchar(191) NOT NULL,
                  Name varchar(120) NOT NULL,
                  MemberIds text NOT NULL,
                  CreatedBy varchar(191) NOT NULL,
                  CreatedAt varchar(191) NOT NULL,
                  UpdatedAt varchar(191) NOT NULL,
                  Status varchar(32) NOT NULL,
                  PRIMARY KEY (GroupId)
                );
                """);
            logger.LogInformation("Workflow schema is ready (tasks, sessions, teacher workspace notes).");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not ensure workflow schema. Create staff_tasks / session_packages tables in MySQL.");
        }
    }

    private static bool IsPostgres(HirayaLearningCenterDbContext db) =>
        db.Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true;

    private static async Task EnsurePostgresWorkflowSchemaAsync(HirayaLearningCenterDbContext db, ILogger logger)
    {
        await TryAddColumn(db, "users", "PersonalEmail", "varchar(191) NOT NULL DEFAULT ''");
        await TryAddColumn(db, "announcements", "Audience", "varchar(64) NOT NULL DEFAULT 'everyone'");
        await TryAddColumn(db, "announcements", "AudienceId", "varchar(191) NOT NULL DEFAULT ''");
        await TryAddColumn(db, "announcements", "Priority", "varchar(32) NOT NULL DEFAULT 'normal'");
        await TryAddColumn(db, "announcements", "ExpiresAt", "varchar(191) NOT NULL DEFAULT ''");
        await TryAddColumn(db, "notifications", "RelatedRecordId", "varchar(191) NOT NULL DEFAULT ''");
        await TryAddColumn(db, "notifications", "ReadAt", "varchar(191) NOT NULL DEFAULT ''");
        await TryAddColumn(db, "schedules", "ProgramId", "varchar(191) NOT NULL DEFAULT ''");
        await TryAddColumn(db, "students", "ProfileImagePath", "varchar(512) NOT NULL DEFAULT ''");
        await TryAddColumn(db, "payments", "ReceivedBy", "varchar(191) NOT NULL DEFAULT ''");
        await TryAddColumn(db, "payments", "AccountNumber", "varchar(191) NOT NULL DEFAULT ''");
        await TryAddColumn(db, "payments", "FromAccountNumber", "varchar(191) NOT NULL DEFAULT ''");
        await TryAddColumn(db, "payments", "ReceiptPath", "varchar(512) NOT NULL DEFAULT ''");
        await TryAddColumn(db, "payments", "ReceiptName", "varchar(191) NOT NULL DEFAULT ''");
        await TryAddColumn(db, "student_ops", "TuitionFee", "decimal(18,2) NOT NULL DEFAULT 0");
        await TryAddColumn(db, "programs", "TuitionFee", "decimal(18,2) NOT NULL DEFAULT 0");
        await TryAddColumn(db, "programs", "PackageSessions", "int NOT NULL DEFAULT 0");
        await TryAddColumn(db, "payments", "IncomeBucket", "varchar(32) NOT NULL DEFAULT ''");
        await TryAddColumn(db, "enrollment_applications", "ApplicationKind", "varchar(32) NOT NULL DEFAULT 'student'");
        await TryAddColumn(db, "center_expenses", "Kind", "varchar(16) NOT NULL DEFAULT 'expense'");
        logger.LogInformation("PostgreSQL workflow columns are ready. Tables come from the Neon baseline migration.");
    }

    private static async Task TryAddColumn(HirayaLearningCenterDbContext db, string table, string column, string definition)
    {
        try
        {
            var sql = IsPostgres(db)
                ? $"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS \"{column}\" {definition};"
                : $"ALTER TABLE `{table}` ADD COLUMN `{column}` {definition};";
            await db.Database.ExecuteSqlRawAsync(sql);
        }
        catch
        {
            /* column already exists */
        }
    }

    private static void AddDetached<T>(HirayaLearningCenterDbContext db, IEnumerable<T> items) where T : class
    {
        foreach (var item in items)
        {
            if (db.Entry(item).State == EntityState.Detached)
                db.Set<T>().Add(item);
        }
    }
}
