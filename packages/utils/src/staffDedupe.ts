import type { HirayaDatabase, HirayaUser } from '@hiraya/types';

function isStaffRole(role?: string | null) {
  const value = (role || '').toLowerCase();
  return value === 'teacher' || value === 'staff';
}

export function staffDisplayName(user: Pick<HirayaUser, 'fullname' | 'firstName' | 'lastName' | 'userId'>) {
  const full = (user.fullname || '').trim();
  if (full) return full;
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.userId;
}

export function normalizeStaffName(value?: string | null) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeStaffEmail(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

/** Stable identity for duplicate detection among teachers/staff (case-insensitive name). */
export function staffIdentityKey(user: HirayaUser) {
  const name = normalizeStaffName(staffDisplayName(user));
  const email = normalizeStaffEmail(user.email);
  // Same person if name matches; email is an extra signal when present.
  return name ? `name:${name}` : email ? `email:${email}` : `id:${user.userId}`;
}

function titleCaseScore(name: string) {
  const parts = name.trim().split(/\s+/);
  if (!parts.length) return 0;
  let score = 0;
  for (const part of parts) {
    if (/^[A-Z][a-z'’-]*$/.test(part)) score += 2;
    else if (/^[a-z]+$/.test(part)) score -= 1;
    else if (part) score += 1;
  }
  return score;
}

function preferStaffUser(a: HirayaUser, b: HirayaUser) {
  const aActive = (a.status || '').toLowerCase() === 'active' ? 1 : 0;
  const bActive = (b.status || '').toLowerCase() === 'active' ? 1 : 0;
  if (aActive !== bActive) return aActive > bActive ? a : b;
  const aName = staffDisplayName(a);
  const bName = staffDisplayName(b);
  const aCase = titleCaseScore(aName);
  const bCase = titleCaseScore(bName);
  if (aCase !== bCase) return aCase > bCase ? a : b;
  const aCreated = a.createdAt || '';
  const bCreated = b.createdAt || '';
  if (aCreated && bCreated && aCreated !== bCreated) return aCreated < bCreated ? a : b;
  return a.userId <= b.userId ? a : b;
}

function remapPackedIds(packed: string | null | undefined, fromId: string, toId: string) {
  if (!packed) return packed || '';
  const parts = packed
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part === fromId ? toId : part));
  return [...new Set(parts)].join(',');
}

function rewriteStaffId(store: HirayaDatabase, fromId: string, toId: string): HirayaDatabase {
  if (!fromId || !toId || fromId === toId) return store;
  return {
    ...store,
    users: (store.users || []).filter((user) => user.userId !== fromId),
  teacherProfiles: (() => {
    const rows = store.teacherProfiles || [];
    const keep = rows.find((row) => row.userId === toId);
    const from = rows.find((row) => row.userId === fromId);
    const others = rows.filter((row) => row.userId !== fromId && row.userId !== toId);
    if (keep) return [...others, keep];
    if (from) return [...others, { ...from, userId: toId }];
    return others;
  })(),
    attendance: (store.attendance || []).map((row) => ({
      ...row,
      employeeId: row.employeeId === fromId ? toId : row.employeeId,
      recordedBy: row.recordedBy === fromId ? toId : row.recordedBy,
    })),
    classes: (store.classes || []).map((row) => ({
      ...row,
      teacherId: row.teacherId === fromId ? toId : row.teacherId,
    })),
    schedules: (store.schedules || []).map((row) => ({
      ...row,
      teacherId: remapPackedIds(row.teacherId, fromId, toId),
    })),
    staffTasks: (store.staffTasks || []).map((row) => ({
      ...row,
      teacherIds: remapPackedIds(row.teacherIds, fromId, toId),
    })),
    reports: (store.reports || []).map((row) => ({
      ...row,
      teacherId: row.teacherId === fromId ? toId : row.teacherId,
    })),
    teacherComments: (store.teacherComments || []).map((row) => ({
      ...row,
      teacherId: row.teacherId === fromId ? toId : row.teacherId,
      createdBy: row.createdBy === fromId ? toId : row.createdBy,
    })),
    teacherNotes: (store.teacherNotes || []).map((row) => ({
      ...row,
      teacherId: row.teacherId === fromId ? toId : row.teacherId,
      createdBy: row.createdBy === fromId ? toId : row.createdBy,
    })),
    payments: (store.payments || []).map((row) => ({
      ...row,
      studentId: row.studentId === fromId ? toId : row.studentId,
      recordedBy: row.recordedBy === fromId ? toId : row.recordedBy,
    })),
    alerts: (store.alerts || []).map((row) => ({
      ...row,
      recipientId: row.recipientId === fromId ? toId : row.recipientId,
    })),
    chatGroups: (store.chatGroups || []).map((row) => ({
      ...row,
      memberIds: remapPackedIds(row.memberIds, fromId, toId),
      createdBy: row.createdBy === fromId ? toId : row.createdBy,
    })),
  };
}

export function findDuplicateStaffGroups(store: HirayaDatabase) {
  const groups = new Map<string, HirayaUser[]>();
  for (const user of store.users || []) {
    if (!isStaffRole(user.role)) continue;
    const key = staffIdentityKey(user);
    if (!key.endsWith(':')) {
      const list = groups.get(key) || [];
      list.push(user);
      groups.set(key, list);
    }
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

/** Collapse duplicate teacher/staff accounts (same email or same name when email missing). */
export function mergeDuplicateStaffUsers(store: HirayaDatabase): {
  store: HirayaDatabase;
  merged: number;
  keptIds: string[];
} {
  const groups = findDuplicateStaffGroups(store);
  if (!groups.length) return { store, merged: 0, keptIds: [] };
  let next = store;
  let merged = 0;
  const keptIds: string[] = [];
  for (const group of groups) {
    const keep = group.reduce((best, user) => preferStaffUser(best, user));
    keptIds.push(keep.userId);
    const display = staffDisplayName(keep);
    const titled =
      display === display.toLowerCase()
        ? display.replace(/\b\w/g, (ch) => ch.toUpperCase())
        : display;
    next = {
      ...next,
      users: (next.users || []).map((user) =>
        user.userId === keep.userId
          ? {
              ...user,
              fullname: titled,
              firstName: user.firstName || titled.split(/\s+/)[0] || '',
              lastName: user.lastName || titled.split(/\s+/).slice(-1)[0] || '',
            }
          : user,
      ),
    };
    for (const user of group) {
      if (user.userId === keep.userId) continue;
      next = rewriteStaffId(next, user.userId, keep.userId);
      merged += 1;
    }
  }
  return { store: next, merged, keptIds };
}

export function uniqueStaffTeachers(store: HirayaDatabase) {
  const chosen = new Map<string, HirayaUser>();
  for (const user of store.users || []) {
    if (!isStaffRole(user.role)) continue;
    const key = staffIdentityKey(user);
    const prev = chosen.get(key);
    if (!prev) chosen.set(key, user);
    else chosen.set(key, preferStaffUser(prev, user));
  }
  return [...chosen.values()].sort((a, b) =>
    staffDisplayName(a).localeCompare(staffDisplayName(b), undefined, { sensitivity: 'base' }),
  );
}
