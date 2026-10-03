export const STORE_ROW_IDS: Record<string, string> = {
  users: 'userId',
  teacherProfiles: 'profileId',
  students: 'studentId',
  programs: 'programId',
  classes: 'classId',
  enrollments: 'enrollmentId',
  enrollmentApplications: 'applicationId',
  attendance: 'attendanceId',
  reports: 'reportId',
  schedules: 'scheduleId',
  teacherWorkShifts: 'shiftId',
  teacherRoleOptions: 'roleId',
  news: 'newsId',
  leaveRequests: 'leaveId',
  payments: 'paymentId',
  centerExpenses: 'expenseId',
  openingBalances: 'openingId',
  alerts: 'alertId',
  auditLogs: 'auditId',
  rolePermissions: 'permissionId',
  roles: 'roleId',
  rooms: 'roomId',
  learningModules: 'moduleId',
  learningModuleVersions: 'versionId',
  parentStudents: 'parentStudentId',
  accountInvitations: 'invitationId',
  studentOps: 'studentId',
  centerHolidays: 'holidayId',
  teacherDuties: 'dutyId',
  websiteGallery: 'itemId',
  staffTasks: 'taskId',
  sessionPackages: 'packageId',
  sessionHistory: 'historyId',
  teacherComments: 'commentId',
  teacherNotes: 'noteId',
  studentDocuments: 'documentId',
  chatGroups: 'groupId',
};

type Row = Record<string, unknown>;

export type StorePatchBody = {
  collections: string[];
  upserts: Record<string, unknown>;
  deletes: Record<string, string[]>;
};

function rowId(row: Row, key: string) {
  return String(row[key] ?? '').trim();
}

function sameRow(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function deleteIds(deletes: Record<string, string[]> | undefined, name: string) {
  if (!deletes) return [];
  return deletes[name] || deletes[name.toLowerCase()] || [];
}

export function diffStore(base: Record<string, unknown>, next: Record<string, unknown>): StorePatchBody {
  const collections: string[] = [];
  const upserts: Record<string, unknown> = {};
  const deletes: Record<string, string[]> = {};

  for (const [name, idKey] of Object.entries(STORE_ROW_IDS)) {
    const before = base[name];
    const after = next[name];
    if (!Array.isArray(before) || !Array.isArray(after)) continue;
    const beforeRows = before as Row[];
    const afterRows = after as Row[];
    const beforeById = new Map<string, Row>();
    for (const row of beforeRows) {
      const id = rowId(row, idKey);
      if (id) beforeById.set(id, row);
    }
    const afterIds = new Set<string>();
    const changed: Row[] = [];
    for (const row of afterRows) {
      const id = rowId(row, idKey);
      if (!id) continue;
      afterIds.add(id);
      const prior = beforeById.get(id);
      if (!prior || !sameRow(prior, row)) changed.push(row);
    }
    const removed = [...beforeById.keys()].filter((id) => !afterIds.has(id));
    if (changed.length === 0 && removed.length === 0) continue;
    collections.push(name);
    upserts[name] = changed;
    if (removed.length) deletes[name.toLowerCase()] = removed;
  }

  if (base.settings && next.settings && !sameRow(base.settings, next.settings)) {
    collections.push('settings');
    upserts.settings = next.settings;
  }

  return { collections, upserts, deletes };
}

export function applyStorePatch(base: Record<string, unknown>, patch: StorePatchBody) {
  const next: Record<string, unknown> = { ...base };
  for (const name of patch.collections) {
    if (name === 'settings') {
      next.settings = patch.upserts.settings;
      continue;
    }
    const idKey = STORE_ROW_IDS[name];
    if (!idKey) continue;
    const drop = new Set(deleteIds(patch.deletes, name));
    const rows = (Array.isArray(next[name]) ? (next[name] as Row[]) : []).filter((row) => !drop.has(rowId(row, idKey)));
    const incoming = Array.isArray(patch.upserts[name]) ? (patch.upserts[name] as Row[]) : [];
    for (const row of incoming) {
      const id = rowId(row, idKey);
      if (!id) continue;
      const index = rows.findIndex((item) => rowId(item, idKey) === id);
      if (index >= 0) rows[index] = row;
      else rows.push(row);
    }
    next[name] = rows;
  }
  return next;
}
