import type { HirayaDatabase, HirayaUser, Payment, Student } from '@hiraya/types';
import { formatPeso } from './certificateOfEmployment';
import { isTeacherPayment } from './paymentLanes';
import { studentSessionAccount } from './sessionPackage';

const CLOSED_PAY = new Set(['paid', 'cancelled', 'canceled', 'void', 'waived']);

function titleStatus(value: string) {
  const raw = (value || '').trim();
  if (!raw) return '';
  return raw.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function studentLabel(student: Pick<Student, 'firstName' | 'middleName' | 'lastName' | 'fullname'>) {
  const parts = [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ').trim();
  return parts || student.fullname || 'Student';
}

function newAlertId() {
  return `al_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function sessionLeftFor(store: HirayaDatabase, studentId: string) {
  const account = studentSessionAccount(store, studentId);
  return {
    remaining: account.remaining,
    total: account.total,
    used: account.used,
    hasPackage: account.hasPackage,
  };
}

export function sessionLeftLabel(store: HirayaDatabase, studentId: string) {
  const pack = sessionLeftFor(store, studentId);
  if (!pack.hasPackage) return 'No package';
  if (pack.total > 0) return `${pack.remaining} left · ${pack.total} in package`;
  return `${pack.remaining} left`;
}

export function studentPayments(store: HirayaDatabase, studentId: string): Payment[] {
  const id = (studentId || '').trim().toLowerCase();
  return (store.payments || [])
    .filter((row) => !isTeacherPayment(row) && (row.studentId || '').trim().toLowerCase() === id)
    .slice()
    .sort((a, b) => {
      const left = (b.paymentDate || b.dueAt || b.paidAt || '').localeCompare(a.paymentDate || a.dueAt || a.paidAt || '');
      if (left) return left;
      return (b.paymentId || '').localeCompare(a.paymentId || '');
    });
}

export function studentBalanceReceivedBy(store: HirayaDatabase, studentId: string) {
  const open = studentPayments(store, studentId).filter(
    (row) => !CLOSED_PAY.has((row.paymentStatus || '').toLowerCase()),
  );
  const withName = open.find((row) => (row.receivedBy || '').trim()) || studentPayments(store, studentId).find((row) => (row.receivedBy || '').trim());
  return (withName?.receivedBy || '').trim();
}

export function studentBalanceDueAt(store: HirayaDatabase, studentId: string) {
  const open = studentPayments(store, studentId).filter(
    (row) => !CLOSED_PAY.has((row.paymentStatus || '').toLowerCase()),
  );
  const withDue = open.find((row) => (row.dueAt || '').trim());
  return ((withDue || open[0] || studentPayments(store, studentId)[0])?.dueAt || '').slice(0, 10);
}

export function parentsForStudent(store: HirayaDatabase, studentId: string): HirayaUser[] {
  const id = (studentId || '').trim().toLowerCase();
  const student = store.students.find((row) => (row.studentId || '').trim().toLowerCase() === id);
  const ids = new Set<string>();
  if (student?.parentId) ids.add(student.parentId);
  for (const link of store.parentStudents || []) {
    if (!link.isActive) continue;
    if ((link.studentId || '').trim().toLowerCase() !== id) continue;
    if (link.parentId) ids.add(link.parentId);
  }
  return store.users.filter((user) => {
    if (!ids.has(user.userId)) return false;
    if ((user.role || '').toLowerCase() !== 'parent') return false;
    const status = (user.status || 'active').toLowerCase();
    return status === 'active' || status === 'pending';
  });
}

export {
  studentPaymentBalance,
  paymentBalanceLabel,
  upsertStudentBalance,
  recordStudentAmountReceived,
  updateStudentPayment,
  cancelStudentPayment,
  studentTuitionFee,
  studentTotalPaid,
  studentRemainingBalance,
  studentPaymentStanding,
  studentPaymentTypeLabel,
  centerTuitionTotals,
  paymentCountsTowardPaid,
} from './tuitionLedger';

export function notifyStudentBalance(store: HirayaDatabase, studentId: string, actorId = '') {
  const id = (studentId || '').trim().toLowerCase();
  const student = store.students.find((row) => (row.studentId || '').trim().toLowerCase() === id);
  if (!student) throw new Error('Student not found.');
  const parents = parentsForStudent(store, studentId);
  if (!parents.length) {
    throw new Error('No linked parent to notify. Link a parent on the student record first.');
  }
  const bill = studentPaymentBalance(store, studentId);
  const dueAt = studentBalanceDueAt(store, studentId);
  const name = studentLabel(student);
  const amount = `₱${formatPeso(bill.due)}`;
  const dueText = dueAt
    ? ` Due ${new Date(`${dueAt}T12:00:00`).toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}.`
    : '';
  const center = store.settings?.centerName || 'Hiraya Kids Learning Center';
  const title = bill.due > 0 ? 'Remaining balance' : 'Account settled';
  const message =
    bill.due > 0
      ? `Good day. This is ${center}. ${name} has a remaining balance of ${amount}.${dueText} Please settle this at the center. You can also see this balance on your Hiraya account.`
      : `Good day. This is ${center}. ${name} has no remaining balance. The account is settled, and you can see this on your Hiraya account.`;
  const now = new Date().toISOString();
  const alerts = parents.map((parent) => ({
    alertId: newAlertId(),
    kind: 'payment',
    title,
    message,
    recipientId: parent.userId,
    href: 'payments',
    status: 'active',
    createdAt: now,
    read: false,
    relatedRecordId: student.studentId,
  }));
  void actorId;
  return {
    store: { ...store, alerts: [...alerts, ...(store.alerts || [])] },
    parentCount: parents.length,
    message,
  };
}
