namespace Hiraya.Data;

/// <summary>
/// The app that is calling the API for this request. The repository uses it to
/// read that app's Firestore project. It is not a Firestore read.
/// </summary>
public static class HirayaClientContext
{
    private static readonly AsyncLocal<string?> Current = new();

    public static string? Client => Normalize(Current.Value);

    public static void Set(string? value) => Current.Value = value;

    public static string? Normalize(string? raw)
    {
        var text = (raw ?? "").Trim().ToLowerInvariant();
        return text is "mobile" or "desktop" or "website" ? text : null;
    }
}
