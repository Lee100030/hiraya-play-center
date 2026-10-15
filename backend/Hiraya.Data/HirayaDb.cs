using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;

namespace Hiraya.Data;

public static class HirayaDb
{
    public const string MySql = "mysql";
    public const string Postgres = "postgres";
    public const string SqlServer = "sqlserver";

    public static string ResolveProvider(IConfiguration? configuration)
    {
        var explicitProvider = NormalizeProvider(Environment.GetEnvironmentVariable("HIRAYA_DB_PROVIDER"))
                               ?? NormalizeProvider(configuration?["Hiraya:DatabaseProvider"]);
        if (explicitProvider is not null)
            return explicitProvider;

        if (!string.IsNullOrWhiteSpace(NeonConnection(configuration)))
            return Postgres;

        if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("HIRAYA_SQLSERVER")))
            return SqlServer;

        return Postgres;
    }

    public static string ResolveConnection(IConfiguration? configuration, string provider)
    {
        if (string.Equals(provider, Postgres, StringComparison.OrdinalIgnoreCase))
            return NormalizePostgresConnection(NeonConnection(configuration), configuration);

        if (string.Equals(provider, SqlServer, StringComparison.OrdinalIgnoreCase))
        {
            return Environment.GetEnvironmentVariable("HIRAYA_SQLSERVER")
                   ?? configuration?.GetConnectionString("HirayaSqlServer")
                   ?? configuration?.GetConnectionString("Hiraya")
                   ?? "Server=127.0.0.1;Database=hiraya_learning_center;User Id=sa;Password=;TrustServerCertificate=True";
        }

        var raw = Environment.GetEnvironmentVariable("HIRAYA_MYSQL")
                  ?? Environment.GetEnvironmentVariable("DATABASE_URL")
                  ?? configuration?.GetConnectionString("Hiraya")
                  ?? "Server=127.0.0.1;Port=3306;Database=hiraya_learning_center;User=root;Password=";
        return NormalizeMysqlConnection(raw, configuration);
    }

    public static string ApplyPassword(string connection, IConfiguration? configuration)
    {
        var password = Environment.GetEnvironmentVariable("HIRAYA_SQLSERVER_PASSWORD")
                       ?? Environment.GetEnvironmentVariable("HIRAYA_MYSQL_PASSWORD")
                       ?? Environment.GetEnvironmentVariable("HIRAYA_DB_PASSWORD")
                       ?? configuration?["Hiraya:DatabasePassword"];
        if (string.IsNullOrEmpty(password))
            return connection;

        var parts = connection.Split(';', StringSplitOptions.RemoveEmptyEntries)
            .Select(p =>
            {
                if (p.StartsWith("Password=", StringComparison.OrdinalIgnoreCase)
                    || p.StartsWith("Pwd=", StringComparison.OrdinalIgnoreCase))
                    return "Password=" + password;
                return p;
            })
            .ToList();
        if (!parts.Any(p => p.StartsWith("Password=", StringComparison.OrdinalIgnoreCase)))
            parts.Add("Password=" + password);
        return string.Join(";", parts) + ";";
    }

    public static void Configure(DbContextOptionsBuilder options, string provider, string connection)
    {
        if (string.Equals(provider, SqlServer, StringComparison.OrdinalIgnoreCase))
        {
            options.UseSqlServer(connection, sql =>
                sql.EnableRetryOnFailure(5, TimeSpan.FromSeconds(10), null));
        }
        else if (string.Equals(provider, Postgres, StringComparison.OrdinalIgnoreCase))
        {
            options.UseNpgsql(connection, npgsql =>
                npgsql.EnableRetryOnFailure(5, TimeSpan.FromSeconds(10), null));
        }
        else
        {
            options.UseMySql(connection, new MySqlServerVersion(new Version(8, 0, 21)), mySql =>
                mySql.EnableRetryOnFailure(5, TimeSpan.FromSeconds(10), null));
        }

        options.ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning));
    }

    public static string NormalizeMysqlConnection(string value, IConfiguration? configuration = null)
    {
        var trimmed = value.Trim();
        if (trimmed.StartsWith("mysql://", StringComparison.OrdinalIgnoreCase)
            || trimmed.StartsWith("mysql2://", StringComparison.OrdinalIgnoreCase))
        {
            var uri = new Uri(trimmed.Replace("mysql2://", "mysql://", StringComparison.OrdinalIgnoreCase));
            var userInfo = uri.UserInfo.Split(':', 2);
            var user = Uri.UnescapeDataString(userInfo[0]);
            var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
            var database = Uri.UnescapeDataString(uri.AbsolutePath.Trim('/'));
            if (string.IsNullOrWhiteSpace(database))
                database = "defaultdb";
            var port = uri.Port > 0 ? uri.Port : 3306;
            trimmed =
                $"Server={uri.Host};Port={port};Database={database};User={user};Password={password};SslMode=Required;";
        }

        var local = trimmed.Contains("Server=127.0.0.1", StringComparison.OrdinalIgnoreCase)
                    || trimmed.Contains("Server=localhost", StringComparison.OrdinalIgnoreCase);
        var ca = Environment.GetEnvironmentVariable("HIRAYA_MYSQL_CA")
                 ?? configuration?["Hiraya:MysqlSslCa"];
        if (!local && !string.IsNullOrWhiteSpace(ca))
        {
            if (trimmed.Contains("SslMode=", StringComparison.OrdinalIgnoreCase))
                trimmed = System.Text.RegularExpressions.Regex.Replace(
                    trimmed, @"SslMode=[^;]*", "SslMode=VerifyCA", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            else
                trimmed = trimmed.TrimEnd(';') + ";SslMode=VerifyCA";
            if (!trimmed.Contains("SslCa=", StringComparison.OrdinalIgnoreCase))
                trimmed = trimmed.TrimEnd(';') + ";SslCa=" + ca;
        }
        else if (!local && !trimmed.Contains("SslMode=", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed.TrimEnd(';') + ";SslMode=Required;";
        }

        return trimmed;
    }

    private static string? NormalizeProvider(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        var normalized = value.Trim().ToLowerInvariant();
        return normalized switch
        {
            "mysql" or "mariadb" or "maria" => MySql,
            "postgres" or "postgresql" or "npgsql" or "neon" => Postgres,
            "sqlserver" or "mssql" or "sql" => SqlServer,
            _ => null
        };
    }

    private static string NeonConnection(IConfiguration? configuration)
    {
        var postgres = Environment.GetEnvironmentVariable("HIRAYA_POSTGRES")
                       ?? configuration?["Hiraya:Neon"]
                       ?? "";
        if (!string.IsNullOrWhiteSpace(postgres))
            return postgres;

        var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL") ?? "";
        if (databaseUrl.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            || databaseUrl.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase)
            || databaseUrl.Contains("neon.tech", StringComparison.OrdinalIgnoreCase))
            return databaseUrl;
        return "";
    }

    public static string NormalizePostgresConnection(string value, IConfiguration? configuration = null)
    {
        var trimmed = (value ?? "").Trim();
        if (trimmed.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            || trimmed.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            var uri = new Uri(trimmed);
            var userInfo = uri.UserInfo.Split(':', 2);
            var user = Uri.UnescapeDataString(userInfo[0]);
            var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
            var database = Uri.UnescapeDataString(uri.AbsolutePath.Trim('/'));
            if (string.IsNullOrWhiteSpace(database))
                database = "neondb";
            var port = uri.Port > 0 ? uri.Port : 5432;
            trimmed = $"Host={uri.Host};Port={port};Database={database};Username={user};Password={password}";
        }

        var local = trimmed.Contains("Host=127.0.0.1", StringComparison.OrdinalIgnoreCase)
                    || trimmed.Contains("Host=localhost", StringComparison.OrdinalIgnoreCase);
        if (local)
            return trimmed.TrimEnd(';') + ";";

        var ca = Environment.GetEnvironmentVariable("HIRAYA_POSTGRES_CA")
                 ?? configuration?["Hiraya:NeonCa"];
        if (!string.IsNullOrWhiteSpace(ca))
        {
            trimmed = trimmed.TrimEnd(';') + ";SSL Mode=VerifyFull;Root Certificate=" + ca;
        }
        else if (!trimmed.Contains("SSL Mode=", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed.TrimEnd(';') + ";SSL Mode=Require;Trust Server Certificate=true";
        }

        return trimmed.EndsWith(';') ? trimmed : trimmed + ";";
    }
}
