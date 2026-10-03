import type { HirayaDatabase } from '@hiraya/types';

function personName(user?: { fullname?: string; firstName?: string; lastName?: string } | null) {
  if (!user) return '';
  const assembled = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return assembled || (user.fullname || '').trim();
}

const LIVE_ENROLLMENT = new Set(['active', 'pending', 'approved']);

export function packedTeacherIds(packed?: string | null) {
  return (packed || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export function scheduleAssignedTo(schedule: { teacherId?: string }, teacherId?: string) {
  if (!teacherId) return false;
  return packedTeacherIds(schedule.teacherId).includes(teacherId);
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
  const ids = new Set(
    store.enrollments
      .filter(
        (row) =>
          LIVE_ENROLLMENT.has((row.status || '').toLowerCase()) &&
          (row.teacherId === teacherId ||
            store.classes.some((item) => item.classId === row.classId && item.teacherId === teacherId)),
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
    if (!LIVE_ENROLLMENT.has((row.status || '').toLowerCase())) continue;
    if (row.teacherId) teacherIds.add(row.teacherId);
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

export function studentPlacement(store: HirayaDatabase, studentId: string) {
  const enrollment =
    store.enrollments.find(
      (row) => row.studentId === studentId && LIVE_ENROLLMENT.has((row.status || '').toLowerCase()),
    ) || store.enrollments.find((row) => row.studentId === studentId);
  const cls = enrollment ? store.classes.find((item) => item.classId === enrollment.classId) : undefined;
  const program =
    (enrollment && store.programs.find((item) => item.programId === enrollment.programId)?.name) ||
    (cls && store.programs.find((item) => item.programId === cls.programId)?.name) ||
    '';
  const teacherId = enrollment?.teacherId || cls?.teacherId || '';
  return {
    classId: cls?.classId || enrollment?.classId || '',
    className: cls?.name || '',
    programName: program,
    teacherName: teacherId ? personName(store.users.find((item) => item.userId === teacherId)) : '',
    enrollmentStatus: enrollment?.status || '',
  };
}
