using System.Security.Cryptography;
using System.Text;

namespace Hiraya.Shared.Security;

/// <summary>
/// Short-lived Super Administrator sign-in codes. Kept in memory, separate from password-change codes.
/// </summary>
public sealed class LoginOtpChallenges
{
    public const string Mailbox = "hklc.admin@gmail.com";
    public const string TooMany = "Too many attempts. Please wait before trying again.";
    public const string InvalidCode = "That sign-in code is not valid.";
    public const string ExpiredCode = "That sign-in code has expired. Request a new one.";
    public const string UsedCode = "That sign-in code was already used. Request a new one.";
    public const string MailFailed = "The sign-in code could not be sent. Try again.";
    public const string SignInAgain = "Sign in again to get a new code.";

    private static readonly TimeSpan CodeLifetime = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(15);
    private const int MaxSends = 5;
    private const int MaxChecks = 8;

    private readonly object _gate = new();
    private readonly Dictionary<string, Challenge> _challenges = new(StringComparer.Ordinal);
    private readonly Dictionary<string, SendWindow> _windows = new(StringComparer.OrdinalIgnoreCase);

    public bool TryIssue(string userId, string passwordStamp, out string challengeId, out string code, out string error)
    {
        challengeId = "";
        code = "";
        error = TooMany;
        if (string.IsNullOrWhiteSpace(userId))
            return false;

        lock (_gate)
        {
            if (!ReserveSend(userId.Trim()))
                return false;
            code = NewCode();
            challengeId = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            var now = DateTime.UtcNow;
            if (_windows.TryGetValue(userId.Trim(), out var window) && !string.IsNullOrEmpty(window.ActiveChallenge))
                _challenges.Remove(window.ActiveChallenge);
            if (window is not null)
                window.ActiveChallenge = challengeId;
            _challenges[challengeId] = new Challenge
            {
                UserId = userId.Trim(),
                PasswordStamp = passwordStamp ?? "",
                Hash = Hash(code),
                Expires = now.Add(CodeLifetime),
                RecordExpires = now.Add(Window)
            };
            error = "";
            return true;
        }
    }

    public bool TryResend(string challengeId, out string code, out string error)
    {
        code = "";
        error = SignInAgain;
        if (string.IsNullOrWhiteSpace(challengeId))
            return false;

        lock (_gate)
        {
            if (!_challenges.TryGetValue(challengeId.Trim(), out var state))
                return false;
            if (state.Used)
            {
                error = UsedCode;
                return false;
            }
            if (DateTime.UtcNow > state.RecordExpires)
            {
                error = ExpiredCode;
                return false;
            }
            if (!ReserveSend(state.UserId))
            {
                error = TooMany;
                return false;
            }
            code = NewCode();
            var now = DateTime.UtcNow;
            state.Hash = Hash(code);
            state.Expires = now.Add(CodeLifetime);
            state.RecordExpires = now.Add(Window);
            state.Used = false;
            state.CheckCount = 0;
            error = "";
            return true;
        }
    }

    public string? Consume(string challengeId, string code, out string? userId, out string? passwordStamp)
    {
        userId = null;
        passwordStamp = null;
        if (string.IsNullOrWhiteSpace(challengeId) || string.IsNullOrWhiteSpace(code))
            return InvalidCode;

        lock (_gate)
        {
            if (!_challenges.TryGetValue(challengeId.Trim(), out var state))
                return InvalidCode;
            if (state.Used)
                return UsedCode;
            if (DateTime.UtcNow > state.Expires || DateTime.UtcNow > state.RecordExpires)
                return ExpiredCode;
            state.CheckCount++;
            if (state.CheckCount > MaxChecks)
                return TooMany;
            if (!FixedEquals(state.Hash, Hash(code.Trim())))
                return InvalidCode;
            state.Used = true;
            userId = state.UserId;
            passwordStamp = state.PasswordStamp;
            return null;
        }
    }

    public void Drop(string challengeId)
    {
        if (string.IsNullOrWhiteSpace(challengeId))
            return;
        lock (_gate)
        {
            if (!_challenges.Remove(challengeId.Trim(), out var state))
                return;
            if (_windows.TryGetValue(state.UserId, out var window) &&
                string.Equals(window.ActiveChallenge, challengeId.Trim(), StringComparison.Ordinal))
                window.ActiveChallenge = "";
        }
    }

    private bool ReserveSend(string userId)
    {
        var now = DateTime.UtcNow;
        if (!_windows.TryGetValue(userId, out var window) || now - window.WindowStart > Window)
        {
            _windows[userId] = new SendWindow { SendCount = 1, WindowStart = now, ActiveChallenge = window?.ActiveChallenge ?? "" };
            return true;
        }
        window.SendCount++;
        return window.SendCount <= MaxSends;
    }

    private static string NewCode() => RandomNumberGenerator.GetInt32(100000, 1000000).ToString("D6");

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

    private sealed class Challenge
    {
        public string UserId { get; set; } = "";
        public string PasswordStamp { get; set; } = "";
        public string Hash { get; set; } = "";
        public DateTime Expires { get; set; }
        public DateTime RecordExpires { get; set; }
        public bool Used { get; set; }
        public int CheckCount { get; set; }
    }

    private sealed class SendWindow
    {
        public int SendCount { get; set; }
        public DateTime WindowStart { get; set; }
        public string ActiveChallenge { get; set; } = "";
    }
}
