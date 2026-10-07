using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace Hiraya.Shared.Security;

public sealed class SensitiveActionCodes
{
    public const string TooMany = "Too many attempts. Please wait before trying again.";
    public const string InvalidCode = "That verification code is not valid.";
    public const string ExpiredCode = "That verification code has expired. Request a new one.";
    public const string UsedCode = "That verification code was already used. Request a new one.";

    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan IssueWindow = TimeSpan.FromMinutes(15);
    private const int MaxIssues = 5;
    private const int MaxChecks = 8;

    private readonly ConcurrentDictionary<string, CodeState> _codes = new(StringComparer.OrdinalIgnoreCase);

    public bool AllowIssue(string userId, out string error)
    {
        error = TooMany;
        if (string.IsNullOrWhiteSpace(userId))
            return false;
        var now = DateTime.UtcNow;
        var next = _codes.AddOrUpdate(
            userId.Trim(),
            _ => new CodeState { IssueCount = 1, IssueWindowStart = now },
            (_, cur) =>
            {
                if (now - cur.IssueWindowStart > IssueWindow)
                    return new CodeState { IssueCount = 1, IssueWindowStart = now };
                cur.IssueCount++;
                return cur;
            });
        if (next.IssueCount > MaxIssues)
            return false;
        error = "";
        return true;
    }

    public string Issue(string userId)
    {
        var code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString("D6");
        _codes.AddOrUpdate(
            userId.Trim(),
            _ => new CodeState
            {
                Hash = Hash(code),
                Expires = DateTime.UtcNow.Add(Lifetime),
                IssueCount = 1,
                IssueWindowStart = DateTime.UtcNow
            },
            (_, cur) =>
            {
                cur.Hash = Hash(code);
                cur.Expires = DateTime.UtcNow.Add(Lifetime);
                cur.Used = false;
                cur.CheckCount = 0;
                return cur;
            });
        return code;
    }

    public string? Consume(string userId, string code)
    {
        if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(code))
            return InvalidCode;
        if (!_codes.TryGetValue(userId.Trim(), out var state) || string.IsNullOrEmpty(state.Hash))
            return InvalidCode;
        if (state.Used)
            return UsedCode;
        if (DateTime.UtcNow > state.Expires)
            return ExpiredCode;
        state.CheckCount++;
        if (state.CheckCount > MaxChecks)
            return TooMany;
        if (!FixedEquals(state.Hash, Hash(code.Trim())))
            return InvalidCode;
        state.Used = true;
        return null;
    }

    private static string Hash(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes);
    }

    private static bool FixedEquals(string left, string right)
    {
        var a = Encoding.UTF8.GetBytes(left);
        var b = Encoding.UTF8.GetBytes(right);
        return a.Length == b.Length && CryptographicOperations.FixedTimeEquals(a, b);
    }

    private sealed class CodeState
    {
        public string Hash { get; set; } = "";
        public DateTime Expires { get; set; }
        public bool Used { get; set; }
        public int CheckCount { get; set; }
        public int IssueCount { get; set; }
        public DateTime IssueWindowStart { get; set; }
    }
}
