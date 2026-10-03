using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hiraya.Data.Migrations.Postgres
{
    /// <inheritdoc />
    public partial class NeonBaseline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "account_invitations",
                columns: table => new
                {
                    InvitationId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    UserId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Kind = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ExpiresAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    UsedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    CreatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_account_invitations", x => x.InvitationId);
                });

            migrationBuilder.CreateTable(
                name: "announcements",
                columns: table => new
                {
                    NewsId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Title = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Body = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    PublishedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    IsPublished = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Audience = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    AudienceId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Priority = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ExpiresAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_announcements", x => x.NewsId);
                });

            migrationBuilder.CreateTable(
                name: "attendance",
                columns: table => new
                {
                    AttendanceId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Kind = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    StudentId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    EmployeeId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ClassId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    QrCode = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    TimeIn = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    TimeOut = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: true),
                    AttendanceDate = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Notes = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    RecordedBy = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attendance", x => x.AttendanceId);
                });

            migrationBuilder.CreateTable(
                name: "audit_logs",
                columns: table => new
                {
                    AuditId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ActorId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ActorName = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Module = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Action = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    EntityType = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    EntityId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Summary = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    CreatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_logs", x => x.AuditId);
                });

            migrationBuilder.CreateTable(
                name: "center_expenses",
                columns: table => new
                {
                    ExpenseId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ExpenseDate = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Item = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Category = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PaidTo = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    PaidBy = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Note = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    CreatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    UpdatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_center_expenses", x => x.ExpenseId);
                });

            migrationBuilder.CreateTable(
                name: "center_holidays",
                columns: table => new
                {
                    HolidayId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Date = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Title = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Kind = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_center_holidays", x => x.HolidayId);
                });

            migrationBuilder.CreateTable(
                name: "chat_groups",
                columns: table => new
                {
                    GroupId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    MemberIds = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    CreatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    UpdatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_chat_groups", x => x.GroupId);
                });

            migrationBuilder.CreateTable(
                name: "classes",
                columns: table => new
                {
                    ClassId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Name = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ProgramId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    TeacherId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Room = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Capacity = table.Column<int>(type: "integer", nullable: false),
                    ScheduleNotes = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_classes", x => x.ClassId);
                });

            migrationBuilder.CreateTable(
                name: "enrollment_applications",
                columns: table => new
                {
                    ApplicationId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    StudentFullname = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    StudentBirthdate = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    StudentAge = table.Column<int>(type: "integer", nullable: false),
                    StudentGender = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ParentFullname = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ParentEmail = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ParentPhone = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    PreferredProgram = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    SubmittedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    StudentNumber = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: true),
                    Notes = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ApplicationKind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_enrollment_applications", x => x.ApplicationId);
                });

            migrationBuilder.CreateTable(
                name: "enrollments",
                columns: table => new
                {
                    EnrollmentId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    StudentId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ClassId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ProgramId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    TeacherId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Period = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    EnrollmentDate = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ApprovedBy = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_enrollments", x => x.EnrollmentId);
                });

            migrationBuilder.CreateTable(
                name: "learning_module_versions",
                columns: table => new
                {
                    VersionId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ModuleId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Version = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    FileName = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    FilePath = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    FileType = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    ChangeDescription = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    UploadedByUserId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    CreatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    IsCurrent = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_learning_module_versions", x => x.VersionId);
                });

            migrationBuilder.CreateTable(
                name: "learning_modules",
                columns: table => new
                {
                    ModuleId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Title = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Description = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    ProgramId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Subject = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    GradeLevel = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ModuleType = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ClassIds = table.Column<string>(type: "text", nullable: false),
                    CurrentVersionId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Version = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    FileName = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    FilePath = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    FileType = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    UploadedByUserId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    CreatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    UpdatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    PublishedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ArchivedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_learning_modules", x => x.ModuleId);
                });

            migrationBuilder.CreateTable(
                name: "leave_requests",
                columns: table => new
                {
                    LeaveId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    TeacherId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    TeacherName = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Email = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    StartDate = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    EndDate = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Reason = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    SubmittedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ReviewedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: true),
                    ReviewedBy = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: true),
                    AdminNote = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_leave_requests", x => x.LeaveId);
                });

            migrationBuilder.CreateTable(
                name: "notifications",
                columns: table => new
                {
                    AlertId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Kind = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Title = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Message = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    RecipientId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Href = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    CreatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Read = table.Column<bool>(type: "boolean", nullable: false),
                    RelatedRecordId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ReadAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notifications", x => x.AlertId);
                });

            migrationBuilder.CreateTable(
                name: "opening_balances",
                columns: table => new
                {
                    OpeningId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Month = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Note = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    UpdatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_opening_balances", x => x.OpeningId);
                });

            migrationBuilder.CreateTable(
                name: "parent_students",
                columns: table => new
                {
                    ParentStudentId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ParentId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    StudentId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Relationship = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    UpdatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_parent_students", x => x.ParentStudentId);
                });

            migrationBuilder.CreateTable(
                name: "payments",
                columns: table => new
                {
                    PaymentId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    EnrollmentId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    StudentId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    AmountPaid = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PaymentMethod = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    PaymentStatus = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ReferenceNumber = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    PaymentDate = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    DueAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    PaidAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    RecordedBy = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ReceivedBy = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    AccountNumber = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    FromAccountNumber = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ReceiptPath = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    ReceiptName = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Notes = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    IncomeBucket = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    History = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payments", x => x.PaymentId);
                });

            migrationBuilder.CreateTable(
                name: "programs",
                columns: table => new
                {
                    ProgramId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Name = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Description = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    TuitionFee = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PackageSessions = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_programs", x => x.ProgramId);
                });

            migrationBuilder.CreateTable(
                name: "progress_records",
                columns: table => new
                {
                    ReportId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    StudentId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    TeacherId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ClassId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Period = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Area = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Rating = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Evaluation = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    BehaviorReport = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    DevelopmentalReport = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    Remarks = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    UploadedMedia = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    CreatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    UpdatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    History = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_progress_records", x => x.ReportId);
                });

            migrationBuilder.CreateTable(
                name: "revoked_sessions",
                columns: table => new
                {
                    Jti = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ExpiresUnix = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_revoked_sessions", x => x.Jti);
                });

            migrationBuilder.CreateTable(
                name: "role_permissions",
                columns: table => new
                {
                    PermissionId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Role = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Permission = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Allowed = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_role_permissions", x => x.PermissionId);
                });

            migrationBuilder.CreateTable(
                name: "roles",
                columns: table => new
                {
                    RoleId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Code = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Name = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_roles", x => x.RoleId);
                });

            migrationBuilder.CreateTable(
                name: "rooms",
                columns: table => new
                {
                    RoomId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    RoomName = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    RoomNumber = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Capacity = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rooms", x => x.RoomId);
                });

            migrationBuilder.CreateTable(
                name: "schedules",
                columns: table => new
                {
                    ScheduleId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Title = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Kind = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ClassId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    StudentId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    TeacherId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ScheduleType = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    StartAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    EndAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Room = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Notes = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ProgramId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_schedules", x => x.ScheduleId);
                });

            migrationBuilder.CreateTable(
                name: "session_history",
                columns: table => new
                {
                    HistoryId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    PackageId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    StudentId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ScheduleId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    AttendanceId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Action = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Note = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    ActorId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    CreatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_session_history", x => x.HistoryId);
                });

            migrationBuilder.CreateTable(
                name: "session_packages",
                columns: table => new
                {
                    PackageId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    StudentId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ProgramId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    TotalSessions = table.Column<int>(type: "integer", nullable: false),
                    UsedSessions = table.Column<int>(type: "integer", nullable: false),
                    RemainingSessions = table.Column<int>(type: "integer", nullable: false),
                    StartDate = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ExpirationDate = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    CreatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    UpdatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_session_packages", x => x.PackageId);
                });

            migrationBuilder.CreateTable(
                name: "staff_tasks",
                columns: table => new
                {
                    TaskId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Title = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Description = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    Priority = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    DueAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    TeacherIds = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    ClassId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    StudentId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Response = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    AttachmentName = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    AssignedBy = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    CompletedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    CompletedBy = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    CreatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    UpdatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_staff_tasks", x => x.TaskId);
                });

            migrationBuilder.CreateTable(
                name: "student_documents",
                columns: table => new
                {
                    DocumentId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    StudentId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Kind = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Title = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    OriginalName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    StoredPath = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    UploadedBy = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    CreatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_student_documents", x => x.DocumentId);
                });

            migrationBuilder.CreateTable(
                name: "student_ops",
                columns: table => new
                {
                    StudentId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    PaymentStatus = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Collector = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    HasIdCard = table.Column<bool>(type: "boolean", nullable: false),
                    HasFetcherId = table.Column<bool>(type: "boolean", nullable: false),
                    HasNametag = table.Column<bool>(type: "boolean", nullable: false),
                    FeeAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TuitionFee = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    LaceAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CurrentSlot = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Package = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_student_ops", x => x.StudentId);
                });

            migrationBuilder.CreateTable(
                name: "students",
                columns: table => new
                {
                    StudentId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    FirstName = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    MiddleName = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    LastName = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Fullname = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Birthdate = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Age = table.Column<int>(type: "integer", nullable: false),
                    Gender = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Address = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ContactNumber = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ParentId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    EmergencyContact = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    EmergencyPhone = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    QrCode = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    GradeLevel = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Program = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    EnrollmentDate = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Notes = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ProfileImagePath = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_students", x => x.StudentId);
                });

            migrationBuilder.CreateTable(
                name: "system_settings",
                columns: table => new
                {
                    SettingsId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    CenterName = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    LogoPath = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Address = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Phone = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Email = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Website = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Description = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    AboutTitle = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    WelcomeTitle = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    WelcomeMessage = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    Mission = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    Vision = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    Values = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    TimeZone = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    DefaultPeriod = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    BusinessHours = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    DefaultAttendanceStatus = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    DefaultPaymentMethod = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    NotificationsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    NotifyAttendance = table.Column<bool>(type: "boolean", nullable: false),
                    NotifyPayments = table.Column<bool>(type: "boolean", nullable: false),
                    NotifySchedule = table.Column<bool>(type: "boolean", nullable: false),
                    NotifyProgress = table.Column<bool>(type: "boolean", nullable: false),
                    ModuleAllowedExtensions = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ModuleMaxFileMb = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_system_settings", x => x.SettingsId);
                });

            migrationBuilder.CreateTable(
                name: "teacher_comments",
                columns: table => new
                {
                    CommentId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    TeacherId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Content = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    Visibility = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Reply = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    CreatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    UpdatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_teacher_comments", x => x.CommentId);
                });

            migrationBuilder.CreateTable(
                name: "teacher_duties",
                columns: table => new
                {
                    DutyId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    WorkDate = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    TeacherId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Marker = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Note = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_teacher_duties", x => x.DutyId);
                });

            migrationBuilder.CreateTable(
                name: "teacher_notes",
                columns: table => new
                {
                    NoteId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    TeacherId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Title = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Content = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    Priority = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ReminderDate = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Visibility = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    CreatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    UpdatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_teacher_notes", x => x.NoteId);
                });

            migrationBuilder.CreateTable(
                name: "teacher_role_options",
                columns: table => new
                {
                    RoleId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Name = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_teacher_role_options", x => x.RoleId);
                });

            migrationBuilder.CreateTable(
                name: "teacher_work_shifts",
                columns: table => new
                {
                    ShiftId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    TeacherId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Title = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    WorkDate = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    StartTime = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    EndTime = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Room = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Notes = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_teacher_work_shifts", x => x.ShiftId);
                });

            migrationBuilder.CreateTable(
                name: "teachers",
                columns: table => new
                {
                    ProfileId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    UserId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    EmployeeCode = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Position = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Specialty = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Phone = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Bio = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    HireDate = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_teachers", x => x.ProfileId);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Username = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    FirstName = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    MiddleName = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    LastName = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Fullname = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Email = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    PersonalEmail = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Role = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Phone = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: true),
                    Address = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Position = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    ProfileImagePath = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    CreatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    UpdatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    LastLoginAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    NotifyAttendance = table.Column<bool>(type: "boolean", nullable: false),
                    NotifyPayments = table.Column<bool>(type: "boolean", nullable: false),
                    NotifySchedule = table.Column<bool>(type: "boolean", nullable: false),
                    NotifyProgress = table.Column<bool>(type: "boolean", nullable: false),
                    DateFormat = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    TimeFormat = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Theme = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Notes = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    PasswordHash = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.UserId);
                });

            migrationBuilder.CreateTable(
                name: "website_gallery",
                columns: table => new
                {
                    ItemId = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Title = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    Caption = table.Column<string>(type: "text", maxLength: 191, nullable: false),
                    FilePath = table.Column<string>(type: "varchar(512)", maxLength: 512, nullable: false),
                    Status = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false),
                    UpdatedAt = table.Column<string>(type: "character varying(191)", maxLength: 191, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_website_gallery", x => x.ItemId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_account_invitations_TokenHash",
                table: "account_invitations",
                column: "TokenHash");

            migrationBuilder.CreateIndex(
                name: "IX_account_invitations_UserId",
                table: "account_invitations",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_AttendanceDate",
                table: "attendance",
                column: "AttendanceDate");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_ClassId",
                table: "attendance",
                column: "ClassId");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_EmployeeId",
                table: "attendance",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_StudentId",
                table: "attendance",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_ActorId",
                table: "audit_logs",
                column: "ActorId");

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_CreatedAt",
                table: "audit_logs",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_center_expenses_Category",
                table: "center_expenses",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_center_expenses_ExpenseDate",
                table: "center_expenses",
                column: "ExpenseDate");

            migrationBuilder.CreateIndex(
                name: "IX_center_holidays_Date",
                table: "center_holidays",
                column: "Date",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_classes_ProgramId",
                table: "classes",
                column: "ProgramId");

            migrationBuilder.CreateIndex(
                name: "IX_classes_TeacherId",
                table: "classes",
                column: "TeacherId");

            migrationBuilder.CreateIndex(
                name: "IX_enrollments_ClassId",
                table: "enrollments",
                column: "ClassId");

            migrationBuilder.CreateIndex(
                name: "IX_enrollments_EnrollmentDate",
                table: "enrollments",
                column: "EnrollmentDate");

            migrationBuilder.CreateIndex(
                name: "IX_enrollments_Status",
                table: "enrollments",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_enrollments_StudentId",
                table: "enrollments",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_learning_module_versions_ModuleId",
                table: "learning_module_versions",
                column: "ModuleId");

            migrationBuilder.CreateIndex(
                name: "IX_learning_modules_ProgramId",
                table: "learning_modules",
                column: "ProgramId");

            migrationBuilder.CreateIndex(
                name: "IX_learning_modules_Status",
                table: "learning_modules",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_notifications_RecipientId",
                table: "notifications",
                column: "RecipientId");

            migrationBuilder.CreateIndex(
                name: "IX_opening_balances_Month",
                table: "opening_balances",
                column: "Month");

            migrationBuilder.CreateIndex(
                name: "IX_parent_students_ParentId",
                table: "parent_students",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_parent_students_ParentId_StudentId",
                table: "parent_students",
                columns: new[] { "ParentId", "StudentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_parent_students_StudentId",
                table: "parent_students",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_payments_EnrollmentId",
                table: "payments",
                column: "EnrollmentId");

            migrationBuilder.CreateIndex(
                name: "IX_payments_PaymentDate",
                table: "payments",
                column: "PaymentDate");

            migrationBuilder.CreateIndex(
                name: "IX_payments_PaymentStatus",
                table: "payments",
                column: "PaymentStatus");

            migrationBuilder.CreateIndex(
                name: "IX_payments_StudentId",
                table: "payments",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_programs_Name",
                table: "programs",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_progress_records_StudentId",
                table: "progress_records",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_progress_records_TeacherId",
                table: "progress_records",
                column: "TeacherId");

            migrationBuilder.CreateIndex(
                name: "IX_role_permissions_Role_Permission",
                table: "role_permissions",
                columns: new[] { "Role", "Permission" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_roles_Code",
                table: "roles",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_rooms_RoomName",
                table: "rooms",
                column: "RoomName");

            migrationBuilder.CreateIndex(
                name: "IX_schedules_ClassId",
                table: "schedules",
                column: "ClassId");

            migrationBuilder.CreateIndex(
                name: "IX_schedules_Room",
                table: "schedules",
                column: "Room");

            migrationBuilder.CreateIndex(
                name: "IX_schedules_StartAt",
                table: "schedules",
                column: "StartAt");

            migrationBuilder.CreateIndex(
                name: "IX_schedules_TeacherId",
                table: "schedules",
                column: "TeacherId");

            migrationBuilder.CreateIndex(
                name: "IX_session_history_PackageId",
                table: "session_history",
                column: "PackageId");

            migrationBuilder.CreateIndex(
                name: "IX_session_history_StudentId",
                table: "session_history",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_session_packages_Status",
                table: "session_packages",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_session_packages_StudentId",
                table: "session_packages",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_staff_tasks_Status",
                table: "staff_tasks",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_student_documents_Kind",
                table: "student_documents",
                column: "Kind");

            migrationBuilder.CreateIndex(
                name: "IX_student_documents_StudentId",
                table: "student_documents",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_students_ParentId",
                table: "students",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_students_QrCode",
                table: "students",
                column: "QrCode");

            migrationBuilder.CreateIndex(
                name: "IX_students_Status",
                table: "students",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_teacher_comments_TeacherId",
                table: "teacher_comments",
                column: "TeacherId");

            migrationBuilder.CreateIndex(
                name: "IX_teacher_duties_WorkDate",
                table: "teacher_duties",
                column: "WorkDate");

            migrationBuilder.CreateIndex(
                name: "IX_teacher_duties_WorkDate_TeacherId",
                table: "teacher_duties",
                columns: new[] { "WorkDate", "TeacherId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_teacher_notes_TeacherId",
                table: "teacher_notes",
                column: "TeacherId");

            migrationBuilder.CreateIndex(
                name: "IX_teacher_work_shifts_TeacherId",
                table: "teacher_work_shifts",
                column: "TeacherId");

            migrationBuilder.CreateIndex(
                name: "IX_teachers_EmployeeCode",
                table: "teachers",
                column: "EmployeeCode");

            migrationBuilder.CreateIndex(
                name: "IX_teachers_UserId",
                table: "teachers",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_users_Email",
                table: "users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_Status",
                table: "users",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_users_Username",
                table: "users",
                column: "Username");

            migrationBuilder.CreateIndex(
                name: "IX_website_gallery_Status",
                table: "website_gallery",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "account_invitations");

            migrationBuilder.DropTable(
                name: "announcements");

            migrationBuilder.DropTable(
                name: "attendance");

            migrationBuilder.DropTable(
                name: "audit_logs");

            migrationBuilder.DropTable(
                name: "center_expenses");

            migrationBuilder.DropTable(
                name: "center_holidays");

            migrationBuilder.DropTable(
                name: "chat_groups");

            migrationBuilder.DropTable(
                name: "classes");

            migrationBuilder.DropTable(
                name: "enrollment_applications");

            migrationBuilder.DropTable(
                name: "enrollments");

            migrationBuilder.DropTable(
                name: "learning_module_versions");

            migrationBuilder.DropTable(
                name: "learning_modules");

            migrationBuilder.DropTable(
                name: "leave_requests");

            migrationBuilder.DropTable(
                name: "notifications");

            migrationBuilder.DropTable(
                name: "opening_balances");

            migrationBuilder.DropTable(
                name: "parent_students");

            migrationBuilder.DropTable(
                name: "payments");

            migrationBuilder.DropTable(
                name: "programs");

            migrationBuilder.DropTable(
                name: "progress_records");

            migrationBuilder.DropTable(
                name: "revoked_sessions");

            migrationBuilder.DropTable(
                name: "role_permissions");

            migrationBuilder.DropTable(
                name: "roles");

            migrationBuilder.DropTable(
                name: "rooms");

            migrationBuilder.DropTable(
                name: "schedules");

            migrationBuilder.DropTable(
                name: "session_history");

            migrationBuilder.DropTable(
                name: "session_packages");

            migrationBuilder.DropTable(
                name: "staff_tasks");

            migrationBuilder.DropTable(
                name: "student_documents");

            migrationBuilder.DropTable(
                name: "student_ops");

            migrationBuilder.DropTable(
                name: "students");

            migrationBuilder.DropTable(
                name: "system_settings");

            migrationBuilder.DropTable(
                name: "teacher_comments");

            migrationBuilder.DropTable(
                name: "teacher_duties");

            migrationBuilder.DropTable(
                name: "teacher_notes");

            migrationBuilder.DropTable(
                name: "teacher_role_options");

            migrationBuilder.DropTable(
                name: "teacher_work_shifts");

            migrationBuilder.DropTable(
                name: "teachers");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "website_gallery");
        }
    }
}
