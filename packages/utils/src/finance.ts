import type { CenterExpense, HirayaDatabase, OpeningBalance, Payment } from '@hiraya/types';
import { programLane } from './managementLanes';
import { isTeacherPayment } from './paymentLanes';
import { staffDisplayName, uniqueStaffTeachers } from './staffDedupe';
import { scrubLeftoverSessionPackages, studentSessionPackage } from './sessionPackage';
import { teacherPayCashAmount } from './teacherPayments';
import { deletePaymentRecord, paymentCountsTowardPaid, pesos } from './tuitionLedger';

export const INCOME_BUCKETS = [
  { id: 'playgroup', label: 'Playgroup' },
  { id: 'tutorial', label: 'Tutorial' },
  { id: 'prekinder', label: 'Pre-K' },
  { id: 'aba', label: 'ABA' },
  { id: 'uniform', label: 'Uniform' },
  { id: 'other', label: 'Other' },
] as const;

export const EXPENSE_CATEGORIES = [
  { id: 'rent_bills', label: 'Rent and bills' },
  { id: 'incentives', label: 'Incentives' },
  { id: 'loans', label: 'Loans' },
  { id: 'materials', label: 'Materials' },
  { id: 'aids_uniform', label: 'Aids and uniform' },
  { id: 'party', label: 'Party and other' },
  { id: 'teacher_salary', label: 'Teachers salary' },
] as const;

export type IncomeBucketId = (typeof INCOME_BUCKETS)[number]['id'];
export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]['id'];

const BUCKET_IDS = new Set<string>(INCOME_BUCKETS.map((row) => row.id));
const CATEGORY_IDS = new Set<string>(EXPENSE_CATEGORIES.map((row) => row.id));

function signedPesos(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function incomeBucketLabel(id?: string | null) {
  return INCOME_BUCKETS.find((row) => row.id === id)?.label || 'Other';
}

export function expenseCategoryLabel(id?: string | null) {
  return EXPENSE_CATEGORIES.find((row) => row.id === id)?.label || 'Party and other';
}

export function cashFlowTeacherNames(store: HirayaDatabase) {
  return uniqueStaffTeachers(store)
    .filter((user) => (user.role || '').toLowerCase() === 'teacher' && (user.status || 'active').toLowerCase() === 'active')
    .map((user) => staffDisplayName(user))
    .filter((name) => name.length > 0);
}

export function currentMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function monthKeyFromDate(value?: string | null) {
  const text = (value || '').trim();
  const match = text.match(/^(\d{4}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return currentMonthKey(parsed);
}

export function monthLabel(key: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(key || '');
  if (!match) return key || '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return date.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
}

export function recentMonthKeys(endMonth: string, count = 6) {
  const match = /^(\d{4})-(\d{2})$/.exec(endMonth || '') || /^(\d{4})-(\d{2})$/.exec(currentMonthKey());
  const year = Number(match?.[1] || new Date().getFullYear());
  const month = Number(match?.[2] || 1);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(year, month - 1 - i, 1);
    keys.push(currentMonthKey(date));
  }
  return keys;
}

function paymentWhen(row: Payment) {
  return monthKeyFromDate(row.paymentDate || row.paidAt || row.dueAt);
}

function countedAmount(row: Payment) {
  if (!paymentCountsTowardPaid(row.paymentStatus)) return 0;
  return pesos(row.amountPaid || 0);
}

function studentCountsInFinance(store: HirayaDatabase, studentId?: string | null) {
  const id = (studentId || '').trim().toLowerCase();
  if (!id) return false;
  const student = (store.students || []).find((row) => (row.studentId || '').trim().toLowerCase() === id);
  if (!student) return false;
  const status = (student.status || 'active').trim().toLowerCase();
  return status !== 'archived' && status !== 'inactive' && status !== 'deleted';
}

const DROPPED_PAY = new Set(['cancelled', 'canceled', 'void', 'failed', 'refunded', 'rejected', 'waived']);

function sessionIncomeNeedsPackage(store: HirayaDatabase, row: Payment) {
  const student = (store.students || []).find((item) => (item.studentId || '').trim().toLowerCase() === (row.studentId || '').trim().toLowerCase());
  const lane = programLane(student?.program || student?.gradeLevel || '', store);
  return lane === 'playgroup' || lane === 'tutorial';
}

function countsAsStudentIncome(store: HirayaDatabase, row: Payment) {
  if (isTeacherPayment(row)) return false;
  if (!studentCountsInFinance(store, row.studentId)) return false;
  if (countedAmount(row) <= 0) return false;
  if (incomeBucketFor(store, row) === 'opening') return false;
  if (sessionIncomeNeedsPackage(store, row) && !studentSessionPackage(store, row.studentId)) return false;
  return true;
}

function keepStoredPayment(store: HirayaDatabase, row: Payment) {
  const status = (row.paymentStatus || '').trim().toLowerCase();
  if (DROPPED_PAY.has(status)) return false;
  if (isTeacherPayment(row)) return true;
  if (!studentCountsInFinance(store, row.studentId)) return false;
  if (sessionIncomeNeedsPackage(store, row) && !studentSessionPackage(store, row.studentId)) return false;
  return true;
}

function sameIdList(left: { paymentId?: string }[], right: { paymentId?: string }[]) {
  if (left.length !== right.length) return false;
  const ids = new Set(right.map((row) => row.paymentId));
  return left.every((row) => ids.has(row.paymentId));
}

/** Remove leftover payments so Income and expenses drop after session / student / finance deletes. */
export function scrubLeftoverFinance(store: HirayaDatabase): HirayaDatabase | null {
  const current = store.payments || [];
  const payments = current.filter((row) => keepStoredPayment(store, row));
  if (sameIdList(current, payments)) return null;
  return { ...store, payments };
}

export function scrubLeftoverCenterRecords(store: HirayaDatabase): HirayaDatabase | null {
  const sessions = scrubLeftoverSessionPackages(store);
  const afterSessions = sessions || store;
  const finance = scrubLeftoverFinance(afterSessions);
  return finance || sessions;
}

export function incomeBucketFor(store: HirayaDatabase, payment: Payment): IncomeBucketId | 'opening' {
  const set = (payment.incomeBucket || '').trim().toLowerCase();
  if (set === 'opening') return 'opening';
  if (BUCKET_IDS.has(set)) return set as IncomeBucketId;
  const notes = `${payment.notes || ''} ${payment.referenceNumber || ''}`.toLowerCase();
  if (notes.includes('uniform')) return 'uniform';
  const student = (store.students || []).find((row) => row.studentId === payment.studentId);
  const lane = programLane(student?.program || student?.gradeLevel || '', store);
  if (lane === 'playgroup' || lane === 'tutorial' || lane === 'prekinder' || lane === 'aba') return lane;
  return 'other';
}

export function openingBalanceFor(store: HirayaDatabase, month: string) {
  const key = monthKeyFromDate(month) || month;
  const row = (store.openingBalances || []).find((item) => item.month === key);
  return pesos(row?.amount || 0);
}

export function invoiceForMonth(store: HirayaDatabase, month: string) {
  const key = monthKeyFromDate(month) || month;
  return pesos(
    (store.payments || [])
      .filter((row) => paymentWhen(row) === key && countsAsStudentIncome(store, row))
      .reduce((sum, row) => sum + countedAmount(row), 0),
  );
}

export function teacherSalaryForMonth(store: HirayaDatabase, month: string) {
  const key = monthKeyFromDate(month) || month;
  return pesos(
    (store.payments || [])
      .filter((row) => isTeacherPayment(row) && paymentWhen(row) === key)
      .reduce((sum, row) => sum + teacherPayCashAmount(row), 0),
  );
}

export function isBookIncome(row: { kind?: string | null }) {
  return (row.kind || '').toLowerCase() === 'income';
}

export function centerExpensesForMonth(store: HirayaDatabase, month: string) {
  const key = monthKeyFromDate(month) || month;
  return (store.centerExpenses || []).filter((row) => monthKeyFromDate(row.expenseDate) === key && !isBookIncome(row));
}

export function bookIncomeForMonth(store: HirayaDatabase, month: string) {
  const key = monthKeyFromDate(month) || month;
  return pesos(
    (store.centerExpenses || [])
      .filter((row) => monthKeyFromDate(row.expenseDate) === key && isBookIncome(row))
      .reduce((sum, row) => sum + pesos(row.amount || 0), 0),
  );
}

export function centerExpenseTotal(store: HirayaDatabase, month: string) {
  return pesos(centerExpensesForMonth(store, month).reduce((sum, row) => sum + pesos(row.amount || 0), 0));
}

export function cashIncomeForMonth(store: HirayaDatabase, month: string) {
  return pesos(invoiceForMonth(store, month) + bookIncomeForMonth(store, month));
}

export function expenseTotalForMonth(store: HirayaDatabase, month: string) {
  return pesos(teacherSalaryForMonth(store, month) + centerExpenseTotal(store, month));
}

export function incomeBucketsForMonth(store: HirayaDatabase, month: string) {
  const key = monthKeyFromDate(month) || month;
  const totals = Object.fromEntries(INCOME_BUCKETS.map((row) => [row.id, 0])) as Record<IncomeBucketId, number>;
  for (const row of store.payments || []) {
    if (paymentWhen(row) !== key || !countsAsStudentIncome(store, row)) continue;
    const bucket = incomeBucketFor(store, row);
    if (bucket === 'opening') continue;
    totals[bucket] = pesos(totals[bucket] + countedAmount(row));
  }
  for (const row of store.centerExpenses || []) {
    if (!isBookIncome(row) || monthKeyFromDate(row.expenseDate) !== key) continue;
    const bucket = BUCKET_IDS.has(row.category) ? (row.category as IncomeBucketId) : 'other';
    totals[bucket] = pesos(totals[bucket] + pesos(row.amount || 0));
  }
  return INCOME_BUCKETS.map((row) => ({ id: row.id, label: row.label, amount: totals[row.id] }));
}

export function expenseCategoriesForMonth(store: HirayaDatabase, month: string) {
  const totals = Object.fromEntries(EXPENSE_CATEGORIES.map((row) => [row.id, 0])) as Record<ExpenseCategoryId, number>;
  for (const row of centerExpensesForMonth(store, month)) {
    const id = CATEGORY_IDS.has(row.category) ? (row.category as ExpenseCategoryId) : 'party';
    totals[id] = pesos(totals[id] + pesos(row.amount || 0));
  }
  totals.teacher_salary = pesos(totals.teacher_salary + teacherSalaryForMonth(store, month));
  return EXPENSE_CATEGORIES.map((row) => ({ id: row.id, label: row.label, amount: totals[row.id] }));
}

export type FinanceMonthPoint = {
  month: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
};

export function financeSeries(store: HirayaDatabase, endMonth: string, count = 6): FinanceMonthPoint[] {
  return recentMonthKeys(endMonth, count).map((month) => {
    const income = cashIncomeForMonth(store, month);
    const expenses = expenseTotalForMonth(store, month);
    return { month, label: monthLabel(month), income, expenses, net: signedPesos(income - expenses) };
  });
}

export function financeMonth(store: HirayaDatabase, monthInput?: string) {
  const month = monthKeyFromDate(monthInput) || currentMonthKey();
  const income = cashIncomeForMonth(store, month);
  const salary = teacherSalaryForMonth(store, month);
  const center = centerExpenseTotal(store, month);
  const expenses = pesos(salary + center);
  return {
    month,
    label: monthLabel(month),
    opening: openingBalanceFor(store, month),
    income,
    salary,
    center,
    expenses,
    net: signedPesos(income - expenses),
    buckets: incomeBucketsForMonth(store, month),
    categories: expenseCategoriesForMonth(store, month),
    series: financeSeries(store, month),
  };
}

export function upsertOpeningBalance(store: HirayaDatabase, monthInput: string, amountInput: number | string, note = ''): HirayaDatabase {
  const month = monthKeyFromDate(monthInput) || currentMonthKey();
  const amount = pesos(amountInput);
  const rows = store.openingBalances || [];
  const current = rows.find((row) => row.month === month);
  const next: OpeningBalance = {
    openingId: current?.openingId || `open_${month.replace('-', '')}`,
    month,
    amount,
    note: note.trim(),
    updatedAt: new Date().toISOString(),
  };
  return {
    ...store,
    openingBalances: current ? rows.map((row) => (row.month === month ? next : row)) : [...rows, next],
  };
}

export function upsertCenterExpense(store: HirayaDatabase, expense: CenterExpense): HirayaDatabase {
  const rows = store.centerExpenses || [];
  const kind = expense.kind === 'income' ? 'income' : 'expense';
  const category =
    kind === 'income'
      ? BUCKET_IDS.has(expense.category)
        ? expense.category
        : 'other'
      : CATEGORY_IDS.has(expense.category)
        ? expense.category
        : 'party';
  const next: CenterExpense = {
    ...expense,
    kind,
    category,
    amount: pesos(expense.amount),
    item: (expense.item || '').trim(),
    expenseDate: (expense.expenseDate || '').slice(0, 10),
    updatedAt: new Date().toISOString(),
  };
  if (!next.expenseId || !next.item || next.amount <= 0 || !next.expenseDate) {
    throw new Error('Date, item, and amount are required.');
  }
  const exists = rows.some((row) => row.expenseId === next.expenseId);
  return {
    ...store,
    centerExpenses: exists ? rows.map((row) => (row.expenseId === next.expenseId ? next : row)) : [next, ...rows],
  };
}

export function removeCenterExpense(store: HirayaDatabase, expenseId: string): HirayaDatabase {
  return {
    ...store,
    centerExpenses: (store.centerExpenses || []).filter((row) => row.expenseId !== expenseId),
  };
}

/** Remove a cash-flow sheet row, including student payments and teacher pay that feed Income and expenses. */
export function removeCashFlowLine(store: HirayaDatabase, lineId: string): HirayaDatabase {
  const id = (lineId || '').trim();
  if (!id) throw new Error('That row was already removed.');
  if ((store.centerExpenses || []).some((row) => row.expenseId === id)) {
    return removeCenterExpense(store, id);
  }
  return deletePaymentRecord(store, id);
}

export type CashFlowLine = {
  id: string;
  source: 'payment' | 'salary' | 'book';
  kind: 'income' | 'expense';
  date: string;
  category: string;
  detail: string;
  amount: number;
  party: string;
  handledBy: string;
  note: string;
};

function lineDate(value?: string | null) {
  return (value || '').slice(0, 10);
}

export function cashFlowLines(store: HirayaDatabase, month: string): CashFlowLine[] {
  const key = monthKeyFromDate(month) || month;
  const lines: CashFlowLine[] = [];
  for (const row of store.payments || []) {
    const when = paymentWhen(row);
    if (when !== key) continue;
    if (isTeacherPayment(row)) {
      const amount = teacherPayCashAmount(row);
      if (amount <= 0) continue;
      const teacher = (store.users || []).find((item) => item.userId === row.studentId);
      const name = teacher ? staffDisplayName(teacher) : 'Teacher';
      lines.push({
        id: row.paymentId,
        source: 'salary',
        kind: 'expense',
        date: lineDate(row.paymentDate || row.paidAt),
        category: 'teacher_salary',
        detail: name,
        amount,
        party: name,
        handledBy: (row.receivedBy || row.recordedBy || '').trim(),
        note: [row.notes, row.paymentMethod, row.referenceNumber].filter(Boolean).join(' · '),
      });
      continue;
    }
    if (!countsAsStudentIncome(store, row)) continue;
    const student = (store.students || []).find((item) => item.studentId === row.studentId);
    const name = (student?.fullname || '').trim() || 'Student payment';
    lines.push({
      id: row.paymentId,
      source: 'payment',
      kind: 'income',
      date: lineDate(row.paymentDate || row.paidAt),
      category: incomeBucketFor(store, row),
      detail: name,
      amount: countedAmount(row),
      party: name,
      handledBy: (row.receivedBy || row.recordedBy || '').trim(),
      note: [row.notes, row.paymentMethod, row.referenceNumber].filter(Boolean).join(' · '),
    });
  }
  for (const row of store.centerExpenses || []) {
    if (monthKeyFromDate(row.expenseDate) !== key) continue;
    const income = isBookIncome(row);
    lines.push({
      id: row.expenseId,
      source: 'book',
      kind: income ? 'income' : 'expense',
      date: lineDate(row.expenseDate),
      category: row.category,
      detail: row.item,
      amount: pesos(row.amount),
      party: row.paidTo || '',
      handledBy: row.paidBy || '',
      note: row.note || '',
    });
  }
  return lines.sort((a, b) => b.date.localeCompare(a.date) || a.detail.localeCompare(b.detail));
}

export function remittanceForDay(store: HirayaDatabase, date: string) {
  const day = (date || '').slice(0, 10);
  const rows = (store.payments || []).filter((row) => {
    if (!countsAsStudentIncome(store, row)) return false;
    const when = (row.paymentDate || row.paidAt || '').slice(0, 10);
    return when === day;
  });
  const groups = new Map<string, { receivedBy: string; total: number; buckets: Record<string, number> }>();
  for (const row of rows) {
    const who = (row.receivedBy || '').trim() || 'Not named';
    const current = groups.get(who) || { receivedBy: who, total: 0, buckets: {} };
    const bucket = incomeBucketFor(store, row);
    const amount = countedAmount(row);
    current.buckets[bucket] = pesos((current.buckets[bucket] || 0) + amount);
    current.total = pesos(current.total + amount);
    groups.set(who, current);
  }
  return [...groups.values()].sort((a, b) => a.receivedBy.localeCompare(b.receivedBy));
}
