namespace Hiraya.Shared;

public sealed class HirayaApiStatus
{
    private readonly object _gate = new();
    private DateTime _retryAfterUtc;

    public bool ShouldAttemptRemote
    {
        get
        {
            lock (_gate)
                return DateTime.UtcNow >= _retryAfterUtc;
        }
    }

    public void MarkOnline()
    {
        lock (_gate)
            _retryAfterUtc = DateTime.MinValue;
    }

    public void MarkOffline(TimeSpan? cooldown = null)
    {
        lock (_gate)
            _retryAfterUtc = DateTime.UtcNow + (cooldown ?? TimeSpan.FromSeconds(45));
    }
}
