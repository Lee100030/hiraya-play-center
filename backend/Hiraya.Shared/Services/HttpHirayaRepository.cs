using System.Net.Http.Json;
using System.Text.Json;
using Hiraya.Shared.Models;
using Hiraya.Shared.Services.Firebase;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Hiraya.Shared.Services;

public class HttpHirayaRepository : IHirayaRepository
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(20);

    private readonly IHttpClientFactory _http;
    private readonly HirayaRepository _local;
    private readonly HirayaApiStatus _status;
    private readonly HirayaApiOptions _api;
    private readonly ILogger<HttpHirayaRepository> _logger;
    private readonly HirayaActorContext _actor;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private HirayaDatabase? _cache;
    private DateTime _cacheAtUtc;

    public HttpHirayaRepository(
        IHttpClientFactory http,
        HirayaRepository local,
        HirayaApiStatus status,
        IOptions<HirayaApiOptions> api,
        ILogger<HttpHirayaRepository> logger,
        HirayaActorContext actor)
    {
        _http = http;
        _local = local;
        _status = status;
        _api = api.Value;
        _logger = logger;
        _actor = actor;
    }

    public bool UsingFirebase => false;

    public async Task MutateAsync(Func<HirayaDatabase, Task> mutator, CancellationToken ct = default)
    {
        await _gate.WaitAsync(ct);
        try
        {
            var db = await LoadUnlockedAsync(ct, forceRefresh: false);
            await mutator(db);
            await SaveUnlockedAsync(db, ct);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<HirayaDatabase> LoadAsync(CancellationToken ct = default)
    {
        await _gate.WaitAsync(ct);
        try
        {
            return await LoadUnlockedAsync(ct, forceRefresh: false);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task SaveAsync(HirayaDatabase database, CancellationToken ct = default)
    {
        await _gate.WaitAsync(ct);
        try
        {
            await SaveUnlockedAsync(database, ct);
        }
        finally
        {
            _gate.Release();
        }
    }

    public Task SetItemAsync<T>(string collection, string id, T item, CancellationToken ct = default) =>
        MutateAsync(_ => Task.CompletedTask, ct);

    public Task DeleteItemAsync(string collection, string id, CancellationToken ct = default) =>
        MutateAsync(_ => Task.CompletedTask, ct);

    private async Task<HirayaDatabase> LoadUnlockedAsync(CancellationToken ct, bool forceRefresh)
    {
        if (!forceRefresh && _cache is not null && DateTime.UtcNow - _cacheAtUtc < CacheTtl)
            return Clone(_cache);

        if (_status.ShouldAttemptRemote)
        {
            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                cts.CancelAfter(RequestTimeout);
                var client = _http.CreateClient("hiraya-api");
                using var request = new HttpRequestMessage(HttpMethod.Get, "api/store");
                _actor.ApplyTo(request);
                using var response = await client.SendAsync(request, cts.Token);
                if (response.IsSuccessStatusCode)
                {
                    var db = await response.Content.ReadFromJsonAsync<HirayaDatabase>(JsonDefaults.Options, cts.Token)
                             ?? new HirayaDatabase();
                    _status.MarkOnline();
                    SetCache(db);
                    return Clone(_cache!);
                }

                if ((int)response.StatusCode is 401)
                    throw new InvalidOperationException("Your session expired. Sign in again, then save.");

                _logger.LogWarning("Hiraya API load failed: {Status}", (int)response.StatusCode);
                _status.MarkOffline();
            }
            catch (InvalidOperationException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _status.MarkOffline();
                _logger.LogWarning(ex, "Hiraya API is unavailable.");
            }
        }

        if (_cache is not null)
            return Clone(_cache);

        try
        {
            var local = await _local.LoadAsync(ct);
            SetCache(local);
            return Clone(local);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Local Hiraya store is unavailable.");
            throw new InvalidOperationException("The learning center service is not available. Start Hiraya.Api and MySQL, then try again.");
        }
    }

    private async Task SaveUnlockedAsync(HirayaDatabase database, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_actor.SessionToken))
            throw new InvalidOperationException("Your session expired. Sign in again, then save.");

        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(RequestTimeout);
            var client = _http.CreateClient("hiraya-api");
            using var message = new HttpRequestMessage(HttpMethod.Put, "api/store")
            {
                Content = JsonContent.Create(database, options: JsonDefaults.Options)
            };
            _actor.ApplyTo(message);
            using var response = await client.SendAsync(message, cts.Token);
            if (response.IsSuccessStatusCode)
            {
                _status.MarkOnline();
                SetCache(database);
                return;
            }

            var detail = await ReadApiErrorAsync(response, cts.Token);
            _logger.LogWarning("Hiraya API save failed: {Status} {Detail}", (int)response.StatusCode, detail);
            if ((int)response.StatusCode is 401)
                throw new InvalidOperationException("Your session expired. Sign in again, then save.");
            if ((int)response.StatusCode is 403)
                throw new InvalidOperationException(detail ?? "You are not allowed to save that change.");
            if ((int)response.StatusCode is 503)
                throw new InvalidOperationException(detail ?? "MySQL is not available. Start XAMPP MySQL, then try again.");

            throw new InvalidOperationException(detail ?? "Could not save to the learning center service. Check Hiraya.Api and try again.");
        }
        catch (InvalidOperationException)
        {
            throw;
        }
        catch (TaskCanceledException)
        {
            throw new InvalidOperationException("Hiraya.Api did not respond in time. Keep Hiraya.Api running on http://127.0.0.1:5188 and try again.");
        }
        catch (HttpRequestException)
        {
            _status.MarkOffline();
            throw new InvalidOperationException("Could not reach Hiraya.Api. Start the Hiraya.Api project and keep it running, then try again.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Hiraya API save failed.");
            throw new InvalidOperationException("Could not save to the learning center service. Check Hiraya.Api and try again.");
        }
    }

    private static async Task<string?> ReadApiErrorAsync(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            var payload = await response.Content.ReadFromJsonAsync<ApiErrorDto>(JsonDefaults.Options, ct);
            return string.IsNullOrWhiteSpace(payload?.Error) ? null : payload.Error;
        }
        catch
        {
            return null;
        }
    }

    private sealed class ApiErrorDto
    {
        public string? Error { get; set; }
    }

    public void InvalidateCache()
    {
        _cache = null;
        _cacheAtUtc = DateTime.MinValue;
    }

    private TimeSpan RequestTimeout => TimeSpan.FromSeconds(Math.Max(30, _api.TimeoutSeconds));

    private void SetCache(HirayaDatabase db)
    {
        _cache = Clone(db);
        _cacheAtUtc = DateTime.UtcNow;
    }

    private static HirayaDatabase Clone(HirayaDatabase db)
    {
        var json = JsonSerializer.Serialize(db, JsonDefaults.Options);
        return JsonSerializer.Deserialize<HirayaDatabase>(json, JsonDefaults.Options) ?? new HirayaDatabase();
    }
}
