import type { HirayaDatabase, Student } from '@hiraya/types';

function isRecordId(value: string, studentId?: string | null) {
  const text = value.trim();
  if (!text) return true;
  const id = (studentId || '').trim();
  if (id && text.toLowerCase() === id.toLowerCase()) return true;
  return /^stu_[a-z0-9]+$/i.test(text);
}

/** Printable center number. The internal student id is not this number. */
export function studentNumber(student?: Pick<Student, 'qrCode' | 'studentId'> | null) {
  const qr = (student?.qrCode || '').trim();
  if (!qr) return '';
  const number = (/^HIRAYA-/i.test(qr) ? qr.replace(/^HIRAYA-/i, '') : qr).trim();
  if (isRecordId(number, student?.studentId)) return '';
  return number;
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

export function compareStudentNumbers(
  a?: Pick<Student, 'qrCode' | 'studentId'> | null,
  b?: Pick<Student, 'qrCode' | 'studentId'> | null,
) {
  return studentNumber(a).localeCompare(studentNumber(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function studentNumberTaken(store: HirayaDatabase, value: string, exceptStudentId?: string) {
  const want = studentNumber({ qrCode: studentQrFromNumber(value), studentId: value }).toLowerCase();
  if (!want) return false;
  return (store.students || []).some(
    (row) => row.studentId !== exceptStudentId && studentNumber(row).toLowerCase() === want,
  );
}
