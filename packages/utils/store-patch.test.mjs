import assert from 'node:assert/strict';
import test from 'node:test';
import { applyStorePatch, diffStore } from './src/storePatch.ts';

test('two patches of different records both remain', () => {
  const base = {
    payments: [{ paymentId: 'pay_a', amount: 10 }],
    students: [{ studentId: 'stu_a', fullname: 'A' }],
    settings: { settingsId: 'center', centerName: 'Hiraya' },
  };
  const paymentEdit = {
    ...base,
    payments: [...base.payments, { paymentId: 'pay_b', amount: 20 }],
  };
  const studentEdit = {
    ...base,
    students: [...base.students, { studentId: 'stu_b', fullname: 'B' }],
  };
  const paymentPatch = diffStore(base, paymentEdit);
  const studentPatch = diffStore(base, studentEdit);
  assert.deepEqual(paymentPatch.collections, ['payments']);
  assert.deepEqual(studentPatch.collections, ['students']);
  const afterBoth = applyStorePatch(applyStorePatch(base, paymentPatch), studentPatch);
  assert.equal(afterBoth.payments.length, 2);
  assert.equal(afterBoth.students.length, 2);
  assert.equal(afterBoth.payments.find((row) => row.paymentId === 'pay_a').amount, 10);
});

test('a patch does not delete a row the editor never loaded', () => {
  const editorBase = {
    payments: [{ paymentId: 'pay_a', amount: 10 }],
    students: [{ studentId: 'stu_a', fullname: 'A' }],
  };
  const editorNext = {
    ...editorBase,
    payments: [{ paymentId: 'pay_a', amount: 15 }],
  };
  const patch = diffStore(editorBase, editorNext);
  const server = {
    ...editorBase,
    payments: [...editorBase.payments, { paymentId: 'pay_other', amount: 99 }],
    students: [...editorBase.students, { studentId: 'stu_other', fullname: 'Other' }],
  };
  const saved = applyStorePatch(server, patch);
  assert.equal(saved.payments.find((row) => row.paymentId === 'pay_other').amount, 99);
  assert.equal(saved.students.find((row) => row.studentId === 'stu_other').fullname, 'Other');
  assert.equal(saved.payments.find((row) => row.paymentId === 'pay_a').amount, 15);
});

test('removing a cash row sends the delete under the lowercase collection name', () => {
  const base = {
    centerExpenses: [{ expenseId: 'exp_keep', item: 'Rent' }, { expenseId: 'exp_drop', item: 'Old' }],
  };
  const next = {
    centerExpenses: [{ expenseId: 'exp_keep', item: 'Rent' }],
  };
  const patch = diffStore(base, next);
  assert.deepEqual(patch.deletes.centerexpenses, ['exp_drop']);
  const saved = applyStorePatch(base, patch);
  assert.deepEqual(saved.centerExpenses.map((row) => row.expenseId), ['exp_keep']);
});
