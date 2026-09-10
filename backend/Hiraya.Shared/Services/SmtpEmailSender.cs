using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Hiraya.Shared.Services;

public sealed class SmtpEmailSender : IEmailSender
{
    private readonly HirayaSmtpOptions _options;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IOptions<HirayaSmtpOptions> options, ILogger<SmtpEmailSender> logger)
    {
        _options = HirayaSmtpOptions.Resolved(options.Value);
        _logger = logger;
    }

    public bool IsConfigured => _options.IsConfigured();

    public string? Host => string.IsNullOrWhiteSpace(_options.Host) ? null : _options.Host;

    public async Task SendAsync(string to, string subject, string textBody, string? htmlBody = null, CancellationToken ct = default)
    {
        if (!IsConfigured)
            throw new InvalidOperationException("SMTP is not configured. Set Smtp settings or HIRAYA_SMTP_HOST / HIRAYA_SMTP_USER / HIRAYA_SMTP_PASSWORD.");
        if (string.IsNullOrWhiteSpace(to) || !to.Contains('@'))
            throw new InvalidOperationException("A valid recipient email is required.");

        using var message = new MailMessage
        {
            From = new MailAddress(_options.From, _options.FromName),
            Subject = subject,
            Body = string.IsNullOrWhiteSpace(htmlBody) ? textBody : htmlBody,
            IsBodyHtml = !string.IsNullOrWhiteSpace(htmlBody)
        };
        message.To.Add(to.Trim());

#pragma warning disable SYSLIB0014
        using var client = new SmtpClient(_options.Host, _options.Port)
        {
            EnableSsl = _options.EnableSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = string.IsNullOrWhiteSpace(_options.Password),
            Credentials = string.IsNullOrWhiteSpace(_options.Password)
                ? null
                : new NetworkCredential(
                    string.IsNullOrWhiteSpace(_options.User) ? _options.From : _options.User,
                    _options.Password)
        };
#pragma warning restore SYSLIB0014

        try
        {
            await client.SendMailAsync(message, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SMTP send to {To} failed via {Host}.", to, _options.Host);
            throw new InvalidOperationException("The invitation email could not be sent. Check SMTP host, port, and password.");
        }
    }
}
