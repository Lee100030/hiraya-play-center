using System.Net;
using System.Text;
using Hiraya.Shared.Models;

namespace Hiraya.Shared.Services;

public readonly record struct HirayaEmailRow(string Label, string? Value);

public sealed record HirayaEmailContact(string? Address, string? Phone, string? Email, string? Website);

public sealed class HirayaEmailMessage
{
    public string CenterName { get; init; } = "Hiraya Kids Learning Center";
    public string Headline { get; init; } = "";
    public string Intro { get; init; } = "";
    public IReadOnlyList<HirayaEmailRow> Rows { get; init; } = [];
    public string? Reference { get; init; }
    public string? ActionLabel { get; init; }
    public string? ActionUrl { get; init; }
    public HirayaEmailContact? Contact { get; init; }
}

public static class HirayaEmailLayout
{
    public const string EmptyValue = "Not provided";
    public const string CrestContentId = "hiraya-crest";

    public static string Shown(string? value)
    {
        var text = (value ?? "").Trim();
        if (text.Length == 0 || text is "—" or "–" or "-" or "N/A" or "n/a")
            return EmptyValue;
        return text;
    }

    public static HirayaEmailContact ContactFrom(CenterSettings? settings)
    {
        var address = (settings?.Address ?? "").Trim();
        var phone = (settings?.Phone ?? "").Trim();
        var email = (settings?.Email ?? "").Trim();
        var website = (settings?.Website ?? "").Trim();
        return new HirayaEmailContact(
            address.Length == 0 ? "Rodriguez (Montalban), Rizal, Philippines" : address,
            phone.Length == 0 ? "+63 917 753 4258" : phone,
            email.Length == 0 ? "hirayakids.learning@gmail.com" : email,
            website);
    }

    public static string? PublicUrl(string? website)
    {
        var raw = (website ?? "").Trim();
        if (!Uri.TryCreate(raw, UriKind.Absolute, out var uri))
            return "https://www.hirayalearningcenter.app";
        if (uri.Scheme is not ("http" or "https"))
            return "https://www.hirayalearningcenter.app";
        var host = uri.Host;
        if (host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
            host is "127.0.0.1" or "::1" or "0.0.0.0")
            return "https://www.hirayalearningcenter.app";
        return uri.GetLeftPart(UriPartial.Path).TrimEnd('/');
    }

    public static byte[] CrestBytes()
    {
        var assembly = typeof(HirayaEmailLayout).Assembly;
        var name = assembly.GetManifestResourceNames()
            .FirstOrDefault(item => item.EndsWith("hiraya-crest-email.png", StringComparison.OrdinalIgnoreCase));
        if (name is null)
            return [];
        using var stream = assembly.GetManifestResourceStream(name);
        if (stream is null)
            return [];
        using var memory = new MemoryStream();
        stream.CopyTo(memory);
        return memory.ToArray();
    }

    public static string Plain(HirayaEmailMessage message)
    {
        var center = Center(message.CenterName);
        var lines = new List<string>
        {
            center,
            message.Headline.Trim(),
            "",
            message.Intro.Trim(),
            ""
        };
        foreach (var row in message.Rows)
            lines.Add($"{row.Label}: {Shown(row.Value)}");
        if (!string.IsNullOrWhiteSpace(message.Reference))
        {
            lines.Add("");
            lines.Add($"Reference: {message.Reference.Trim()}");
        }
        if (!string.IsNullOrWhiteSpace(message.ActionUrl) && !string.IsNullOrWhiteSpace(message.ActionLabel))
        {
            lines.Add("");
            lines.Add($"{message.ActionLabel.Trim()}: {message.ActionUrl.Trim()}");
        }
        lines.Add("");
        lines.Add(FooterPlain(message, center));
        return string.Join('\n', lines.Where((line, index) => index == 0 || true)).Trim() + "\n";
    }

    public static string Html(HirayaEmailMessage message)
    {
        var center = Center(message.CenterName);
        var rows = new StringBuilder();
        for (var i = 0; i < message.Rows.Count; i++)
        {
            var row = message.Rows[i];
            var background = i % 2 == 0 ? "#faf8f3" : "#f4f1e9";
            rows.Append("<tr style=\"background:")
                .Append(background)
                .Append("\"><td style=\"padding:12px 14px;width:38%;color:#4a5c54;font-family:Poppins,'Segoe UI',sans-serif;font-size:13px;vertical-align:top\">")
                .Append(Encode(row.Label))
                .Append("</td><td style=\"padding:12px 14px;color:#0b1f14;font-family:Poppins,'Segoe UI',sans-serif;font-size:15px;vertical-align:top\">")
                .Append(Encode(Shown(row.Value)))
                .Append("</td></tr>");
        }

        var reference = string.IsNullOrWhiteSpace(message.Reference)
            ? ""
            : "<p style=\"margin:18px 0 0\"><span style=\"display:inline-block;font-family:'Courier New',Courier,monospace;font-size:12px;letter-spacing:0.02em;background:#efe6c8;color:#0b1f14;border:1px solid #c9a227;border-radius:6px;padding:4px 8px\">Reference: "
              + Encode(message.Reference.Trim())
              + "</span></p>";

        var action = "";
        if (!string.IsNullOrWhiteSpace(message.ActionUrl) && !string.IsNullOrWhiteSpace(message.ActionLabel))
        {
            action = "<p style=\"margin:22px 0 0\"><a href=\""
                + Encode(message.ActionUrl.Trim())
                + "\" style=\"display:inline-block;background:#c9a227;color:#0b1f14;text-decoration:none;font-family:Poppins,'Segoe UI',sans-serif;font-weight:600;font-size:15px;letter-spacing:0.04em;border-radius:999px;padding:14px 26px;border:1px solid #d4af37\">"
                + Encode(message.ActionLabel.Trim())
                + "</a></p>";
        }

        var table = message.Rows.Count == 0
            ? ""
            : "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"border-collapse:collapse;margin-top:8px\">"
              + rows
              + "</table>";

        return $"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width,initial-scale=1">
              <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Poppins:wght@400;600&display=swap" rel="stylesheet">
            </head>
            <body style="margin:0;padding:0;background:#e7e1d4">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#e7e1d4">
                <tr>
                  <td align="center" style="padding:28px 12px">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px">
                      <tr>
                        <td style="background:#0b1f14;padding:22px 28px">
                          <img src="cid:{CrestContentId}" width="48" height="48" alt="" style="display:inline-block;vertical-align:middle;border:0;width:48px;height:48px">
                          <span style="display:inline-block;vertical-align:middle;margin-left:12px;color:#f4f1e9;font-family:Poppins,'Segoe UI',sans-serif;font-weight:600;font-size:13px;letter-spacing:0.18em">HIRAYA KIDS LEARNING CENTER</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="height:4px;background:#c9a227;font-size:0;line-height:0">&nbsp;</td>
                      </tr>
                      <tr>
                        <td style="background:#f4f1e9;padding:28px 28px 32px">
                          <h1 style="margin:0 0 14px;font-family:'Playfair Display',Georgia,serif;font-weight:500;font-size:28px;line-height:1.2;color:#0b1f14">{Encode(message.Headline.Trim())}</h1>
                          <p style="margin:0 0 18px;font-family:Poppins,'Segoe UI',sans-serif;font-size:16px;line-height:1.6;color:#0b1f14">{Encode(message.Intro.Trim())}</p>
                          {table}
                          {reference}
                          {action}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:18px 8px 0;font-family:Poppins,'Segoe UI',sans-serif;font-size:12px;line-height:1.6;color:#4a5c54;text-align:center">
                          {FooterHtml(message, center)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """;
    }

    private static string FooterPlain(HirayaEmailMessage message, string center)
    {
        var contact = message.Contact;
        var lines = new List<string>();
        if (contact is not null)
        {
            lines.Add(Shown(contact.Address));
            lines.Add(Shown(contact.Phone));
            lines.Add(Shown(contact.Email));
        }
        lines.Add($"This is an automated message from {center}.");
        var site = PublicUrl(contact?.Website);
        if (!string.IsNullOrWhiteSpace(site))
            lines.Add($"Notification preferences are managed when you sign in at {site}.");
        return string.Join('\n', lines);
    }

    private static string FooterHtml(HirayaEmailMessage message, string center)
    {
        var contact = message.Contact;
        var bits = new List<string>();
        if (contact is not null)
        {
            bits.Add(Encode(Shown(contact.Address)));
            bits.Add(Encode(Shown(contact.Phone)));
            bits.Add(Encode(Shown(contact.Email)));
        }
        bits.Add("This is an automated message from " + Encode(center) + ".");
        var site = PublicUrl(contact?.Website);
        if (!string.IsNullOrWhiteSpace(site))
        {
            bits.Add("Notification preferences are managed when you <a href=\""
                + Encode(site)
                + "\" style=\"color:#0b1f14\">sign in</a>.");
        }
        return string.Join("<br>", bits);
    }

    private static string Center(string? name) =>
        string.IsNullOrWhiteSpace(name) ? "Hiraya Kids Learning Center" : name.Trim();

    private static string Encode(string? value) => WebUtility.HtmlEncode(value ?? "");
}
