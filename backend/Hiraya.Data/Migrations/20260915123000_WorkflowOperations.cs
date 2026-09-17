using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hiraya.Data.Migrations
{
    [DbContext(typeof(HirayaLearningCenterDbContext))]
    [Migration("20260915123000_WorkflowOperations")]
    public partial class WorkflowOperations : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
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
            migrationBuilder.Sql("""
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
            migrationBuilder.Sql("""
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
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "staff_tasks");
            migrationBuilder.DropTable(name: "session_packages");
            migrationBuilder.DropTable(name: "session_history");
        }
    }
}
