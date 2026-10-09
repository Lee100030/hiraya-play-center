namespace Hiraya.Api;

/// <summary>
/// Single API all React clients share: website (Next.js), desktop (Electron), and mobile (Expo).
/// </summary>
public static class CentralHub
{
    public static readonly string[] Clients = ["website", "desktop", "mobile"];

    public static object Info(string database) => new
    {
        name = "HIRAYA Central API",
        hub = "hiraya-central",
        sessionHeader = "X-Hiraya-Session",
        database,
        clients = Clients,
        listen = "http://0.0.0.0:5188",
        endpoints = new
        {
            health = "/api/health",
            login = "/api/auth/login",
            logout = "/api/auth/logout",
            store = "/api/store",
            publicSite = "/api/public/site",
            publicEnrollment = "/api/public/enrollment",
            enrollmentActions = "/api/enrollment/applications/{id}/{approve|reject|cancel|interview}",
            staff = "/api/staff",
            parents = "/api/admin/parents",
            parentPortal = "/api/parent",
            modules = "/api/modules",
            websiteCms = "/api/admin/website",
        },
    };
}
