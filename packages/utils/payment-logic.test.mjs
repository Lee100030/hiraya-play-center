import assert from 'node:assert/strict';
import test from 'node:test';
import { saveProgramTuition } from './src/programs.ts';
import {
  cancelStudentPayment,
  recordStudentAmountReceived,
  studentPaymentStanding,
  studentRemainingBalance,
  studentTotalPaid,
  studentTuitionFee,
  updateStudentPayment,
  upsertStudentBalance,
} from './src/tuitionLedger.ts';

function emptyStore() {
  return { students: [{ studentId: 'stu_1' }], payments: [], studentOps: [], enrollments: [] };
}

function withTuition(amount) {
  return upsertStudentBalance(emptyStore(), 'stu_1', amount, 'paid', 'admin');
}

test('unpaid tuition leaves the full remaining balance', () => {
  const store = withTuition(5000);
  assert.equal(studentTuitionFee(store, 'stu_1'), 5000);
  assert.equal(studentTotalPaid(store, 'stu_1'), 0);
  assert.equal(studentRemainingBalance(store, 'stu_1'), 5000);
  assert.equal(studentPaymentStanding(store, 'stu_1'), 'unpaid');
});

test('a down payment is counted once', () => {
  const store = recordStudentAmountReceived(withTuition(5000), 'stu_1', 1000, 'admin', 'Mariel');
  assert.equal(studentTotalPaid(store, 'stu_1'), 1000);
  assert.equal(studentRemainingBalance(store, 'stu_1'), 4000);
  assert.equal(studentPaymentStanding(store, 'stu_1'), 'partial');
});

test('later payments add to total paid', () => {
  let store = recordStudentAmountReceived(withTuition(5000), 'stu_1', 1000, 'admin', 'Mariel');
  store = recordStudentAmountReceived(store, 'stu_1', 500, 'admin', 'Mariel');
  assert.equal(studentTotalPaid(store, 'stu_1'), 1500);
  assert.equal(studentRemainingBalance(store, 'stu_1'), 3500);
  assert.equal(studentPaymentStanding(store, 'stu_1'), 'partial');
});

test('payments that reach the tuition fee are paid in full', () => {
  let store = recordStudentAmountReceived(withTuition(5000), 'stu_1', 1000, 'admin', 'Mariel');
  store = recordStudentAmountReceived(store, 'stu_1', 500, 'admin', 'Mariel');
  store = recordStudentAmountReceived(store, 'stu_1', 3500, 'admin', 'Mariel');
  assert.equal(studentTotalPaid(store, 'stu_1'), 5000);
  assert.equal(studentRemainingBalance(store, 'stu_1'), 0);
  assert.equal(studentPaymentStanding(store, 'stu_1'), 'paid');
});

test('a payment above the remaining balance is rejected', () => {
  let store = recordStudentAmountReceived(withTuition(5000), 'stu_1', 4500, 'admin', 'Mariel');
  assert.throws(
    () => recordStudentAmountReceived(store, 'stu_1', 1000, 'admin', 'Mariel'),
    /cannot exceed the remaining balance of ₱500\.00/,
  );
  assert.equal(studentTotalPaid(store, 'stu_1'), 4500);
});

test('cancelling the only payment returns the account to unpaid', () => {
  let store = recordStudentAmountReceived(withTuition(5000), 'stu_1', 1000, 'admin', 'Mariel');
  const paymentId = store.payments[0].paymentId;
  store = cancelStudentPayment(store, paymentId, 'admin');
  assert.equal(studentTotalPaid(store, 'stu_1'), 0);
  assert.equal(studentRemainingBalance(store, 'stu_1'), 5000);
  assert.equal(studentPaymentStanding(store, 'stu_1'), 'unpaid');
  assert.equal(store.payments.length, 1);
});

test('a playgroup class time uses the playgroup tuition fee', () => {
  let store = {
    students: [{ studentId: 'stu_1', program: 'Playgroup 1:30-3:00' }],
    payments: [],
    studentOps: [{ studentId: 'stu_1', tuitionFee: 180, feeAmount: 180 }],
    enrollments: [{ studentId: 'stu_1', programId: 'prg_bright', classId: 'cls_bright', status: 'active' }],
    classes: [{ classId: 'cls_bright', name: 'Bright Buds (12:00)', programId: 'prg_bright' }],
    programs: [
      { programId: 'prg_playgroup', name: 'Playgroup', status: 'active', tuitionFee: 0 },
      { programId: 'prg_bright', name: 'Bright Buds', status: 'active', tuitionFee: 10000 },
    ],
  };
  store = saveProgramTuition(store, 'playgroup', 20000);
  assert.equal(studentTuitionFee(store, 'stu_1'), 20000);
  assert.equal(studentRemainingBalance(store, 'stu_1'), 20000);
});

test('a bright buds class uses the bright buds fee, not playgroup', () => {
  const store = {
    students: [{ studentId: 'stu_1', program: 'Bright Buds (12:00)' }],
    payments: [],
    studentOps: [{ studentId: 'stu_1', tuitionFee: 180, feeAmount: 180 }],
    enrollments: [{ studentId: 'stu_1', programId: 'prg_playgroup', status: 'active' }],
    classes: [],
    programs: [
      { programId: 'prg_playgroup', name: 'Playgroup', status: 'active', tuitionFee: 20000 },
      { programId: 'prg_bright_buds', name: 'Bright Buds', status: 'active', tuitionFee: 10000 },
    ],
  };
  assert.equal(studentTuitionFee(store, 'stu_1'), 10000);
  assert.equal(studentRemainingBalance(store, 'stu_1'), 10000);
});

test('an unset program fee is the tuition, not an old student amount', () => {
  const store = {
    students: [{ studentId: 'stu_1', program: 'Grade 1' }],
    payments: [],
    studentOps: [{ studentId: 'stu_1', tuitionFee: 20000, feeAmount: 20000 }],
    enrollments: [],
    classes: [],
    programs: [
      { programId: 'prg_playgroup', name: 'Playgroup', status: 'active', tuitionFee: 20000 },
      { programId: 'prg_grade1', name: 'Grade 1', status: 'active', tuitionFee: 0 },
    ],
  };
  assert.equal(studentTuitionFee(store, 'stu_1'), 0);
  assert.equal(studentRemainingBalance(store, 'stu_1'), 0);
});

test('a program tuition fee is the tuition for students in that program', () => {
  let store = {
    students: [{ studentId: 'stu_1', program: 'Playgroup' }],
    payments: [],
    studentOps: [],
    enrollments: [],
    programs: [],
  };
  store = saveProgramTuition(store, 'playgroup', 5000);
  assert.equal(studentTuitionFee(store, 'stu_1'), 5000);
  store = recordStudentAmountReceived(store, 'stu_1', 1000, 'admin', 'Mariel');
  assert.equal(studentTotalPaid(store, 'stu_1'), 1000);
  assert.equal(studentRemainingBalance(store, 'stu_1'), 4000);
  assert.equal(studentPaymentStanding(store, 'stu_1'), 'partial');
});

test('editing a payment recalculates total paid and remaining balance', () => {
  let store = recordStudentAmountReceived(withTuition(5000), 'stu_1', 1000, 'admin', 'Mariel');
  store = recordStudentAmountReceived(store, 'stu_1', 500, 'admin', 'Mariel');
  const second = store.payments[1].paymentId;
  store = updateStudentPayment(store, second, 1000, 'admin');
  assert.equal(studentTotalPaid(store, 'stu_1'), 2000);
  assert.equal(studentRemainingBalance(store, 'stu_1'), 3000);
  assert.equal(studentPaymentStanding(store, 'stu_1'), 'partial');
});
