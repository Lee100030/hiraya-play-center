using Hiraya.Shared.Models;
using Hiraya.Shared.Services;
using Hiraya.Shared.Services.Firebase;

namespace Hiraya.Api;

public static class WebsiteApi
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/admin/website/gallery/{id}/image", async (string id, HttpRequest request, IHirayaRepository repo, WebsiteMediaStorage media) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            if (!Navigation.CanManageSystemSettings(actor.Role))
                return Results.Json(new { error = "Forbidden" }, statusCode: StatusCodes.Status403Forbidden);
            var db = await repo.LoadAsync();
            var item = db.WebsiteGallery.FirstOrDefault(g => g.ItemId == id);
            if (item is null)
                return Results.NotFound();
            var bytes = media.Read(item.FilePath);
            if (bytes is null)
                return Results.NotFound();
            return Results.File(bytes, media.ContentType(item.FilePath));
        });

        app.MapGet("/api/public/intro-video", (HttpContext http, WebsiteMediaStorage media) =>
        {
            var path = media.IntroVideoFile();
            if (path is null)
                return Results.NotFound();
            http.Response.Headers.CacheControl = "no-store";
            return Results.File(path, media.ContentType(path), enableRangeProcessing: true);
        });

        app.MapGet("/api/public/logo", async (HttpContext http, IHirayaRepository repo, WebsiteMediaStorage media) =>
        {
            http.Response.Headers.CacheControl = "no-store";
            var db = await repo.LoadAsync();
            var bytes = media.Read(db.Settings.LogoPath);
            if (bytes is null)
                return Results.NotFound();
            return Results.File(bytes, media.ContentType(db.Settings.LogoPath));
        });

        app.MapGet("/api/public/gallery/{id}/image", async (string id, HttpContext http, IHirayaRepository repo, WebsiteMediaStorage media) =>
        {
            http.Response.Headers.CacheControl = "no-store";
            var db = await repo.LoadAsync();
            var item = db.WebsiteGallery.FirstOrDefault(g =>
                g.ItemId == id &&
                g.Status == WebsitePublishStatuses.Published);
            if (item is null)
                return Results.NotFound();
            var bytes = media.Read(item.FilePath);
            if (bytes is null)
                return Results.NotFound();
            return Results.File(bytes, media.ContentType(item.FilePath));
        });

        app.MapPut("/api/admin/website/landing", async (WebsiteLandingSave body, HttpRequest request, IHirayaRepository repo, WebsiteContentService cms) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            try
            {
                await cms.SaveLandingAsync(body, actor);
                return Results.NoContent();
            }
            catch (UnauthorizedAccessException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });

        app.MapPut("/api/admin/website/about", async (WebsiteAboutSave body, HttpRequest request, IHirayaRepository repo, WebsiteContentService cms) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            try
            {
                await cms.SaveAboutAsync(body, actor);
                return Results.NoContent();
            }
            catch (UnauthorizedAccessException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });

        app.MapPost("/api/admin/website/intro-video", async (HttpRequest request, IHirayaRepository repo, WebsiteContentService cms) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            try
            {
                var form = await request.ReadFormAsync();
                var upload = form.Files.GetFile("file");
                if (upload is null || upload.Length <= 0)
                    throw new InvalidOperationException("Choose an MP4 or WEBM video.");
                await using var stream = upload.OpenReadStream();
                using var ms = new MemoryStream();
                await stream.CopyToAsync(ms);
                await cms.SaveIntroVideoAsync(actor, ms.ToArray(), upload.FileName);
                return Results.NoContent();
            }
            catch (UnauthorizedAccessException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        }).DisableAntiforgery();

        app.MapPost("/api/admin/website/logo", async (HttpRequest request, IHirayaRepository repo, WebsiteContentService cms) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            try
            {
                var form = await request.ReadFormAsync();
                var upload = form.Files.GetFile("file");
                if (upload is null || upload.Length <= 0)
                    throw new InvalidOperationException("Choose a logo image.");
                await using var stream = upload.OpenReadStream();
                using var ms = new MemoryStream();
                await stream.CopyToAsync(ms);
                await cms.SaveLogoAsync(actor, ms.ToArray(), upload.FileName);
                return Results.NoContent();
            }
            catch (UnauthorizedAccessException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        }).DisableAntiforgery();

        app.MapPost("/api/admin/website/gallery", async (HttpRequest request, IHirayaRepository repo, WebsiteContentService cms) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            try
            {
                var form = await request.ReadFormAsync();
                byte[]? bytes = null;
                string? fileName = null;
                var upload = form.Files.GetFile("file");
                if (upload is { Length: > 0 })
                {
                    await using var stream = upload.OpenReadStream();
                    using var ms = new MemoryStream();
                    await stream.CopyToAsync(ms);
                    bytes = ms.ToArray();
                    fileName = upload.FileName;
                }

                _ = int.TryParse(form["sortOrder"].ToString(), out var order);
                var saved = await cms.SaveGalleryAsync(new WebsiteGallerySave
                {
                    ItemId = form["itemId"].ToString(),
                    Title = form["title"].ToString(),
                    Caption = form["caption"].ToString(),
                    Status = form["status"].ToString(),
                    SortOrder = order
                }, actor, bytes, fileName);
                return Results.Json(saved, JsonDefaults.Options);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        }).DisableAntiforgery();

        app.MapPost("/api/admin/website/gallery/{id}/status", async (string id, StatusBody body, HttpRequest request, IHirayaRepository repo, WebsiteContentService cms) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            try
            {
                await cms.SetGalleryStatusAsync(id, body.Status, actor);
                return Results.NoContent();
            }
            catch (UnauthorizedAccessException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });

        app.MapDelete("/api/admin/website/gallery/{id}", async (string id, HttpRequest request, IHirayaRepository repo, WebsiteContentService cms) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            try
            {
                await cms.DeleteGalleryAsync(id, actor);
                return Results.NoContent();
            }
            catch (UnauthorizedAccessException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });
    }

    private sealed class StatusBody
    {
        public string Status { get; set; } = "";
    }
}
