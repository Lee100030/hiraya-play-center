import type { AttendanceRecord, HirayaDatabase, HirayaUser, Payment } from '@hiraya/types';
import { TEACHER_PAYMENT_MARK } from './paymentLanes';
import { staffDisplayName, uniqueStaffTeachers } from './staffDedupe';

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function teacherLabel(user: HirayaUser) {
  return staffDisplayName(user);
}

export function isTeacherAttendanceRow(row: AttendanceRecord) {
  const kind = (row.kind || '').toLowerCase();
  return kind === 'employee' || kind === 'teacher' || kind === 'staff';
}

function presentLike(status?: string) {
  const value = (status || '').toLowerCase();
  return value === 'present' || value === 'late';
}

function absentLike(status?: string) {
  const value = (status || '').toLowerCase();
  return value === 'absent';
}

function excusedLike(status?: string) {
  const value = (status || '').toLowerCase();
  return value === 'excused' || value === 'leave' || value === 'day-off' || value === 'day off';
}

export function staffTeachers(store: HirayaDatabase) {
  return uniqueStaffTeachers(store);
}

export function teacherAttendanceInMonth(store: HirayaDatabase, teacherId: string, month: string) {
  const id = (teacherId || '').trim();
  const prefix = (month || '').slice(0, 7);
  return (store.attendance || []).filter(
    (row) =>
      isTeacherAttendanceRow(row) &&
      (row.employeeId || '').trim() === id &&
      (row.attendanceDate || '').startsWith(prefix),
  );
}

export type TeacherAttendanceSummary = {
  teacher: HirayaUser;
  present: number;
  late: number;
  absent: number;
  excused: number;
  /** Days that count toward work for salary (present + late). */
  worked: number;
  recorded: number;
  records: AttendanceRecord[];
};

export function teacherAttendanceSummary(
  store: HirayaDatabase,
  teacher: HirayaUser,
  month: string,
): TeacherAttendanceSummary {
  const records = teacherAttendanceInMonth(store, teacher.userId, month);
  let present = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;
  for (const row of records) {
    const status = (row.status || '').toLowerCase();
    if (status === 'late') late += 1;
    else if (presentLike(status)) present += 1;
    else if (absentLike(status)) absent += 1;
    else if (excusedLike(status)) excused += 1;
    else if (status) absent += 1;
  }
  return {
    teacher,
    present,
    late,
    absent,
    excused,
    worked: present + late,
    recorded: records.length,
    records,
  };
}

export function teacherAttendanceSummaries(store: HirayaDatabase, month: string): TeacherAttendanceSummary[] {
  return staffTeachers(store)
    .map((teacher) => teacherAttendanceSummary(store, teacher, month))
    .sort((a, b) => teacherLabel(a.teacher).localeCompare(teacherLabel(b.teacher), undefined, { sensitivity: 'base' }));
}

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function teacherDayAttendance(store: HirayaDatabase, teacherId: string, date = todayKey()) {
  const id = (teacherId || '').trim();
  const day = (date || '').slice(0, 10);
  return (store.attendance || []).find(
    (row) =>
      isTeacherAttendanceRow(row) &&
      (row.employeeId || '').trim() === id &&
      row.attendanceDate === day,
  );
}

export function isTeacherOnSite(store: HirayaDatabase, teacherId: string, date = todayKey()) {
  return presentLike(teacherDayAttendance(store, teacherId, date)?.status);
}

export function markTeacherAttendance(
  store: HirayaDatabase,
  teacherId: string,
  status: 'present' | 'absent' | 'excused' | 'late',
  recordedBy: string,
  date = todayKey(),
  notes = '',
) {
  const label =
    status === 'present'
      ? 'Confirmed on site by admin'
      : status === 'absent'
        ? 'Marked absent by admin'
        : status === 'excused'
          ? 'Marked excused by admin'
          : 'Marked late by admin';
  return upsertTeacherAttendanceDay(store, teacherId, date, status, recordedBy, notes || label);
}

export function upsertTeacherAttendanceDay(
  store: HirayaDatabase,
  teacherId: string,
  attendanceDate: string,
  status: string,
  recordedBy: string,
  notes = '',
): HirayaDatabase {
  const day = (attendanceDate || '').slice(0, 10);
  if (!day) throw new Error('Date is required.');
  if (isTeacherSalaryMonthPaid(store, day.slice(0, 7))) {
    throw new Error('Salary for that month is already paid. Open the next month to keep marking attendance.');
  }
  const teacher = staffTeachers(store).find((item) => item.userId === teacherId);
  if (!teacher) throw new Error('Teacher or staff account not found.');
  const existing = (store.attendance || []).find(
    (row) =>
      isTeacherAttendanceRow(row) &&
      row.employeeId === teacherId &&
      row.attendanceDate === day,
  );
  const now = new Date().toISOString();
  const nextStatus = (status || 'present').trim() || 'present';
  if (existing) {
    return {
      ...store,
      attendance: (store.attendance || []).map((row) =>
        row.attendanceId === existing.attendanceId
          ? {
              ...row,
              kind: 'employee',
              status: nextStatus,
              notes: notes.trim() || row.notes,
              recordedBy: recordedBy || row.recordedBy,
              timeIn: presentLike(nextStatus) ? row.timeIn || now : row.timeIn || '',
            }
          : row,
      ),
    };
  }
  const record: AttendanceRecord = {
    attendanceId: newId('att'),
    kind: 'employee',
    studentId: '',
    employeeId: teacherId,
    classId: '',
    qrCode: '',
    timeIn: presentLike(nextStatus) ? now : '',
    timeOut: null,
    attendanceDate: day,
    status: nextStatus,
    notes: notes.trim(),
    recordedBy,
  };
  return { ...store, attendance: [record, ...(store.attendance || [])] };
}

function daysInMonth(month: string) {
  const [yearRaw, monthRaw] = month.slice(0, 7).split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw);
  if (!year || !monthIndex) return 31;
  return new Date(year, monthIndex, 0).getDate();
}

function wholeCount(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || Math.floor(value) !== value) {
    throw new Error(`${label} must be a whole number, 0 or more.`);
  }
  return value;
}

/** Rewrite this teacher's month so the summary counts match. Earlier dates are kept. */
export function setTeacherMonthAttendanceCounts(
  store: HirayaDatabase,
  teacherId: string,
  month: string,
  counts: { worked: number; absent: number; excused: number },
  recordedBy: string,
): HirayaDatabase {
  const key = (month || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(key)) throw new Error('Choose a valid month first.');
  if (isTeacherSalaryMonthPaid(store, key)) {
    throw new Error('Salary for that month is already paid. Open the next month to keep editing attendance.');
  }
  const teacher = staffTeachers(store).find((item) => item.userId === teacherId);
  if (!teacher) throw new Error('Teacher or staff account not found.');

  const worked = wholeCount(counts.worked, 'Days worked');
  const absent = wholeCount(counts.absent, 'Absent');
  const excused = wholeCount(counts.excused, 'Excused');
  const total = worked + absent + excused;
  const capacity = daysInMonth(key);
  if (total > capacity) {
    throw new Error(`That month only has ${capacity} days. Lower the counts so they fit.`);
  }

  const existing = teacherAttendanceInMonth(store, teacherId, key)
    .slice()
    .sort((a, b) => (a.attendanceDate || '').localeCompare(b.attendanceDate || ''));
  const used = new Set(existing.map((row) => row.attendanceDate));
  const dates = existing.map((row) => row.attendanceDate);
  for (let day = 1; dates.length < total && day <= capacity; day += 1) {
    const date = `${key}-${String(day).padStart(2, '0')}`;
    if (used.has(date)) continue;
    dates.push(date);
    used.add(date);
  }

  const chosen = dates.slice(0, total);
  const byDate = new Map(existing.map((row) => [row.attendanceDate, row]));
  const now = new Date().toISOString();
  const nextRecords: AttendanceRecord[] = chosen.map((date, index) => {
    const status = index < worked ? 'present' : index < worked + absent ? 'absent' : 'excused';
    const prior = byDate.get(date);
    if (prior) {
      return {
        ...prior,
        kind: 'employee',
        employeeId: teacherId,
        status,
        recordedBy: recordedBy || prior.recordedBy,
        timeIn: status === 'present' ? prior.timeIn || now : prior.timeIn || '',
      };
    }
    return {
      attendanceId: newId('att'),
      kind: 'employee',
      studentId: '',
      employeeId: teacherId,
      classId: '',
      qrCode: '',
      timeIn: status === 'present' ? now : '',
      timeOut: null,
      attendanceDate: date,
      status,
      notes: 'Adjusted from the attendance summary',
      recordedBy,
    };
  });

  const drop = new Set(existing.map((row) => row.attendanceId));
  const kept = (store.attendance || []).filter((row) => !drop.has(row.attendanceId));
  return { ...store, attendance: [...nextRecords, ...kept] };
}

export function teacherSalaryMonthRef(month: string) {
  return `salary-month:${(month || '').slice(0, 7)}`;
}

export function isTeacherSalaryMonthPaid(store: HirayaDatabase, month: string) {
  const ref = teacherSalaryMonthRef(month);
  return (store.payments || []).some(
    (row) =>
      (row.enrollmentId || '').trim().toLowerCase() === TEACHER_PAYMENT_MARK &&
      (row.referenceNumber || '').trim() === ref &&
      (row.paymentStatus || '').toLowerCase() === 'paid',
  );
}

export function nextAttendanceMonth(month: string) {
  const key = (month || todayKey()).slice(0, 7);
  const [yearRaw, monthRaw] = key.split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw);
  if (!year || !monthIndex) return todayKey().slice(0, 7);
  const next = new Date(year, monthIndex, 1);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Close the month after teachers get salary — counts stay in history, next month starts fresh. */
export function markTeacherSalaryMonthPaid(
  store: HirayaDatabase,
  month: string,
  recordedBy: string,
): { store: HirayaDatabase; nextMonth: string } {
  const key = (month || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(key)) throw new Error('Choose a valid month first.');
  if (isTeacherSalaryMonthPaid(store, key)) {
    return { store, nextMonth: nextAttendanceMonth(key) };
  }
  const summaries = teacherAttendanceSummaries(store, key);
  const worked = summaries.reduce((sum, row) => sum + row.worked, 0);
  const marker: Payment = {
    paymentId: newId('pay'),
    enrollmentId: TEACHER_PAYMENT_MARK,
    studentId: '',
    amount: 0,
    amountPaid: 0,
    paymentMethod: 'salary',
    paymentStatus: 'paid',
    referenceNumber: teacherSalaryMonthRef(key),
    paymentDate: todayKey(),
    dueAt: '',
    paidAt: new Date().toISOString(),
    recordedBy,
    receivedBy: '',
    notes: `Teacher salary paid for ${key}. Attendance worked days logged: ${worked}. Next month starts fresh.`,
    history: [],
  };
  return {
    store: { ...store, payments: [marker, ...(store.payments || [])] },
    nextMonth: nextAttendanceMonth(key),
  };
}
