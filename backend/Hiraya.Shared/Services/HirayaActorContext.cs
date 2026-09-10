namespace Hiraya.Shared.Services;

public sealed class HirayaActorContext
{
    public string? UserId { get; set; }
    public string? SessionToken { get; set; }

    public void ApplyTo(HttpRequestMessage request)
    {
        if (!string.IsNullOrWhiteSpace(SessionToken))
            request.Headers.TryAddWithoutValidation("X-Hiraya-Session", SessionToken);
    }
}
