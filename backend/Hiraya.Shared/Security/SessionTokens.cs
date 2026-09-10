using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

using Hiraya.Shared.Models;

namespace Hiraya.Shared.Security;

public static class SessionTokens
{
    public static TimeSpan DefaultLifetime => TimeSpan.FromHours(12);
    public const string DevelopmentSecret = "hiraya-dev-session-not-for-production";

    public static string PasswordStamp(string? passwordHash)
    {
        if (string.IsNullOrWhiteSpace(passwordHash))
            return "none";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(passwordHash)))[..16];
    }

    public static string Issue(string userId, string secret, TimeSpan? lifetime = null, string? stamp = null)
    {
        var expires = DateTimeOffset.UtcNow.Add(lifetime ?? DefaultLifetime).ToUnixTimeSeconds();
        var jti = Convert.ToHexString(RandomNumberGenerator.GetBytes(8));
        var payload = $"{userId.Trim()}|{expires}|{jti}|{stamp ?? "none"}";
        var mac = Sign(payload, secret);
        return Convert.ToBase64String(Encoding.UTF8.GetBytes($"{payload}|{mac}"));
    }

    public static string? TryGetUserId(string? token, string secret) =>
        TryRead(token, secret)?.UserId;

    public static SessionTicket? TryRead(string? token, string secret)
    {
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(secret))
            return null;
        try
        {
            var raw = Encoding.UTF8.GetString(Convert.FromBase64String(token.Trim()));
            var parts = raw.Split('|');
            if (parts.Length != 5)
                return null;
            var userId = parts[0];
            if (!long.TryParse(parts[1], out var expires))
                return null;
            if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > expires)
                return null;
            var jti = parts[2];
            var stamp = parts[3];
            var expected = Sign($"{userId}|{expires}|{jti}|{stamp}", secret);
            if (!CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(expected),
                    Encoding.UTF8.GetBytes(parts[4])))
                return null;
            if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(jti))
                return null;
            return new SessionTicket
            {
                UserId = userId,
                Jti = jti,
                Stamp = stamp,
                ExpiresUnix = expires
            };
        }
        catch (FormatException)
        {
            return null;
        }
        catch (ArgumentException)
        {
            return null;
        }
    }

    private static string Sign(string payload, string secret)
    {
        var key = SHA256.HashData(Encoding.UTF8.GetBytes(secret));
        var mac = HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(payload));
        return Convert.ToHexString(mac);
    }
}

public sealed class SessionTicket
{
    public string UserId { get; init; } = "";
    public string Jti { get; init; } = "";
    public string Stamp { get; init; } = "";
    public long ExpiresUnix { get; init; }
}

public sealed class SessionGate
{
    private readonly ConcurrentDictionary<string, long> _revoked = new(StringComparer.Ordinal);

    public void Revoke(string? jti, long expiresUnix)
    {
        if (string.IsNullOrWhiteSpace(jti))
            return;
        _revoked[jti] = expiresUnix;
        Prune();
    }

    public bool IsRevoked(string? jti)
    {
        if (string.IsNullOrWhiteSpace(jti))
            return true;
        Prune();
        return _revoked.ContainsKey(jti);
    }

    private void Prune()
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        foreach (var pair in _revoked)
        {
            if (pair.Value <= now)
                _revoked.TryRemove(pair.Key, out _);
        }
    }
}

public sealed class PublicRequestThrottle
{
    private readonly ConcurrentDictionary<string, (int Count, DateTime WindowStart)> _hits = new(StringComparer.Ordinal);

    public bool Allow(string key, int max, TimeSpan window)
    {
        if (string.IsNullOrWhiteSpace(key) || max <= 0)
            return false;
        var now = DateTime.UtcNow;
        var next = _hits.AddOrUpdate(
            key,
            _ => (1, now),
            (_, cur) => now - cur.WindowStart > window ? (1, now) : (cur.Count + 1, cur.WindowStart));
        return next.Count <= max;
    }
}

public sealed class SessionTokenOptions
{
    public string Secret { get; set; } = "";
}

public sealed class AuthSession
{
    public HirayaUser User { get; set; } = new();
    public string Token { get; set; } = "";
}

public static class FileTickets
{
    public static TimeSpan DefaultLifetime => TimeSpan.FromMinutes(10);

    public static string Issue(string userId, string moduleId, string secret, TimeSpan? lifetime = null, string? stamp = null)
    {
        var expires = DateTimeOffset.UtcNow.Add(lifetime ?? DefaultLifetime).ToUnixTimeSeconds();
        var payload = $"file|{userId.Trim()}|{expires}|{moduleId.Trim()}|{stamp ?? "none"}";
        var mac = Sign(payload, secret);
        return Convert.ToBase64String(Encoding.UTF8.GetBytes($"{payload}|{mac}"));
    }

    public static FileTicket? TryRead(string? token, string secret)
    {
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(secret))
            return null;
        try
        {
            var raw = Encoding.UTF8.GetString(Convert.FromBase64String(token.Trim()));
            var parts = raw.Split('|');
            if (parts.Length != 6 || parts[0] != "file")
                return null;
            if (!long.TryParse(parts[2], out var expires))
                return null;
            if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > expires)
                return null;
            var expected = Sign($"{parts[0]}|{parts[1]}|{parts[2]}|{parts[3]}|{parts[4]}", secret);
            if (!CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(expected),
                    Encoding.UTF8.GetBytes(parts[5])))
                return null;
            if (string.IsNullOrWhiteSpace(parts[1]) || string.IsNullOrWhiteSpace(parts[3]))
                return null;
            return new FileTicket
            {
                UserId = parts[1],
                ModuleId = parts[3],
                Stamp = parts[4],
                ExpiresUnix = expires
            };
        }
        catch (FormatException)
        {
            return null;
        }
        catch (ArgumentException)
        {
            return null;
        }
    }

    private static string Sign(string payload, string secret)
    {
        var key = SHA256.HashData(Encoding.UTF8.GetBytes(secret));
        var mac = HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(payload));
        return Convert.ToHexString(mac);
    }
}

public sealed class FileTicket
{
    public string UserId { get; init; } = "";
    public string ModuleId { get; init; } = "";
    public string Stamp { get; init; } = "";
    public long ExpiresUnix { get; init; }
}
