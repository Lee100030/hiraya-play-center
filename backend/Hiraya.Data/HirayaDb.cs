using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;

namespace Hiraya.Data;

public static class HirayaDb
{
    public const string MySql = "mysql";
    public const string SqlServer = "sqlserver";

    public static string ResolveProvider(IConfiguration? configuration)
    {
        var explicitProvider = NormalizeProvider(Environment.GetEnvironmentVariable("HIRAYA_DB_PROVIDER"))
                               ?? NormalizeProvider(configuration?["Hiraya:DatabaseProvider"]);
        if (explicitProvider is not null)
            return explicitProvider;

        if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("HIRAYA_SQLSERVER")))
            return SqlServer;

        return MySql;
    }

    public static string ResolveConnection(IConfiguration? configuration, string provider)
    {
        if (string.Equals(provider, SqlServer, StringComparison.OrdinalIgnoreCase))
        {
            return Environment.GetEnvironmentVariable("HIRAYA_SQLSERVER")
                   ?? configuration?.GetConnectionString("HirayaSqlServer")
                   ?? configuration?.GetConnectionString("Hiraya")
                   ?? "Server=127.0.0.1;Database=hiraya_learning_center;User Id=sa;Password=;TrustServerCertificate=True";
        }

        return Environment.GetEnvironmentVariable("HIRAYA_MYSQL")
               ?? configuration?.GetConnectionString("Hiraya")
               ?? "Server=127.0.0.1;Port=3306;Database=hiraya_learning_center;User=root;Password=";
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
        else
        {
            options.UseMySql(connection, new MySqlServerVersion(new Version(8, 0, 21)), mySql =>
                mySql.EnableRetryOnFailure(5, TimeSpan.FromSeconds(10), null));
        }

        options.ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning));
    }

    private static string? NormalizeProvider(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        var normalized = value.Trim().ToLowerInvariant();
        return normalized switch
        {
            "mysql" or "mariadb" or "maria" => MySql,
            "sqlserver" or "mssql" or "sql" => SqlServer,
            _ => null
        };
    }
}
