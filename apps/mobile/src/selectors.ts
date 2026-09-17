import type { AttendanceRecord, HirayaDatabase, HirayaUser, ProgressReport, Schedule, Student } from '@hiraya/types';
import { displayName, studentDisplay } from '@hiraya/utils';
import { isMobileParent, isMobileTeacher } from './rbac';

export function greetingPeriod() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function greeting(name: string) {
  return `${greetingPeriod()}, ${name || 'there'}`;
}

function compactName(value: string) {
  return value.replace(/\s+/g, '').toLowerCase();
}

function splitCamelName(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function peelLastName(first: string, last: string) {
  const lastCompact = compactName(last);
  if (!lastCompact) return splitCamelName(first);
  const glued = compactName(first);
  if (glued === lastCompact) return splitCamelName(first);
  if (glued.endsWith(lastCompact) && glued.length > lastCompact.length) {
    return splitCamelName(first.slice(0, first.length - last.length));
  }
  return splitCamelName(first);
}

function titleCaseName(value: string) {
  return splitCamelName(value)
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** Greeting name: first + last with a space, never a glued username-style string. */
export function givenName(user?: HirayaUser | null) {
  const first = titleCaseName(user?.firstName || '');
  const last = titleCaseName(user?.lastName || '');
  const full = titleCaseName(user?.fullname || '');

  if (first && last) {
    const cleanedFirst = peelLastName(first, last);
    const named = titleCaseName(cleanedFirst);
    if (named && compactName(named) !== compactName(last)) {
      return `${named} ${last}`;
    }
    return last;
  }
  if (full.includes(' ')) return full;
  if (first.includes(' ')) return first;
  if (full && first && compactName(full) === compactName(first)) return first || full;
  return first || full || 'there';
}

export function eventTitle(item: Pick<Schedule, 'title' | 'kind' | 'scheduleType'>) {
  const raw = (item.title || '').trim();
  const kind = (item.kind || item.scheduleType || '').trim();
  if (raw && !/^(schedule|classsession|class session)$/i.test(raw.replace(/[_-]+/g, ' '))) {
    return titleCaseName(raw);
  }
  if (kind && !/task|classsession/i.test(kind.replace(/\s/g, ''))) {
    return titleCaseName(kind.replace(/([a-z])([A-Z])/g, '$1 $2'));
  }
  return 'Class session';
}

export function eventTimeRange(start?: string | null, end?: string | null) {
  const from = formatTime(start);
  if (!start || from === '—') return '';
  if (!end) return from;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isNaN(a) && !Number.isNaN(b) && Math.abs(b - a) < 60 * 1000) return from;
  const to = formatTime(end);
  if (!to || to === '—' || to === from) return from;
  return `${from} – ${to}`;
}

export function eventPlace(room?: string | null) {
  const value = (room || '').trim();
  if (!value || /^(tba|n\/a|none|-|—|location tba)$/i.test(value)) return '';
  return value;
}

export function todayAttendanceStatus(store: HirayaDatabase, studentId?: string) {
  if (!studentId) return 'No child linked';
  const day = todayKey();
  const row = store.attendance.find(
    (item) =>
      item.kind !== 'employee' &&
      item.studentId === studentId &&
      (item.attendanceDate || '').slice(0, 10) === day,
  );
  if (!row) return 'Not yet marked';
  const status = (row.status || 'Recorded').trim();
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function pendingAttendanceCount(store: HirayaDatabase, students: Student[]) {
  const day = todayKey();
  const marked = new Set(
    store.attendance
      .filter((item) => item.kind !== 'employee' && (item.attendanceDate || '').slice(0, 10) === day)
      .map((item) => item.studentId),
  );
  return students.filter((item) => !marked.has(item.studentId)).length;
}

export function nextHighlight(
  store: HirayaDatabase,
  student?: Student | null,
  teacherId?: string,
): { title: string; detail: string } {
  const now = new Date().toISOString();
  const upcoming = schedulesForDay(store, todayKey(), student, teacherId).find((item) => (item.startAt || '') >= now)
    || store.schedules
      .filter((item) => (item.startAt || '') >= now)
      .sort((a, b) => (a.startAt || '').localeCompare(b.startAt || ''))[0];
  if (upcoming) {
    return {
      title: eventTitle(upcoming),
      detail: `${eventTimeRange(upcoming.startAt, upcoming.endAt) || formatTime(upcoming.startAt)}${eventPlace(upcoming.room) ? ` · ${eventPlace(upcoming.room)}` : ''}`,
    };
  }
  const day = todayKey();
  const holiday = [...(store.centerHolidays || [])]
    .filter((item) => (item.date || '') >= day)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))[0];
  if (holiday) {
    return { title: holiday.title || 'School event', detail: holiday.date };
  }
  return { title: 'Open day', detail: 'No upcoming events posted' };
}

export function todayKey(value = new Date()) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const time = value.slice(11, 16);
    return time || value;
  }
  return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

export function formatWhen(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function friendlyError(error: unknown, fallback = 'We could not load this right now. Check your connection and try again.') {
  const message = error instanceof Error ? error.message : '';
  const lower = message.toLowerCase();
  if (lower.includes('teachers and parents only')) return message;
  if (lower.includes('unauthorized') || lower.includes('401')) return 'Please sign in again to continue.';
  if (lower.includes('invalid') || lower.includes('password') || lower.includes('sign-in') || lower.includes('credentials')) {
    return 'Username or password is incorrect.';
  }
  if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('timeout')) {
    return 'Connection looks unstable. Try again when you have a signal.';
  }
  if (message && message.length < 120 && !lower.includes('exception') && !lower.includes('sql')) return message;
  return fallback;
}

export function familyStudents(store: HirayaDatabase, user?: HirayaUser | null): Student[] {
  if (!user) return [];
  if (isMobileParent(user.role)) {
    const ids = new Set(
      store.parentStudents.filter((link) => link.parentId === user.userId && link.isActive).map((link) => link.studentId),
    );
    return store.students.filter((item) => ids.has(item.studentId) || item.parentId === user.userId);
  }
  if (isMobileTeacher(user.role)) {
    const classIds = new Set(store.classes.filter((item) => item.teacherId === user.userId).map((item) => item.classId));
    const studentIds = new Set(
      store.enrollments
        .filter(
          (item) =>
            ['active', 'pending', 'approved'].includes((item.status || '').toLowerCase()) &&
            (classIds.has(item.classId) || item.teacherId === user.userId),
        )
        .map((item) => item.studentId),
    );
    return store.students.filter((item) => studentIds.has(item.studentId));
  }
  return [];
}

export function classForStudent(store: HirayaDatabase, studentId?: string) {
  if (!studentId) return undefined;
  const enrollment = store.enrollments.find((item) => item.studentId === studentId && item.status === 'active');
  return store.classes.find((item) => item.classId === (enrollment?.classId || ''));
}

export function teacherName(store: HirayaDatabase, teacherId?: string) {
  const user = store.users.find((item) => item.userId === teacherId);
  return user ? displayName(user) : '';
}

export function schedulesForDay(store: HirayaDatabase, day: string, student?: Student | null, teacherId?: string): Schedule[] {
  const classId = student ? classForStudent(store, student.studentId)?.classId : undefined;
  const teacherClasses = teacherId
    ? new Set(store.classes.filter((item) => item.teacherId === teacherId).map((item) => item.classId))
    : null;
    return store.schedules
    .filter((item) => (item.startAt || '').slice(0, 10) === day)
    .filter((item) => {
      const kind = (item.kind || item.scheduleType || '').toLowerCase();
      const isTask = kind.includes('task');
      if (student) {
        if (isTask) return false;
        return item.studentId === student.studentId || (classId && item.classId === classId);
      }
      if (teacherClasses) return teacherClasses.has(item.classId) || item.teacherId === teacherId;
      return false;
    })
    .sort((a, b) => (a.startAt || '').localeCompare(b.startAt || ''));
}

export function attendanceForStudent(store: HirayaDatabase, studentId?: string): AttendanceRecord[] {
  return store.attendance
    .filter((item) => item.kind !== 'employee' && (!studentId || item.studentId === studentId))
    .sort((a, b) => (b.attendanceDate || '').localeCompare(a.attendanceDate || ''));
}

export function attendanceCounts(rows: AttendanceRecord[]) {
  const present = rows.filter((item) => (item.status || '').toLowerCase() === 'present').length;
  const absent = rows.filter((item) => (item.status || '').toLowerCase() === 'absent').length;
  const late = rows.filter((item) => (item.status || '').toLowerCase() === 'late').length;
  return { present, absent, late, total: rows.length };
}

export function ratingScore(rating?: string | null) {
  const raw = (rating || '').trim();
  const numeric = Number(raw.replace('%', ''));
  if (!Number.isNaN(numeric) && raw) {
    if (numeric <= 5) return Math.round(numeric * 20);
    return Math.max(0, Math.min(100, Math.round(numeric)));
  }
  const key = raw.toLowerCase();
  if (key.includes('excellent') || key.includes('outstanding')) return 95;
  if (key.includes('very good')) return 88;
  if (key.includes('good')) return 80;
  if (key.includes('satisfactory') || key.includes('average')) return 70;
  if (key.includes('developing') || key.includes('progress')) return 58;
  if (key.includes('emerging') || key.includes('begin')) return 45;
  if (key.includes('need')) return 35;
  return 0;
}

export function reportsForStudent(store: HirayaDatabase, studentId?: string): ProgressReport[] {
  return store.reports
    .filter((item) => !studentId || item.studentId === studentId)
    .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
}

export function overallProgress(reports: ProgressReport[]) {
  if (!reports.length) return 0;
  const scores = reports.map((item) => ratingScore(item.rating)).filter((item) => item > 0);
  if (!scores.length) return 0;
  return Math.round(scores.reduce((sum, item) => sum + item, 0) / scores.length);
}

export function studentLabel(student?: Student | null) {
  return student ? titleCaseName(studentDisplay(student)) : 'No student selected';
}

export function roleHomeTitle(role?: string) {
  if (isMobileTeacher(role)) return 'Teacher workspace';
  return 'Family workspace';
}

export function isTeacherTask(item: { kind?: string; scheduleType?: string }) {
  const kind = (item.kind || item.scheduleType || '').toLowerCase();
  return kind.includes('task');
}

export function teacherModules(store: HirayaDatabase, teacherId?: string) {
  const classIds = new Set(store.classes.filter((item) => item.teacherId === teacherId).map((item) => item.classId));
  return store.learningModules.filter((item) => {
    const status = (item.status || '').toLowerCase();
    if (status.includes('archive')) return false;
    const assigned = item.classIds || [];
    if (!assigned.length) return status.includes('publish') || !item.status;
    return assigned.some((id) => classIds.has(id));
  });
}

export function adminAnnouncements(store: HirayaDatabase) {
  const now = Date.now();
  return store.news
    .filter((item) => item.isPublished || item.status === 'published' || !item.status)
    .filter((item) => {
      if (item.status === 'archived') return false;
      if (!item.expiresAt) return true;
      const expires = new Date(item.expiresAt).getTime();
      return Number.isNaN(expires) || expires >= now;
    })
    .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
}

export function remainingForStudent(store: HirayaDatabase, studentId?: string) {
  if (!studentId) {
    return { sessionsLeft: 0, daysLeft: 0, used: 0, total: 0, sessionsLabel: 'No child linked', daysLabel: 'Not provided' };
  }
  const pack = (store.sessionPackages || [])
    .filter((item) => item.studentId === studentId && item.status !== 'suspended')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
  if (pack) {
    const remaining = Math.max(0, (pack.totalSessions || 0) - (pack.usedSessions || 0));
    return {
      sessionsLeft: remaining,
      daysLeft: remaining,
      used: pack.usedSessions || 0,
      total: pack.totalSessions || 0,
      sessionsLabel: remaining === 1 ? '1 session left' : `${remaining} sessions left`,
      daysLabel: pack.status.replace(/_/g, ' ') || 'Package',
      unit: 'session',
    };
  }
  const enrollment = store.enrollments.find(
    (item) => item.studentId === studentId && ['active', 'approved', 'enrolled'].includes((item.status || '').toLowerCase()),
  );
  const ops = store.studentOps.find((item) => item.studentId === studentId);
  const blob = `${ops?.package || ''} ${ops?.currentSlot || ''} ${enrollment?.period || ''}`;
  const packed = blob.match(/(\d+)\s*(session|class|day)/i);
  const used = store.attendance.filter(
    (item) =>
      item.studentId === studentId &&
      item.kind !== 'employee' &&
      ['present', 'late'].includes((item.status || '').toLowerCase()),
  ).length;
  const now = new Date().toISOString();
  const classId = enrollment?.classId;
  const upcoming = store.schedules.filter((item) => {
    if ((item.status || '').toLowerCase() === 'cancelled') return false;
    if ((item.startAt || '') < now) return false;
    if (isTeacherTask(item)) return false;
    const kind = (item.kind || '').toLowerCase();
    if (kind.includes('holiday') || kind.includes('deadline')) return false;
    return item.studentId === studentId || (!!classId && item.classId === classId);
  });
  const daysLeft = new Set(upcoming.map((item) => (item.startAt || '').slice(0, 10))).size;
  const packedCount = packed ? Number(packed[1]) : 0;
  const unit = (packed?.[2] || 'session').toLowerCase();
  const sessionsLeft = packedCount
    ? Math.max(0, packedCount - used)
    : upcoming.length;
  const total = packedCount || sessionsLeft + used;
  return {
    sessionsLeft,
    daysLeft,
    used,
    total,
    sessionsLabel: sessionsLeft === 1 ? '1 session left' : `${sessionsLeft} sessions left`,
    daysLabel: daysLeft === 1 ? '1 day left' : `${daysLeft} days left`,
    unit,
  };
}
