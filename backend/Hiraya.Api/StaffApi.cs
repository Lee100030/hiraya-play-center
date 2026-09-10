using Hiraya.Shared.Models;
using Hiraya.Shared.Services;
using Hiraya.Shared.Services.Firebase;

namespace Hiraya.Api;

public static class StaffApi
{
    public static void Map(WebApplication app)
    {
        app.MapPut("/api/staff", async (StaffSaveRequest body, HttpRequest request, IHirayaRepository repo) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            return await RunAsync(async () =>
            {
                await new StaffService(repo).SaveAsync(body, actor);
                return Results.NoContent();
            });
        });

        app.MapPost("/api/staff/archive", async (StaffUserIdBody body, HttpRequest request, IHirayaRepository repo) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            return await RunAsync(async () =>
            {
                await new StaffService(repo).SetActiveAsync(body.UserId, false, actor);
                return Results.NoContent();
            });
        });

        app.MapPost("/api/staff/restore", async (StaffUserIdBody body, HttpRequest request, IHirayaRepository repo) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            return await RunAsync(async () =>
            {
                await new StaffService(repo).SetActiveAsync(body.UserId, true, actor);
                return Results.NoContent();
            });
        });

        app.MapPost("/api/staff/active", async (StaffActiveBody body, HttpRequest request, IHirayaRepository repo) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            return await RunAsync(async () =>
            {
                await new StaffService(repo).SetActiveAsync(body.UserId, body.Active, actor);
                return Results.NoContent();
            });
        });

        app.MapPost("/api/staff/delete", async (StaffUserIdBody body, HttpRequest request, IHirayaRepository repo) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            return await RunAsync(async () =>
            {
                await new StaffService(repo).DeleteAsync(body.UserId, actor);
                return Results.NoContent();
            });
        });

        app.MapPost("/api/staff/specialties", async (StaffSpecialtyBody body, HttpRequest request, IHirayaRepository repo) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            return await RunAsync(async () =>
            {
                await new StaffService(repo).AddSpecialtyAsync(body.Name, actor);
                return Results.NoContent();
            });
        });
    }

    private static async Task<IResult> RunAsync(Func<Task<IResult>> action)
    {
        try
        {
            return await action();
        }
        catch (UnauthorizedAccessException ex)
        {
            return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
        }
        catch (InvalidOperationException ex)
        {
            return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
        }
    }
}
