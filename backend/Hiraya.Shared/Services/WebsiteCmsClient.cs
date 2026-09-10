using System.Net.Http.Json;
using Hiraya.Shared.Models;
using Hiraya.Shared.Services.Firebase;
using Microsoft.Extensions.Options;

namespace Hiraya.Shared.Services;

public class WebsiteCmsClient
{
    private readonly WebsiteContentService _local;
    private readonly WebsiteMediaStorage _media;
    private readonly IHirayaRepository _repository;
    private readonly IHttpClientFactory _http;
    private readonly HirayaApiOptions _api;
    private readonly HirayaActorContext _actor;

    public WebsiteCmsClient(
        WebsiteContentService local,
        WebsiteMediaStorage media,
        IHirayaRepository repository,
        IHttpClientFactory http,
        IOptions<HirayaApiOptions> api,
        HirayaActorContext actor)
    {
        _local = local;
        _media = media;
        _repository = repository;
        _http = http;
        _api = api.Value;
        _actor = actor;
    }

    public async Task SaveLandingAsync(WebsiteLandingSave input, HirayaUser actor)
    {
        if (!_api.UseRemoteStore)
        {
            await _local.SaveLandingAsync(input, actor);
            return;
        }

        using var request = new HttpRequestMessage(HttpMethod.Put, "api/admin/website/landing")
        {
            Content = JsonContent.Create(input, options: JsonDefaults.Options)
        };
        _actor.ApplyTo(request);
        using var response = await Send(request);
        await EnsureOk(response);
    }

    public async Task SaveAboutAsync(WebsiteAboutSave input, HirayaUser actor)
    {
        if (!_api.UseRemoteStore)
        {
            await _local.SaveAboutAsync(input, actor);
            return;
        }

        using var request = new HttpRequestMessage(HttpMethod.Put, "api/admin/website/about")
        {
            Content = JsonContent.Create(input, options: JsonDefaults.Options)
        };
        _actor.ApplyTo(request);
        using var response = await Send(request);
        await EnsureOk(response);
    }

    public async Task SaveLogoAsync(HirayaUser actor, byte[] bytes, string fileName)
    {
        if (!_api.UseRemoteStore)
        {
            await _local.SaveLogoAsync(actor, bytes, fileName);
            return;
        }

        using var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent(bytes), "file", fileName);
        using var request = new HttpRequestMessage(HttpMethod.Post, "api/admin/website/logo") { Content = content };
        _actor.ApplyTo(request);
        using var response = await SendUpload(request);
        await EnsureOk(response);
    }

    public async Task<List<WebsiteGalleryItem>> ListGalleryAsync()
    {
        var db = await _repository.LoadAsync();
        return db.WebsiteGallery.OrderBy(g => g.SortOrder).ThenBy(g => g.Title).ToList();
    }

    public async Task SaveGalleryAsync(WebsiteGallerySave input, HirayaUser actor, byte[]? bytes, string? fileName)
    {
        if (!_api.UseRemoteStore)
        {
            await _local.SaveGalleryAsync(input, actor, bytes, fileName);
            return;
        }

        using var content = new MultipartFormDataContent();
        content.Add(new StringContent(input.ItemId ?? ""), "itemId");
        content.Add(new StringContent(input.Title ?? ""), "title");
        content.Add(new StringContent(input.Caption ?? ""), "caption");
        content.Add(new StringContent(input.Status ?? ""), "status");
        content.Add(new StringContent(input.SortOrder.ToString()), "sortOrder");
        if (bytes is { Length: > 0 })
            content.Add(new ByteArrayContent(bytes), "file", fileName ?? "image.jpg");
        using var request = new HttpRequestMessage(HttpMethod.Post, "api/admin/website/gallery") { Content = content };
        _actor.ApplyTo(request);
        using var response = await SendUpload(request);
        await EnsureOk(response);
    }

    public async Task SetGalleryStatusAsync(string itemId, string status, HirayaUser actor)
    {
        if (!_api.UseRemoteStore)
        {
            await _local.SetGalleryStatusAsync(itemId, status, actor);
            return;
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, $"api/admin/website/gallery/{Uri.EscapeDataString(itemId)}/status")
        {
            Content = JsonContent.Create(new { status }, options: JsonDefaults.Options)
        };
        _actor.ApplyTo(request);
        using var response = await Send(request);
        await EnsureOk(response);
    }

    public async Task DeleteGalleryAsync(string itemId, HirayaUser actor)
    {
        if (!_api.UseRemoteStore)
        {
            await _local.DeleteGalleryAsync(itemId, actor);
            return;
        }

        using var request = new HttpRequestMessage(HttpMethod.Delete, $"api/admin/website/gallery/{Uri.EscapeDataString(itemId)}");
        _actor.ApplyTo(request);
        using var response = await Send(request);
        await EnsureOk(response);
    }

    public async Task<string?> GalleryPreviewDataUrlAsync(string itemId)
    {
        if (string.IsNullOrWhiteSpace(itemId))
            return null;
        if (!_api.UseRemoteStore)
        {
            var db = await _repository.LoadAsync();
            var item = db.WebsiteGallery.FirstOrDefault(g => g.ItemId == itemId);
            var bytes = item is null ? null : _media.Read(item.FilePath);
            if (bytes is null)
                return null;
            return $"data:{_media.ContentType(item!.FilePath)};base64,{Convert.ToBase64String(bytes)}";
        }

        using var request = new HttpRequestMessage(HttpMethod.Get, $"api/admin/website/gallery/{Uri.EscapeDataString(itemId)}/image");
        _actor.ApplyTo(request);
        using var response = await Send(request);
        if (!response.IsSuccessStatusCode)
            return null;
        var payload = await response.Content.ReadAsByteArrayAsync();
        var type = response.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
        return $"data:{type};base64,{Convert.ToBase64String(payload)}";
    }

    public string? GalleryPreviewUrl(string itemId)
    {
        var root = (_api.BaseUrl ?? "").TrimEnd('/');
        if (string.IsNullOrWhiteSpace(root) || string.IsNullOrWhiteSpace(itemId))
            return null;
        return $"{root}/api/admin/website/gallery/{Uri.EscapeDataString(itemId)}/image";
    }

    public string? LogoUrl(string? cacheBust)
    {
        var root = (_api.BaseUrl ?? "").TrimEnd('/');
        if (string.IsNullOrWhiteSpace(root))
            return null;
        var url = root + "/api/public/logo";
        if (!string.IsNullOrWhiteSpace(cacheBust))
            url += "?v=" + Uri.EscapeDataString(cacheBust);
        return url;
    }

    private async Task<HttpResponseMessage> Send(HttpRequestMessage request)
    {
        var client = _http.CreateClient("hiraya-api");
        return await client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> SendUpload(HttpRequestMessage request)
    {
        var client = _http.CreateClient("hiraya-api-upload");
        return await client.SendAsync(request);
    }

    private static async Task EnsureOk(HttpResponseMessage response)
    {
        if (response.IsSuccessStatusCode)
            return;
        var problem = await response.Content.ReadFromJsonAsync<ErrorBody>(JsonDefaults.Options);
        throw new InvalidOperationException(problem?.Error ?? "The website request could not be completed.");
    }

    private sealed class ErrorBody
    {
        public string? Error { get; set; }
    }
}
