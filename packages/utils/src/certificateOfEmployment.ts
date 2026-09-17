import type { CenterSettings, HirayaUser, TeacherProfile } from '@hiraya/types';

export type CoeHonorific = 'Mr.' | 'Ms.' | 'Mrs.' | 'Mx.';

export type CoeDraft = {
  centerName: string;
  centerPlace: string;
  centerPhone: string;
  honorific: CoeHonorific;
  fullName: string;
  lastName: string;
  position: string;
  startDate: string;
  salaryAmount: string;
  duties: string;
  qualities: string;
  purpose: string;
  issuedOn: string;
  signer1Name: string;
  signer1Title: string;
  signer2Name: string;
  signer2Title: string;
};

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const TEENS = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function chunkToWords(n: number): string {
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`.trim();
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${chunkToWords(n % 100)}` : ''}`;
}

export function pesoWords(amount: number) {
  const pesos = Math.max(0, Math.floor(Number(amount) || 0));
  if (!pesos) return '';
  if (pesos >= 1_000_000_000) return 'Amount too large';
  const million = Math.floor(pesos / 1_000_000);
  const thousand = Math.floor((pesos % 1_000_000) / 1000);
  const rest = pesos % 1000;
  const parts: string[] = [];
  if (million) parts.push(`${chunkToWords(million)} Million`);
  if (thousand) parts.push(`${chunkToWords(thousand)} Thousand`);
  if (rest) parts.push(chunkToWords(rest));
  return `${parts.join(' ')} Pesos`;
}

export function formatPeso(amount: number) {
  return new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

function isoDate(value?: string) {
  if (!value) return '';
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayLocal() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDate(value: string) {
  const [y, m, d] = isoDate(value).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function ordinal(day: number) {
  const v = day % 100;
  if (v >= 11 && v <= 13) return `${day}th`;
  if (day % 10 === 1) return `${day}st`;
  if (day % 10 === 2) return `${day}nd`;
  if (day % 10 === 3) return `${day}rd`;
  return `${day}th`;
}

function longMonth(date: Date, upper = false) {
  const name = date.toLocaleDateString('en-PH', { month: 'long' });
  return upper ? name.toUpperCase() : name;
}

export function legalStaffName(user: Pick<HirayaUser, 'firstName' | 'middleName' | 'lastName' | 'fullname'>) {
  const first = (user.firstName || '').trim();
  const middle = (user.middleName || '').trim();
  const last = (user.lastName || '').trim();
  if (first && last) {
    const initial = middle ? ` ${middle[0]!.toUpperCase()}.` : '';
    return `${first}${initial} ${last}`;
  }
  const assembled = [first, last].filter(Boolean).join(' ').trim();
  return assembled || (user.fullname || '').trim();
}

function pronouns(honorific: CoeHonorific) {
  if (honorific === 'Mx.') {
    return { subj: 'they', Subj: 'They', poss: 'their', verb: 'are', possAdj: 'their' };
  }
  if (honorific === 'Mr.') {
    return { subj: 'he', Subj: 'He', poss: 'his', verb: 'is', possAdj: 'his' };
  }
  return { subj: 'she', Subj: 'She', poss: 'her', verb: 'is', possAdj: 'her' };
}

function defaultDuties(position: string) {
  const role = (position || '').toLowerCase();
  if (role.includes('market')) {
    return 'assisting in the planning and implementation of the Center’s marketing initiatives, supporting promotional activities, preparing marketing materials, managing communication and engagement efforts, and contributing to the promotion and visibility of Hiraya Kids Learning Center and its programs';
  }
  return 'planning and facilitating learning sessions, supporting student development, preparing instructional materials, coordinating with parents and colleagues, and contributing to the programs of Hiraya Kids Learning Center';
}

function placeFromAddress(address?: string) {
  const text = (address || '').trim();
  if (!text) return 'Montalban, Rizal';
  const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return parts.slice(-2).join(', ');
  return text;
}

export function defaultCoeDraft(
  user: HirayaUser,
  profile: TeacherProfile | undefined,
  settings: CenterSettings,
): CoeDraft {
  const position = (profile?.position || user.position || profile?.specialty || 'Teacher').trim() || 'Teacher';
  return {
    centerName: (settings.centerName || 'HIRAYA Kids Learning Center').trim() || 'HIRAYA Kids Learning Center',
    centerPlace: placeFromAddress(settings.address),
    centerPhone: (settings.phone || '0976-007-3175').trim() || '0976-007-3175',
    honorific: 'Mr.',
    fullName: legalStaffName(user),
    lastName: (user.lastName || legalStaffName(user).split(' ').slice(-1)[0] || '').trim(),
    position,
    startDate: isoDate(profile?.hireDate) || isoDate(user.createdAt) || todayLocal(),
    salaryAmount: '',
    duties: defaultDuties(position),
    qualities: 'dedication, professionalism, creativity, responsibility, and a strong commitment',
    purpose: 'for whatever legal purpose it may serve',
    issuedOn: todayLocal(),
    signer1Name: 'ANGELICA CARUYAN',
    signer1Title: 'Program Director / Operations Head',
    signer2Name: 'MIRA BAI FRIAS',
    signer2Title: 'Administrative Director / Marketing Head',
  };
}

export function buildCoeParagraphs(draft: CoeDraft) {
  const p = pronouns(draft.honorific);
  const start = parseLocalDate(draft.startDate);
  const issued = parseLocalDate(draft.issuedOn) || new Date();
  const startLabel = start ? `${longMonth(start, true)} ${start.getDate()}, ${start.getFullYear()}` : draft.startDate;
  const salary = Number(String(draft.salaryAmount).replace(/,/g, ''));
  const salaryWords = Number.isFinite(salary) && salary > 0 ? pesoWords(salary) : '';
  const honorificName = `${draft.honorific} ${draft.fullName}`.replace(/\s+/g, ' ').trim();
  const shortName = `${draft.honorific} ${draft.lastName}`.replace(/\s+/g, ' ').trim();
  const salarySentence = salaryWords
    ? ` A fixed monthly salary of ${salaryWords} (₱${formatPeso(salary)}), with applicable incentives granted in accordance with the company's policies and performance-based incentive program.`
    : '';
  const employment = `This is to certify that ${honorificName} is currently employed by ${draft.centerName} as a ${draft.position} and has been serving as a ${draft.position} since ${startLabel}.${salarySentence}`;
  const duties = `In this capacity, ${p.subj} ${p.verb} responsible for ${draft.duties.replace(/\.$/, '')}.`;
  const character = `Throughout ${p.possAdj} employment, ${shortName} demonstrated ${draft.qualities.replace(/\.$/, '')} in carrying out ${p.possAdj} assigned duties and responsibilities. ${p.Subj} performed ${p.possAdj} duties responsibly and maintained positive relationships with students, parents, and colleagues.`;
  const purpose = `This Certificate of Employment is issued upon ${p.possAdj} request ${draft.purpose.replace(/\.$/, '')}.`;
  const given = `Given this ${ordinal(issued.getDate())} day of ${longMonth(issued)} ${issued.getFullYear()} at ${draft.centerPlace}, Philippines.`;
  return { employment, duties, character, purpose, given };
}

function pdfSafe(value: string) {
  return value
    .replace(/₱/g, 'PHP ')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
}

function pdfEscape(value: string) {
  return pdfSafe(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapWords(text: string, width: number) {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function coeFileName(fullName: string) {
  const slug = pdfSafe(fullName).trim().replace(/\s+/g, '_').replace(/[^\w.-]/g, '') || 'Employee';
  return `Certificate-of-Employment.${slug}.pdf`;
}

function buildCoePdf(draft: CoeDraft) {
  const body = buildCoeParagraphs(draft);
  const pageW = 595;
  const pageH = 842;
  const left = 56;
  const wrapAt = 86;
  const ops: string[] = [];
  let y = 780;

  function text(font: 'F1' | 'F2', size: number, line: string, x: number, pos: number, align: 'left' | 'center' = 'left') {
    const w = pdfSafe(line).length * size * 0.48;
    const tx = align === 'center' ? x - w / 2 : x;
    ops.push(`BT /${font} ${size} Tf 1 0 0 1 ${tx.toFixed(2)} ${pos.toFixed(2)} Tm (${pdfEscape(line)}) Tj ET`);
  }

  function paragraph(content: string) {
    for (const line of wrapWords(content, wrapAt)) {
      text('F1', 12, line, left, y);
      y -= 16;
    }
    y -= 10;
  }

  text('F2', 16, draft.centerName.toUpperCase(), pageW / 2, y, 'center');
  y -= 20;
  text('F1', 11, `${draft.centerPlace} | ${draft.centerPhone}`, pageW / 2, y, 'center');
  y -= 36;
  text('F2', 14, 'CERTIFICATE OF EMPLOYMENT', pageW / 2, y, 'center');
  y -= 32;
  text('F2', 12, 'TO WHOM IT MAY CONCERN:', left, y);
  y -= 24;
  paragraph(body.employment);
  paragraph(body.duties);
  paragraph(body.character);
  paragraph(body.purpose);
  paragraph(body.given);

  y = Math.min(y - 12, 230);
  const col1 = left + 10;
  const col2 = pageW / 2 + 16;
  ops.push(`${col1} ${y} m ${col1 + 190} ${y} l S`);
  ops.push(`${col2} ${y} m ${col2 + 190} ${y} l S`);
  y -= 18;
  text('F2', 11, draft.signer1Name.toUpperCase(), col1 + 95, y, 'center');
  text('F2', 11, draft.signer2Name.toUpperCase(), col2 + 95, y, 'center');
  y -= 14;
  text('F1', 9, draft.signer1Title, col1 + 95, y, 'center');
  text('F1', 9, draft.signer2Title, col2 + 95, y, 'center');

  const stream = `0.12 w\n${ops.join('\n')}\n`;
  const encoder = new TextEncoder();
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>',
  ];

  const chunks: Uint8Array[] = [];
  let size = 0;
  const push = (value: string) => {
    const bytes = encoder.encode(value);
    chunks.push(bytes);
    size += bytes.length;
  };
  push('%PDF-1.4\n');
  const xref: number[] = [0];
  objects.forEach((object, index) => {
    xref.push(size);
    push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });
  const xrefStart = size;
  push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i < xref.length; i += 1) {
    push(`${String(xref[i]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of chunks) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function downloadCertificateOfEmployment(draft: CoeDraft) {
  const bytes = buildCoePdf(draft);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = coeFileName(draft.fullName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
