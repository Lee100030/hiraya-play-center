import type { HirayaDatabase, HirayaUser, Payment } from '@hiraya/types';
import { formatPeso } from './certificateOfEmployment';
import { isTeacherPayment } from './paymentLanes';

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
  if (!raw) return '—';
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

export function buildTeacherPayslip(store: HirayaDatabase, payment: Payment) {
  const teacher = store.users.find((item) => item.userId === payment.studentId);
  const center = store.settings?.centerName || 'Hiraya Kids Learning Center';
  const name = personLabel(teacher);
  const email = (teacher?.email || '').trim();
  const amount = `₱${formatPeso(Number(payment.amount || 0))}`;
  const paid = `₱${formatPeso(Number(payment.amountPaid || 0))}`;
  const date = formatPayDate(payment.paymentDate || payment.paidAt);
  const status = (payment.paymentStatus || 'pending').trim() || 'pending';
  const method = (payment.paymentMethod || 'cash').trim() || 'cash';
  const notes = (payment.notes || '').trim() || '—';
  const subject = `${center} · Your salary is on your account · ${date}`;
  const text = [
    `${center}`,
    `Good day, ${name}. Your salary of ${amount} for ${date} is now on your Hiraya account.`,
    '',
    `Teacher: ${name}`,
    `Email: ${email || '—'}`,
    `Payment date: ${date}`,
    `Amount: ${amount}`,
    `Amount paid: ${paid}`,
    `Method: ${method}`,
    `Status: ${status}`,
    `Sent from: ${(payment.fromAccountNumber || '').trim() || '—'}`,
    `Paid to: ${(payment.accountNumber || '').trim() || '—'}`,
    `Notes: ${notes}`,
    '',
    `Reference: ${payment.paymentId}`,
    '',
    `This notice was sent by ${center}.`,
  ].join('\n');
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#0b1f14;line-height:1.5">
      <h2 style="margin:0 0 8px">${center}</h2>
      <p style="margin:0 0 16px">Good day, ${name}. Your salary of ${amount} for ${date} is now on your Hiraya account.</p>
      <table style="border-collapse:collapse;width:100%;max-width:520px">
        <tr><td style="padding:6px 0;color:#4a5c54">Teacher</td><td style="padding:6px 0"><strong>${name}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#4a5c54">Payment date</td><td style="padding:6px 0">${date}</td></tr>
        <tr><td style="padding:6px 0;color:#4a5c54">Amount</td><td style="padding:6px 0">${amount}</td></tr>
        <tr><td style="padding:6px 0;color:#4a5c54">Amount paid</td><td style="padding:6px 0">${paid}</td></tr>
        <tr><td style="padding:6px 0;color:#4a5c54">Method</td><td style="padding:6px 0">${method}</td></tr>
        <tr><td style="padding:6px 0;color:#4a5c54">Status</td><td style="padding:6px 0">${status}</td></tr>
        <tr><td style="padding:6px 0;color:#4a5c54">Sent from</td><td style="padding:6px 0">${(payment.fromAccountNumber || '').trim() || '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#4a5c54">Paid to</td><td style="padding:6px 0">${(payment.accountNumber || '').trim() || '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#4a5c54">Notes</td><td style="padding:6px 0">${notes}</td></tr>
      </table>
      <p style="margin:16px 0 0;color:#4a5c54;font-size:12px">Reference: ${payment.paymentId}</p>
    </div>
  `.trim();
  return { teacher, name, email, subject, text, html, amount, paid, date, status };
}

export function notifyTeacherPayment(store: HirayaDatabase, paymentId: string, actorId = '') {
  const payment = findTeacherPayment(store, paymentId);
  if (!payment) throw new Error('Teacher payment not found.');
  if (!payment.studentId) throw new Error('This payment is not linked to a teacher.');
  const teacher = store.users.find((item) => item.userId === payment.studentId);
  if (!teacher) throw new Error('Teacher account not found.');
  const slip = buildTeacherPayslip(store, payment);
  const title = 'Salary on your account';
  const sentFrom = (payment.fromAccountNumber || '').trim();
  const sentTo = (payment.accountNumber || '').trim();
  const accountLine = [sentFrom ? `Sent from account ${sentFrom}.` : '', sentTo ? `Sent to account ${sentTo}.` : ''].filter(Boolean).join(' ');
  const message = `Good day, ${slip.name}. Your salary of ${slip.amount} for ${slip.date} is now on your Hiraya account. Amount released: ${slip.paid}.${accountLine ? ` ${accountLine}` : ''} Status: ${slip.status}.`;
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
