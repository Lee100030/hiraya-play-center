using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using MimeKit.Utils;

namespace Hiraya.Shared.Services;

public sealed class SmtpEmailSender : IEmailSender
{
    private readonly IOptionsMonitor<HirayaSmtpOptions> _options;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IOptionsMonitor<HirayaSmtpOptions> options, ILogger<SmtpEmailSender> logger)
    {
        _options = options;
        _logger = logger;
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

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(settings.FromName, settings.From));
        message.ReplyTo.Add(new MailboxAddress(settings.FromName, settings.From));
        message.To.Add(MailboxAddress.Parse(to.Trim()));
        message.Subject = subject;
        var identityDomain = deliverByGmail ? "gmail.com" : RelayIdentityDomain(settings.Host);
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

        if (string.Equals(settings.Host, "file", StringComparison.OrdinalIgnoreCase))
        {
            var dir = string.IsNullOrWhiteSpace(settings.PickupDirectory)
                ? Path.Combine(Path.GetTempPath(), "hiraya-mail")
                : settings.PickupDirectory;
            Directory.CreateDirectory(dir);
            var file = Path.Combine(dir, $"{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}.txt");
            var text = $"To: {to.Trim()}\nFrom: {settings.From}\nSubject: {subject}\n\n{textBody}";
            await File.WriteAllTextAsync(file, text, ct);
            _logger.LogInformation("Saved email for {To} to the local mailbox.", to);
            return;
        }

        var host = deliverByGmail ? "smtp.gmail.com" : settings.Host;
        var port = deliverByGmail ? 587 : settings.Port;
        var user = deliverByGmail
            ? settings.From
            : (string.IsNullOrWhiteSpace(settings.User) ? settings.From : settings.User);
        var password = deliverByGmail ? settings.GmailPassword : settings.Password;
        var secure = deliverByGmail ? SecureSocketOptions.StartTls : SocketOption(settings, port);

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
            throw new InvalidOperationException(deliverByGmail
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
