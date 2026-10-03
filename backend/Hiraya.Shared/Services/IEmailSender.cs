namespace Hiraya.Shared.Services;

public sealed record EmailAttachment(string Path, string FileName, string ContentType);

public interface IEmailSender
{
    bool IsConfigured { get; }
    string? Host { get; }
    Task SendAsync(string to, string subject, string textBody, string? htmlBody = null, EmailAttachment? attachment = null, CancellationToken ct = default);
}
