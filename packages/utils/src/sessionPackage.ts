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

function sameStudent(rowId: string, studentId: string) {
  return (rowId || '').trim().toLowerCase() === (studentId || '').trim().toLowerCase();
}

function packageStatus(status: string | undefined) {
  return (status || '').trim().toLowerCase();
}

/** The one package that counts for a student: newest non-suspended row. */
export function studentSessionPackage(store: HirayaDatabase, studentId: string): SessionPackage | null {
  const rows = (store.sessionPackages || []).filter(
    (row) => sameStudent(row.studentId, studentId) && packageStatus(row.status) !== 'suspended',
  );
  if (!rows.length) return null;
  return [...rows].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))[rows.length - 1];
}

export function studentSessionAccount(store: HirayaDatabase, studentId: string) {
  const row = studentSessionPackage(store, studentId);
  if (!row) return { remaining: 0, total: 0, used: 0, hasPackage: false as const, packageId: '' };
  const total = Math.max(0, Number(row.totalSessions) || 0);
  const used = Math.min(total, Math.max(0, Number(row.usedSessions) || 0));
  const stored = Math.max(0, Number(row.remainingSessions) || 0);
  const remaining = total > 0 ? remainingSessions(total, used) : stored;
  return {
    remaining,
    total: total > 0 ? total : remaining,
    used: total > 0 ? used : 0,
    hasPackage: true as const,
    packageId: row.packageId,
  };
}

export function remainingSessionsFor(store: HirayaDatabase, studentId: string) {
  const account = studentSessionAccount(store, studentId);
  return account.hasPackage ? account.remaining : null;
}

function statusAfterUse(remaining: number) {
  if (remaining <= 0) return 'completed';
  if (remaining <= 2) return 'almost_finished';
  return 'active';
}

/** Keep a single package row for this student and drop any other balances. */
export function placeStudentSessionPackage(store: HirayaDatabase, next: SessionPackage): HirayaDatabase {
  const normalized = normalizeSessionPackage(next);
  const rows = (store.sessionPackages || []).filter((row) => !sameStudent(row.studentId, normalized.studentId));
  return { ...store, sessionPackages: [...rows, normalized] };
}

/**
 * Use one session from the student's package.
 * The same attendance id cannot use a second session.
 */
export function useOneSession(
  store: HirayaDatabase,
  studentId: string,
  actorId = '',
  note = 'Session used',
  attendanceId = '',
): HirayaDatabase {
  if (
    attendanceId &&
    (store.sessionHistory || []).some(
      (row) => row.attendanceId === attendanceId && (row.action || '').toLowerCase() === 'used',
    )
  ) {
    return store;
  }
  const current = studentSessionPackage(store, studentId);
  if (!current) return store;
  const status = packageStatus(current.status);
  if (status === 'completed' || status === 'expired') return store;
  const account = studentSessionAccount(store, studentId);
  if (!account.hasPackage || account.remaining <= 0) return store;
  const total = Math.max(account.total, account.remaining);
  const used = account.used + 1;
  const now = new Date().toISOString();
  const nextRemaining = remainingSessions(total, used);
  return placeStudentSessionPackage(
    {
      ...store,
      sessionHistory: [
        ...(store.sessionHistory || []),
        {
          historyId: newId('sh'),
          packageId: current.packageId,
          studentId: current.studentId,
          scheduleId: '',
          attendanceId,
          action: 'used',
          note,
          actorId,
          createdAt: now,
        },
      ],
    },
    normalizeSessionPackage(
      { ...current, totalSessions: total, usedSessions: used, status: statusAfterUse(nextRemaining) },
      now,
    ),
  );
}

export function upsertStudentSessions(
  store: HirayaDatabase,
  studentId: string,
  remainingInput: number | string,
  totalInput: number | string,
  programId = '',
): HirayaDatabase {
  const remaining = Math.max(0, Number(remainingInput) || 0);
  const total = Math.max(remaining, Math.max(0, Number(totalInput) || 0));
  const latest = studentSessionPackage(store, studentId);
  if (total <= 0) return store;
  const now = new Date().toISOString();
  const next = normalizeSessionPackage({
    packageId: latest?.packageId || newId('pkg'),
    studentId,
    programId: programId || latest?.programId || '',
    totalSessions: total,
    usedSessions: Math.max(0, total - remaining),
    remainingSessions: remaining,
    startDate: latest?.startDate || now.slice(0, 10),
    expirationDate: latest?.expirationDate || '',
    status: latest && packageStatus(latest.status) === 'completed' ? 'active' : latest?.status || 'active',
    createdAt: latest?.createdAt || now,
    updatedAt: now,
  });
  return placeStudentSessionPackage(store, next);
}

export function completeOneSession(
  store: HirayaDatabase,
  packageId: string,
  actorId = '',
  note = 'Completed from Session management',
): HirayaDatabase {
  const current = (store.sessionPackages || []).find((row) => row.packageId === packageId);
  if (!current) throw new Error('Session package was not found.');
  const canonical = studentSessionPackage(store, current.studentId);
  if (!canonical || canonical.packageId !== current.packageId) {
    throw new Error('That package is not this student’s current session balance.');
  }
  const before = studentSessionAccount(store, current.studentId).remaining;
  if (before <= 0) throw new Error('No remaining sessions.');
  const next = useOneSession(store, current.studentId, actorId, note);
  if (studentSessionAccount(next, current.studentId).remaining === before) {
    throw new Error('No remaining sessions.');
  }
  return next;
}
