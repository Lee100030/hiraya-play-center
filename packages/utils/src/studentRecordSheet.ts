import type { HirayaDatabase, HirayaUser, Student } from '@hiraya/types';
import { studentPlacement } from './assignments';
import { formatPeso } from './certificateOfEmployment';
import { sessionLeftLabel } from './studentBilling';
import { studentNumber } from './studentNumber';
import { paymentBalanceLabel, studentTuitionFee } from './tuitionLedger';

function personName(user?: Pick<HirayaUser, 'fullname' | 'firstName' | 'lastName'> | null) {
  if (!user) return '';
  const assembled = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  const full = (user.fullname || '').trim();
  return assembled.includes(' ') ? assembled : full || assembled;
}

function learnerName(student: Student) {
  if (student.fullname?.trim()) return student.fullname.trim();
  return [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ').trim() || 'Student';
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

function shown(value?: string | null) {
  const text = (value || '').trim();
  return text || '-';
}

function genderLabel(value?: string) {
  const text = (value || '').trim().toLowerCase();
  if (text === 'male' || text === 'boy') return 'Boy';
  if (text === 'female' || text === 'girl') return 'Girl';
  return shown(value);
}

function dateLabel(value?: string) {
  const raw = (value || '').trim().slice(0, 10);
  if (!raw) return '-';
  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fileName(fullName: string) {
  const slug = pdfSafe(fullName).trim().replace(/\s+/g, '_').replace(/[^\w.-]/g, '') || 'Student';
  return `Student-Record.${slug}.pdf`;
}

function buildPdf(lines: { font: 'F1' | 'F2'; size: number; text: string; x: number; y: number }[]) {
  const pageW = 595;
  const pageH = 842;
  const ops = lines.map((line) => {
    return `BT /${line.font} ${line.size} Tf 1 0 0 1 ${line.x.toFixed(2)} ${line.y.toFixed(2)} Tm (${pdfEscape(line.text)}) Tj ET`;
  });
  const stream = ops.join('\n') + '\n';
  const encoder = new TextEncoder();
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
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

function wrap(text: string, width: number) {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      if (current) lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['-'];
}

/** Download the learner's record as a single page. */
export function downloadStudentRecord(store: HirayaDatabase, studentId: string) {
  const student = (store.students || []).find((row) => row.studentId === studentId);
  if (!student) throw new Error('That student was not found.');
  const place = studentPlacement(store, student.studentId);
  const parent = (store.users || []).find((user) => user.userId === student.parentId);
  const name = learnerName(student);
  const center = (store.settings?.centerName || 'Hiraya Kids Learning Center').trim();
  const tuition = studentTuitionFee(store, student.studentId);
  const facts: [string, string][] = [
    ['Student number', shown(studentNumber(student))],
    ['Birthday', dateLabel(student.birthdate)],
    ['Age', student.age ? `${student.age}` : '-'],
    ['Boy / Girl', genderLabel(student.gender)],
    ['Program', shown(place.programName || student.program || student.gradeLevel)],
    ['Class', shown(place.className)],
    ['Assigned teacher', shown(place.teacherName)],
    ['Enrollment', shown(place.enrollmentStatus)],
    ['Enrolled', dateLabel(student.enrollmentDate)],
    ['Sessions left', shown(sessionLeftLabel(store, student.studentId))],
    ['Tuition fee', tuition > 0 ? `PHP ${formatPeso(tuition)}` : '-'],
    ['Remaining balance', shown(paymentBalanceLabel(store, student.studentId)).replace(/₱/g, 'PHP ')],
    ['Parent / guardian', parent ? personName(parent) || '-' : '-'],
    ['Parent contact', shown(parent?.phone || student.contactNumber)],
    ['Address', shown(student.address)],
    ['Student contact', shown(student.contactNumber)],
    ['Emergency contact', shown(student.emergencyContact)],
    ['Emergency phone', shown(student.emergencyPhone)],
    ['Status', shown(student.status)],
  ];

  const lines: { font: 'F1' | 'F2'; size: number; text: string; x: number; y: number }[] = [];
  let y = 800;
  lines.push({ font: 'F2', size: 13, text: center.toUpperCase(), x: 48, y });
  y -= 22;
  lines.push({ font: 'F2', size: 16, text: 'STUDENT RECORD', x: 48, y });
  y -= 22;
  lines.push({ font: 'F2', size: 14, text: name, x: 48, y });
  y -= 28;

  for (const [label, value] of facts) {
    lines.push({ font: 'F2', size: 10, text: label, x: 48, y });
    const valueLines = wrap(value, 70);
    lines.push({ font: 'F1', size: 11, text: valueLines[0], x: 190, y });
    y -= 18;
    for (const extra of valueLines.slice(1, 2)) {
      lines.push({ font: 'F1', size: 11, text: extra, x: 190, y });
      y -= 16;
    }
  }

  y -= 8;
  lines.push({ font: 'F2', size: 10, text: 'Notes', x: 48, y });
  y -= 16;
  for (const noteLine of wrap(shown(student.notes), 90).slice(0, 4)) {
    lines.push({ font: 'F1', size: 11, text: noteLine, x: 48, y });
    y -= 15;
  }
  y -= 10;
  lines.push({
    font: 'F1',
    size: 9,
    text: `One-page record saved ${new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}.`,
    x: 48,
    y: Math.max(y, 36),
  });

  const bytes = buildPdf(lines);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName(name);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
