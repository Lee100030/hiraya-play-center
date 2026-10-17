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

var useFirestore = FirestoreHirayaRepository.IsConfigured();
var dbProvider = HirayaDb.ResolveProvider(builder.Configuration);
var connection = useFirestore
    ? ""
    : HirayaDb.ApplyPassword(HirayaDb.ResolveConnection(builder.Configuration, dbProvider), builder.Configuration);
if (builder.Environment.IsProduction() && !useFirestore)
{
    throw new InvalidOperationException(
        "Set FIREBASE_SERVICE_ACCOUNT (Firebase service-account JSON) so Hiraya.Api can use Cloud Firestore.");
}
var listenPort = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(listenPort))
    builder.WebHost.UseUrls($"http://0.0.0.0:{listenPort}");
else if (builder.Environment.IsDevelopment())
    builder.WebHost.UseUrls("http://0.0.0.0:5188");

builder.Services.AddCors(options =>
{
    // Sessions travel in X-Hiraya-Session, not cookies. Expo / okhttp often send
    // Origin: null or a Metro LAN host; a tight origin list answers those with 403 Forbidden.
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    options.SerializerOptions.PropertyNameCaseInsensitive = true;
});
if (!useFirestore)
{
    builder.Services.AddDbContextFactory<HirayaLearningCenterDbContext>(options =>
        HirayaDb.Configure(options, dbProvider, connection));
}
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
builder.Services.AddHttpClient("brevo", client =>
{
    client.BaseAddress = new Uri("https://api.brevo.com/");
    client.Timeout = TimeSpan.FromSeconds(25);
});
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
if (useFirestore)
    builder.Services.AddSingleton<IRevokedSessionStore, MemoryRevokedSessionStore>();
else
    builder.Services.AddSingleton<IRevokedSessionStore, RevokedSessionStore>();
builder.Services.AddSingleton(sp =>
{
    try
    {
        return new SessionGate(sp.GetService<IRevokedSessionStore>());
    }
    catch
    {
        return new SessionGate();
    }
});
builder.Services.AddSingleton<PublicRequestThrottle>();
builder.Services.AddSingleton<SensitiveActionCodes>();
if (useFirestore)
    builder.Services.AddSingleton<IHirayaRepository, FirestoreHirayaRepository>();
else
    builder.Services.AddSingleton<IHirayaRepository, EfHirayaRepository>();
builder.Services.AddSingleton<PortalAuthService>();
builder.Services.AddSingleton<AccountService>();
builder.Services.AddSingleton<ProfilePhotoService>();
builder.Services.AddSingleton<StudentDocumentService>();
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
            log.LogError(ex, "The learning center database is not available.");
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            await context.Response.WriteAsJsonAsync(new
            {
                error = DatabaseUnavailableMessage(dbProvider)
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

app.MapGet("/api", (IHirayaRepository repo) =>
    Results.Json(CentralHub.Info(repo.UsingFirebase ? "firestore" : "neondb"), JsonDefaults.Options));
app.MapGet("/api/hub", (IHirayaRepository repo) =>
    Results.Json(CentralHub.Info(repo.UsingFirebase ? "firestore" : "neondb"), JsonDefaults.Options));

app.MapGet("/api/health", async (IHirayaRepository repo, IServiceProvider services) =>
{
    try
    {
        if (repo.UsingFirebase)
        {
            var ok = repo is FirestoreHirayaRepository fs && await fs.PingAsync();
            var payload = new
            {
                status = ok ? "ok" : "down",
                hub = "hiraya-central",
                database = "firestore",
                store = "firebase-firestore",
                enroll = "2026-10-15-text",
                rev = Environment.GetEnvironmentVariable("RENDER_GIT_COMMIT") ?? "local",
                clients = CentralHub.Clients,
            };
            return ok ? Results.Ok(payload) : Results.Json(payload, statusCode: 503);
        }

        var factory = services.GetRequiredService<IDbContextFactory<HirayaLearningCenterDbContext>>();
        await using var db = await factory.CreateDbContextAsync();
        var connected = await db.Database.CanConnectAsync();
        var neon = new
        {
            status = connected ? "ok" : "down",
            hub = "hiraya-central",
            database = DatabaseName(db.Database.GetConnectionString()),
            store = "neon-postgres",
            enroll = "2026-10-15-text",
            clients = CentralHub.Clients,
        };
        return connected ? Results.Ok(neon) : Results.Json(neon, statusCode: 503);
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Health check could not reach the center database.");
        return Results.Json(new
        {
            status = "down",
            hub = "hiraya-central",
            database = "",
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
        return Results.Json(new { error = RecordsUnavailableMessage(dbProvider, "loaded") }, statusCode: StatusCodes.Status500InternalServerError);
    }
});

app.MapPost("/api/auth/login", async (LoginRequest body, HttpRequest request, PortalAuthService auth, SessionTokenOptions tokens, IHirayaRepository repo, PublicRequestThrottle throttle) =>
{
    try
    {
        var host = ParentPortalApi.ClientHost(request);
        var loginKey = (body.Login ?? "").Trim();
        if (!throttle.Allow($"login-ip:{host}", 30, TimeSpan.FromMinutes(10)) ||
            (!string.IsNullOrWhiteSpace(loginKey) && !throttle.Allow($"login-id:{loginKey}", 20, TimeSpan.FromMinutes(10))))
            return Results.Json(new { error = "Too many attempts. Please wait before trying again." }, statusCode: StatusCodes.Status429TooManyRequests);
        var session = await auth.AuthenticateAsync(body.Login, body.Password);
        if (session?.User is null)
            return Results.Json(new { error = "Username or password is incorrect." }, statusCode: StatusCodes.Status401Unauthorized);
        var live = await repo.FindUserAsync(session.User.UserId, null)
                   ?? session.User;
        var fromPhone = string.Equals(body.Client, "mobile", StringComparison.OrdinalIgnoreCase)
                        || string.Equals(request.Headers["X-Hiraya-Client"], "mobile", StringComparison.OrdinalIgnoreCase);
        if (fromPhone)
        {
            var whoUser = live;
            _ = Task.Run(async () =>
            {
                try
                {
                    await repo.MutateAsync(async db =>
                    {
                        var name = string.IsNullOrWhiteSpace(whoUser.Fullname) ? whoUser.Username : whoUser.Fullname.Trim();
                        var who = string.IsNullOrWhiteSpace(whoUser.Email) ? name : $"{name} ({whoUser.Email})";
                        var message = $"{who} signed in on the phone.";
                        AuditService.Append(db, whoUser, AuditModules.Auth, "login", "user", whoUser.UserId, message);
                        var admins = NotificationService.Recipients(db, NotificationAudiences.Admins);
                        NotificationService.PushToUsers(db, admins.Select(admin => admin.UserId), message, "mobile-login", "Phone sign-in");
                        await Task.CompletedTask;
                    });
                }
                catch
                {
                    // Phone sign-in must not wait on a full store rewrite.
                }
            });
        }
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

app.MapGet("/api/auth/me", async (HttpRequest request, IHirayaRepository repo, ILoggerFactory logs) =>
{
    try
    {
        var actor = await ParentPortalApi.ActorAsync(request, repo);
        if (actor is null)
            return Results.Unauthorized();
        return Results.Json(AccountService.ClonePublic(actor), JsonDefaults.Options);
    }
    catch (Exception ex)
    {
        logs.CreateLogger("Hiraya.Api").LogError(ex, "Failed resolving the signed-in HIRAYA account.");
        return Results.Json(new { error = "Could not load this account from Firestore. Sign in again." }, statusCode: StatusCodes.Status500InternalServerError);
    }
});

app.MapPost("/api/auth/logout", async (HttpRequest request, SessionTokenOptions tokens, SessionGate gate, CancellationToken ct) =>
{
    var packed = request.Headers["X-Hiraya-Session"].FirstOrDefault();
    var ticket = SessionTokens.TryRead(packed, tokens.Secret);
    if (ticket is not null)
        await gate.RevokeAsync(ticket.Jti, ticket.ExpiresUnix, ct);
    return Results.NoContent();
});

app.MapPost("/api/auth/password/request-code", async (
    PasswordChangeRequest body,
    HttpRequest request,
    IHirayaRepository repo,
    IEmailSender email,
    SensitiveActionCodes codes,
    PublicRequestThrottle throttle) =>
{
    var actor = await ParentPortalApi.ActorAsync(request, repo);
    if (actor is null)
        return Results.Unauthorized();
    if (!UserRoles.IsAdmin(actor.Role))
        return Results.Json(new { error = "Only the Super Administrator can request a password verification code." }, statusCode: StatusCodes.Status403Forbidden);
    if (!throttle.Allow($"pw-code:{actor.UserId}", 6, TimeSpan.FromMinutes(15)))
        return Results.Json(new { error = SensitiveActionCodes.TooMany }, statusCode: StatusCodes.Status429TooManyRequests);
    if (!PasswordHasher.Verify(body.CurrentPassword, actor.Password))
        return Results.Json(new { error = "Current password is incorrect." }, statusCode: StatusCodes.Status400BadRequest);
    if (!email.IsConfigured)
        return Results.Json(new { error = "Email is not configured, so a verification code cannot be sent." }, statusCode: StatusCodes.Status503ServiceUnavailable);
    if (!codes.AllowIssue(actor.UserId, out var issueError))
        return Results.Json(new { error = issueError }, statusCode: StatusCodes.Status429TooManyRequests);
    var mailbox = !string.IsNullOrWhiteSpace(actor.PersonalEmail) && actor.PersonalEmail.Contains('@')
        ? actor.PersonalEmail.Trim()
        : actor.Email.Trim();
    if (string.IsNullOrWhiteSpace(mailbox) || !mailbox.Contains('@'))
        return Results.Json(new { error = "This administrator account has no email address for verification." }, statusCode: StatusCodes.Status400BadRequest);
    var code = codes.Issue(actor.UserId);
    await email.SendAsync(
        mailbox,
        "HIRAYA · Confirm password change",
        $"Your verification code is {code}. It expires in 10 minutes. If you did not request a password change, ignore this message.",
        null);
    return Results.Json(new { sent = true, to = mailbox });
});

app.MapPost("/api/auth/password", async (
    PasswordChangeRequest body,
    HttpRequest request,
    IHirayaRepository repo,
    AccountService accounts,
    SensitiveActionCodes codes,
    PublicRequestThrottle throttle) =>
{
    var actor = await ParentPortalApi.ActorAsync(request, repo);
    if (actor is null)
        return Results.Unauthorized();
    if (!throttle.Allow($"pw-change:{actor.UserId}", 8, TimeSpan.FromMinutes(15)))
        return Results.Json(new { error = SensitiveActionCodes.TooMany }, statusCode: StatusCodes.Status429TooManyRequests);
    var targetId = string.IsNullOrWhiteSpace(body.UserId) ? actor.UserId : body.UserId;
    var changingOther = !string.Equals(actor.UserId, targetId, StringComparison.OrdinalIgnoreCase);
    if (changingOther && !Navigation.CanManageUsers(actor.Role))
        return Results.Json(new { error = "You can only change your own password on the phone app." }, statusCode: StatusCodes.Status403Forbidden);

    try
    {
        if (changingOther)
        {
            PasswordHasher.RequireAdminConfirmation(actor.Password, body.AdminPassword);
            await accounts.ReplacePasswordAsync(targetId, body.NewPassword, body.ConfirmPassword);
            return Results.NoContent();
        }

        if (UserRoles.IsAdmin(actor.Role))
        {
            var problem = codes.Consume(actor.UserId, body.VerificationCode);
            if (problem != null)
                return Results.Json(new { error = problem }, statusCode: StatusCodes.Status400BadRequest);
        }

        await accounts.ChangePasswordAsync(actor.UserId, body.CurrentPassword, body.NewPassword, body.ConfirmPassword);
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
    request.HttpContext.Response.Headers.CacheControl = "no-store";
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

app.MapPost("/api/public/inquiries", async (
    HttpRequest request,
    PublicInquiryRequest body,
    IHirayaRepository repo,
    IEmailSender email,
    PublicRequestThrottle throttle,
    ILoggerFactory logs,
    CancellationToken ct) =>
{
    if (!throttle.Allow($"inquiry:{ParentPortalApi.ClientHost(request)}", 8, TimeSpan.FromMinutes(15)))
        return Results.Json(new { error = "Too many messages. Please wait and try again." }, statusCode: StatusCodes.Status429TooManyRequests);

    var name = (body.Name ?? "").Trim();
    var from = (body.Email ?? "").Trim();
    var phone = (body.Phone ?? "").Trim();
    var message = (body.Message ?? "").Trim();
    var digits = phone.Count(char.IsDigit);
    if (name.Length < 2 || !from.Contains('@') || digits < 7 || message.Length < 10)
        return Results.Json(new { error = "Please complete your name, email, phone, and a short message." }, statusCode: StatusCodes.Status400BadRequest);

    var inquiryId = "inq_" + Guid.NewGuid().ToString("N")[..10];
    var centerName = "Hiraya Kids Learning Center";
    var centerEmail = "";
    HirayaEmailContact? contact = null;
    var saved = false;
    await repo.MutateAsync(async db =>
    {
        if (!string.IsNullOrWhiteSpace(db.Settings.CenterName))
            centerName = db.Settings.CenterName.Trim();
        centerEmail = (db.Settings.Email ?? "").Trim();
        contact = HirayaEmailLayout.ContactFrom(db.Settings);
        var admins = db.Users
            .Where(user => user.Role is UserRoles.SuperAdmin or UserRoles.Admin or UserRoles.Staff)
            .Where(user => !string.Equals(user.Status, "inactive", StringComparison.OrdinalIgnoreCase))
            .Select(user => user.UserId)
            .ToList();
        if (admins.Count > 0)
        {
            NotificationService.PushToUsers(
                db,
                admins,
                $"{name} ({from}, {phone}) wrote: {message}",
                NotificationKinds.System,
                "Website inquiry",
                "/admin/messages");
            saved = true;
        }
        await Task.CompletedTask;
    }, ct);

    var emailed = false;
    var deliverable = centerEmail.Contains('@') &&
                      !centerEmail.EndsWith(".local", StringComparison.OrdinalIgnoreCase) &&
                      !centerEmail.EndsWith(".invalid", StringComparison.OrdinalIgnoreCase);
    if (deliverable)
    {
        try
        {
            var notice = new HirayaEmailMessage
            {
                CenterName = centerName,
                Headline = "New website inquiry",
                Intro = $"{name} sent a message from the public website.",
                Reference = inquiryId,
                Contact = contact,
                Rows =
                [
                    new HirayaEmailRow("Name", name),
                    new HirayaEmailRow("Email", from),
                    new HirayaEmailRow("Phone", phone),
                    new HirayaEmailRow("Message", message),
                ],
            };
            await email.SendAsync(
                centerEmail,
                $"{centerName} · Website inquiry",
                HirayaEmailLayout.Plain(notice),
                HirayaEmailLayout.Html(notice),
                ct: ct);
            emailed = true;
        }
        catch (Exception ex)
        {
            logs.CreateLogger("Hiraya.Inquiries").LogWarning(ex, "Inquiry {InquiryId} was saved, but the notice email was not sent.", inquiryId);
        }
    }

    if (!saved && !emailed)
        return Results.Json(new { error = "The center could not receive this message. Please try again in a moment." }, statusCode: StatusCodes.Status503ServiceUnavailable);

    return Results.Json(new PublicInquiryResult { Submitted = true, Emailed = emailed }, JsonDefaults.Options);
});

app.MapPost("/api/public/teacher-application", async (HttpRequest request, TeacherApplyRequest body, EnrollmentService enroll, PublicRequestThrottle throttle) =>
{
    if (!throttle.Allow($"teacher:{ParentPortalApi.ClientHost(request)}", 8, TimeSpan.FromMinutes(15)))
        return Results.Json(new { error = "Too many applications. Please wait and try again." }, statusCode: StatusCodes.Status429TooManyRequests);
    try
    {
        var applicationId = await enroll.SubmitTeacherApplicationAsync(body.Fullname, body.Email, body.Phone, body.Position, body.Notes);
        return Results.Json(new PublicEnrollmentResult { Submitted = true, ApplicationId = applicationId }, JsonDefaults.Options);
    }
    catch (InvalidOperationException ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
    }
});

app.MapPost("/api/messages", SendDirect);
app.MapPost("/api/direct-messages", SendDirect);
app.MapDelete("/api/messages/{alertId}", DeleteDirect);
app.MapDelete("/api/direct-messages/{alertId}", DeleteDirect);
app.MapPost("/api/chat-groups", async (ChatGroupCreateRequest payload, HttpRequest request, IHirayaRepository repo, NotificationService notes) =>
{
    var actor = await ParentPortalApi.ActorAsync(request, repo);
    if (actor is null)
        return Results.Unauthorized();
    try
    {
        await notes.CreateGroupAsync(actor, payload ?? new ChatGroupCreateRequest());
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
});

async Task<IResult> SendDirect(DirectMessageRequest payload, HttpRequest request, IHirayaRepository repo, NotificationService notes, PublicRequestThrottle throttle)
{
    var actor = await ParentPortalApi.ActorAsync(request, repo);
    if (actor is null)
        return Results.Unauthorized();
    if (!throttle.Allow($"msg:{actor.UserId}", 40, TimeSpan.FromMinutes(10)))
        return Results.Json(new { error = "Too many messages. Please wait before sending again." }, statusCode: StatusCodes.Status429TooManyRequests);
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

async Task<IResult> DeleteDirect(string alertId, HttpRequest request, IHirayaRepository repo, NotificationService notes)
{
    var actor = await ParentPortalApi.ActorAsync(request, repo);
    if (actor is null)
        return Results.Unauthorized();
    try
    {
        await notes.DeleteDirectMessageAsync(actor, alertId);
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

app.MapPost("/api/store/patch", async (HttpRequest request, StorePatchRequest? body, IHirayaRepository repo, ILoggerFactory logs, CancellationToken ct) =>
{
    var actor = await ParentPortalApi.ActorAsync(request, repo);
    if (actor is null)
        return Results.Unauthorized();
    try
    {
        var patch = body ?? new StorePatchRequest();
        var merged = patch.Collections.Count == 0
            ? await repo.LoadAsync(ct)
            : await repo.ApplyClientPatchAsync(patch, actor, ct);
        return Results.Json(StoreSanitizer.VisibleTo(merged, actor), JsonDefaults.Options);
    }
    catch (UnauthorizedAccessException ex)
    {
        logs.CreateLogger("Hiraya.Api").LogWarning("Store patch denied for {UserId}: {Message}", actor.UserId, ex.Message);
        return Results.Json(new { error = "You are not allowed to save that data." }, statusCode: StatusCodes.Status403Forbidden);
    }
    catch (InvalidOperationException ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
    }
    catch (Exception ex)
    {
        logs.CreateLogger("Hiraya.Api").LogError(ex, "Failed saving HLCMS store patch.");
        return Results.Json(new { error = RecordsUnavailableMessage(dbProvider, "saved") }, statusCode: StatusCodes.Status500InternalServerError);
    }
});

app.MapPut("/api/store", async (HttpRequest request, HirayaDatabase incoming, IHirayaRepository repo, ILoggerFactory logs, CancellationToken ct) =>
{
    var actor = await ParentPortalApi.ActorAsync(request, repo);
    if (actor is null)
        return Results.Unauthorized();
    try
    {
        var current = await repo.LoadAsync(ct);
        SessionNoticeMail.Begin();
        HirayaDatabase merged;
        List<SessionParentMail> notices;
        try
        {
            merged = StoreSanitizer.MergeStoreWrite(current, incoming, actor);
            await repo.SaveAsync(merged, ct);
            notices = SessionNoticeMail.Take();
        }
        finally
        {
            SessionNoticeMail.Clear();
        }
        await SessionNoticeMail.SendAsync(notices, app.Services.GetRequiredService<IEmailSender>(), logs.CreateLogger("Hiraya.Api"), ct);
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
        return Results.Json(new { error = RecordsUnavailableMessage(dbProvider, "saved") }, statusCode: StatusCodes.Status500InternalServerError);
    }
});

LearningModuleApi.Map(app);
ParentPortalApi.Map(app);
WebsiteApi.Map(app);
StaffApi.Map(app);
ProfilePhotoApi.Map(app);
StudentDocumentApi.Map(app);
EnrollmentApi.Map(app);
PaymentApi.Map(app);
FeedbackApi.Map(app);

if (!useFirestore)
{
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
            dbProvider == HirayaDb.SqlServer ? "SQL Server" : "PostgreSQL");
    }
}
else
{
    app.Logger.LogInformation("Hiraya.Api is using Cloud Firestore project hiraya-kids-learning.");
    var warmRepo = app.Services.GetRequiredService<IHirayaRepository>();
    app.Lifetime.ApplicationStarted.Register(() => _ = Task.Run(async () =>
    {
        var started = DateTime.UtcNow;
        try
        {
            await warmRepo.LoadAsync();
            app.Logger.LogInformation("Warmed the Firestore store cache in {Seconds:F1}s.", (DateTime.UtcNow - started).TotalSeconds);
        }
        catch (Exception ex)
        {
            app.Logger.LogWarning(ex, "Could not warm the Firestore store cache; the first request will load it.");
        }
    }));
}

var keepAwakeUrls = (Environment.GetEnvironmentVariable("KEEP_AWAKE_URLS")
        ?? (Environment.GetEnvironmentVariable("RENDER") is null ? "" : "https://hirayakidslearningcenter.com/api/health"))
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
if (keepAwakeUrls.Length > 0)
{
    var keepAwakeClients = app.Services.GetRequiredService<IHttpClientFactory>();
    app.Lifetime.ApplicationStarted.Register(() => _ = Task.Run(async () =>
    {
        // Render free web services sleep after 15 idle minutes.
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(10));
        do
        {
            foreach (var url in keepAwakeUrls)
            {
                try
                {
                    using var client = keepAwakeClients.CreateClient("hiraya-api");
                    client.Timeout = TimeSpan.FromSeconds(90);
                    using var response = await client.GetAsync(url, app.Lifetime.ApplicationStopping);
                    app.Logger.LogInformation("Keep-awake ping {Url} returned {Status}.", url, (int)response.StatusCode);
                }
                catch (OperationCanceledException) when (app.Lifetime.ApplicationStopping.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    app.Logger.LogWarning("Keep-awake ping {Url} failed: {Message}", url, ex.Message);
                }
            }
        } while (await timer.WaitForNextTickAsync(app.Lifetime.ApplicationStopping).AsTask().ContinueWith(t => t.IsCompletedSuccessfully && t.Result));
    }));
}

app.Run();

static string DatabaseUnavailableMessage(string provider)
{
    _ = provider;
    return FirestoreHirayaRepository.IsConfigured()
        ? "The learning center database is not available. Confirm Cloud Firestore is reachable and try again."
        : "The learning center database is not available. Confirm Neon PostgreSQL is reachable and try again.";
}

static string RecordsUnavailableMessage(string provider, string action)
{
    _ = provider;
    var store = FirestoreHirayaRepository.IsConfigured() ? "Cloud Firestore" : "Neon PostgreSQL";
    return $"Center records could not be {action}. Confirm {store} is reachable and try again.";
}

static string DatabaseName(string? connection)
{
    if (string.IsNullOrWhiteSpace(connection))
        return "";
    foreach (var part in connection.Split(';', StringSplitOptions.RemoveEmptyEntries))
    {
        var split = part.Split('=', 2);
        if (split.Length != 2)
            continue;
        if (split[0].Equals("Database", StringComparison.OrdinalIgnoreCase) ||
            split[0].Equals("Initial Catalog", StringComparison.OrdinalIgnoreCase))
            return split[1].Trim();
    }
    return "";
}

static bool IsDatabaseError(Exception? ex)
{
    for (var cur = ex; cur != null; cur = cur.InnerException)
    {
        if (cur is DbUpdateException)
            return true;
        var name = cur.GetType().FullName ?? "";
        if (name.Contains("MySql", StringComparison.OrdinalIgnoreCase)
            || name.Contains("Npgsql", StringComparison.OrdinalIgnoreCase)
            || name.Contains("Postgres", StringComparison.OrdinalIgnoreCase)
            || name.Contains("SqlClient", StringComparison.OrdinalIgnoreCase)
            || name.Contains("SqlException", StringComparison.OrdinalIgnoreCase))
            return true;
    }

    return false;
}
