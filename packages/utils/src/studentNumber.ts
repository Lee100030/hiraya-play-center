import type { HirayaDatabase, Student } from '@hiraya/types';

export function studentNumber(student?: Pick<Student, 'qrCode' | 'studentId'> | null) {
  const qr = (student?.qrCode || '').trim();
  if (qr) return /^HIRAYA-/i.test(qr) ? qr.replace(/^HIRAYA-/i, '') : qr;
  return (student?.studentId || '').trim();
}

export function studentQrFromNumber(value?: string | null) {
  const raw = (value || '').trim();
  if (!raw) return '';
  return /^HIRAYA-/i.test(raw) ? raw : `HIRAYA-${raw}`;
}

export function nextStudentNumber() {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const tag = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `STU-${day}-${tag}`;
}

export function studentNumberTaken(store: HirayaDatabase, value: string, exceptStudentId?: string) {
  const want = studentNumber({ qrCode: studentQrFromNumber(value), studentId: value }).toLowerCase();
  if (!want) return false;
  return (store.students || []).some(
    (row) => row.studentId !== exceptStudentId && studentNumber(row).toLowerCase() === want,
  );
}
