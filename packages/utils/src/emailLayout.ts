export const EMAIL_EMPTY = 'Not provided';

export type EmailRow = { label: string; value?: string | null };
export type EmailContact = { address?: string; phone?: string; email?: string; website?: string };
export type EmailMessage = {
  centerName?: string;
  headline: string;
  intro: string;
  rows?: EmailRow[];
  reference?: string;
  actionLabel?: string;
  actionUrl?: string;
  contact?: EmailContact;
};

export function shown(value?: string | null) {
  const text = (value || '').trim();
  if (!text || text === '—' || text === '–' || text === '-' || text.toLowerCase() === 'n/a') return EMAIL_EMPTY;
  return text;
}

export function publicSiteUrl(website?: string) {
  const raw = (website || '').trim();
  try {
    const uri = new URL(raw);
    if (uri.protocol !== 'http:' && uri.protocol !== 'https:') return 'https://www.hirayalearningcenter.app';
    if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(uri.hostname)) return 'https://www.hirayalearningcenter.app';
    return uri.origin;
  } catch {
    return 'https://www.hirayalearningcenter.app';
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function centerName(name?: string) {
  return (name || '').trim() || 'Hiraya Kids Learning Center';
}

export function emailPlain(message: EmailMessage) {
  const center = centerName(message.centerName);
  const lines = [center, message.headline.trim(), '', message.intro.trim(), ''];
  for (const row of message.rows || []) lines.push(`${row.label}: ${shown(row.value)}`);
  if ((message.reference || '').trim()) {
    lines.push('', `Reference: ${message.reference!.trim()}`);
  }
  if ((message.actionUrl || '').trim() && (message.actionLabel || '').trim()) {
    lines.push('', `${message.actionLabel!.trim()}: ${message.actionUrl!.trim()}`);
  }
  const contact = message.contact;
  lines.push('', shown(contact?.address || 'Rodriguez (Montalban), Rizal, Philippines'));
  lines.push(shown(contact?.phone || '+63 917 753 4258'));
  lines.push(shown(contact?.email || 'hirayakids.learning@gmail.com'));
  lines.push(`This is an automated message from ${center}.`);
  lines.push(`Notification preferences are managed when you sign in at ${publicSiteUrl(contact?.website)}.`);
  return `${lines.join('\n').trim()}\n`;
}

export function emailHtml(message: EmailMessage) {
  const center = centerName(message.centerName);
  const rows = (message.rows || [])
    .map((row, index) => {
      const background = index % 2 === 0 ? '#faf8f3' : '#f4f1e9';
      return `<tr style="background:${background}"><td style="padding:12px 14px;width:38%;color:#4a5c54;font-family:Poppins,'Segoe UI',sans-serif;font-size:13px;vertical-align:top">${escapeHtml(row.label)}</td><td style="padding:12px 14px;color:#0b1f14;font-family:Poppins,'Segoe UI',sans-serif;font-size:15px;vertical-align:top">${escapeHtml(shown(row.value))}</td></tr>`;
    })
    .join('');
  const reference = (message.reference || '').trim()
    ? `<p style="margin:18px 0 0"><span style="display:inline-block;font-family:'Courier New',Courier,monospace;font-size:12px;letter-spacing:0.02em;background:#efe6c8;color:#0b1f14;border:1px solid #c9a227;border-radius:6px;padding:4px 8px">Reference: ${escapeHtml(message.reference!.trim())}</span></p>`
    : '';
  const action = (message.actionUrl || '').trim() && (message.actionLabel || '').trim()
    ? `<p style="margin:22px 0 0"><a href="${escapeHtml(message.actionUrl!.trim())}" style="display:inline-block;background:#c9a227;color:#0b1f14;text-decoration:none;font-family:Poppins,'Segoe UI',sans-serif;font-weight:600;font-size:15px;letter-spacing:0.04em;border-radius:999px;padding:14px 26px;border:1px solid #d4af37">${escapeHtml(message.actionLabel!.trim())}</a></p>`
    : '';
  const site = publicSiteUrl(message.contact?.website);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Poppins:wght@400;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#e7e1d4">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#e7e1d4">
    <tr><td align="center" style="padding:28px 12px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px">
        <tr><td style="background:#0b1f14;padding:22px 28px">
          <img src="cid:hiraya-crest" width="48" height="48" alt="" style="display:inline-block;vertical-align:middle;border:0;width:48px;height:48px">
          <span style="display:inline-block;vertical-align:middle;margin-left:12px;color:#f4f1e9;font-family:Poppins,'Segoe UI',sans-serif;font-weight:600;font-size:13px;letter-spacing:0.18em">HIRAYA KIDS LEARNING CENTER</span>
        </td></tr>
        <tr><td style="height:4px;background:#c9a227;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="background:#f4f1e9;padding:28px 28px 32px">
          <h1 style="margin:0 0 14px;font-family:'Playfair Display',Georgia,serif;font-weight:500;font-size:28px;line-height:1.2;color:#0b1f14">${escapeHtml(message.headline.trim())}</h1>
          <p style="margin:0 0 18px;font-family:Poppins,'Segoe UI',sans-serif;font-size:16px;line-height:1.6;color:#0b1f14">${escapeHtml(message.intro.trim())}</p>
          ${rows ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-top:8px">${rows}</table>` : ''}
          ${reference}
          ${action}
        </td></tr>
        <tr><td style="padding:18px 8px 0;font-family:Poppins,'Segoe UI',sans-serif;font-size:12px;line-height:1.6;color:#4a5c54;text-align:center">
          ${escapeHtml(shown(message.contact?.address || 'Rodriguez (Montalban), Rizal, Philippines'))}<br>
          ${escapeHtml(shown(message.contact?.phone || '+63 917 753 4258'))}<br>
          ${escapeHtml(shown(message.contact?.email || 'hirayakids.learning@gmail.com'))}<br>
          This is an automated message from ${escapeHtml(center)}.<br>
          Notification preferences are managed when you <a href="${escapeHtml(site)}" style="color:#0b1f14">sign in</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
