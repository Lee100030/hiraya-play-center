import type { HirayaDatabase, StaffTask } from '@hiraya/types';

function personName(user?: { fullname?: string; firstName?: string; lastName?: string } | null) {
  if (!user) return '';
  const assembled = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return assembled || (user.fullname || '').trim();
}

const LIVE_ENROLLMENT = new Set(['active', 'pending', 'approved', 'pending_review', 'enrolled']);

function sameId(left?: string | null, right?: string | null) {
  return (left || '').trim().toLowerCase() === (right || '').trim().toLowerCase() && !!(left || '').trim();
}

function liveEnrollment(status?: string | null) {
  const value = (status || '').trim().toLowerCase();
  return !value || LIVE_ENROLLMENT.has(value);
}

export function packedTeacherIds(packed?: string | null) {
  return (packed || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function hasTeacher(packed: string | null | undefined, teacherId: string) {
  const want = (teacherId || '').trim().toLowerCase();
  if (!want) return false;
  return packedTeacherIds(packed).some((id) => id.toLowerCase() === want);
}

export function scheduleAssignedTo(schedule: { teacherId?: string }, teacherId?: string) {
  if (!teacherId) return false;
  return packedTeacherIds(schedule.teacherId).some((id) => sameId(id, teacherId));
}

export function staffTaskKey(task: Pick<StaffTask, 'title' | 'teacherIds' | 'dueAt' | 'status'>) {
  const title = (task.title || '').trim().toLowerCase();
  const teachers = packedTeacherIds(task.teacherIds)
    .map((id) => id.toLowerCase())
    .sort()
    .join(',');
  const due = (task.dueAt || '').slice(0, 10);
  const status = (task.status || '').trim().toLowerCase();
  return `${title}|${teachers}|${due}|${status}`;
}

/** Keep the first open copy when a double-click assigned the same task twice. */
export function collapseDuplicateStaffTasks(tasks: StaffTask[]) {
  const seen = new Set<string>();
  const kept: StaffTask[] = [];
  const sorted = [...tasks].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  for (const task of sorted) {
    const closed = ['completed', 'cancelled'].includes((task.status || '').toLowerCase());
    const key = staffTaskKey(task);
    if (!closed && seen.has(key)) continue;
    if (!closed) seen.add(key);
    kept.push(task);
  }
  return kept;
}

export function openTaskCountForTeacher(store: HirayaDatabase, teacherId: string) {
  return (store.staffTasks || []).filter((item) => {
    const assigned = (item.teacherIds || '')
      .split(',')
      .map((id) => id.trim())
      .includes(teacherId);
    if (!assigned) return false;
    return !['completed', 'cancelled'].includes((item.status || '').toLowerCase());
  }).length;
}

export function assignedStudentsForTeacher(store: HirayaDatabase, teacherId: string) {
  const want = (teacherId || '').trim();
  if (!want) return [];
  const classIds = new Set(
    (store.classes || [])
      .filter((item) => hasTeacher(item.teacherId, want))
      .map((item) => item.classId),
  );
  const ids = new Set(
    (store.enrollments || [])
      .filter(
        (row) =>
          liveEnrollment(row.status) &&
          (hasTeacher(row.teacherId, want) || classIds.has(row.classId)),
      )
      .map((row) => row.studentId),
  );
  return store.students.filter((student) => ids.has(student.studentId));
}

/** Teachers linked to the given students via enrollment or class assignment. */
export function teachersForStudents(store: HirayaDatabase, studentIds: string[]) {
  const allowed = new Set((studentIds || []).map((id) => (id || '').trim()).filter(Boolean));
  if (!allowed.size) return [];
  const teacherIds = new Set<string>();
  for (const row of store.enrollments || []) {
    if (!allowed.has(row.studentId)) continue;
    if (!liveEnrollment(row.status)) continue;
    for (const id of packedTeacherIds(row.teacherId)) teacherIds.add(id);
    const cls = store.classes.find((item) => item.classId === row.classId);
    if (cls?.teacherId) teacherIds.add(cls.teacherId);
  }
  for (const schedule of store.schedules || []) {
    if (schedule.studentId && allowed.has(schedule.studentId)) {
      for (const id of packedTeacherIds(schedule.teacherId)) teacherIds.add(id);
    }
  }
  return store.users
    .filter((user) => {
      if (!teacherIds.has(user.userId)) return false;
      const role = (user.role || '').toLowerCase();
      if (role !== 'teacher' && role !== 'staff') return false;
      const status = (user.status || 'active').toLowerCase();
      return status === 'active' || status === 'pending';
    })
    .sort((a, b) => personName(a).localeCompare(personName(b), undefined, { sensitivity: 'base' }));
}

export function programsForTeacher(store: HirayaDatabase, teacherId: string) {
  const ids = new Set(
    store.classes
      .filter((row) => row.teacherId === teacherId)
      .map((row) => row.programId)
      .concat(store.enrollments.filter((row) => row.teacherId === teacherId).map((row) => row.programId)),
  );
  return store.programs.filter((row) => ids.has(row.programId));
}

export function liveEnrollmentForStudent(store: HirayaDatabase, studentId: string) {
  const id = (studentId || '').trim();
  if (!id) return undefined;
  const rows = (store.enrollments || []).filter((row) => sameId(row.studentId, id));
  return rows.find((row) => liveEnrollment(row.status)) || rows[0];
}

export function classForStudent(store: HirayaDatabase, studentId?: string) {
  const enrollment = liveEnrollmentForStudent(store, studentId || '');
  if (!enrollment?.classId) return undefined;
  return store.classes.find((item) => item.classId === enrollment.classId);
}

export function teacherIdForStudent(store: HirayaDatabase, studentId?: string) {
  const enrollment = liveEnrollmentForStudent(store, studentId || '');
  const fromEnrollment = packedTeacherIds(enrollment?.teacherId)[0] || '';
  if (fromEnrollment) return fromEnrollment;
  return (classForStudent(store, studentId)?.teacherId || '').trim();
}

export function teacherForStudent(store: HirayaDatabase, studentId?: string) {
  const teacherId = teacherIdForStudent(store, studentId);
  if (!teacherId) return undefined;
  return store.users.find((item) => sameId(item.userId, teacherId));
}

export function studentPlacement(store: HirayaDatabase, studentId: string) {
  const enrollment = liveEnrollmentForStudent(store, studentId);
  const cls = classForStudent(store, studentId);
  const program =
    (enrollment && store.programs.find((item) => item.programId === enrollment.programId)?.name) ||
    (cls && store.programs.find((item) => item.programId === cls.programId)?.name) ||
    '';
  const teacher = teacherForStudent(store, studentId);
  return {
    classId: cls?.classId || enrollment?.classId || '',
    className: cls?.name || '',
    programName: program,
    teacherName: teacher ? personName(teacher) : '',
    enrollmentStatus: enrollment?.status || '',
  };
}
