using Microsoft.EntityFrameworkCore;

namespace Hiraya.Data;

/// <summary>
/// Same center model as <see cref="HirayaLearningCenterDbContext"/>, with its own
/// PostgreSQL migrations for Neon. Older MySQL migration files are not applied.
/// </summary>
public class HirayaNeonDbContext : HirayaLearningCenterDbContext
{
    public HirayaNeonDbContext(DbContextOptions<HirayaNeonDbContext> options)
        : base(options)
    {
    }
}
