using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hiraya.Data.Migrations
{
    [DbContext(typeof(HirayaLearningCenterDbContext))]
    [Migration("20260927170000_SchemaParity")]
    public partial class SchemaParity : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
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
            migrationBuilder.Sql("""
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
            migrationBuilder.Sql("""
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
            migrationBuilder.Sql("""
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
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS revoked_sessions (
                  Jti varchar(64) NOT NULL,
                  ExpiresUnix bigint NOT NULL,
                  PRIMARY KEY (Jti)
                );
                """);
            migrationBuilder.Sql("DROP PROCEDURE IF EXISTS hiraya_schema_parity", suppressTransaction: true);
            migrationBuilder.Sql("""
                CREATE PROCEDURE hiraya_schema_parity()
                BEGIN
                  IF (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'PersonalEmail') = 0 THEN
                    ALTER TABLE `users` ADD COLUMN `PersonalEmail` varchar(191) NOT NULL DEFAULT '';
                  END IF;
                  IF (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'announcements' AND COLUMN_NAME = 'Audience') = 0 THEN
                    ALTER TABLE `announcements` ADD COLUMN `Audience` varchar(64) NOT NULL DEFAULT 'everyone';
                  END IF;
                  IF (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'announcements' AND COLUMN_NAME = 'AudienceId') = 0 THEN
                    ALTER TABLE `announcements` ADD COLUMN `AudienceId` varchar(191) NOT NULL DEFAULT '';
                  END IF;
                  IF (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'announcements' AND COLUMN_NAME = 'Priority') = 0 THEN
                    ALTER TABLE `announcements` ADD COLUMN `Priority` varchar(32) NOT NULL DEFAULT 'normal';
                  END IF;
                  IF (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'announcements' AND COLUMN_NAME = 'ExpiresAt') = 0 THEN
                    ALTER TABLE `announcements` ADD COLUMN `ExpiresAt` varchar(191) NOT NULL DEFAULT '';
                  END IF;
                  IF (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'RelatedRecordId') = 0 THEN
                    ALTER TABLE `notifications` ADD COLUMN `RelatedRecordId` varchar(191) NOT NULL DEFAULT '';
                  END IF;
                  IF (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'ReadAt') = 0 THEN
                    ALTER TABLE `notifications` ADD COLUMN `ReadAt` varchar(191) NOT NULL DEFAULT '';
                  END IF;
                  IF (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schedules' AND COLUMN_NAME = 'ProgramId') = 0 THEN
                    ALTER TABLE `schedules` ADD COLUMN `ProgramId` varchar(191) NOT NULL DEFAULT '';
                  END IF;
                  IF (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'ProfileImagePath') = 0 THEN
                    ALTER TABLE `students` ADD COLUMN `ProfileImagePath` varchar(512) NOT NULL DEFAULT '';
                  END IF;
                  IF (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'ReceivedBy') = 0 THEN
                    ALTER TABLE `payments` ADD COLUMN `ReceivedBy` varchar(191) NOT NULL DEFAULT '';
                  END IF;
                  IF (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'AccountNumber') = 0 THEN
                    ALTER TABLE `payments` ADD COLUMN `AccountNumber` varchar(191) NOT NULL DEFAULT '';
                  END IF;
                  IF (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'FromAccountNumber') = 0 THEN
                    ALTER TABLE `payments` ADD COLUMN `FromAccountNumber` varchar(191) NOT NULL DEFAULT '';
                  END IF;
                  IF (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'ReceiptPath') = 0 THEN
                    ALTER TABLE `payments` ADD COLUMN `ReceiptPath` varchar(512) NOT NULL DEFAULT '';
                  END IF;
                  IF (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'ReceiptName') = 0 THEN
                    ALTER TABLE `payments` ADD COLUMN `ReceiptName` varchar(191) NOT NULL DEFAULT '';
                  END IF;
                  IF (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_ops' AND COLUMN_NAME = 'TuitionFee') = 0 THEN
                    ALTER TABLE `student_ops` ADD COLUMN `TuitionFee` decimal(18,2) NOT NULL DEFAULT 0;
                  END IF;
                  IF (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'programs' AND COLUMN_NAME = 'TuitionFee') = 0 THEN
                    ALTER TABLE `programs` ADD COLUMN `TuitionFee` decimal(18,2) NOT NULL DEFAULT 0;
                  END IF;
                END
                """, suppressTransaction: true);
            migrationBuilder.Sql("CALL hiraya_schema_parity()", suppressTransaction: true);
            migrationBuilder.Sql("DROP PROCEDURE IF EXISTS hiraya_schema_parity", suppressTransaction: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TABLE IF EXISTS revoked_sessions");
        }
    }
}
