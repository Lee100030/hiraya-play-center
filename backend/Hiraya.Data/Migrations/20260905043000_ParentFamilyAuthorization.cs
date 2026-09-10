using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hiraya.Data.Migrations
{
    [DbContext(typeof(HirayaLearningCenterDbContext))]
    [Migration("20260905043000_ParentFamilyAuthorization")]
    public partial class ParentFamilyAuthorization : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "users",
                type: "varchar(191)",
                maxLength: 191,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "parent_students",
                columns: table => new
                {
                    ParentStudentId = table.Column<string>(type: "varchar(191)", maxLength: 191, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ParentId = table.Column<string>(type: "varchar(191)", maxLength: 191, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    StudentId = table.Column<string>(type: "varchar(191)", maxLength: 191, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Relationship = table.Column<string>(type: "varchar(191)", maxLength: 191, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAt = table.Column<string>(type: "varchar(191)", maxLength: 191, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    UpdatedAt = table.Column<string>(type: "varchar(191)", maxLength: 191, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_parent_students", x => x.ParentStudentId);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_parent_students_ParentId",
                table: "parent_students",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_parent_students_StudentId",
                table: "parent_students",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_parent_students_ParentId_StudentId",
                table: "parent_students",
                columns: new[] { "ParentId", "StudentId" },
                unique: true);

            migrationBuilder.CreateTable(
                name: "account_invitations",
                columns: table => new
                {
                    InvitationId = table.Column<string>(type: "varchar(191)", maxLength: 191, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    UserId = table.Column<string>(type: "varchar(191)", maxLength: 191, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    TokenHash = table.Column<string>(type: "varchar(128)", maxLength: 128, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Kind = table.Column<string>(type: "varchar(191)", maxLength: 191, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ExpiresAt = table.Column<string>(type: "varchar(191)", maxLength: 191, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    UsedAt = table.Column<string>(type: "varchar(191)", maxLength: 191, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<string>(type: "varchar(191)", maxLength: 191, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_account_invitations", x => x.InvitationId);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_account_invitations_UserId",
                table: "account_invitations",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_account_invitations_TokenHash",
                table: "account_invitations",
                column: "TokenHash");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "parent_students");
            migrationBuilder.DropTable(name: "account_invitations");
            migrationBuilder.DropColumn(name: "Notes", table: "users");
        }
    }
}
