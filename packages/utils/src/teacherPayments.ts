import type { HirayaDatabase, HirayaUser, Payment } from '@hiraya/types';
import { formatPeso } from './certificateOfEmployment';
import { emailHtml, emailPlain, shown } from './emailLayout';
import { isTeacherPayment, TEACHER_PAYMENT_MARK } from './paymentLanes';
import { describeSalaryNotice } from './salaryNotice';
import { pesos } from './tuitionLedger';

function newAlertId() {
  return `al_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function personLabel(user?: HirayaUser | null) {
  if (!user) return 'Teacher';
  const parts = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ').trim();
  return parts || user.fullname || user.email || user.username || 'Teacher';
}

function formatPayDate(value?: string) {
  const raw = (value || '').trim().slice(0, 10);
  if (!raw) return '';
  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function teacherPaymentRows(store: HirayaDatabase, teacherId: string): Payment[] {
  const id = (teacherId || '').trim().toLowerCase();
  return (store.payments || [])
    .filter((row) => isTeacherPayment(row) && (row.studentId || '').trim().toLowerCase() === id)
    .slice()
    .sort((a, b) => {
      const left = (b.paymentDate || b.paidAt || '').localeCompare(a.paymentDate || a.paidAt || '');
      if (left) return left;
      return (b.paymentId || '').localeCompare(a.paymentId || '');
    });
}

export function findTeacherPayment(store: HirayaDatabase, paymentId: string) {
  const id = (paymentId || '').trim().toLowerCase();
  return (store.payments || []).find((row) => isTeacherPayment(row) && (row.paymentId || '').trim().toLowerCase() === id) || null;
}

const SKIP_CASH = new Set(['cancelled', 'canceled', 'void', 'failed', 'refunded', 'rejected', 'waived']);

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function newPaymentId() {
  return `pay_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Money that Center cash flow should show for a teacher payment. */
export function teacherPayCashAmount(row: Payment) {
  const status = (row.paymentStatus || '').trim().toLowerCase();
  if (SKIP_CASH.has(status)) return 0;
  const paid = pesos(row.amountPaid || 0);
  if (paid > 0) return paid;
  if (status === 'paid' || status === 'partial') return pesos(row.amount || 0);
  return 0;
}

function teacherPayStatus(amount: number, paid: number, requested?: string) {
  const asked = (requested || '').trim().toLowerCase();
  if (SKIP_CASH.has(asked)) return asked;
  if (paid <= 0) return asked === 'paid' || asked === 'partial' ? asked : 'pending';
  if (amount > 0 && paid + 0.001 < amount) return 'partial';
  return 'paid';
}

export function applyTeacherPayment(
  store: HirayaDatabase,
  input: {
    paymentId?: string;
    teacherId: string;
    amount?: number | string;
    amountPaid?: number | string;
    paymentStatus?: string;
    paymentMethod?: string;
    paymentDate?: string;
    notes?: string;
    referenceNumber?: string;
    accountNumber?: string;
    fromAccountNumber?: string;
    receivedBy?: string;
    recordedBy?: string;
  },
): HirayaDatabase {
  const teacherId = (input.teacherId || '').trim();
  if (!teacherId) throw new Error('Choose a teacher.');
  let amount = pesos(input.amount || 0);
  let paid = pesos(input.amountPaid || 0);
  if (paid <= 0 && amount > 0) paid = amount;
  if (amount <= 0 && paid > 0) amount = paid;
  if (paid <= 0) throw new Error('Enter the amount paid so it can be recorded in Center cash flow.');
  const existing = input.paymentId
    ? (store.payments || []).find((row) => row.paymentId === input.paymentId)
    : undefined;
  const date = (input.paymentDate || existing?.paymentDate || existing?.paidAt || '').slice(0, 10) || todayKey();
  const status = teacherPayStatus(amount, paid, input.paymentStatus || existing?.paymentStatus);
  const next: Payment = {
    paymentId: existing?.paymentId || newPaymentId(),
    enrollmentId: TEACHER_PAYMENT_MARK,
    studentId: teacherId,
    amount: Math.max(amount, paid),
    amountPaid: paid,
    paymentMethod: (input.paymentMethod || existing?.paymentMethod || 'cash').trim() || 'cash',
    paymentStatus: status,
    referenceNumber: (input.referenceNumber ?? existing?.referenceNumber ?? '').trim(),
    paymentDate: date,
    dueAt: existing?.dueAt || '',
    paidAt: paid > 0 ? existing?.paidAt || new Date().toISOString() : '',
    recordedBy: (input.recordedBy || existing?.recordedBy || '').trim(),
    receivedBy: (input.receivedBy || existing?.receivedBy || '').trim(),
    notes: (input.notes ?? existing?.notes ?? '').trim(),
    accountNumber: (input.accountNumber ?? existing?.accountNumber ?? '').trim(),
    fromAccountNumber: (input.fromAccountNumber ?? existing?.fromAccountNumber ?? '').trim(),
    history: existing?.history || [],
  };
  const rows = store.payments || [];
  return {
    ...store,
    payments: existing ? rows.map((row) => (row.paymentId === next.paymentId ? { ...row, ...next } : row)) : [next, ...rows],
  };
}

export function buildTeacherPayslip(store: HirayaDatabase, payment: Payment) {
  const teacher = store.users.find((item) => item.userId === payment.studentId);
  const settings = store.settings;
  const center = settings?.centerName || 'Hiraya Kids Learning Center';
  const name = personLabel(teacher);
  const email = (teacher?.personalEmail || teacher?.email || '').trim();
  const amountValue = Number(payment.amount || 0);
  const paidValue = Number(payment.amountPaid || 0);
  const owedValue = Math.max(0, amountValue - paidValue);
  const amount = `₱${formatPeso(amountValue)}`;
  const paid = `₱${formatPeso(paidValue)}`;
  const owed = `₱${formatPeso(owedValue)}`;
  const date = formatPayDate(payment.paymentDate || payment.paidAt);
  const method = (payment.paymentMethod || '').trim();
  const fromAccount = (payment.fromAccountNumber || '').trim();
  const toAccount = (payment.accountNumber || '').trim();
  const extra = [fromAccount ? `Sent from account ${fromAccount}.` : '', toAccount ? `Sent to account ${toAccount}.` : '']
    .filter(Boolean)
    .join(' ');
  const copy = describeSalaryNotice(name, shown(date), amount, paid, owed, amountValue, paidValue, payment.paymentStatus, extra);
  const contact = {
    address: settings?.address,
    phone: settings?.phone,
    email: settings?.email,
    website: settings?.website,
  };
  const message = {
    centerName: center,
    headline: copy.headline,
    intro: copy.intro,
    rows: [
      { label: 'Teacher', value: name },
      { label: 'Email', value: email },
      { label: 'Payment date', value: date },
      { label: 'Amount', value: amount },
      { label: 'Amount paid', value: paid },
      { label: 'Still owed', value: owed },
      { label: 'Method', value: method },
      { label: 'Status', value: copy.status },
      { label: 'Sent from', value: fromAccount },
      { label: 'Paid to', value: toAccount },
      { label: 'Notes', value: payment.notes },
    ],
    reference: payment.paymentId,
    contact,
  };
  const subject = `${center} · ${copy.subjectPhrase} · ${shown(date)}`;
  return {
    teacher,
    name,
    email,
    subject,
    text: emailPlain(message),
    html: emailHtml(message),
    amount,
    paid,
    date: shown(date),
    status: copy.status,
    headline: copy.headline,
    notifyTitle: copy.notifyTitle,
  };
}

export function notifyTeacherPayment(store: HirayaDatabase, paymentId: string, actorId = '') {
  const payment = findTeacherPayment(store, paymentId);
  if (!payment) throw new Error('Teacher payment not found.');
  if (!payment.studentId) throw new Error('This payment is not linked to a teacher.');
  const teacher = store.users.find((item) => item.userId === payment.studentId);
  if (!teacher) throw new Error('Teacher account not found.');
  const slip = buildTeacherPayslip(store, payment);
  const title = slip.notifyTitle;
  const message = slip.text.split('\n').find((line) => line.startsWith('Good day,')) || slip.headline;
  const now = new Date().toISOString();
  const alert = {
    alertId: newAlertId(),
    kind: 'payment',
    title,
    message,
    recipientId: teacher.userId,
    href: 'payments',
    status: 'active',
    createdAt: now,
    read: false,
    relatedRecordId: payment.paymentId,
  };
  void actorId;
  return {
    store: { ...store, alerts: [alert, ...(store.alerts || [])] },
    teacher,
    message,
    email: slip.email,
  };
}

export function openTeacherPayslipMailto(store: HirayaDatabase, payment: Payment) {
  const slip = buildTeacherPayslip(store, payment);
  if (!slip.email || !slip.email.includes('@')) {
    throw new Error('This teacher has no email on file. Add an email on their staff profile first.');
  }
  const href = `mailto:${encodeURIComponent(slip.email)}?subject=${encodeURIComponent(slip.subject)}&body=${encodeURIComponent(slip.text)}`;
  if (typeof window !== 'undefined') window.location.href = href;
  return slip;
}
