import type { HirayaDatabase } from '@hiraya/types';

function personName(user?: { fullname?: string; firstName?: string; lastName?: string } | null) {
  if (!user) return '';
  const assembled = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return assembled || (user.fullname || '').trim();
}

const LIVE_ENROLLMENT = new Set(['active', 'pending', 'approved']);

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
