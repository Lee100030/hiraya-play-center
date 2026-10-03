using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hiraya.Data.Migrations
{
    [DbContext(typeof(HirayaLearningCenterDbContext))]
    [Migration("20260930170000_ProgramPackageSessions")]
    public partial class ProgramPackageSessions : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP PROCEDURE IF EXISTS hiraya_program_package_sessions;
                CREATE PROCEDURE hiraya_program_package_sessions()
                BEGIN
                  IF (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'programs' AND COLUMN_NAME = 'PackageSessions') = 0 THEN
                    ALTER TABLE `programs` ADD COLUMN `PackageSessions` int NOT NULL DEFAULT 0;
                  END IF;
                END
                """, suppressTransaction: true);
            migrationBuilder.Sql("CALL hiraya_program_package_sessions()", suppressTransaction: true);
            migrationBuilder.Sql("DROP PROCEDURE IF EXISTS hiraya_program_package_sessions", suppressTransaction: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE `programs` DROP COLUMN `PackageSessions`", suppressTransaction: true);
        }
    }
}
