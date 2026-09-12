using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hiraya.Data.Migrations
{
    [DbContext(typeof(HirayaLearningCenterDbContext))]
    [Migration("20260912120000_EnrollmentApplicationNotes")]
    public partial class EnrollmentApplicationNotes : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "enrollment_applications",
                type: "text",
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "Notes", table: "enrollment_applications");
        }
    }
}
