namespace Hiraya.Shared.Services;

public interface IEmailSender
{
    bool IsConfigured { get; }
    string? Host { get; }
    Task SendAsync(string to, string subject, string textBody, string? htmlBody = null, CancellationToken ct = default);
}
