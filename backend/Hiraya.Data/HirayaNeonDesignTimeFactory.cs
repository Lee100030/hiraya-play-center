using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Hiraya.Data;

public class HirayaNeonDesignTimeFactory : IDesignTimeDbContextFactory<HirayaNeonDbContext>
{
    public HirayaNeonDbContext CreateDbContext(string[] args)
    {
        var uri = Environment.GetEnvironmentVariable("HIRAYA_POSTGRES");
        if (string.IsNullOrWhiteSpace(uri))
            uri = ReadNeonUri();
        var connection = string.IsNullOrWhiteSpace(uri)
            ? "Host=127.0.0.1;Port=5432;Database=hiraya_neon_design;Username=postgres;Password=postgres"
            : HirayaDb.NormalizePostgresConnection(DirectHost(uri));
        var options = new DbContextOptionsBuilder<HirayaNeonDbContext>();
        options.UseNpgsql(connection);
        return new HirayaNeonDbContext(options.Options);
    }

    private static string DirectHost(string uri)
    {
        return uri.Replace("-pooler.", ".", StringComparison.OrdinalIgnoreCase);
    }

    private static string? ReadNeonUri()
    {
        var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (dir is not null)
        {
            var candidate = Path.Combine(dir.FullName, "backend", "Hiraya.Api", "appsettings.Local.json");
            if (!File.Exists(candidate))
                candidate = Path.Combine(dir.FullName, "appsettings.Local.json");
            if (File.Exists(candidate))
            {
                using var doc = JsonDocument.Parse(File.ReadAllText(candidate));
                if (doc.RootElement.TryGetProperty("Hiraya", out var hiraya) &&
                    hiraya.TryGetProperty("Neon", out var neon) &&
                    neon.ValueKind == JsonValueKind.String)
                    return neon.GetString();
            }
            dir = dir.Parent;
        }
        return null;
    }
}
