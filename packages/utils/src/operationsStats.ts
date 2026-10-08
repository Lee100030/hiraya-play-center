import type { HirayaDatabase } from '@hiraya/types';
import { sessionPackageStats } from './sessionPackage';

export function isTeacherApplication(row: { applicationKind?: string | null }) {
  return (row.applicationKind || '').toLowerCase() === 'teacher';
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function operationsStats(store: HirayaDatabase) {
  const today = todayKey();
  const activeStudents = store.students.filter((row) => row.status === 'active');
  const activeTeachers = store.users.filter((row) => row.role === 'teacher' && row.status === 'active');
  const parents = store.users.filter((row) => row.role === 'parent');
  const classes = store.classes.filter((row) => row.status !== 'archived' && row.status !== 'inactive');
  const learnerApplications = store.enrollmentApplications.filter((row) => !isTeacherApplication(row));
  const pendingEnrollments = learnerApplications.filter((row) =>
    ['pending', 'pending_review'].includes((row.status || '').toLowerCase()),
  );
  const approvedEnrollments = learnerApplications.filter((row) =>
    ['approved', 'enrolled'].includes((row.status || '').toLowerCase()),
  );
  const pendingTeacherApplications = store.enrollmentApplications.filter(
    (row) =>
      isTeacherApplication(row) && ['pending', 'pending_review'].includes((row.status || '').toLowerCase()),
  );
  const todayClasses = store.schedules.filter(
    (row) => row.kind !== 'teacherTask' && (row.startAt || '').slice(0, 10) === today && row.status !== 'cancelled',
  );
  const upcomingClasses = store.schedules.filter(
    (row) =>
      row.kind !== 'teacherTask' &&
      row.status !== 'cancelled' &&
      !!row.startAt &&
      row.startAt.slice(0, 10) > today,
  );
  const pendingTasks = (store.staffTasks || []).filter((row) => !['completed', 'cancelled'].includes(row.status));
  const sessionPackages = sessionPackageStats(store);
  return {
    totalStudents: activeStudents.length,
    activeTeachers: activeTeachers.length,
    parents: parents.length,
    totalClasses: classes.length,
    pendingEnrollments: pendingEnrollments.length,
    pendingTeacherApplications: pendingTeacherApplications.length,
    approvedEnrollments: approvedEnrollments.length,
    todayClasses: todayClasses.length,
    upcomingClasses: upcomingClasses.length,
    pendingTasks: pendingTasks.length,
    sessionPackages: sessionPackages.total,
    activeSessionPackages: sessionPackages.active,
    notifications: store.alerts.filter(
      (row) => (row.kind || '').toLowerCase() !== 'direct' && !row.read && row.status !== 'read',
    ).length,
  };
}
