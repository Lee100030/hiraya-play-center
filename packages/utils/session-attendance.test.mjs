import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmStudentPresentToday } from './src/studentAttendance.ts';
import { sessionLeftFor, sessionLeftLabel } from './src/studentBilling.ts';
import { assignLaneSessionPackage } from './src/programs.ts';
import { upsertStudentSessions, useOneSession } from './src/sessionPackage.ts';

function storeWithPackage(total, used) {
  return {
    students: [{ studentId: 'stu_1', fullname: 'Ana Cruz', qrCode: '' }],
    attendance: [],
    sessionPackages: [
      {
        packageId: 'pkg_1',
        studentId: 'stu_1',
        programId: 'playgroup',
        totalSessions: total,
        usedSessions: used,
        remainingSessions: total - used,
        startDate: '2026-09-01',
        expirationDate: '',
        status: 'active',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ],
    sessionHistory: [],
    enrollments: [],
    classes: [],
    programs: [],
    users: [],
  };
}

test('confirming a student is in class uses one session', () => {
  const start = storeWithPackage(10, 0);
  const next = confirmStudentPresentToday(start, 'stu_1', 'teacher_1', '2026-09-30', 'In class');
  const left = sessionLeftFor(next, 'stu_1');
  assert.equal(left.remaining, 9);
  assert.equal(left.used, 1);
  assert.equal(left.total, 10);
  assert.equal(next.sessionHistory.length, 1);
  assert.equal(next.sessionHistory[0].attendanceId, next.attendance[0].attendanceId);
  assert.throws(() => confirmStudentPresentToday(next, 'stu_1', 'teacher_1', '2026-09-30', 'In class'));
  assert.equal(sessionLeftFor(next, 'stu_1').remaining, 9);
});

test('a second class day uses another session', () => {
  const first = confirmStudentPresentToday(storeWithPackage(10, 0), 'stu_1', 'teacher_1', '2026-09-29', 'In class');
  const second = confirmStudentPresentToday(first, 'stu_1', 'teacher_1', '2026-09-30', 'In class');
  assert.equal(sessionLeftFor(second, 'stu_1').remaining, 8);
  assert.equal(second.sessionHistory.length, 2);
});

test('two packages do not add together', () => {
  const start = storeWithPackage(10, 0);
  start.sessionPackages.push({
    packageId: 'pkg_2',
    studentId: 'stu_1',
    programId: 'playgroup',
    totalSessions: 4,
    usedSessions: 0,
    remainingSessions: 4,
    startDate: '2026-09-15',
    expirationDate: '',
    status: 'active',
    createdAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '2026-09-15T00:00:00.000Z',
  });
  assert.equal(sessionLeftFor(start, 'stu_1').remaining, 4);
  assert.equal(sessionLeftFor(start, 'stu_1').total, 4);
  const next = confirmStudentPresentToday(start, 'stu_1', 'teacher_1', '2026-09-30', 'In class');
  assert.equal(sessionLeftFor(next, 'stu_1').remaining, 3);
  assert.equal(next.sessionPackages.length, 1);
  assert.equal(next.sessionPackages[0].packageId, 'pkg_2');
  const again = useOneSession(next, 'stu_1', 'teacher_1', 'In class', next.attendance[0].attendanceId);
  assert.equal(sessionLeftFor(again, 'stu_1').remaining, 3);
});

test('saving a package replaces any other balance for that student', () => {
  const start = storeWithPackage(10, 0);
  const next = upsertStudentSessions(start, 'stu_1', 8, 8, 'playgroup');
  assert.equal(next.sessionPackages.length, 1);
  assert.equal(sessionLeftFor(next, 'stu_1').remaining, 8);
  assert.equal(sessionLeftFor(next, 'stu_1').total, 8);
});

test('a program package applies to every child in that program', () => {
  const start = {
    students: [
      { studentId: 'stu_1', program: 'Playgroup', fullname: 'Ana' },
      { studentId: 'stu_2', program: 'Playgroup', fullname: 'Ben' },
      { studentId: 'stu_3', program: 'Kinder', fullname: 'Cara' },
    ],
    programs: [{ programId: 'prg_play', name: 'Playgroup', description: '', status: 'active', tuitionFee: 0 }],
    sessionPackages: [
      {
        packageId: 'pkg_1',
        studentId: 'stu_1',
        programId: 'prg_play',
        totalSessions: 8,
        usedSessions: 2,
        remainingSessions: 6,
        startDate: '2026-09-01',
        expirationDate: '',
        status: 'active',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ],
    sessionHistory: [],
    enrollments: [],
    classes: [],
    attendance: [],
    users: [],
  };
  const next = assignLaneSessionPackage(start, 'playgroup', 10);
  assert.equal(next.programs[0].packageSessions, 10);
  assert.equal(sessionLeftFor(next, 'stu_1').total, 10);
  assert.equal(sessionLeftFor(next, 'stu_1').used, 2);
  assert.equal(sessionLeftFor(next, 'stu_1').remaining, 8);
  assert.equal(sessionLeftFor(next, 'stu_2').total, 10);
  assert.equal(sessionLeftFor(next, 'stu_2').remaining, 10);
  assert.equal(sessionLeftFor(next, 'stu_3').hasPackage, false);
});

test('a student with no package is labeled as having no package', () => {
  const start = storeWithPackage(10, 0);
  start.sessionPackages = [];
  assert.equal(sessionLeftLabel(start, 'stu_1'), 'No package');
});

test('no package still records attendance', () => {
  const start = storeWithPackage(10, 0);
  start.sessionPackages = [];
  const next = confirmStudentPresentToday(start, 'stu_1', 'teacher_1', '2026-09-30', 'In class');
  assert.equal(next.attendance.length, 1);
  assert.equal(next.sessionHistory.length, 0);
  assert.equal(sessionLeftFor(next, 'stu_1').hasPackage, false);
});
