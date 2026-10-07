import type { HirayaDatabase, Payment, StudentOpsRecord } from '@hiraya/types';
import { formatPeso } from './certificateOfEmployment';
import { isTeacherPayment } from './paymentLanes';
import { programForStudent } from './programs';

function studentPayments(store: HirayaDatabase, studentId: string): Payment[] {
  const id = (studentId || '').trim().toLowerCase();
  return (store.payments || [])
    .filter((row) => !isTeacherPayment(row) && (row.studentId || '').trim().toLowerCase() === id)
    .slice()
    .sort((a, b) => (a.paymentDate || a.paidAt || '').localeCompare(b.paymentDate || b.paidAt || ''));
}

const EXCLUDED = new Set(['cancelled', 'canceled', 'void', 'failed', 'refunded', 'rejected', 'waived', 'pending']);

export function pesos(value: number | string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(Math.max(0, amount) * 100) / 100;
}

export function paymentCountsTowardPaid(status?: string) {
  return !EXCLUDED.has((status || '').trim().toLowerCase());
}

function opsFor(store: HirayaDatabase, studentId: string) {
  const id = (studentId || '').trim().toLowerCase();
  return (store.studentOps || []).find((row) => (row.studentId || '').trim().toLowerCase() === id);
}

export function studentTuitionFee(store: HirayaDatabase, studentId: string) {
  const program = programForStudent(store, studentId);
  const programFee = pesos(program?.tuitionFee || 0);
  if (programFee > 0) return programFee;
  const ops = opsFor(store, studentId);
  const explicit = pesos(ops?.tuitionFee || 0);
  if (explicit > 0) return explicit;
  const fee = pesos(ops?.feeAmount || 0);
  const largestBill = studentPayments(store, studentId)
    .filter((row) => paymentCountsTowardPaid(row.paymentStatus) && Number(row.amount || 0) > Number(row.amountPaid || 0))
    .reduce((max, row) => Math.max(max, pesos(row.amount || 0)), 0);
  return largestBill > fee ? largestBill : fee;
}

export function studentTotalPaid(store: HirayaDatabase, studentId: string) {
  return pesos(
    studentPayments(store, studentId)
      .filter((row) => paymentCountsTowardPaid(row.paymentStatus))
      .reduce((sum, row) => sum + pesos(row.amountPaid || 0), 0),
  );
}

export function studentRemainingBalance(store: HirayaDatabase, studentId: string) {
  return pesos(studentTuitionFee(store, studentId) - studentTotalPaid(store, studentId));
}

export function studentPaymentStanding(store: HirayaDatabase, studentId: string) {
  const tuition = studentTuitionFee(store, studentId);
  const paid = studentTotalPaid(store, studentId);
  if (paid <= 0) return 'unpaid';
  if (paid + 0.001 < tuition) return 'partial';
  return 'paid';
}

export function studentPaymentBalance(store: HirayaDatabase, studentId: string) {
  const due = studentRemainingBalance(store, studentId);
  const status = studentPaymentStanding(store, studentId);
  const openCount = studentPayments(store, studentId).filter((row) => paymentCountsTowardPaid(row.paymentStatus) && pesos(row.amountPaid || 0) > 0).length;
  return { due, status, openCount, tuitionFee: studentTuitionFee(store, studentId), totalPaid: studentTotalPaid(store, studentId) };
}

export function paymentBalanceLabel(store: HirayaDatabase, studentId: string) {
  const bill = studentPaymentBalance(store, studentId);
  const amount = `₱${formatPeso(bill.due)}`;
  if (bill.tuitionFee <= 0 && bill.totalPaid <= 0) return `${amount} · No tuition fee`;
  if (bill.status === 'paid') return `${amount} · Paid`;
  if (bill.status === 'partial') return `${amount} · Partial`;
  return `${amount} · Unpaid`;
}

export function studentPaymentTypeLabel(store: HirayaDatabase, payment: Payment) {
  const status = (payment.paymentStatus || '').toLowerCase();
  if (status === 'pending') return 'Pending';
  if (!paymentCountsTowardPaid(status)) return 'Cancelled';
  const counted = studentPayments(store, payment.studentId)
    .filter((row) => paymentCountsTowardPaid(row.paymentStatus) && pesos(row.amountPaid || 0) > 0)
    .slice()
    .sort((a, b) => (a.paymentDate || a.paidAt || '').localeCompare(b.paymentDate || b.paidAt || ''));
  const index = counted.findIndex((row) => row.paymentId === payment.paymentId);
  if (index === 0) return 'Down payment';
  if (index > 0) return 'Partial payment';
  return 'Payment';
}

function lockTuition(store: HirayaDatabase, studentId: string): HirayaDatabase {
  const fee = studentTuitionFee(store, studentId);
  if (fee <= 0) return store;
  const id = (studentId || '').trim().toLowerCase();
  const ops = store.studentOps || [];
  const current = ops.find((row) => (row.studentId || '').trim().toLowerCase() === id);
  if (current && pesos(current.tuitionFee || 0) > 0) return store;
  const studentOps = current
    ? ops.map((row) => ((row.studentId || '').trim().toLowerCase() === id ? { ...row, tuitionFee: fee, feeAmount: fee } : row))
    : [...ops, { ...blankOps(studentId, 'unpaid'), tuitionFee: fee, feeAmount: fee }];
  return { ...store, studentOps };
}

function blankOps(studentId: string, status: string): StudentOpsRecord {
  return {
    studentId,
    paymentStatus: status,
    collector: '',
    hasIdCard: false,
    hasFetcherId: false,
    hasNametag: false,
    feeAmount: 0,
    tuitionFee: 0,
    laceAmount: 0,
    currentSlot: '',
    package: '',
  };
}

function withStanding(store: HirayaDatabase, studentId: string): HirayaDatabase {
  const id = (studentId || '').trim().toLowerCase();
  const status = studentPaymentStanding(store, studentId);
  const ops = store.studentOps || [];
  const exists = ops.some((row) => (row.studentId || '').trim().toLowerCase() === id);
  if (!exists && studentTuitionFee(store, studentId) <= 0 && studentTotalPaid(store, studentId) <= 0) return store;
  const studentOps = exists
    ? ops.map((row) => ((row.studentId || '').trim().toLowerCase() === id ? { ...row, paymentStatus: status } : row))
    : [...ops, blankOps(studentId, status)];
  return { ...store, studentOps };
}

export function upsertStudentBalance(
  store: HirayaDatabase,
  studentId: string,
  tuitionInput: number | string = '',
  _statusInput = '',
  _actorId = '',
  dueAtInput = '',
) {
  const raw = String(tuitionInput ?? '').trim();
  let next = store;
  if (raw) {
    const tuition = pesos(tuitionInput);
    const paid = studentTotalPaid(store, studentId);
    if (tuition + 0.001 < paid) {
      throw new Error(`Tuition fee cannot be less than the ₱${formatPeso(paid)} already paid.`);
    }
    const id = (studentId || '').trim().toLowerCase();
    const ops = store.studentOps || [];
    const status = tuition <= 0 ? 'unpaid' : paid <= 0 ? 'unpaid' : paid + 0.001 < tuition ? 'partial' : 'paid';
    const studentOps = ops.some((row) => (row.studentId || '').trim().toLowerCase() === id)
      ? ops.map((row) =>
          (row.studentId || '').trim().toLowerCase() === id ? { ...row, feeAmount: tuition, tuitionFee: tuition, paymentStatus: status } : row,
        )
      : [...ops, { ...blankOps(studentId, status), feeAmount: tuition, tuitionFee: tuition }];
    const dueAt = (dueAtInput || '').trim().slice(0, 10);
    const payments = dueAt
      ? (store.payments || []).map((row) =>
          (row.studentId || '').trim().toLowerCase() === id && paymentCountsTowardPaid(row.paymentStatus) ? { ...row, dueAt } : row,
        )
      : store.payments;
    next = { ...store, studentOps, payments };
  }
  return withStanding(next, studentId);
}

function overpayMessage(remaining: number) {
  return `Payment amount cannot exceed the remaining balance of ₱${formatPeso(remaining)}.`;
}

export function recordStudentAmountReceived(
  store: HirayaDatabase,
  studentId: string,
  receivedInput: number | string,
  actorId = '',
  receivedByInput = '',
  accountNumberInput = '',
  fromAccountNumberInput = '',
  methodInput = 'cash',
  notesInput = '',
  paymentDateInput = '',
  referenceInput = '',
) {
  const locked = lockTuition(store, studentId);
  const received = pesos(receivedInput);
  if (received <= 0) throw new Error('Enter the payment amount.');
  const tuition = studentTuitionFee(locked, studentId);
  if (tuition <= 0) throw new Error('Set the tuition fee before recording a payment.');
  const remaining = studentRemainingBalance(locked, studentId);
  if (received > remaining + 0.001) throw new Error(overpayMessage(remaining));
  const receivedBy = (receivedByInput || '').trim();
  if (!receivedBy) throw new Error('Choose who received this payment.');
  const already = studentPayments(locked, studentId).some(
    (row) => paymentCountsTowardPaid(row.paymentStatus) && pesos(row.amountPaid || 0) > 0,
  );
  const now = new Date().toISOString();
  const note = (notesInput || '').trim() || (already ? 'Partial payment' : 'Down payment');
  const payment: Payment = {
    paymentId: `pay_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    enrollmentId: (locked.enrollments || []).find((item) => (item.studentId || '').trim().toLowerCase() === studentId.trim().toLowerCase())?.enrollmentId || '',
    studentId,
    amount: received,
    amountPaid: received,
    paymentMethod: (methodInput || '').trim() || 'cash',
    paymentStatus: 'paid',
    referenceNumber: (referenceInput || '').trim(),
    paymentDate: (paymentDateInput || '').trim().slice(0, 10) || now.slice(0, 10),
    dueAt: '',
    paidAt: now.slice(0, 10),
    recordedBy: actorId,
    receivedBy,
    accountNumber: (accountNumberInput || '').trim(),
    fromAccountNumber: (fromAccountNumberInput || '').trim(),
    notes: note,
    history: [
      {
        entryId: `ph_${Date.now().toString(36)}`,
        changedBy: actorId,
        changedAt: now,
        action: 'received',
        summary: `${already ? 'Partial payment' : 'Down payment'} ₱${formatPeso(received)}.`,
      },
    ],
  };
  return withStanding({ ...locked, payments: [...(locked.payments || []), payment] }, studentId);
}

export function updateStudentPayment(
  store: HirayaDatabase,
  paymentId: string,
  amountInput: number | string,
  actorId = '',
  details?: {
    method?: string;
    receivedBy?: string;
    accountNumber?: string;
    fromAccountNumber?: string;
    notes?: string;
    paymentDate?: string;
  },
) {
  const id = (paymentId || '').trim();
  const current = (store.payments || []).find((row) => row.paymentId === id);
  if (!current) throw new Error('Payment not found.');
  const amount = pesos(amountInput);
  if (amount <= 0) throw new Error('Enter the payment amount.');
  const locked = lockTuition(store, current.studentId);
  const without = {
    ...locked,
    payments: (locked.payments || []).map((row) => (row.paymentId === id ? { ...row, amountPaid: 0, paymentStatus: 'cancelled' } : row)),
  };
  const tuition = studentTuitionFee(locked, current.studentId);
  const paidWithout = studentTotalPaid(without, current.studentId);
  const room = pesos(tuition - paidWithout);
  if (amount > room + 0.001) throw new Error(overpayMessage(room));
  const now = new Date().toISOString();
  const receivedBy = (details?.receivedBy ?? current.receivedBy ?? '').trim();
  if (!receivedBy) throw new Error('Choose who received this payment.');
  const payments = (locked.payments || []).map((row) =>
    row.paymentId === id
      ? {
          ...row,
          amount,
          amountPaid: amount,
          paymentStatus: 'paid',
          paymentMethod: (details?.method ?? row.paymentMethod ?? '').trim() || row.paymentMethod,
          receivedBy,
          accountNumber: details?.accountNumber !== undefined ? details.accountNumber.trim() : row.accountNumber,
          fromAccountNumber: details?.fromAccountNumber !== undefined ? details.fromAccountNumber.trim() : row.fromAccountNumber,
          notes: details?.notes !== undefined ? details.notes.trim() : row.notes,
          paymentDate: (details?.paymentDate || row.paymentDate || now).slice(0, 10),
          paidAt: row.paidAt || now.slice(0, 10),
          history: [
            ...(row.history || []),
            {
              entryId: `ph_${Date.now().toString(36)}`,
              changedBy: actorId,
              changedAt: now,
              action: 'updated',
              summary: `Payment updated to ₱${formatPeso(amount)}.`,
            },
          ],
        }
      : row,
  );
  return withStanding({ ...locked, payments }, current.studentId);
}

export function cancelStudentPayment(store: HirayaDatabase, paymentId: string, actorId = '') {
  const id = (paymentId || '').trim();
  const current = (store.payments || []).find((row) => row.paymentId === id);
  if (!current) throw new Error('Payment not found.');
  const locked = lockTuition(store, current.studentId);
  const now = new Date().toISOString();
  const payments = (locked.payments || []).map((row) =>
    row.paymentId === id
      ? {
          ...row,
          paymentStatus: 'cancelled',
          history: [
            ...(row.history || []),
            {
              entryId: `ph_${Date.now().toString(36)}`,
              changedBy: actorId,
              changedAt: now,
              action: 'cancelled',
              summary: `Payment of ₱${formatPeso(row.amountPaid || row.amount || 0)} cancelled.`,
            },
          ],
        }
      : row,
  );
  return withStanding({ ...locked, payments }, current.studentId);
}

export function centerTuitionTotals(store: HirayaDatabase) {
  let tuition = 0;
  let paid = 0;
  let outstanding = 0;
  let paidCount = 0;
  let partialCount = 0;
  let unpaidCount = 0;
  for (const student of store.students || []) {
    const fee = studentTuitionFee(store, student.studentId);
    const total = studentTotalPaid(store, student.studentId);
    const remaining = pesos(fee - total);
    const status = studentPaymentStanding(store, student.studentId);
    tuition += fee;
    paid += total;
    outstanding += remaining;
    if (fee <= 0 && total <= 0) continue;
    if (status === 'paid') paidCount += 1;
    else if (status === 'partial') partialCount += 1;
    else unpaidCount += 1;
  }
  return {
    tuition: pesos(tuition),
    paid: pesos(paid),
    outstanding: pesos(outstanding),
    paidCount,
    partialCount,
    unpaidCount,
  };
}
