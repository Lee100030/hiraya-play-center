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

        var raw = Environment.GetEnvironmentVariable("HIRAYA_MYSQL")
                  ?? Environment.GetEnvironmentVariable("DATABASE_URL")
                  ?? configuration?.GetConnectionString("Hiraya")
                  ?? "Server=127.0.0.1;Port=3306;Database=hiraya_learning_center;User=root;Password=";
        return ToMySqlConnectionString(raw);
    }

    public static string ApplyPassword(string connection, IConfiguration? configuration)
    {
        var password = Environment.GetEnvironmentVariable("HIRAYA_SQLSERVER_PASSWORD")
                       ?? Environment.GetEnvironmentVariable("HIRAYA_MYSQL_PASSWORD")
                       ?? Environment.GetEnvironmentVariable("HIRAYA_DB_PASSWORD")
                       ?? configuration?["Hiraya:DatabasePassword"];
        if (string.IsNullOrEmpty(password))
            return ApplyTls(connection);

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
        return ApplyTls(string.Join(";", parts) + ";");
    }

    public static string DatabaseName(string connection)
    {
        if (LooksLikeUri(connection))
        {
            try
            {
                var path = new Uri(NormalizeUri(connection)).AbsolutePath.Trim('/');
                if (!string.IsNullOrWhiteSpace(path))
                    return path.Split('?')[0];
            }
            catch
            {
                // fall through
            }
        }

        foreach (var part in connection.Split(';', StringSplitOptions.RemoveEmptyEntries))
        {
            if (part.StartsWith("Database=", StringComparison.OrdinalIgnoreCase)
                || part.StartsWith("Initial Catalog=", StringComparison.OrdinalIgnoreCase))
            {
                var value = part[(part.IndexOf('=') + 1)..].Trim();
                if (!string.IsNullOrWhiteSpace(value))
                    return value;
            }
        }

        return "hiraya_learning_center";
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

    internal static string ToMySqlConnectionString(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return "Server=127.0.0.1;Port=3306;Database=hiraya_learning_center;User=root;Password=";

        raw = raw.Trim().Trim('"');
        if (!LooksLikeUri(raw))
            return raw.TrimEnd(';') + ";";

        var uri = new Uri(NormalizeUri(raw));
        var user = "";
        var password = "";
        if (!string.IsNullOrEmpty(uri.UserInfo))
        {
            var cut = uri.UserInfo.IndexOf(':');
            if (cut < 0)
            {
                user = Uri.UnescapeDataString(uri.UserInfo);
            }
            else
            {
                user = Uri.UnescapeDataString(uri.UserInfo[..cut]);
                password = Uri.UnescapeDataString(uri.UserInfo[(cut + 1)..]);
            }
        }

        var database = uri.AbsolutePath.Trim('/');
        if (string.IsNullOrWhiteSpace(database))
            database = "hiraya_learning_center";

        var port = uri.IsDefaultPort ? 3306 : uri.Port;
        var ssl = "";
        var query = uri.Query.TrimStart('?');
        if (query.Contains("ssl", StringComparison.OrdinalIgnoreCase)
            && !query.Contains("ssl-mode=disabled", StringComparison.OrdinalIgnoreCase)
            && !query.Contains("sslmode=disabled", StringComparison.OrdinalIgnoreCase))
        {
            ssl = "SslMode=Required;";
        }

        return $"Server={uri.Host};Port={port};Database={database};User={user};Password={password};{ssl}";
    }

    static string ApplyTls(string connection)
    {
        var ca = Environment.GetEnvironmentVariable("HIRAYA_MYSQL_CA");
        if (string.IsNullOrWhiteSpace(ca))
            return connection.TrimEnd(';') + ";";

        var parts = connection.Split(';', StringSplitOptions.RemoveEmptyEntries).ToList();
        if (!parts.Any(p => p.StartsWith("SslMode=", StringComparison.OrdinalIgnoreCase)))
            parts.Add("SslMode=Required");
        if (!parts.Any(p => p.StartsWith("SslCa=", StringComparison.OrdinalIgnoreCase)))
            parts.Add("SslCa=" + ca);
        return string.Join(";", parts) + ";";
    }

    static bool LooksLikeUri(string value) =>
        value.StartsWith("mysql://", StringComparison.OrdinalIgnoreCase)
        || value.StartsWith("mysqls://", StringComparison.OrdinalIgnoreCase)
        || value.StartsWith("mariadb://", StringComparison.OrdinalIgnoreCase);

    static string NormalizeUri(string value) =>
        value.StartsWith("mysqls://", StringComparison.OrdinalIgnoreCase)
            ? "mysql://" + value["mysqls://".Length..]
            : value;

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
