import type { HirayaDatabase, SessionPackage } from '@hiraya/types';

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function remainingSessions(totalSessions: number, usedSessions: number) {
  const total = Math.max(0, Number(totalSessions) || 0);
  const used = Math.min(total, Math.max(0, Number(usedSessions) || 0));
  return Math.max(0, total - used);
}

export function normalizeSessionPackage(row: SessionPackage, now = new Date().toISOString()): SessionPackage {
  const total = Math.max(0, Number(row.totalSessions) || 0);
  const used = Math.min(total, Math.max(0, Number(row.usedSessions) || 0));
  return {
    ...row,
    totalSessions: total,
    usedSessions: used,
    remainingSessions: remainingSessions(total, used),
    updatedAt: now,
  };
}

export function remainingSessionsFor(store: HirayaDatabase, studentId: string) {
  const packages = (store.sessionPackages || []).filter(
    (row) => row.studentId === studentId && row.status !== 'suspended',
  );
  if (!packages.length) return null;
  const latest = packages[packages.length - 1];
  return remainingSessions(latest.totalSessions, latest.usedSessions);
}

export function completeOneSession(
  store: HirayaDatabase,
  packageId: string,
  actorId = '',
  note = 'Completed from Session management',
): HirayaDatabase {
  const rows = store.sessionPackages || [];
  const current = rows.find((row) => row.packageId === packageId);
  if (!current) throw new Error('Session package was not found.');
  const remaining = remainingSessions(current.totalSessions, current.usedSessions);
  if (remaining <= 0) throw new Error('No remaining sessions.');
  const used = current.usedSessions + 1;
  const now = new Date().toISOString();
  return {
    ...store,
    sessionPackages: rows.map((item) =>
      item.packageId === packageId ? normalizeSessionPackage({ ...item, usedSessions: used }, now) : item,
    ),
    sessionHistory: [
      ...(store.sessionHistory || []),
      {
        historyId: newId('sh'),
        packageId,
        studentId: current.studentId,
        scheduleId: '',
        attendanceId: '',
        action: 'used',
        note,
        actorId,
        createdAt: now,
      },
    ],
  };
}
