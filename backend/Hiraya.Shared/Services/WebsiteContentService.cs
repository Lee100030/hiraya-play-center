using Hiraya.Shared.Models;
using Hiraya.Shared.Services.Firebase;

namespace Hiraya.Shared.Services;

public sealed class WebsiteLandingSave
{
    public string WelcomeTitle { get; set; } = "";
    public string WelcomeMessage { get; set; } = "";
}

public sealed class WebsiteAboutSave
{
    public string AboutTitle { get; set; } = "";
    public string Description { get; set; } = "";
    public string Mission { get; set; } = "";
    public string Vision { get; set; } = "";
    public string Values { get; set; } = "";
}

public sealed class WebsiteGallerySave
{
    public string ItemId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Caption { get; set; } = "";
    public string Status { get; set; } = WebsitePublishStatuses.Published;
    public int SortOrder { get; set; }
}

public class WebsiteContentService
{
    private readonly IHirayaRepository _repository;
    private readonly WebsiteMediaStorage _media;

    public WebsiteContentService(IHirayaRepository repository, WebsiteMediaStorage media)
    {
        _repository = repository;
        _media = media;
    }

    public async Task SaveLandingAsync(WebsiteLandingSave input, HirayaUser actor)
    {
        EnsureAdmin(actor);
        await _repository.MutateAsync(async db =>
        {
            db.Settings.WelcomeTitle = string.IsNullOrWhiteSpace(input.WelcomeTitle)
                ? "Welcome to Hiraya Kids Learning Center"
                : input.WelcomeTitle.Trim();
            db.Settings.WelcomeMessage = (input.WelcomeMessage ?? "").Trim();
            db.Settings.UpdatedAt = DateTime.UtcNow.ToString("o");
            AuditService.Append(db, actor, AuditModules.Website, "update", "landing", "landing",
                $"{actor.Fullname} updated the public landing page.");
            await Task.CompletedTask;
        });
    }

    public async Task SaveAboutAsync(WebsiteAboutSave input, HirayaUser actor)
    {
        EnsureAdmin(actor);
        await _repository.MutateAsync(async db =>
        {
            db.Settings.AboutTitle = string.IsNullOrWhiteSpace(input.AboutTitle) ? "About HIRAYA" : input.AboutTitle.Trim();
            db.Settings.Description = (input.Description ?? "").Trim();
            db.Settings.Mission = (input.Mission ?? "").Trim();
            db.Settings.Vision = (input.Vision ?? "").Trim();
            db.Settings.Values = (input.Values ?? "").Trim();
            db.Settings.UpdatedAt = DateTime.UtcNow.ToString("o");
            AuditService.Append(db, actor, AuditModules.Website, "update", "about", "about",
                $"{actor.Fullname} updated About HIRAYA.");
            await Task.CompletedTask;
        });
    }

    public async Task SaveLogoAsync(HirayaUser actor, byte[] bytes, string fileName)
    {
        EnsureAdmin(actor);
        var path = await _media.SaveLogoAsync(fileName, bytes);
        await _repository.MutateAsync(async db =>
        {
            db.Settings.LogoPath = path;
            db.Settings.UpdatedAt = DateTime.UtcNow.ToString("o");
            AuditService.Append(db, actor, AuditModules.Website, "update", "logo", "logo",
                $"{actor.Fullname} updated the public website logo.");
            await Task.CompletedTask;
        });
    }

    public async Task<WebsiteGalleryItem> SaveGalleryAsync(WebsiteGallerySave input, HirayaUser actor, byte[]? bytes, string? fileName)
    {
        EnsureAdmin(actor);
        var id = string.IsNullOrWhiteSpace(input.ItemId) ? "gal_" + Guid.NewGuid().ToString("N")[..10] : input.ItemId.Trim();
        string? stored = null;
        if (bytes is { Length: > 0 })
            stored = await _media.SaveGalleryAsync(id, fileName ?? "image.jpg", bytes);

        await _repository.MutateAsync(async db =>
        {
            var item = db.WebsiteGallery.FirstOrDefault(g => g.ItemId == id);
            var isNew = item is null;
            item ??= new WebsiteGalleryItem { ItemId = id, CreatedAt = DateTime.UtcNow.ToString("o") };
            if (isNew)
                db.WebsiteGallery.Add(item);
            item.Title = string.IsNullOrWhiteSpace(input.Title) ? "HIRAYA activity" : input.Title.Trim();
            item.Caption = (input.Caption ?? "").Trim();
            item.Status = NormalizeStatus(input.Status);
            item.SortOrder = input.SortOrder;
            if (!string.IsNullOrWhiteSpace(stored))
                item.FilePath = stored;
            if (isNew && string.IsNullOrWhiteSpace(item.FilePath))
                throw new InvalidOperationException("Choose an image to upload.");
            item.UpdatedAt = DateTime.UtcNow.ToString("o");
            AuditService.Append(db, actor, AuditModules.Website, isNew ? "create" : "update", "gallery", id,
                $"{actor.Fullname} {(isNew ? "added" : "updated")} a gallery image.");
            await Task.CompletedTask;
        });

        var db = await _repository.LoadAsync();
        return db.WebsiteGallery.First(g => g.ItemId == id);
    }

    public async Task SetGalleryStatusAsync(string itemId, string status, HirayaUser actor)
    {
        EnsureAdmin(actor);
        await _repository.MutateAsync(async db =>
        {
            var item = db.WebsiteGallery.FirstOrDefault(g => g.ItemId == itemId)
                       ?? throw new InvalidOperationException("Gallery item not found.");
            item.Status = NormalizeStatus(status);
            item.UpdatedAt = DateTime.UtcNow.ToString("o");
            AuditService.Append(db, actor, AuditModules.Website, "status", "gallery", itemId,
                $"{actor.Fullname} set gallery item to {item.Status}.");
            await Task.CompletedTask;
        });
    }

    public async Task DeleteGalleryAsync(string itemId, HirayaUser actor)
    {
        EnsureAdmin(actor);
        await _repository.MutateAsync(async db =>
        {
            var item = db.WebsiteGallery.FirstOrDefault(g => g.ItemId == itemId)
                       ?? throw new InvalidOperationException("Gallery item not found.");
            db.WebsiteGallery.Remove(item);
            AuditService.Append(db, actor, AuditModules.Website, "delete", "gallery", itemId,
                $"{actor.Fullname} removed a gallery image.");
            await Task.CompletedTask;
        });
    }

    private static string NormalizeStatus(string? status) =>
        status is WebsitePublishStatuses.Published or WebsitePublishStatuses.Archived
            ? status
            : WebsitePublishStatuses.Unpublished;

    private static void EnsureAdmin(HirayaUser actor)
    {
        if (!Navigation.CanManageSystemSettings(actor.Role))
            throw new UnauthorizedAccessException("Only administrators can manage website content.");
    }
}
