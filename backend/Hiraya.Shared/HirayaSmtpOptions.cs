namespace Hiraya.Shared;

public class HirayaSmtpOptions
{
    public const string SectionName = "Smtp";

    public bool Enabled { get; set; }
    public string Host { get; set; } = "";
    public int Port { get; set; } = 587;
    public bool EnableSsl { get; set; } = true;
    public string User { get; set; } = "";
    public string Password { get; set; } = "";
    public string From { get; set; } = "";
    public string FromName { get; set; } = "HIRAYA Learning Center";
    public string PublicBaseUrl { get; set; } = "http://127.0.0.1:5288";

    public static HirayaSmtpOptions Resolved(HirayaSmtpOptions source)
    {
        var next = new HirayaSmtpOptions
        {
            Enabled = source.Enabled,
            Host = FirstEnv("HIRAYA_SMTP_HOST", source.Host),
            Port = source.Port > 0 ? source.Port : 587,
            EnableSsl = source.EnableSsl,
            User = FirstEnv("HIRAYA_SMTP_USER", source.User),
            Password = FirstEnv("HIRAYA_SMTP_PASSWORD", source.Password),
            From = FirstEnv("HIRAYA_SMTP_FROM", source.From),
            FromName = string.IsNullOrWhiteSpace(source.FromName) ? "HIRAYA Learning Center" : source.FromName.Trim(),
            PublicBaseUrl = FirstEnv("HIRAYA_PUBLIC_URL", source.PublicBaseUrl)
        };
        if (string.Equals(Environment.GetEnvironmentVariable("HIRAYA_SMTP_ENABLED"), "true", StringComparison.OrdinalIgnoreCase))
            next.Enabled = true;
        if (int.TryParse(Environment.GetEnvironmentVariable("HIRAYA_SMTP_PORT"), out var port) && port > 0)
            next.Port = port;
        if (string.Equals(Environment.GetEnvironmentVariable("HIRAYA_SMTP_SSL"), "false", StringComparison.OrdinalIgnoreCase))
            next.EnableSsl = false;
        if (string.IsNullOrWhiteSpace(next.From))
            next.From = next.User;
        if (string.IsNullOrWhiteSpace(next.PublicBaseUrl))
            next.PublicBaseUrl = "http://127.0.0.1:5288";
        return next;
    }

    public bool IsConfigured()
    {
        var live = Resolved(this);
        return live.Enabled &&
               !string.IsNullOrWhiteSpace(live.Host) &&
               !string.IsNullOrWhiteSpace(live.From);
    }

    private static string FirstEnv(string name, string fallback)
    {
        var value = Environment.GetEnvironmentVariable(name);
        return string.IsNullOrWhiteSpace(value) ? (fallback ?? "").Trim() : value.Trim();
    }
}
