import assert from 'node:assert/strict';
import test from 'node:test';

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
