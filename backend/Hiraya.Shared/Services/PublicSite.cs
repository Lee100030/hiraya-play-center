using Hiraya.Shared.Models;

namespace Hiraya.Shared.Services;

public sealed class PublicProgramDto
{
    public string ProgramId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
}

public sealed class PublicAnnouncementDto
{
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public string PublishedAt { get; set; } = "";
}

public sealed class PublicGalleryItemDto
{
    public string ItemId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Caption { get; set; } = "";
}

public sealed class PublicSiteDto
{
    public string CenterName { get; set; } = "HIRAYA Learning Center";
    public string Description { get; set; } = "";
    public string AboutTitle { get; set; } = "About HIRAYA";
    public string WelcomeTitle { get; set; } = "Welcome to HIRAYA Learning Center";
    public string WelcomeMessage { get; set; } = "";
    public string Mission { get; set; } = "";
    public string Vision { get; set; } = "";
    public string Values { get; set; } = "";
    public string Address { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Email { get; set; } = "";
    public string Website { get; set; } = "";
    public string BusinessHours { get; set; } = "";
    public bool HasLogo { get; set; }
    public string ContentUpdatedAt { get; set; } = "";
    public List<PublicProgramDto> Programs { get; set; } = [];
    public List<PublicAnnouncementDto> Announcements { get; set; } = [];
    public List<PublicGalleryItemDto> Gallery { get; set; } = [];
}

public sealed class PublicEnrollmentRequest
{
    public string StudentFullname { get; set; } = "";
    public string StudentBirthdate { get; set; } = "";
    public string StudentGender { get; set; } = "";
    public string PreferredProgram { get; set; } = "";
    public string ParentFullname { get; set; } = "";
    public string ParentEmail { get; set; } = "";
    public string ParentPhone { get; set; } = "";
}

public sealed class PublicEnrollmentResult
{
    public bool Submitted { get; set; }
}

public static class PublicSiteCatalog
{
    public static PublicSiteDto From(HirayaDatabase db)
    {
        var settings = db.Settings;
        var description = string.IsNullOrWhiteSpace(settings.Description)
            ? "Hiraya Learning Center supports early learning, guided play, and family partnership in a safe, welcoming environment."
            : settings.Description;

        return new PublicSiteDto
        {
            CenterName = string.IsNullOrWhiteSpace(settings.CenterName)
                ? "HIRAYA Learning Center"
                : settings.CenterName,
            Description = description,
            AboutTitle = string.IsNullOrWhiteSpace(settings.AboutTitle) ? "About HIRAYA" : settings.AboutTitle,
            WelcomeTitle = string.IsNullOrWhiteSpace(settings.WelcomeTitle)
                ? "Welcome to HIRAYA Learning Center"
                : settings.WelcomeTitle,
            WelcomeMessage = string.IsNullOrWhiteSpace(settings.WelcomeMessage)
                ? description
                : settings.WelcomeMessage,
            Mission = settings.Mission,
            Vision = settings.Vision,
            Values = settings.Values,
            Address = settings.Address,
            Phone = settings.Phone,
            Email = settings.Email,
            Website = settings.Website,
            BusinessHours = string.IsNullOrWhiteSpace(settings.BusinessHours)
                ? "Monday–Friday, 8:00–17:00"
                : settings.BusinessHours,
            HasLogo = !string.IsNullOrWhiteSpace(settings.LogoPath),
            ContentUpdatedAt = settings.UpdatedAt,
            Programs = db.Programs
                .Where(p => string.Equals(p.Status, "active", StringComparison.OrdinalIgnoreCase))
                .OrderBy(p => p.Name)
                .Select(p => new PublicProgramDto
                {
                    ProgramId = p.ProgramId,
                    Name = p.Name,
                    Description = string.IsNullOrWhiteSpace(p.Description)
                        ? "Ask the center for details about this program."
                        : p.Description
                })
                .ToList(),
            Announcements = NotificationService.PublishedNews(db)
                .Take(5)
                .Select(n => new PublicAnnouncementDto
                {
                    Title = n.Title,
                    Body = n.Body,
                    PublishedAt = n.PublishedAt
                })
                .ToList(),
            Gallery = db.WebsiteGallery
                .Where(g => g.Status == WebsitePublishStatuses.Published && !string.IsNullOrWhiteSpace(g.FilePath))
                .OrderBy(g => g.SortOrder)
                .ThenBy(g => g.Title)
                .Select(g => new PublicGalleryItemDto
                {
                    ItemId = g.ItemId,
                    Title = g.Title,
                    Caption = g.Caption
                })
                .ToList()
        };
    }
}
