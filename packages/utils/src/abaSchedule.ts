import type { HirayaDatabase, HirayaUser, Schedule, Student } from '@hiraya/types';
import { studentInLane, teacherInLane } from './managementLanes';

export const ABA_WEEK_KIND = 'abaWeek';
export const ABA_LANE = 'aba';

export type AbaSlotKind = 'session' | 'break';
export type AbaCellKind = 'empty' | 'session' | 'prep' | 'off' | 'break' | 'makeup';
export type AbaCellStatus = 'confirmed' | 'pending_approval' | 'approved' | 'off';

export type AbaSlot = {
  id: string;
  label: string;
  start: string;
  end: string;
  kind: AbaSlotKind;
};

export type AbaCell = {
  kind: AbaCellKind;
  studentId: string;
  notes: string;
  status: AbaCellStatus;
};

export const ABA_SLOTS: readonly AbaSlot[] = [
  { id: 'am1', label: '8:00 AM–10:00 AM', start: '08:00', end: '10:00', kind: 'session' },
  { id: 'brk1', label: '10:00–10:30 AM', start: '10:00', end: '10:30', kind: 'break' },
  { id: 'am2', label: '10:30 AM–12:30 PM', start: '10:30', end: '12:30', kind: 'session' },
  { id: 'brk2', label: '12:30–1:00 PM', start: '12:30', end: '13:00', kind: 'break' },
  { id: 'pm1', label: '1:00–3:00 PM', start: '13:00', end: '15:00', kind: 'session' },
  { id: 'pm2', label: '3:00–5:00 PM', start: '15:00', end: '17:00', kind: 'session' },
];

export const EMPTY_ABA_CELL: AbaCell = { kind: 'empty', studentId: '', notes: '', status: 'confirmed' };
export const BREAK_ABA_CELL: AbaCell = { kind: 'break', studentId: '', notes: 'BREAK / LUNCH\n30mins.', status: 'confirmed' };

function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateKey(value?: string) {
  const raw = (value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw) && !raw.includes('T')) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);
  return ymd(parsed);
}

function personName(user?: HirayaUser | null) {
  if (!user) return '';
  const assembled = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return assembled || (user.fullname || '').trim();
}

function childName(student?: Student | null) {
  if (!student) return '';
  if (student.fullname?.trim()) return student.fullname.trim();
  return [student.firstName, student.lastName].filter(Boolean).join(' ').trim();
}

function scheduleId() {
  return `sch_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function mondayOf(date = new Date()) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - offset);
  return day;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function abaWeekDates(monday: Date) {
  return Array.from({ length: 7 }, (_, index) => ymd(addDays(monday, index)));
}

export function abaWeekRangeLabel(monday: Date) {
  const end = addDays(monday, 6);
  if (monday.getMonth() === end.getMonth() && monday.getFullYear() === end.getFullYear()) {
    return `${monday.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()} ${monday.getDate()} to ${end.getDate()}`;
  }
  const startText = monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase();
  const endText = end.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase();
  return `${startText} to ${endText}`;
}

export function abaTherapistLabel(user?: HirayaUser | null) {
  const name = personName(user).trim();
  if (!name) return 'ABA THERAPY WEEKLY SCHEDULE';
  const first = name.split(/\s+/)[0] || name;
  const stamped = /^t\.?\s/i.test(first) ? first : `T. ${first}`;
  return `${stamped.toUpperCase()} – ABA THERAPY WEEKLY SCHEDULE`;
}

export function abaTherapists(store: HirayaDatabase) {
  const people = store.users.filter(
    (item) =>
      item.role === 'teacher' &&
      (item.status || 'active').toLowerCase() !== 'inactive' &&
      (item.status || '').toLowerCase() !== 'deactivated',
  );
  const inLane = people.filter((item) => teacherInLane(store, item.userId, ABA_LANE));
  return (inLane.length ? inLane : people).slice().sort((a, b) =>
    personName(a).localeCompare(personName(b), undefined, { sensitivity: 'base' }),
  );
}

export function abaStudents(store: HirayaDatabase) {
  const inLane = store.students.filter((item) => studentInLane(store, item, ABA_LANE));
  const rows = inLane.length ? inLane : store.students;
  return rows.slice().sort((a, b) => childName(a).localeCompare(childName(b), undefined, { sensitivity: 'base' }));
}

export function abaCellKey(day: string, slotId: string) {
  return `${day}|${slotId}`;
}

export function abaRoom(slotId: string) {
  return `aba:${slotId}`;
}

function parseCell(row: Schedule): AbaCell {
  const type = (row.scheduleType || '').toLowerCase();
  if (type === 'break' || (row.title || '').toLowerCase().includes('break')) {
    return { ...BREAK_ABA_CELL, notes: row.notes || BREAK_ABA_CELL.notes };
  }
  if (type === 'off' || (row.title || '').toLowerCase() === 'off') {
    return { kind: 'off', studentId: '', notes: row.notes || '', status: 'off' };
  }
  if (type === 'prep' || (row.title || '').toUpperCase().includes('ABA PREP')) {
    return { kind: 'prep', studentId: '', notes: row.notes || '', status: (row.status as AbaCellStatus) || 'confirmed' };
  }
  const pending = (row.status || '').toLowerCase().includes('pending');
  const approved = (row.status || '').toLowerCase() === 'approved';
  if (type === 'makeup' || pending || approved) {
    return {
      kind: 'makeup',
      studentId: row.studentId || '',
      notes: row.notes || '',
      status: pending ? 'pending_approval' : 'approved',
    };
  }
  return {
    kind: row.studentId ? 'session' : 'empty',
    studentId: row.studentId || '',
    notes: row.notes || '',
    status: 'confirmed',
  };
}

export function readAbaWeek(store: HirayaDatabase, teacherId: string, monday: Date) {
  const days = abaWeekDates(monday);
  const cells: Record<string, AbaCell> = {};
  for (const day of days) {
    for (const slot of ABA_SLOTS) {
      cells[abaCellKey(day, slot.id)] = slot.kind === 'break' ? { ...BREAK_ABA_CELL } : { ...EMPTY_ABA_CELL };
    }
  }
  for (const row of store.schedules || []) {
    if (row.kind !== ABA_WEEK_KIND || row.teacherId !== teacherId || row.status === 'cancelled') continue;
    const day = dateKey(row.startAt);
    if (!days.includes(day)) continue;
    const slotId = (row.room || '').startsWith('aba:') ? row.room.slice(4) : '';
    if (!slotId || !cells[abaCellKey(day, slotId)]) continue;
    cells[abaCellKey(day, slotId)] = parseCell(row);
  }
  return cells;
}

function cellTitle(cell: AbaCell, student?: Student | null) {
  if (cell.kind === 'break') return 'BREAK / LUNCH';
  if (cell.kind === 'off') return 'OFF';
  if (cell.kind === 'prep') return 'ABA PREP';
  const name = childName(student);
  if (cell.kind === 'makeup') return name ? `${name} MAKE UP` : 'MAKE UP';
  return name ? `${name} ABA (2hrs)` : 'ABA (2hrs)';
}

function cellStatus(cell: AbaCell): AbaCellStatus {
  if (cell.kind === 'off') return 'off';
  if (cell.kind === 'makeup') return cell.status === 'approved' ? 'approved' : 'pending_approval';
  return 'confirmed';
}

export function writeAbaWeek(store: HirayaDatabase, teacherId: string, monday: Date, cells: Record<string, AbaCell>): Schedule[] {
  const days = abaWeekDates(monday);
  const kept = (store.schedules || []).filter((row) => {
    if (row.kind !== ABA_WEEK_KIND || row.teacherId !== teacherId) return true;
    return !days.includes(dateKey(row.startAt));
  });
  const prior = (store.schedules || []).filter(
    (row) => row.kind === ABA_WEEK_KIND && row.teacherId === teacherId && days.includes(dateKey(row.startAt)),
  );
  const added: Schedule[] = [];
  for (const day of days) {
    for (const slot of ABA_SLOTS) {
      const cell = cells[abaCellKey(day, slot.id)] || (slot.kind === 'break' ? BREAK_ABA_CELL : EMPTY_ABA_CELL);
      if (cell.kind === 'empty' || cell.kind === 'break') continue;
      const student = store.students.find((item) => item.studentId === cell.studentId);
      const existing = prior.find((row) => dateKey(row.startAt) === day && row.room === abaRoom(slot.id));
      added.push({
        scheduleId: existing?.scheduleId || scheduleId(),
        title: cellTitle(cell, student),
        kind: ABA_WEEK_KIND,
        scheduleType: cell.kind,
        classId: '',
        studentId: cell.studentId || '',
        teacherId,
        programId: student?.program || ABA_LANE,
        startAt: `${day}T${slot.start}:00`,
        endAt: `${day}T${slot.end}:00`,
        room: abaRoom(slot.id),
        notes: cell.notes || '',
        status: cellStatus(cell),
      });
    }
  }
  return [...kept, ...added];
}

export function abaCellTone(cell: AbaCell, slotKind: string) {
  if (slotKind === 'break' || cell.kind === 'break') return 'break';
  if (cell.kind === 'off') return 'off';
  if (cell.kind === 'prep') return 'prep';
  if (cell.kind === 'makeup' && cell.status === 'approved') return 'approved';
  if (cell.kind === 'makeup') return 'pending';
  if (cell.kind === 'session') return 'session';
  return 'empty';
}

export function abaCellLines(cell: AbaCell, studentName: string) {
  if (cell.kind === 'break') return ['BREAK / LUNCH', '30mins.'];
  if (cell.kind === 'off') return ['OFF'];
  if (cell.kind === 'prep') return ['ABA PREP'];
  if (cell.kind === 'makeup') {
    return [studentName || 'MAKE UP', ...(cell.notes ? cell.notes.split('\n') : []), cell.status === 'approved' ? 'Approved' : 'FOR APPROVAL'].filter(
      Boolean,
    );
  }
  if (cell.kind === 'session' && studentName) return [studentName, 'ABA (2hrs)'];
  return [];
}

export function abaWeekdayLabel(day: string) {
  const date = new Date(`${day}T12:00:00`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}
