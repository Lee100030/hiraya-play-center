using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hiraya.Data.Migrations
{
    [DbContext(typeof(HirayaLearningCenterDbContext))]
    [Migration("20260906180000_WebsiteLanding")]
    public partial class WebsiteLanding : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "WelcomeTitle",
                table: "system_settings",
                type: "varchar(191)",
                maxLength: 191,
                nullable: false,
                defaultValue: "Welcome to Hiraya Kids Learning Center")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "WelcomeMessage",
                table: "system_settings",
                type: "text",
                nullable: false,
                defaultValue: "We provide a safe and supportive learning environment where children can grow, learn, and develop their skills.")
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "WelcomeTitle", table: "system_settings");
            migrationBuilder.DropColumn(name: "WelcomeMessage", table: "system_settings");
        }
    }
}
