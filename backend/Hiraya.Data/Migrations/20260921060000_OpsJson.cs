using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hiraya.Data.Migrations
{
    [DbContext(typeof(HirayaLearningCenterDbContext))]
    [Migration("20260921060000_OpsJson")]
    public partial class OpsJson : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OpsJson",
                table: "system_settings",
                type: "longtext",
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "OpsJson", table: "system_settings");
        }
    }
}
