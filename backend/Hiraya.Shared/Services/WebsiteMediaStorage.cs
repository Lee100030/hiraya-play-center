using Hiraya.Shared.Models;

namespace Hiraya.Shared.Services;

public sealed class WebsiteMediaStorage
{
    public const long MaxBytes = 8 * 1024 * 1024;
    public const long MaxVideoBytes = 25 * 1024 * 1024;
    private static readonly HashSet<string> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp", ".gif"
    };
    private static readonly HashSet<string> VideoAllowed = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp4", ".webm"
    };

    private readonly IHirayaAppPaths _paths;

    public WebsiteMediaStorage(IHirayaAppPaths paths) => _paths = paths;

    public string Root => Path.Combine(_paths.DataDirectory, "media", "website");

    public async Task<string> SaveLogoAsync(string fileName, byte[] bytes)
    {
        EnsureImage(fileName, bytes);
        var ext = Path.GetExtension(LearningModuleRules.SafeFileName(fileName)).ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(ext) || !Allowed.Contains(ext))
            ext = ".png";
        Directory.CreateDirectory(Root);
        var relative = $"media/website/logo{ext}";
        foreach (var leftover in Directory.GetFiles(Root, "logo.*"))
        {
            try { File.Delete(leftover); } catch { /* ignore */ }
        }
        await File.WriteAllBytesAsync(Path.Combine(_paths.DataDirectory, relative.Replace('/', Path.DirectorySeparatorChar)), bytes);
        return relative;
    }

    public async Task SaveIntroVideoAsync(string fileName, byte[] bytes)
    {
        if (bytes.Length == 0)
            throw new InvalidOperationException("The selected file was empty.");
        if (bytes.Length > MaxVideoBytes)
            throw new InvalidOperationException("Video must be 25 MB or smaller.");
        var safe = LearningModuleRules.SafeFileName(fileName);
        if (LearningModuleRules.HasBlockedSegment(safe))
            throw new InvalidOperationException("That file type is not allowed.");
        var ext = Path.GetExtension(safe).ToLowerInvariant();
        if (!VideoAllowed.Contains(ext))
            throw new InvalidOperationException("Use an MP4 or WEBM video.");
        Directory.CreateDirectory(Root);
        foreach (var leftover in Directory.GetFiles(Root, "intro.*"))
        {
            try { File.Delete(leftover); } catch { /* ignore */ }
        }
        var relative = $"media/website/intro{ext}";
        await File.WriteAllBytesAsync(Path.Combine(_paths.DataDirectory, relative.Replace('/', Path.DirectorySeparatorChar)), bytes);
    }

    public string? IntroVideoFile()
    {
        if (!Directory.Exists(Root))
            return null;
        return Directory.GetFiles(Root, "intro.*")
            .FirstOrDefault(path => VideoAllowed.Contains(Path.GetExtension(path)));
    }

    public async Task<string> SaveGalleryAsync(string itemId, string fileName, byte[] bytes)
    {
        EnsureImage(fileName, bytes);
        var safe = LearningModuleRules.SafeFileName(fileName);
        var ext = Path.GetExtension(safe).ToLowerInvariant();
        if (!Allowed.Contains(ext))
            throw new InvalidOperationException("Use a JPG, PNG, WEBP, or GIF image.");
        var id = Sanitize(itemId);
        var folder = Path.Combine(Root, "gallery", id);
        Directory.CreateDirectory(folder);
        var stored = $"gallery_{id}{ext}";
        var relative = $"media/website/gallery/{id}/{stored}";
        var full = Path.Combine(_paths.DataDirectory, relative.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(Path.GetDirectoryName(full)!);
        await File.WriteAllBytesAsync(full, bytes);
        return relative.Replace('\\', '/');
    }

    public byte[]? Read(string? relative)
    {
        if (string.IsNullOrWhiteSpace(relative) || relative.Contains("..", StringComparison.Ordinal))
            return null;
        var cleaned = relative.Replace('\\', '/').TrimStart('/');
        if (!cleaned.StartsWith("media/website/", StringComparison.OrdinalIgnoreCase))
            return null;
        var full = Path.GetFullPath(Path.Combine(_paths.DataDirectory, cleaned.Replace('/', Path.DirectorySeparatorChar)));
        var root = Path.GetFullPath(Root);
        if (!full.StartsWith(root, StringComparison.OrdinalIgnoreCase) || !File.Exists(full))
            return null;
        return File.ReadAllBytes(full);
    }

    public string ContentType(string? relative)
    {
        var ext = Path.GetExtension(relative ?? "").ToLowerInvariant();
        return LearningModuleRules.ContentType(ext);
    }

    private static void EnsureImage(string? fileName, byte[] bytes)
    {
        if (bytes.Length == 0)
            throw new InvalidOperationException("The selected file was empty.");
        if (bytes.Length > MaxBytes)
            throw new InvalidOperationException("Image must be 8 MB or smaller.");
        var safe = LearningModuleRules.SafeFileName(fileName);
        if (LearningModuleRules.HasBlockedSegment(safe))
            throw new InvalidOperationException("That file type is not allowed.");
        var ext = Path.GetExtension(safe).ToLowerInvariant();
        if (!Allowed.Contains(ext))
            throw new InvalidOperationException("Use a JPG, PNG, WEBP, or GIF image.");
    }

    private static string Sanitize(string value)
    {
        var raw = string.Concat((value ?? "").Where(char.IsLetterOrDigit));
        return string.IsNullOrWhiteSpace(raw) ? "item" : raw.Length <= 40 ? raw : raw[..40];
    }
}
