using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Hiraya.Data;

public class HirayaDesignTimeFactory : IDesignTimeDbContextFactory<HirayaLearningCenterDbContext>
{
    public HirayaLearningCenterDbContext CreateDbContext(string[] args)
    {
        var provider = HirayaDb.ResolveProvider(null);
        var connection = HirayaDb.ApplyPassword(HirayaDb.ResolveConnection(null, provider), null);
        var options = new DbContextOptionsBuilder<HirayaLearningCenterDbContext>();
        HirayaDb.Configure(options, provider, connection);
        return new HirayaLearningCenterDbContext(options.Options);
    }
}
