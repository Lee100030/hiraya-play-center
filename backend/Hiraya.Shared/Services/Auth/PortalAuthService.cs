using System.Collections.Concurrent;
using System.Net.Http.Json;
using Hiraya.Shared.Models;
using Hiraya.Shared.Security;
using Hiraya.Shared;
using Hiraya.Shared.Services;
using Hiraya.Shared.Services.Firebase;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Hiraya.Shared.Services.Auth;

public class PortalAuthService
{
    private const int MaxFailedAttempts = 8;
    private static readonly TimeSpan LockoutWindow = TimeSpan.FromMinutes(5);
    private static readonly ConcurrentDictionary<string, (int Count, DateTime WindowStart)> Failures = new(StringComparer.OrdinalIgnoreCase);

    private readonly IHirayaRepository _repository;
    private readonly IServiceProvider _services;
    private readonly IHttpClientFactory _http;
    private readonly HirayaApiOptions _api;
    private readonly HirayaApiStatus _status;

    public PortalAuthService(
        IHirayaRepository repository,
        IServiceProvider services,
        IHttpClientFactory http,
        IOptions<HirayaApiOptions> api,
        HirayaApiStatus status)
    {
        _repository = repository;
        _services = services;
        _http = http;
        _api = api.Value;
        _status = status;
    }

    public async Task<AuthSession?> AuthenticateAsync(string login, string password)
    {
        var key = (login ?? "").Trim();
        if (string.IsNullOrWhiteSpace(key) || string.IsNullOrEmpty(password))
            return null;
        if (IsLocked(key))
            throw new InvalidOperationException(LockoutMessage);

        if (_api.UseRemoteStore)
            return await AuthenticateRemoteAsync(key, password);

        var user = await AuthenticateAgainstAsync(_repository, key, password);
        return user is null ? null : new AuthSession { User = user };
    }

    private async Task<AuthSession?> AuthenticateRemoteAsync(string key, string password)
    {
        try
        {
            var client = _http.CreateClient("hiraya-api");
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(Math.Max(2, _api.TimeoutSeconds)));
            using var response = await client.PostAsJsonAsync("api/auth/login", new LoginRequest { Login = key, Password = password }, cts.Token);
            if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            {
                _status.MarkOnline();
                RegisterFailure(key);
                if (IsLocked(key))
                    throw new InvalidOperationException(LockoutMessage);
                return null;
            }

            if (response.StatusCode == System.Net.HttpStatusCode.Locked)
                throw new InvalidOperationException(await ReadErrorAsync(response) ?? LockoutMessage);

            if ((int)response.StatusCode >= 500 || !response.IsSuccessStatusCode)
            {
                _status.MarkOffline();
                var local = await TryLocalFallbackAsync(key, password);
                if (local is not null)
                    return local;
                throw new InvalidOperationException(await ReadErrorAsync(response)
                    ?? "Could not reach the learning center service. Confirm Hiraya.Api can reach Neon, then try again.");
            }

            _status.MarkOnline();
            Failures.TryRemove(key, out _);
            var session = await response.Content.ReadFromJsonAsync<AuthSession>(JsonDefaults.Options);
            if (session?.User is null || string.IsNullOrWhiteSpace(session.User.UserId))
                return null;
            return session;
        }
        catch (InvalidOperationException)
        {
            throw;
        }
        catch (Exception)
        {
            _status.MarkOffline();
            var local = await TryLocalFallbackAsync(key, password);
            if (local is not null)
                return local;
            throw new InvalidOperationException("Could not reach the learning center service. Confirm Hiraya.Api can reach Neon, then try again.");
        }
    }

    private async Task<AuthSession?> TryLocalFallbackAsync(string key, string password)
    {
        if (_api.UseRemoteStore)
            return null;
        var local = _services.GetService<HirayaRepository>();
        if (local is null)
            return null;
        var user = await AuthenticateAgainstAsync(local, key, password);
        return user is null ? null : new AuthSession { User = user };
    }

    private async Task<HirayaUser?> AuthenticateAgainstAsync(IHirayaRepository repository, string key, string password)
    {
        var user = await repository.FindUserAsync(null, key);
        if (user is not null && !AccountStatuses.AllowsPortalLogin(user.Status))
            throw new InvalidOperationException("This account is not active yet. Ask the center to activate it on HIRAYA Desktop.");

        var passwordOk = user != null && PasswordHasher.Verify(password, user.Password);

        if (user == null || !passwordOk)
        {
            RegisterFailure(key);
            if (IsLocked(key))
                throw new InvalidOperationException(LockoutMessage);
            return null;
        }

        Failures.TryRemove(key, out _);

        if (!ProductAccounts.MaySignIn(user.Role))
            throw new InvalidOperationException(ProductAccounts.SignInBlocked);

        if (!PasswordHasher.IsHashed(user.Password))
        {
            try
            {
                await repository.MutateAsync(async data =>
                {
                    var live = data.Users.FirstOrDefault(u => u.UserId == user.UserId);
                    if (live == null)
                        return;
                    live.Password = PasswordHasher.Hash(password);
                    await Task.CompletedTask;
                });
            }
            catch
            {
                // Rehash is optional; a database hiccup must not block a valid sign-in.
            }
        }

        return AccountService.ClonePublic(user);
    }

    public const string LockoutMessage = "Too many failed sign-ins. Wait a few minutes and try again, or use the correct password.";

    private static async Task<string?> ReadErrorAsync(HttpResponseMessage response)
    {
        try
        {
            var body = await response.Content.ReadFromJsonAsync<ErrorBody>(JsonDefaults.Options);
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

    private static bool IsLocked(string login)
    {
        if (!Failures.TryGetValue(login, out var state))
            return false;
        if (DateTime.UtcNow - state.WindowStart > LockoutWindow)
        {
            Failures.TryRemove(login, out _);
            return false;
        }

        return state.Count >= MaxFailedAttempts;
    }

    private static void RegisterFailure(string login)
    {
        Failures.AddOrUpdate(
            login,
            _ => (1, DateTime.UtcNow),
            (_, state) => DateTime.UtcNow - state.WindowStart > LockoutWindow
                ? (1, DateTime.UtcNow)
                : (state.Count + 1, state.WindowStart));
    }

    public async Task RevokeSessionAsync(string? token)
    {
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(_api.BaseUrl))
            return;
        try
        {
            var client = _http.CreateClient("hiraya-api");
            using var request = new HttpRequestMessage(HttpMethod.Post, "api/auth/logout");
            request.Headers.TryAddWithoutValidation("X-Hiraya-Session", token);
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(4));
            await client.SendAsync(request, cts.Token);
        }
        catch
        {
            // Local sign-out must still succeed if the API is offline.
        }
    }
}

public static class HirayaServiceCollectionExtensions
{
    public static IServiceCollection AddHirayaShared(
        this IServiceCollection services,
        Action<FirebaseOptions>? configureFirebase = null,
        Action<HirayaApiOptions>? configureApi = null)
    {
        if (configureFirebase != null)
            services.Configure(configureFirebase);
        else
            services.Configure<FirebaseOptions>(_ => { });

        if (configureApi != null)
            services.Configure<HirayaApiOptions>(api =>
            {
                configureApi(api);
                HirayaApiOptions.ApplyEnvironment(api);
            });
        else
            services.Configure<HirayaApiOptions>(HirayaApiOptions.ApplyEnvironment);

        services.AddSingleton<HirayaActorContext>();
        services.AddSingleton<HirayaApiStatus>();
        services.Configure<HirayaSmtpOptions>(_ => { });
        services.AddHttpClient("firebase-rtdb");
        services.AddHttpClient("hiraya-api", (sp, client) =>
        {
            var api = sp.GetRequiredService<IOptions<HirayaApiOptions>>().Value;
            if (!string.IsNullOrWhiteSpace(api.BaseUrl))
                client.BaseAddress = new Uri(api.BaseUrl.TrimEnd('/') + "/");
            var seconds = api.TimeoutSeconds > 0 ? api.TimeoutSeconds : 30;
            client.Timeout = TimeSpan.FromSeconds(Math.Max(seconds, 30));
        }).ConfigurePrimaryHttpMessageHandler(() =>
        {
            var connect = TimeSpan.FromSeconds(8);
            return new SocketsHttpHandler
            {
                ConnectTimeout = connect,
                PooledConnectionLifetime = TimeSpan.FromMinutes(2)
            };
        });
        services.AddHttpClient("hiraya-api-upload", (sp, client) =>
        {
            var api = sp.GetRequiredService<IOptions<HirayaApiOptions>>().Value;
            if (!string.IsNullOrWhiteSpace(api.BaseUrl))
                client.BaseAddress = new Uri(api.BaseUrl.TrimEnd('/') + "/");
            client.Timeout = TimeSpan.FromSeconds(90);
        });
        services.AddSingleton<FirebaseCredentialProvider>();
        services.AddSingleton<HirayaRepository>();
        services.AddSingleton<IHirayaRepository>(sp =>
        {
            var api = sp.GetRequiredService<IOptions<HirayaApiOptions>>().Value;
            if (api.UseRemoteStore)
                return ActivatorUtilities.CreateInstance<HttpHirayaRepository>(sp);
            return sp.GetRequiredService<HirayaRepository>();
        });
        services.AddSingleton<PortalAuthService>();
        services.AddSingleton<EnrollmentService>();
        services.AddSingleton<ClassService>();
        services.AddSingleton<AttendanceService>();
        services.AddSingleton<ScheduleService>();
        services.AddSingleton<ProgressService>();
        services.AddSingleton<PaymentService>();
        services.AddSingleton<NotificationService>();
        services.AddSingleton<AuditService>();
        services.AddSingleton<StaffService>();
        services.AddSingleton<AccountService>();
        services.AddSingleton<ProfilePhotoService>();
        services.AddSingleton<UserAdminService>();
        services.AddSingleton<ParentAccountService>();
        services.AddSingleton<IEmailSender, SmtpEmailSender>();
        services.AddSingleton<CenterSettingsService>();
        services.AddSingleton<ProgramService>();
        services.AddSingleton<LearningModuleStorage>();
        services.AddSingleton<LearningModuleService>();
        services.AddSingleton<LearningModuleClient>();
        services.AddSingleton<PublicSiteClient>();
        services.AddSingleton<WebsiteMediaStorage>();
        services.AddSingleton<WebsiteContentService>();
        services.AddSingleton<WebsiteCmsClient>();
        return services;
    }
}
