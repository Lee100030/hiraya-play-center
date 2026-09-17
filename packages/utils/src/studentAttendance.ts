import type { AttendanceRecord, HirayaDatabase } from '@hiraya/types';
import { studentPlacement } from './assignments';

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isStudentRow(row: AttendanceRecord) {
  return (row.kind || '').toLowerCase() !== 'employee';
}

function presentLike(status?: string) {
  const value = (status || '').toLowerCase();
  return value === 'present' || value === 'late';
}

export function studentDayAttendance(store: HirayaDatabase, studentId: string, date = todayKey()) {
  return (store.attendance || []).find(
    (row) => isStudentRow(row) && row.studentId === studentId && row.attendanceDate === date,
  );
}

export function isStudentHereToday(store: HirayaDatabase, studentId: string, date = todayKey()) {
  return presentLike(studentDayAttendance(store, studentId, date)?.status);
}

/** Record that a child arrived at the center today. Present/late uses one package session on save. */
export function confirmStudentPresentToday(
  store: HirayaDatabase,
  studentId: string,
  actorId: string,
  date = todayKey(),
): HirayaDatabase {
  const student = store.students.find((item) => item.studentId === studentId);
  if (!student) throw new Error('Student was not found.');
  const existing = studentDayAttendance(store, studentId, date);
  if (existing && presentLike(existing.status)) {
    throw new Error('This child is already marked as here today.');
  }
  const now = new Date().toISOString();
  const classId = studentPlacement(store, studentId).classId || existing?.classId || '';
  if (existing) {
    return {
      ...store,
      attendance: (store.attendance || []).map((row) =>
        row.attendanceId === existing.attendanceId
          ? {
              ...row,
              status: 'present',
              timeIn: row.timeIn || now,
              classId: row.classId || classId,
              notes: row.notes || 'Confirmed present from student management',
              recordedBy: row.recordedBy || actorId,
            }
          : row,
      ),
    };
  }
  const record: AttendanceRecord = {
    attendanceId: newId('att'),
    kind: 'student',
    studentId,
    employeeId: '',
    classId,
    qrCode: student.qrCode || '',
    timeIn: now,
    timeOut: null,
    attendanceDate: date,
    status: 'present',
    notes: 'Confirmed present from student management',
    recordedBy: actorId,
  };
  return { ...store, attendance: [record, ...(store.attendance || [])] };
}
