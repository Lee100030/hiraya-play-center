using Microsoft.EntityFrameworkCore;

namespace Hiraya.Data;

/// <summary>
/// Same center model as <see cref="HirayaLearningCenterDbContext"/>, with its own
/// PostgreSQL migrations. MySQL migrations are not applied to Neon.
/// </summary>
public class HirayaNeonDbContext : HirayaLearningCenterDbContext
{
    public HirayaNeonDbContext(DbContextOptions<HirayaNeonDbContext> options)
        : base(options)
    {
    }
}
