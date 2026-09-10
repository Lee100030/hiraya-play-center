namespace Hiraya.Shared;

public class HirayaApiOptions
{
    public const string SectionName = "HirayaApi";

    public bool UseRemoteStore { get; set; }
    public string BaseUrl { get; set; } = "http://127.0.0.1:5188";
    public int TimeoutSeconds { get; set; } = 30;

    public static void ApplyEnvironment(HirayaApiOptions target)
    {
        var url = Environment.GetEnvironmentVariable("HIRAYA_API_URL");
        if (!string.IsNullOrWhiteSpace(url))
            target.BaseUrl = url.Trim().TrimEnd('/');

        var remote = Environment.GetEnvironmentVariable("HIRAYA_USE_REMOTE_STORE");
        if (string.Equals(remote, "true", StringComparison.OrdinalIgnoreCase))
            target.UseRemoteStore = true;
        if (string.Equals(remote, "false", StringComparison.OrdinalIgnoreCase))
            target.UseRemoteStore = false;

        if (int.TryParse(Environment.GetEnvironmentVariable("HIRAYA_API_TIMEOUT"), out var seconds) && seconds > 0)
            target.TimeoutSeconds = seconds;
    }
}
