import assert from 'node:assert/strict';
import test from 'node:test';
import { dropStudentSessionPackage } from './src/sessionPackage.ts';
import { cashFlowLines, financeMonth, removeCashFlowLine, scrubLeftoverFinance, upsertCenterExpense, upsertOpeningBalance } from './src/finance.ts';

function store() {
  return {
    students: [{ studentId: 'stu_1', program: 'Playgroup', fullname: 'Ana', status: 'active' }],
    programs: [],
    sessionPackages: [{ packageId: 'pkg_1', studentId: 'stu_1', status: 'active', createdAt: '2026-09-01' }],
    payments: [
      {
        paymentId: 'pay_1',
        enrollmentId: '',
        studentId: 'stu_1',
        amount: 5000,
        amountPaid: 5000,
        paymentStatus: 'paid',
        paymentDate: '2026-09-02',
        notes: '',
      },
      {
        paymentId: 'pay_uniform',
        enrollmentId: '',
        studentId: 'stu_1',
        amount: 1200,
        amountPaid: 1200,
        paymentStatus: 'paid',
        paymentDate: '2026-09-02',
        notes: 'Uniform',
      },
      {
        paymentId: 'pay_teacher',
        enrollmentId: 'teacher',
        studentId: '',
        amount: 8000,
        amountPaid: 8000,
        paymentStatus: 'paid',
        paymentDate: '2026-09-15',
        notes: '',
      },
      {
        paymentId: 'pay_void',
        enrollmentId: '',
        studentId: 'stu_1',
        amount: 9000,
        amountPaid: 9000,
        paymentStatus: 'void',
        paymentDate: '2026-09-03',
        notes: '',
      },
    ],
    centerExpenses: [],
    openingBalances: [],
    enrollments: [],
    classes: [],
    users: [],
  };
}

test('income excludes void payments, teacher pay, and opening cash', () => {
  let next = upsertOpeningBalance(store(), '2026-09', 2791, 'Money from August');
  next = upsertCenterExpense(next, {
    expenseId: 'exp_1',
    expenseDate: '2026-09-04',
    item: 'Rent',
    category: 'rent_bills',
    amount: 15000,
    paidTo: 'Landlord',
    paidBy: 'Office',
    note: '',
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:00:00.000Z',
  });
  const book = financeMonth(next, '2026-09');
  assert.equal(book.opening, 2791);
  assert.equal(book.income, 6200);
  assert.equal(book.salary, 8000);
  assert.equal(book.center, 15000);
  assert.equal(book.expenses, 23000);
  assert.equal(book.net, 6200 - 23000);
  assert.equal(book.buckets.find((row) => row.id === 'playgroup').amount, 5000);
  assert.equal(book.buckets.find((row) => row.id === 'uniform').amount, 1200);
  assert.equal(book.categories.find((row) => row.id === 'teacher_salary').amount, 8000);
  assert.equal(book.categories.find((row) => row.id === 'rent_bills').amount, 15000);
  assert.equal(book.series.length, 6);
  assert.equal(book.series.at(-1).month, '2026-09');
  const withIncome = upsertCenterExpense(next, {
    expenseId: 'inc_1',
    expenseDate: '2026-09-06',
    item: 'Donation',
    category: 'other',
    kind: 'income',
    amount: 300,
    paidTo: 'A parent',
    paidBy: 'Office',
    note: 'Extra',
    createdAt: '2026-09-06T00:00:00.000Z',
    updatedAt: '2026-09-06T00:00:00.000Z',
  });
  const after = financeMonth(withIncome, '2026-09');
  assert.equal(after.income, 6500);
  assert.equal(after.center, 15000);
  assert.equal(after.expenses, 23000);
  const lines = cashFlowLines(withIncome, '2026-09');
  assert.equal(lines.filter((row) => row.kind === 'income').length, 3);
  assert.equal(lines.filter((row) => row.source === 'book' && row.kind === 'expense').length, 1);
  assert.equal(lines.some((row) => row.detail === 'Donation' && row.kind === 'income'), true);
});

test('teacher pay with pending status still posts to cash flow when money was paid', () => {
  const next = {
    ...store(),
    users: [{ userId: 'tch_1', role: 'teacher', status: 'active', fullname: 'Liza Cruz', firstName: 'Liza', lastName: 'Cruz' }],
    payments: [
      {
        paymentId: 'pay_pending_paid',
        enrollmentId: 'teacher',
        studentId: 'tch_1',
        amount: 8000,
        amountPaid: 8000,
        paymentStatus: 'pending',
        paymentDate: '2026-09-20',
        notes: '',
      },
    ],
  };
  const book = financeMonth(next, '2026-09');
  assert.equal(book.salary, 8000);
  const lines = cashFlowLines(next, '2026-09');
  const salary = lines.find((row) => row.source === 'salary');
  assert.equal(salary?.amount, 8000);
  assert.equal(salary?.detail, 'Liza Cruz');
  assert.equal(salary?.kind, 'expense');
});

test('deleting a payment, session package, or student clears income', () => {
  const paid = store();
  assert.equal(financeMonth(paid, '2026-09').income, 6200);
  const cancelled = {
    ...paid,
    payments: paid.payments.map((row) => (row.paymentId === 'pay_1' ? { ...row, amountPaid: 0, paymentStatus: 'cancelled' } : row)),
  };
  assert.equal(financeMonth(cancelled, '2026-09').income, 1200);
  const withoutPay = removeCashFlowLine(paid, 'pay_1');
  assert.equal(financeMonth(withoutPay, '2026-09').income, 1200);
  const withoutBook = upsertCenterExpense(paid, {
    expenseId: 'inc_drop',
    expenseDate: '2026-09-06',
    item: 'Donation',
    category: 'other',
    kind: 'income',
    amount: 300,
    paidTo: 'A parent',
    paidBy: 'Office',
    note: '',
    createdAt: '2026-09-06T00:00:00.000Z',
    updatedAt: '2026-09-06T00:00:00.000Z',
  });
  assert.equal(financeMonth(withoutBook, '2026-09').income, 6500);
  assert.equal(financeMonth(removeCashFlowLine(withoutBook, 'inc_drop'), '2026-09').income, 6200);
  const withPack = {
    ...paid,
    sessionPackages: [{ packageId: 'pkg_1', studentId: 'stu_1', totalSessions: 8, usedSessions: 1, remainingSessions: 7, status: 'active' }],
  };
  const afterPack = dropStudentSessionPackage(withPack, 'stu_1');
  assert.equal(afterPack.sessionPackages.length, 0);
  assert.equal(financeMonth(afterPack, '2026-09').income, 0);
  const afterStudent = { ...paid, students: [] };
  assert.equal(financeMonth(afterStudent, '2026-09').income, 0);
  assert.equal(financeMonth(afterStudent, '2026-09').salary, 8000);
});

test('playgroup income is dropped when the session package is gone', () => {
  const leftover = { ...store(), sessionPackages: [] };
  assert.equal(financeMonth(leftover, '2026-09').income, 0);
  const cleaned = scrubLeftoverFinance(leftover);
  assert.equal(cleaned.payments.some((row) => row.paymentId === 'pay_1'), false);
  assert.equal(financeMonth(cleaned, '2026-09').income, 0);
});
