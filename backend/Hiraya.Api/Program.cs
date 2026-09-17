using Hiraya.Api;
using Hiraya.Data;
using Hiraya.Shared;
using Hiraya.Shared.Models;
using Hiraya.Shared.Services;
using Hiraya.Shared.Services.Auth;
using Hiraya.Shared.Security;
using Hiraya.Shared.Services.Firebase;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

var dbProvider = HirayaDb.ResolveProvider(builder.Configuration);
var connection = HirayaDb.ApplyPassword(HirayaDb.ResolveConnection(builder.Configuration, dbProvider), builder.Configuration);
var listenPort = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(listenPort))
    builder.WebHost.UseUrls($"http://0.0.0.0:{listenPort}");
else if (builder.Environment.IsDevelopment())
    builder.WebHost.UseUrls("http://0.0.0.0:5188");

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var origins = new List<string>
        {
            "http://127.0.0.1:5288",
            "http://localhost:5288",
            "https://127.0.0.1:5288",
            "https://localhost:5288",
            "http://127.0.0.1:5000",
            "http://localhost:5000",
            "http://127.0.0.1:3000",
            "http://localhost:3000",
            "http://127.0.0.1:3001",
            "http://localhost:3001",
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:8081",
            "http://localhost:8081",
            "https://www.hirayalearningcenter.app",
            "https://hirayalearningcenter.app",
            "https://hiraya-play-center-web.vercel.app"
        };
        var publicUrl = Environment.GetEnvironmentVariable("HIRAYA_PUBLIC_URL")?.Trim().TrimEnd('/');
        if (!string.IsNullOrWhiteSpace(publicUrl))
            origins.Add(publicUrl);

        var extra = Environment.GetEnvironmentVariable("HIRAYA_CORS_ORIGINS");
        if (!string.IsNullOrWhiteSpace(extra))
        {
            foreach (var origin in extra.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                origins.Add(origin.TrimEnd('/'));
        }

        var openCors = Environment.GetEnvironmentVariable("HIRAYA_ALLOW_OPEN_CORS");
        if (builder.Environment.IsDevelopment() ||
            string.Equals(openCors, "1", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(openCors, "true", StringComparison.OrdinalIgnoreCase))
        {
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
            return;
        }

        policy.WithOrigins(origins.ToArray()).AllowAnyHeader().AllowAnyMethod();
    });
});
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    options.SerializerOptions.PropertyNameCaseInsensitive = true;
});
builder.Services.AddDbContextFactory<HirayaLearningCenterDbContext>(options =>
    HirayaDb.Configure(options, dbProvider, connection));
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 100L * 1024 * 1024;
});
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 100L * 1024 * 1024;
});
builder.Services.AddSingleton<IHirayaAppPaths>(_ =>
    new DefaultHirayaAppPaths(builder.Environment.ContentRootPath));
builder.Services.AddHttpClient("hiraya-api");
builder.Services.Configure<Hiraya.Shared.HirayaApiOptions>(_ => { });
builder.Services.AddSingleton<HirayaApiStatus>();
builder.Services.AddSingleton<HirayaActorContext>();
var sessionSecret = Environment.GetEnvironmentVariable("HIRAYA_SESSION_SECRET")
                    ?? builder.Configuration["Hiraya:SessionSecret"];
if (builder.Environment.IsProduction())
{
    if (string.IsNullOrWhiteSpace(sessionSecret) ||
        string.Equals(sessionSecret, SessionTokens.DevelopmentSecret, StringComparison.Ordinal))
    {
        throw new InvalidOperationException(
            "Set HIRAYA_SESSION_SECRET (or Hiraya:SessionSecret) before running the API in Production.");
    }
}
builder.Services.AddSingleton(new SessionTokenOptions
{
    Secret = string.IsNullOrWhiteSpace(sessionSecret) ? SessionTokens.DevelopmentSecret : sessionSecret
});
builder.Services.AddSingleton<SessionGate>();
builder.Services.AddSingleton<PublicRequestThrottle>();
builder.Services.AddSingleton<IHirayaRepository, EfHirayaRepository>();
builder.Services.AddSingleton<PortalAuthService>();
builder.Services.AddSingleton<AccountService>();
builder.Services.AddSingleton<ProfilePhotoService>();
builder.Services.AddSingleton<EnrollmentService>();
builder.Services.AddSingleton<NotificationService>();
builder.Services.Configure<HirayaSmtpOptions>(builder.Configuration.GetSection(HirayaSmtpOptions.SectionName));
builder.Services.AddSingleton<IEmailSender, SmtpEmailSender>();
builder.Services.AddSingleton<ParentAccountService>();
builder.Services.AddSingleton<LearningModuleStorage>();
builder.Services.AddSingleton<LearningModuleService>();
builder.Services.AddSingleton<WebsiteMediaStorage>();
builder.Services.AddSingleton<WebsiteContentService>();

var app = builder.Build();
{
    var forwarded = new ForwardedHeadersOptions
    {
        ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor
                           | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto
    };
    forwarded.KnownIPNetworks.Clear();
    forwarded.KnownProxies.Clear();
    app.UseForwardedHeaders(forwarded);
}
app.UseCors();
app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "SAMEORIGIN";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
        if (context.Request.IsHttps)
            headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
        return Task.CompletedTask;
    });
    await next();
});
app.UseExceptionHandler(err =>
{
    err.Run(async context =>
    {
        var ex = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;
        var log = context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("Hiraya.Api");
        if (IsDatabaseError(ex))
        {
            log.LogError(ex, "MySQL is not available.");
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "The learning center database is not available. Start XAMPP MySQL and confirm the connection string."
            });
            return;
        }

        log.LogError(ex, "Unhandled API error.");
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await context.Response.WriteAsJsonAsync(new
        {
            error = "Something went wrong. Please try again."
        });
    });
});

app.MapGet("/api", () => Results.Json(CentralHub.Info(), JsonDefaults.Options));
app.MapGet("/api/hub", () => Results.Json(CentralHub.Info(), JsonDefaults.Options));

app.MapGet("/api/health", async (IDbContextFactory<HirayaLearningCenterDbContext> factory) =>
{
    try
    {
        await using var db = await factory.CreateDbContextAsync();
        var ok = await db.Database.CanConnectAsync();
        var payload = new
        {
            status = ok ? "ok" : "down",
            hub = "hiraya-central",
            database = "hiraya_learning_center",
            clients = CentralHub.Clients,
        };
        return ok ? Results.Ok(payload) : Results.Json(payload, statusCode: 503);
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Health check could not reach MySQL.");
        return Results.Json(new
        {
            status = "down",
            hub = "hiraya-central",
            database = "hiraya_learning_center",
            clients = CentralHub.Clients,
        }, statusCode: 503);
    }
});

app.MapGet("/api/store", async (HttpRequest request, IHirayaRepository repo, ILoggerFactory logs, CancellationToken ct) =>
{
    var actor = await ParentPortalApi.ActorAsync(request, repo);
    if (actor is null)
        return Results.Unauthorized();
    try
    {
        var data = await repo.LoadAsync(ct);
        return Results.Json(StoreSanitizer.VisibleTo(data, actor), JsonDefaults.Options);
    }
    catch (Exception ex)
    {
        logs.CreateLogger("Hiraya.Api").LogError(ex, "Failed loading HLCMS store.");
        return Results.Json(new { error = "Center records could not be loaded. Confirm MySQL is running and try again." }, statusCode: StatusCodes.Status500InternalServerError);
    }
});

app.MapPost("/api/auth/login", async (LoginRequest body, PortalAuthService auth, SessionTokenOptions tokens, IHirayaRepository repo) =>
{
    try
    {
        var session = await auth.AuthenticateAsync(body.Login, body.Password);
        if (session?.User is null)
            return Results.Json(new { error = "Username or password is incorrect." }, statusCode: StatusCodes.Status401Unauthorized);
        var live = await repo.FindUserAsync(session.User.UserId, null)
                   ?? session.User;
        var token = SessionTokens.Issue(
            session.User.UserId,
            tokens.Secret,
            stamp: SessionTokens.PasswordStamp(live.Password));
        var publicUser = AccountService.ClonePublic(live);
        return Results.Json(new AuthSession { User = publicUser, Token = token }, JsonDefaults.Options);
    }
    catch (InvalidOperationException ex) when (ex.Message == PortalAuthService.LockoutMessage)
    {
        return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status423Locked);
    }
    catch (InvalidOperationException ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
    }
});

app.MapGet("/api/auth/me", async (HttpRequest request, IHirayaRepository repo) =>
{
    var actor = await ParentPortalApi.ActorAsync(request, repo);
    if (actor is null)
        return Results.Unauthorized();
    return Results.Json(AccountService.ClonePublic(actor), JsonDefaults.Options);
});

app.MapPost("/api/auth/logout", (HttpRequest request, SessionTokenOptions tokens, SessionGate gate) =>
{
    var packed = request.Headers["X-Hiraya-Session"].FirstOrDefault();
    var ticket = SessionTokens.TryRead(packed, tokens.Secret);
    if (ticket is not null)
        gate.Revoke(ticket.Jti, ticket.ExpiresUnix);
    return Results.NoContent();
});

app.MapPost("/api/auth/password", async (PasswordChangeRequest body, HttpRequest request, IHirayaRepository repo, AccountService accounts) =>
{
    var actor = await ParentPortalApi.ActorAsync(request, repo);
    if (actor is null)
        return Results.Unauthorized();
    if (!string.Equals(actor.UserId, body.UserId, StringComparison.OrdinalIgnoreCase) &&
        !Navigation.CanManageUsers(actor.Role))
    {
        return Results.Json(new { error = "Forbidden" }, statusCode: StatusCodes.Status403Forbidden);
    }

    try
    {
        await accounts.ChangePasswordAsync(body.UserId, body.CurrentPassword, body.NewPassword, body.ConfirmPassword);
        return Results.NoContent();
    }
    catch (InvalidOperationException ex)
    {
        return Results.Text(ex.Message, statusCode: StatusCodes.Status400BadRequest);
    }
});

app.MapPut("/api/auth/profile", SaveOwnProfile);
app.MapPost("/api/auth/profile", SaveOwnProfile);
app.MapPut("/api/parent/profile", SaveOwnProfile);
app.MapPost("/api/parent/profile", SaveOwnProfile);

async Task<IResult> SaveOwnProfile(ProfileSaveRequest body, HttpRequest request, IHirayaRepository repo, AccountService accounts)
{
    var actor = await ParentPortalApi.ActorAsync(request, repo);
    if (actor is null)
        return Results.Json(new { error = "Your session expired. Sign out and sign in, then save again." }, statusCode: StatusCodes.Status401Unauthorized);
    try
    {
        var saved = await accounts.SaveProfileAsync(actor.UserId, body);
        return Results.Json(saved, JsonDefaults.Options);
    }
    catch (InvalidOperationException ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
    }
}

app.MapGet("/api/public/site", async (HttpContext http, IHirayaRepository repo, CancellationToken ct) =>
{
    http.Response.Headers.CacheControl = "no-store";
    var data = await repo.LoadAsync(ct);
    return Results.Json(PublicSiteCatalog.From(data), JsonDefaults.Options);
});

app.MapPost("/api/public/enrollment", async (HttpRequest request, PublicEnrollmentRequest body, EnrollmentService enroll, PublicRequestThrottle throttle) =>
{
    if (!throttle.Allow($"enroll:{ParentPortalApi.ClientHost(request)}", 8, TimeSpan.FromMinutes(15)))
        return Results.Json(new { error = "Too many enrollment submissions. Please wait and try again." }, statusCode: StatusCodes.Status429TooManyRequests);
    try
    {
        var applicationId = await enroll.SubmitPublicApplicationAsync(
            body.StudentFullname,
            body.StudentBirthdate,
            body.StudentGender,
            body.PreferredProgram,
            body.ParentFullname,
            body.ParentEmail,
            body.ParentPhone,
            body.StudentAddress,
            body.StudentPhone,
            body.StudentEmail,
            body.GuardianRelationship,
            body.PreferredSchedule,
            body.EnrollmentType,
            body.Notes);
        return Results.Json(new PublicEnrollmentResult { Submitted = true, ApplicationId = applicationId }, JsonDefaults.Options);
    }
    catch (InvalidOperationException ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
    }
});

app.MapPost("/api/messages", SendDirect);
app.MapPost("/api/direct-messages", SendDirect);

async Task<IResult> SendDirect(DirectMessageRequest payload, HttpRequest request, IHirayaRepository repo, NotificationService notes)
{
    var actor = await ParentPortalApi.ActorAsync(request, repo);
    if (actor is null)
        return Results.Unauthorized();
    try
    {
        await notes.SendDirectAsync(actor, payload ?? new DirectMessageRequest());
        var data = await repo.LoadAsync();
        return Results.Json(StoreSanitizer.VisibleTo(data, actor), JsonDefaults.Options);
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

app.MapPut("/api/store", async (HttpRequest request, HirayaDatabase incoming, IHirayaRepository repo, ILoggerFactory logs, CancellationToken ct) =>
{
    var actor = await ParentPortalApi.ActorAsync(request, repo);
    if (actor is null)
        return Results.Unauthorized();
    try
    {
        var current = await repo.LoadAsync(ct);
        var merged = StoreSanitizer.MergeStoreWrite(current, incoming, actor);
        await repo.SaveAsync(merged, ct);
        return Results.Json(StoreSanitizer.VisibleTo(merged, actor), JsonDefaults.Options);
    }
    catch (UnauthorizedAccessException ex)
    {
        logs.CreateLogger("Hiraya.Api").LogWarning("Store write denied for {UserId}: {Message}", actor.UserId, ex.Message);
        return Results.Json(new { error = "You are not allowed to save that data." }, statusCode: StatusCodes.Status403Forbidden);
    }
    catch (InvalidOperationException ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
    }
    catch (Exception ex)
    {
        logs.CreateLogger("Hiraya.Api").LogError(ex, "Failed saving HLCMS store.");
        return Results.Json(new { error = "Center records could not be saved. Confirm MySQL is running and try again." }, statusCode: StatusCodes.Status500InternalServerError);
    }
});

LearningModuleApi.Map(app);
ParentPortalApi.Map(app);
WebsiteApi.Map(app);
StaffApi.Map(app);
ProfilePhotoApi.Map(app);
EnrollmentApi.Map(app);

try
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<IDbContextFactory<HirayaLearningCenterDbContext>>();
    await using var context = await db.CreateDbContextAsync();
    await DatabaseInitializer.InitializeAsync(context, app.Logger);
}
catch (Exception ex)
{
    app.Logger.LogError(ex, "{Provider} initialization failed. Check the connection string and that the database server is running.",
        dbProvider == HirayaDb.SqlServer ? "SQL Server" : "MySQL");
}

app.Run();

static bool IsDatabaseError(Exception? ex)
{
    for (var cur = ex; cur != null; cur = cur.InnerException)
    {
        if (cur is DbUpdateException)
            return true;
        var name = cur.GetType().FullName ?? "";
        if (name.Contains("MySql", StringComparison.OrdinalIgnoreCase)
            || name.Contains("SqlClient", StringComparison.OrdinalIgnoreCase)
            || name.Contains("SqlException", StringComparison.OrdinalIgnoreCase))
            return true;
    }

    return false;
}
