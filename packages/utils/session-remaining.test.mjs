import assert from 'node:assert/strict';
import test from 'node:test';
import { scrubLeftoverSessionPackages, sessionPackageStats, upsertStudentSessions } from './src/sessionPackage.ts';

function remainingSessions(totalSessions, usedSessions) {
  const total = Math.max(0, Number(totalSessions) || 0);
  const used = Math.min(total, Math.max(0, Number(usedSessions) || 0));
  return Math.max(0, total - used);
}

test('session remaining is total minus used', () => {
  assert.equal(remainingSessions(10, 1), 9);
  assert.equal(remainingSessions(10, 10), 0);
});

test('session remaining cannot go negative', () => {
  assert.equal(remainingSessions(4, 9), 0);
  assert.equal(remainingSessions(0, 1), 0);
});

test('session package count ignores leftover and deleted students', () => {
  const store = {
    students: [{ studentId: 'stu_live', status: 'active' }],
    sessionPackages: [
      { packageId: 'pkg_old', studentId: 'stu_live', status: 'active', createdAt: '2026-01-01' },
      { packageId: 'pkg_now', studentId: 'stu_live', status: 'active', createdAt: '2026-09-01' },
      { packageId: 'pkg_gone', studentId: 'stu_deleted', status: 'active', createdAt: '2026-09-01' },
    ],
    sessionHistory: [{ historyId: 'sh_1', packageId: 'pkg_gone', studentId: 'stu_deleted' }],
    payments: [],
  };
  const stats = sessionPackageStats(store);
  assert.equal(stats.total, 1);
  assert.equal(stats.active, 1);
  const cleaned = scrubLeftoverSessionPackages(store);
  assert.deepEqual(cleaned.sessionPackages.map((row) => row.packageId), ['pkg_now']);
  assert.equal(cleaned.sessionHistory.length, 0);
});

test('clearing sessions on a student drops that package from the count', () => {
  const store = {
    students: [{ studentId: 'stu_live', status: 'active' }],
    sessionPackages: [{ packageId: 'pkg_now', studentId: 'stu_live', status: 'active', totalSessions: 8, usedSessions: 1 }],
    sessionHistory: [],
    payments: [],
  };
  const next = upsertStudentSessions(store, 'stu_live', '0', '0');
  assert.equal(next.sessionPackages.length, 0);
  assert.equal(sessionPackageStats(next).total, 0);
});
