using System.Net.Http.Json;
using Hiraya.Shared.Models;
using Hiraya.Shared.Security;
using Hiraya.Shared.Services.Auth;
using Hiraya.Shared.Services.Firebase;
using Microsoft.Extensions.Options;

namespace Hiraya.Shared.Services;

public class PublicSiteClient
{
    private readonly IHttpClientFactory _http;
    private readonly HirayaApiOptions _api;

    public PublicSiteClient(IHttpClientFactory http, IOptions<HirayaApiOptions> api)
    {
        _http = http;
        _api = api.Value;
    }

    public string LogoUrl(string? cacheBust = null)
    {
        var root = (_api.BaseUrl ?? "").TrimEnd('/');
        var url = string.IsNullOrWhiteSpace(root) ? "/api/public/logo" : root + "/api/public/logo";
        if (!string.IsNullOrWhiteSpace(cacheBust))
            url += "?v=" + Uri.EscapeDataString(cacheBust);
        return url;
    }

    public string GalleryImageUrl(string itemId, string? cacheBust = null)
    {
        var root = (_api.BaseUrl ?? "").TrimEnd('/');
        var path = $"/api/public/gallery/{Uri.EscapeDataString(itemId)}/image";
        var url = string.IsNullOrWhiteSpace(root) ? path : root + path;
        if (!string.IsNullOrWhiteSpace(cacheBust))
            url += "?v=" + Uri.EscapeDataString(cacheBust);
        return url;
    }

    public async Task<PublicSiteDto> GetSiteAsync(CancellationToken ct = default)
    {
        var client = _http.CreateClient("hiraya-api");
        var site = await client.GetFromJsonAsync<PublicSiteDto>("api/public/site", JsonDefaults.Options, ct);
        return site ?? new PublicSiteDto();
    }

    public async Task SubmitEnrollmentAsync(PublicEnrollmentRequest request, CancellationToken ct = default)
    {
        var client = _http.CreateClient("hiraya-api");
        using var response = await client.PostAsJsonAsync("api/public/enrollment", request, JsonDefaults.Options, ct);
        if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
        {
            var limited = await ReadErrorAsync(response, ct);
            throw new InvalidOperationException(limited ?? "Too many enrollment submissions. Please wait and try again.");
        }
        if (!response.IsSuccessStatusCode)
        {
            var problem = await response.Content.ReadFromJsonAsync<ErrorBody>(JsonDefaults.Options, ct);
            throw new InvalidOperationException(problem?.Error ?? "The application could not be submitted.");
        }
    }

    public async Task<AuthSession?> LoginAsync(string login, string password, CancellationToken ct = default)
    {
        var client = _http.CreateClient("hiraya-api");
        using var response = await client.PostAsJsonAsync(
            "api/auth/login",
            new LoginRequest { Login = login, Password = password },
            JsonDefaults.Options,
            ct);
        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            return null;
        if (response.StatusCode == System.Net.HttpStatusCode.Locked)
        {
            var locked = await ReadErrorAsync(response, ct);
            throw new InvalidOperationException(locked ?? PortalAuthService.LockoutMessage);
        }
        if ((int)response.StatusCode >= 500)
        {
            var down = await ReadErrorAsync(response, ct);
            throw new InvalidOperationException(down ?? "Could not reach the learning center service. Confirm Hiraya.Api can reach Neon, then try again.");
        }
        if (!response.IsSuccessStatusCode)
        {
            var problem = await ReadErrorAsync(response, ct);
            throw new InvalidOperationException(problem ?? "Sign-in could not be completed.");
        }
        var session = await response.Content.ReadFromJsonAsync<AuthSession>(JsonDefaults.Options, ct);
        if (session?.User is null || string.IsNullOrWhiteSpace(session.User.UserId))
            return null;
        return session;
    }

    public async Task ActivateAsync(string token, string password, string confirm, CancellationToken ct = default)
    {
        var client = _http.CreateClient("hiraya-api");
        using var response = await client.PostAsJsonAsync(
            "api/auth/activate",
            new { token, password, confirmPassword = confirm },
            JsonDefaults.Options,
            ct);
        if (response.IsSuccessStatusCode)
            return;
        if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
        {
            var limited = await ReadErrorAsync(response, ct);
            throw new InvalidOperationException(limited ?? "Too many activation attempts. Please wait and try again.");
        }
        var problem = await ReadErrorAsync(response, ct);
        throw new InvalidOperationException(problem ?? "This invitation could not be used.");
    }

    private static async Task<string?> ReadErrorAsync(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            var body = await response.Content.ReadFromJsonAsync<ErrorBody>(JsonDefaults.Options, ct);
            return string.IsNullOrWhiteSpace(body?.Error) ? null : body.Error;
        }
        catch
        {
            return null;
        }
    }

    private sealed class ErrorBody
    {
        public string? Error { get; set; }
    }
}
