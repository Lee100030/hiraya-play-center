using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using MimeKit.Utils;

namespace Hiraya.Shared.Services;

public sealed class SmtpEmailSender : IEmailSender
{
    private static readonly JsonSerializerOptions Json = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly IOptionsMonitor<HirayaSmtpOptions> _options;
    private readonly ILogger<SmtpEmailSender> _logger;
    private readonly IHttpClientFactory? _http;

    public SmtpEmailSender(
        IOptionsMonitor<HirayaSmtpOptions> options,
        ILogger<SmtpEmailSender> logger,
        IHttpClientFactory? http = null)
    {
        _options = options;
        _logger = logger;
        _http = http;
    }

    private HirayaSmtpOptions Settings => HirayaSmtpOptions.Resolved(_options.CurrentValue);

    public bool IsConfigured => Settings.IsConfigured();

    public string? Host => string.IsNullOrWhiteSpace(Settings.Host) ? null : Settings.Host;

    public async Task SendAsync(string to, string subject, string textBody, string? htmlBody = null, EmailAttachment? attachment = null, CancellationToken ct = default)
    {
        var settings = Settings;
        if (!settings.IsConfigured())
            throw new InvalidOperationException("SMTP is not configured. Set Smtp settings or HIRAYA_SMTP_HOST / HIRAYA_SMTP_USER / HIRAYA_SMTP_PASSWORD.");
        if (string.IsNullOrWhiteSpace(to) || !to.Contains('@'))
            throw new InvalidOperationException("A valid recipient email is required.");

        var deliverByGmail = IsGmailMailbox(settings.From) && !string.IsNullOrWhiteSpace(settings.GmailPassword);
        if (deliverByGmail)
        {
            await SendViaSmtp(settings, to, subject, textBody, htmlBody, attachment, gmail: true, ct);
            return;
        }

        if (string.Equals(settings.Host, "file", StringComparison.OrdinalIgnoreCase))
        {
            await SavePickup(settings, to, subject, textBody, ct);
            return;
        }

        // Render (and similar hosts) block outbound SMTP :587/:465. The client app
        // talks to that live API, so mail must go over HTTPS. This PC can still use SMTP.
        if (IsBrevoHost(settings.Host) && ShouldUseBrevoHttp())
        {
            var apiKey = ResolveBrevoApiKey(settings);
            if (string.IsNullOrWhiteSpace(apiKey))
                throw new InvalidOperationException(
                    "The live API cannot send mail through SMTP. Set HIRAYA_BREVO_API_KEY on Render to a Brevo API key (SMTP keys starting with xsmtpsib- do not work there).");
            await SendViaBrevoHttp(settings, apiKey, to, subject, textBody, htmlBody, attachment, ct);
            return;
        }

        await SendViaSmtp(settings, to, subject, textBody, htmlBody, attachment, gmail: false, ct);
    }

    private static bool ShouldUseBrevoHttp()
    {
        if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("RENDER")))
            return true;
        if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("HIRAYA_BREVO_API_KEY")))
            return true;
        return false;
    }

    private static string? ResolveBrevoApiKey(HirayaSmtpOptions settings)
    {
        var dedicated = Environment.GetEnvironmentVariable("HIRAYA_BREVO_API_KEY");
        if (!string.IsNullOrWhiteSpace(dedicated))
            return dedicated.Trim();
        var password = (settings.Password ?? "").Trim();
        if (password.StartsWith("xkeysib-", StringComparison.OrdinalIgnoreCase))
            return password;
        // On Render, try the SMTP password as an API key so an existing env var can work.
        if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("RENDER")) && password.Length > 20)
            return password;
        return null;
    }

    private async Task SendViaBrevoHttp(
        HirayaSmtpOptions settings,
        string apiKey,
        string to,
        string subject,
        string textBody,
        string? htmlBody,
        EmailAttachment? attachment,
        CancellationToken ct)
    {
        object? files = null;
        if (attachment is not null && File.Exists(attachment.Path))
        {
            files = new[]
            {
                new
                {
                    name = attachment.FileName,
                    content = Convert.ToBase64String(await File.ReadAllBytesAsync(attachment.Path, ct))
                }
            };
        }

        var payload = new
        {
            sender = new { name = settings.FromName, email = settings.From },
            to = new[] { new { email = to.Trim() } },
            subject,
            textContent = textBody ?? "",
            htmlContent = string.IsNullOrWhiteSpace(htmlBody) ? null : htmlBody,
            attachment = files
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "v3/smtp/email");
        if (_http is null)
            request.RequestUri = new Uri("https://api.brevo.com/v3/smtp/email");
        request.Headers.TryAddWithoutValidation("api-key", apiKey);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Content = new StringContent(JsonSerializer.Serialize(payload, Json), Encoding.UTF8, "application/json");

        HttpClient client;
        var owned = false;
        if (_http is not null)
            client = _http.CreateClient("brevo");
        else
        {
            client = new HttpClient { Timeout = TimeSpan.FromSeconds(25) };
            owned = true;
        }

        try
        {
            using var response = await client.SendAsync(request, ct);
            var body = await response.Content.ReadAsStringAsync(ct);
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Brevo accepted mail to {To} over HTTPS.", to);
                return;
            }

            if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
            {
                throw new InvalidOperationException(
                    "Brevo rejected the live API key. On Render set HIRAYA_BREVO_API_KEY to a Brevo API key (SMTP-only keys do not work on the hosted API).");
            }

            _logger.LogError("Brevo HTTP send to {To} failed ({Status}): {Body}", to, (int)response.StatusCode, TrimBrevoBody(body));
            throw new InvalidOperationException("The email could not be sent through Brevo. Check the API key and the personal email address.");
        }
        finally
        {
            if (owned)
                client.Dispose();
        }
    }

    private static string TrimBrevoBody(string? body)
    {
        var text = (body ?? "").Trim();
        return text.Length <= 300 ? text : text[..300];
    }

    private async Task SavePickup(HirayaSmtpOptions settings, string to, string subject, string textBody, CancellationToken ct)
    {
        var dir = string.IsNullOrWhiteSpace(settings.PickupDirectory)
            ? Path.Combine(Path.GetTempPath(), "hiraya-mail")
            : settings.PickupDirectory;
        Directory.CreateDirectory(dir);
        var file = Path.Combine(dir, $"{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}.txt");
        var text = $"To: {to.Trim()}\nFrom: {settings.From}\nSubject: {subject}\n\n{textBody}";
        await File.WriteAllTextAsync(file, text, ct);
        _logger.LogInformation("Saved email for {To} to the local mailbox.", to);
    }

    private async Task SendViaSmtp(
        HirayaSmtpOptions settings,
        string to,
        string subject,
        string textBody,
        string? htmlBody,
        EmailAttachment? attachment,
        bool gmail,
        CancellationToken ct)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(settings.FromName, settings.From));
        message.ReplyTo.Add(new MailboxAddress(settings.FromName, settings.From));
        message.To.Add(MailboxAddress.Parse(to.Trim()));
        message.Subject = subject;
        var identityDomain = gmail ? "gmail.com" : RelayIdentityDomain(settings.Host);
        if (!string.IsNullOrWhiteSpace(identityDomain))
            message.MessageId = MimeUtils.GenerateMessageId(identityDomain);
        var body = new BodyBuilder { TextBody = textBody ?? "" };
        if (!string.IsNullOrWhiteSpace(htmlBody))
        {
            body.HtmlBody = htmlBody;
            if (htmlBody.Contains("cid:" + HirayaEmailLayout.CrestContentId, StringComparison.Ordinal))
            {
                var crest = HirayaEmailLayout.CrestBytes();
                if (crest.Length > 0)
                {
                    var linked = body.LinkedResources.Add("hiraya-crest.png", crest, new ContentType("image", "png"));
                    linked.ContentId = HirayaEmailLayout.CrestContentId;
                    linked.ContentDisposition = new ContentDisposition(ContentDisposition.Inline);
                }
            }
        }
        if (attachment is not null && File.Exists(attachment.Path))
        {
            var mime = string.IsNullOrWhiteSpace(attachment.ContentType) ? "application/octet-stream" : attachment.ContentType;
            body.Attachments.Add(attachment.FileName, await File.ReadAllBytesAsync(attachment.Path, ct), ContentType.Parse(mime));
        }
        message.Body = body.ToMessageBody();

        var host = gmail ? "smtp.gmail.com" : settings.Host;
        var port = gmail ? 587 : settings.Port;
        var user = gmail
            ? settings.From
            : (string.IsNullOrWhiteSpace(settings.User) ? settings.From : settings.User);
        var password = gmail ? settings.GmailPassword : settings.Password;
        var secure = gmail ? SecureSocketOptions.StartTls : SocketOption(settings, port);

        using var client = new SmtpClient();
        try
        {
            if (!string.IsNullOrWhiteSpace(identityDomain))
                client.LocalDomain = identityDomain;
            await client.ConnectAsync(host, port, secure, ct);
            if (!string.IsNullOrWhiteSpace(password))
                await client.AuthenticateAsync(user, password, ct);
            await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);
            _logger.LogInformation("SMTP accepted mail to {To} via {Host}.", to, host);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SMTP send to {To} failed via {Host}.", to, host);
            throw new InvalidOperationException(gmail
                ? "The email could not be sent through Gmail. Check the Gmail app password and the teacher's personal email."
                : "The email could not be sent. Check the Brevo SMTP key and the personal email address.");
        }
    }

    private static bool IsGmailMailbox(string? email)
    {
        var at = (email ?? "").LastIndexOf('@');
        if (at < 0 || at >= email!.Length - 1) return false;
        var domain = email[(at + 1)..].Trim();
        return domain.Equals("gmail.com", StringComparison.OrdinalIgnoreCase)
            || domain.Equals("googlemail.com", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsBrevoHost(string? host) =>
        (host ?? "").Trim().Equals("smtp-relay.brevo.com", StringComparison.OrdinalIgnoreCase);

    private static string? RelayIdentityDomain(string? host) =>
        IsBrevoHost(host) ? "smtp-relay.brevo.com" : null;

    private static SecureSocketOptions SocketOption(HirayaSmtpOptions settings, int port)
    {
        if (!settings.EnableSsl) return SecureSocketOptions.None;
        if (port == 465) return SecureSocketOptions.SslOnConnect;
        return SecureSocketOptions.StartTls;
    }
}
