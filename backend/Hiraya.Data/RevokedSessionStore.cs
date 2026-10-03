using Hiraya.Shared.Security;
using Microsoft.EntityFrameworkCore;

namespace Hiraya.Data;

public class RevokedSession
{
    public string Jti { get; set; } = "";
    public long ExpiresUnix { get; set; }
}

public sealed class RevokedSessionStore : IRevokedSessionStore
{
    private readonly IDbContextFactory<HirayaLearningCenterDbContext> _factory;

    public RevokedSessionStore(IDbContextFactory<HirayaLearningCenterDbContext> factory)
    {
        _factory = factory;
    }

    public async Task RevokeAsync(string jti, long expiresUnix, CancellationToken ct = default)
    {
        var id = (jti ?? "").Trim();
        if (id.Length == 0)
            return;
        await using var db = await _factory.CreateDbContextAsync(ct);
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"DELETE FROM revoked_sessions WHERE ExpiresUnix <= {now}", ct);
        var existing = await db.RevokedSessions.FirstOrDefaultAsync(row => row.Jti == id, ct);
        if (existing is null)
            db.RevokedSessions.Add(new RevokedSession { Jti = id, ExpiresUnix = expiresUnix });
        else
            existing.ExpiresUnix = expiresUnix;
        await db.SaveChangesAsync(ct);
    }

    public async Task<bool> IsRevokedAsync(string jti, CancellationToken ct = default)
    {
        var id = (jti ?? "").Trim();
        if (id.Length == 0)
            return true;
        await using var db = await _factory.CreateDbContextAsync(ct);
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        return await db.RevokedSessions.AnyAsync(row => row.Jti == id && row.ExpiresUnix > now, ct);
    }
}
