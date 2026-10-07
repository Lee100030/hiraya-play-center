'use client';

import { AdminModal } from '@/components/admin/AdminModal';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { Button, EmptyState, Field, Input, Loading, Select, StatusBadge, Table } from '@hiraya/ui';
import {
  compareStudentNames,
  displayName,
  formatPeso,
  isTeacherPayment,
  notifyTeacherPayment,
  openTeacherPayslipMailto,
  ownedPersonalEmail,
  personalEmailError,
  personalEmailOwnerError,
  parentsForStudent,
  parsePaymentLane,
  paymentBalanceLabel,
  studentBalanceDueAt,
  studentBalanceReceivedBy,
  studentDisplay,
  studentPaymentBalance,
  studentPayments,
  teacherPaymentRows,
  upsertStudentBalance,
  applyTeacherPayment,
  recordStudentAmountReceived,
  updateStudentPayment,
  cancelStudentPayment,
  programForStudent,
  studentTuitionFee,
  studentTotalPaid,
  scrubLeftoverPaymentData,
  studentPaymentTypeLabel,
} from '@hiraya/utils';
import type { HirayaDatabase, HirayaUser, Payment } from '@hiraya/types';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

function noticeClass(text: string) {
  return /could not|failed|error|incorrect|required|forbidden|do not match|invalid/i.test(text) ? 'hlc-field-error' : 'form-ok';
}

function formatDueLabel(value?: string) {
  const raw = (value || '').trim().slice(0, 10);
  if (!raw) return '—';
  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function resolveReceivedBy(form: FormData) {
  const pick = String(form.get('receivedByPick') || '').trim();
  const custom = String(form.get('receivedByCustom') || '').trim();
  if (pick === '__custom__') return custom;
  return pick;
}

function PaymentReceivedByField({
  store,
  actor,
  defaultValue = '',
  value,
  onChange,
  disabled,
}: {
  store: HirayaDatabase;
  actor: HirayaUser;
  defaultValue?: string;
  value?: string;
  onChange?: (next: string) => void;
  disabled?: boolean;
}) {
  const people = useMemo(
    () =>
      store.users
        .filter((item) => {
          const role = (item.role || '').toLowerCase();
          const status = (item.status || 'active').toLowerCase();
          if (status !== 'active' && status !== 'pending') return false;
          return role === 'admin' || role === 'super_admin' || role === 'staff' || role === 'teacher';
        })
        .sort((a, b) => displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base' })),
    [store.users],
  );
  const actorName = displayName(actor);
  const known = useMemo(() => new Set(people.map((item) => displayName(item))), [people]);
  const current = value ?? defaultValue;
  const startsCustom = Boolean(current) && current !== actorName && !known.has(current);
  const [customMode, setCustomMode] = useState(startsCustom);
  const controlled = typeof onChange === 'function';

  return (
    <>
      <Field label="Received by" required hint="Who received the payment from this student.">
        <Select
          name={controlled ? undefined : 'receivedByPick'}
          value={controlled ? (customMode ? '__custom__' : current || actorName) : undefined}
          defaultValue={controlled ? undefined : startsCustom ? '__custom__' : current || actorName}
          required
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value;
            const custom = next === '__custom__';
            setCustomMode(custom);
            if (!controlled) return;
            if (custom) {
              if (known.has(current) || current === actorName) onChange('');
              return;
            }
            onChange(next);
          }}
        >
          <option value={actorName}>{actorName} (you)</option>
          {people
            .filter((item) => item.userId !== actor.userId)
            .map((item) => (
              <option key={item.userId} value={displayName(item)}>
                {displayName(item)}
              </option>
            ))}
          <option value="__custom__">Other (type name)…</option>
        </Select>
      </Field>
      {customMode ? (
        <Field label="Custom name" required>
          <Input
            name={controlled ? undefined : 'receivedByCustom'}
            value={controlled ? (startsCustom || customMode ? current : '') : undefined}
            defaultValue={controlled ? undefined : startsCustom ? current : ''}
            required
            disabled={disabled}
            placeholder="Who received the money"
            onChange={controlled ? (event) => onChange(event.target.value) : undefined}
          />
        </Field>
      ) : null}
    </>
  );
}

function PaymentReceiptField({
  paymentId,
  receiptName,
  busy,
  onBusy,
  onUploaded,
  onNotice,
  onError,
}: {
  paymentId: string;
  receiptName?: string;
  busy: boolean;
  onBusy: (value: boolean) => void;
  onUploaded: (next: HirayaDatabase) => Promise<void> | void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    if (!paymentId) {
      onError('Save the balance first, then upload the receipt.');
      return;
    }
    onError('');
    onBusy(true);
    try {
      const next = await api.uploadPaymentReceipt(paymentId, file, file.name);
      await onUploaded(next);
      onNotice(`Receipt uploaded: ${file.name}. It will be attached to the email.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not upload the receipt.');
    } finally {
      onBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <Field label="Receipt" hint="Photo or PDF of the receipt. It is attached when you send the email.">
      <div className="receipt-upload">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf,.png,.jpg,.jpeg,.webp"
          hidden
          onChange={(event) => void onPick(event.target.files)}
        />
        <Button type="button" variant="ghost" disabled={busy || !paymentId} onClick={() => inputRef.current?.click()}>
          {receiptName ? 'Replace receipt' : 'Upload receipt'}
        </Button>
        {receiptName && paymentId ? (
          <button type="button" className="receipt-link" disabled={busy} onClick={() => void api.openPaymentReceipt(paymentId)}>
            {receiptName}
          </button>
        ) : (
          <span className="muted">{paymentId ? 'No receipt yet.' : 'Save the balance first.'}</span>
        )}
      </div>
    </Field>
  );
}

function receiptPayment(payments: Payment[]) {
  const closed = new Set(['paid', 'cancelled', 'canceled', 'void', 'waived']);
  const rows = [...payments].reverse();
  return (
    rows.find((row) => (row.receiptName || row.receiptPath || '').trim()) ||
    rows.find((row) => !closed.has((row.paymentStatus || '').toLowerCase())) ||
    rows[0] ||
    null
  );
}

function EmailSentPop({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 2400);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  return createPortal(
    <div className="email-sent-pop" role="status" aria-live="polite">
      <span className="email-sent-pop-glow" aria-hidden="true" />
      <strong>Email sent</strong>
    </div>,
    document.body,
  );
}

function TeacherPaymentModal({
  store,
  paymentId,
  actor,
  save,
  onClose,
}: {
  store: HirayaDatabase;
  paymentId: string;
  actor: HirayaUser;
  save: (next: HirayaDatabase) => Promise<void>;
  onClose: () => void;
}) {
  const payment = store.payments.find((item) => item.paymentId === paymentId) || null;
  const teacher = payment ? store.users.find((item) => item.userId === payment.studentId) || null : null;
  const history = payment ? teacherPaymentRows(store, payment.studentId) : [];
  const [amount, setAmount] = useState(String(payment?.amount ?? 0));
  const [amountPaid, setAmountPaid] = useState(String(payment?.amountPaid ?? 0));
  const [status, setStatus] = useState(payment?.paymentStatus || 'pending');
  const [method, setMethod] = useState(payment?.paymentMethod || 'cash');
  const [notes, setNotes] = useState(payment?.notes || '');
  const [accountNumber, setAccountNumber] = useState(payment?.accountNumber || '');
  const [fromAccountNumber, setFromAccountNumber] = useState(payment?.fromAccountNumber || '');
  const boundMail = ownedPersonalEmail(store.users || [], payment?.studentId || '');
  const mailKey = `${payment?.studentId || ''}:${boundMail.email}:${boundMail.error || ''}`;
  const [personalEmail, setPersonalEmail] = useState(boundMail.email);
  const [emailBindError, setEmailBindError] = useState<string | null>(boundMail.error);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [emailPop, setEmailPop] = useState(false);
  const closeEmailPop = useRef(() => setEmailPop(false));

  useEffect(() => {
    const row = store.payments.find((item) => item.paymentId === paymentId);
    if (!row) return;
    setAmount(String(row.amount ?? 0));
    setAmountPaid(String(row.amountPaid ?? 0));
    setStatus(row.paymentStatus || 'pending');
    setMethod(row.paymentMethod || 'cash');
    setNotes(row.notes || '');
    setAccountNumber(row.accountNumber || '');
    setFromAccountNumber(row.fromAccountNumber || '');
  }, [paymentId]);

  useEffect(() => {
    setPersonalEmail(boundMail.email);
    setEmailBindError(boundMail.error);
  }, [mailKey]);

  if (!payment || !teacher) return null;
  const current = payment;
  const person = teacher;

  function rejectForeignEmail(typed: string) {
    const foreign = personalEmailOwnerError(store.users || [], person.userId, typed);
    if (!foreign) return false;
    setEmailBindError(foreign);
    setError(foreign);
    setBusy(false);
    return true;
  }

  async function savePayment() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const typed = personalEmail.trim();
    if (rejectForeignEmail(typed)) return;
    if (typed) {
      const invalid = personalEmailError(typed);
      if (invalid) {
        setError(invalid);
        setBusy(false);
        return;
      }
    }
    try {
      await save(
        applyTeacherPayment(
          {
            ...store,
            users: (store.users || []).map((user) => (user.userId === person.userId ? { ...user, personalEmail: typed } : user)),
          },
          {
            paymentId: current.paymentId,
            teacherId: person.userId,
            amount,
            amountPaid,
            paymentStatus: status,
            paymentMethod: method,
            notes,
            accountNumber: accountNumber.trim(),
            fromAccountNumber: fromAccountNumber.trim(),
            recordedBy: actor.userId,
            receivedBy: displayName(actor),
          },
        ),
      );
      setNotice('Payment saved. Center cash flow lists this as Teachers salary.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save payment.');
    } finally {
      setBusy(false);
    }
  }

  async function notifyTeacher() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const typed = personalEmail.trim();
    if (rejectForeignEmail(typed)) return;
    if (typed && personalEmailError(typed)) {
      setError(personalEmailError(typed));
      setBusy(false);
      return;
    }
    try {
      try {
        const result = await api.notifyTeacherPayment(
          current.paymentId,
          typed,
          accountNumber.trim(),
          fromAccountNumber.trim(),
          Math.max(0, Number(amount) || 0),
          Math.max(0, Number(amountPaid) || 0),
        );
        const refreshed = await api.getStore();
        await save(refreshed);
        setNotice(
          result.emailed && result.to
            ? `Email sent to ${displayName(person)}.`
            : `Notified ${displayName(person)} on their account. ${result.emailError || 'Add a valid personal email so Hiraya can send the message.'}`,
        );
      } catch {
        const result = notifyTeacherPayment(store, current.paymentId, actor.userId);
        await save(result.store);
        setNotice(`Notified ${displayName(result.teacher)} on their account. Add a valid personal email so Hiraya can send the message.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not notify teacher.');
    } finally {
      setBusy(false);
    }
  }

  async function sendPayslip() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const typed = personalEmail.trim();
    if (rejectForeignEmail(typed)) return;
    const invalid = personalEmailError(typed);
    if (invalid) {
      setError(invalid);
      setBusy(false);
      return;
    }
    try {
      await save(
        applyTeacherPayment(store, {
          paymentId: current.paymentId,
          teacherId: person.userId,
          amount,
          amountPaid,
          paymentStatus: status,
          paymentMethod: method,
          notes,
          accountNumber: accountNumber.trim(),
          fromAccountNumber: fromAccountNumber.trim(),
          recordedBy: actor.userId,
          receivedBy: displayName(actor),
        }),
      );
      await api.sendTeacherPayslip(
        current.paymentId,
        typed,
        accountNumber.trim(),
        fromAccountNumber.trim(),
        Math.max(0, Number(amount) || 0),
        Math.max(0, Number(amountPaid) || 0),
      );
      const refreshed = await api.getStore();
      await save(refreshed);
      setNotice(null);
      setEmailPop(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not email payslip.';
      if (/SMTP is not configured|Open email draft/i.test(message)) {
        try {
          openTeacherPayslipMailto(store, current);
          setNotice('Opened an email draft with the payslip (SMTP is not configured on the server).');
          setError(null);
        } catch (mailErr) {
          setError(mailErr instanceof Error ? mailErr.message : message);
        }
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    {emailPop ? <EmailSentPop onDone={closeEmailPop.current} /> : null}
    <AdminModal
      title={`${displayName(person)} · Payment`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void notifyTeacher()}>
            Notify teacher
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void sendPayslip()}>
            Send to their email
          </Button>
          <Button type="button" disabled={busy} onClick={() => void savePayment()}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="balance-detail">
        <p className="muted balance-detail-lead">
          Hiraya account: {person.email || 'none'}. Mail is sent from the center mailbox to their personal email.
        </p>
        <div className="balance-detail-fields">
          <Field label="Amount">
            <Input type="number" min={0} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={busy} />
          </Field>
          <Field label="Amount paid">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amountPaid}
              onChange={(event) => setAmountPaid(event.target.value)}
              disabled={busy}
            />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(event) => setStatus(event.target.value)} disabled={busy}>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
            </Select>
          </Field>
          <Field label="Method">
            <Input value={method} onChange={(event) => setMethod(event.target.value)} disabled={busy} />
          </Field>
          <Field label="Sent from" hint="Account the center sent this salary from.">
            <Input value={fromAccountNumber} onChange={(event) => setFromAccountNumber(event.target.value)} disabled={busy} placeholder="GCash or bank account" />
          </Field>
          <Field label="Paid to" hint="Account the teacher was paid into. Included in the email.">
            <Input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} disabled={busy} placeholder="GCash or bank account" />
          </Field>
          <PaymentReceiptField
            paymentId={current.paymentId}
            receiptName={current.receiptName}
            busy={busy}
            onBusy={setBusy}
            onUploaded={(next) => save(next)}
            onNotice={setNotice}
            onError={(message) => {
              setNotice(null);
              setError(message || null);
            }}
          />
          <Field label="Personal email" hint="A real inbox such as Gmail. The Hiraya sign-in address cannot receive mail." error={emailBindError || undefined}>
            <Input
              type="email"
              value={personalEmail}
              placeholder="name@gmail.com"
              disabled={busy}
              aria-invalid={emailBindError ? true : undefined}
              onChange={(event) => {
                const next = event.target.value;
                setPersonalEmail(next);
                setEmailBindError(personalEmailOwnerError(store.users || [], person.userId, next));
              }}
            />
          </Field>
          <Field label="Notes" optional>
            <Input value={notes} onChange={(event) => setNotes(event.target.value)} disabled={busy} />
          </Field>
        </div>
        {error ? <p className="hlc-field-error">{error}</p> : null}
        {notice ? <p className="form-ok">{notice}</p> : null}
        <section className="balance-detail-history">
          <h3>Payment records</h3>
          {history.length === 0 ? (
            <EmptyState title="No payment records yet" hint="Saved salary payments for this teacher will show up here." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Paid</th>
                  <th>Sent from</th>
                  <th>Paid to</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.paymentId}>
                    <td>{(row.paymentDate || row.paidAt || '').slice(0, 10) || '—'}</td>
                    <td>₱{formatPeso(Number(row.amount || 0))}</td>
                    <td>₱{formatPeso(Number(row.amountPaid || 0))}</td>
                    <td>{row.fromAccountNumber || '—'}</td>
                    <td>{row.accountNumber || '—'}</td>
                    <td>
                      <StatusBadge status={row.paymentStatus} />
                    </td>
                    <td>{row.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      </div>
    </AdminModal>
    </>
  );
}

function StudentBalanceModal({
  store,
  studentId,
  actorId,
  save,
  onReceive,
  onEditPayment,
  onClose,
}: {
  store: HirayaDatabase;
  studentId: string;
  actorId: string;
  save: (next: HirayaDatabase) => Promise<void>;
  onReceive?: () => void;
  onEditPayment?: (paymentId: string) => void;
  onClose: () => void;
}) {
  const student = store.students.find((item) => item.studentId === studentId);
  const bill = studentPaymentBalance(store, studentId);
  const programFee = programForStudent(store, studentId);
  const programHasFee = Number(programFee?.tuitionFee || 0) > 0;
  const payments = studentPayments(store, studentId);
  const parents = parentsForStudent(store, studentId);
  const [balance, setBalance] = useState(String(studentTuitionFee(store, studentId)));
  const typedTuition = Number(balance);
  const previewRemaining = Math.max(
    0,
    Math.round(((programHasFee ? bill.tuitionFee : Number.isFinite(typedTuition) ? typedTuition : 0) - studentTotalPaid(store, studentId)) * 100) / 100,
  );
  const [dueAt, setDueAt] = useState(studentBalanceDueAt(store, studentId));
  const [parentEmails, setParentEmails] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setBalance(String(studentTuitionFee(store, studentId)));
    setDueAt(studentBalanceDueAt(store, studentId));
  }, [studentId]);

  const parentMailKey = parents.map((parent) => `${parent.userId}:${parent.personalEmail || ''}`).join('|');
  useEffect(() => {
    setParentEmails(Object.fromEntries(parents.map((parent) => [parent.userId, parent.personalEmail || ''])));
  }, [parentMailKey]);

  if (!student) return null;

  async function saveBalance() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await save(upsertStudentBalance(store, studentId, balance, '', actorId, dueAt));
      setNotice('Tuition fee saved. Remaining balance is tuition fee minus total paid.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save balance.');
    } finally {
      setBusy(false);
    }
  }

  async function notifyParent() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      for (const parent of parents) {
        const value = (parentEmails[parent.userId] || '').trim();
        if (!value) continue;
        const invalid = personalEmailError(value);
        if (invalid) throw new Error(`${displayName(parent)}: ${invalid}`);
      }
      const recipients = parents
        .map((parent) => ({ userId: parent.userId, personalEmail: (parentEmails[parent.userId] || '').trim() }))
        .filter((item) => item.personalEmail);
      try {
        const rows = [...studentPayments(store, studentId)].reverse();
        const result = await api.notifyStudentBalance(
          studentId,
          recipients,
          rows.find((row) => (row.accountNumber || '').trim())?.accountNumber || '',
          rows.find((row) => (row.fromAccountNumber || '').trim())?.fromAccountNumber || '',
        );
        const refreshed = await api.getStore();
        await save(refreshed);
        const parentNames = parents.map((parent) => displayName(parent)).filter(Boolean).join(', ') || 'the parent';
        if (!result.emailed) throw new Error(result.emailError || 'The email was not sent. Check SMTP on the API and the parent personal email.');
        setNotice(`Email sent to ${result.to || parentNames}.`);
      } catch (err) {
        throw err instanceof Error ? err : new Error('Could not notify parent.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not notify parent.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminModal
      title={`${studentDisplay(student)} · Remaining balance`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" disabled={busy} onClick={onReceive}>
            Amount received
          </Button>
          <Button type="button" disabled={busy} onClick={() => void saveBalance()}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="balance-detail">
        <p className="muted balance-detail-lead">
          {parents.length
            ? `Linked parent${parents.length === 1 ? '' : 's'}: ${parents.map((item) => displayName(item)).join(', ')}`
            : 'No linked parent yet — link one on the student record to send balance notices.'}
        </p>
        <div className="balance-detail-fields">
          <Field
            label="Tuition fee"
            hint={
              programHasFee
                ? `Default for ${programFee?.name || 'this program'} is ₱${formatPeso(Number(programFee?.tuitionFee || 0))}. Type a different amount here for this student only. Remaining balance is that fee minus total paid.`
                : programFee
                  ? `No fee is set yet for ${programFee.name}. Type this student's tuition here, or set one fee for the whole program in Program tuition management.`
                  : 'Total amount this student is required to pay. Or set one fee for the whole program in Program tuition management.'
            }
          >
            <Input
              type="number"
              min={0}
              step="0.01"
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
              disabled={busy}
            />
          </Field>
          <div className="balance-readouts">
            <p className="hlc-money-readout">
              <span>Total paid</span>
              <strong>₱{formatPeso(studentTotalPaid(store, studentId))}</strong>
            </p>
            <p className="hlc-money-readout">
              <span>Remaining balance</span>
              <strong>₱{formatPeso(previewRemaining)}</strong>
            </p>
          </div>
          <Field label="Due date" optional hint="When this balance should be paid.">
            <Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} disabled={busy} />
          </Field>
        </div>
        <section className="balance-notify">
          <h3>Notify parents for balance</h3>
          <p className="muted">
            {parents.length
              ? 'Mail goes to each parent’s personal email. Their Hiraya sign-in address cannot receive it.'
              : 'No linked parent yet — link one on the student record, then send the balance notice.'}
          </p>
          {parents.length ? (
            <div className="balance-detail-fields">
              {parents.map((parent) => (
                <Field
                  key={parent.userId}
                  label={`${displayName(parent)} personal email`}
                  hint={`Hiraya account: ${parent.email || 'none'}.`}
                >
                  <Input
                    type="email"
                    value={parentEmails[parent.userId] || ''}
                    placeholder="name@gmail.com"
                    disabled={busy}
                    onChange={(event) =>
                      setParentEmails((current) => ({ ...current, [parent.userId]: event.target.value }))
                    }
                  />
                </Field>
              ))}
            </div>
          ) : null}
          <div>
            <Button type="button" variant="ghost" disabled={busy || !parents.length} onClick={() => void notifyParent()}>
              Notice parent via email
            </Button>
          </div>
        </section>
        {error ? <p className="hlc-field-error">{error}</p> : null}
        {notice ? <p className="form-ok">{notice}</p> : null}
        <section className="balance-detail-history">
          <h3>Payment records</h3>
          {payments.length === 0 ? (
            <p className="muted">No payment charges yet for this student.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((row) => (
                  <tr key={row.paymentId}>
                    <td>{(row.paidAt || row.paymentDate || '').slice(0, 10) || '—'}</td>
                    <td>{studentPaymentTypeLabel(store, row)}</td>
                    <td>₱{formatPeso(Number(row.amountPaid || row.amount || 0))}</td>
                    <td>
                      <StatusBadge status={row.paymentStatus} />
                    </td>
                    <td>{row.notes || '—'}</td>
                    <td>
                      {(row.paymentStatus || '').toLowerCase() === 'cancelled' ? null : (
                        <Button type="button" variant="ghost" disabled={busy} onClick={() => onEditPayment?.(row.paymentId)}>
                          Edit details
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      </div>
    </AdminModal>
  );
}

function StudentReceivedModal({
  store,
  studentId,
  actor,
  save,
  stacked,
  paymentId,
  onClose,
}: {
  store: HirayaDatabase;
  studentId: string;
  actor: HirayaUser;
  save: (next: HirayaDatabase) => Promise<void>;
  stacked?: boolean;
  paymentId?: string | null;
  onClose: () => void;
}) {
  const student = store.students.find((item) => item.studentId === studentId);
  const bill = studentPaymentBalance(store, studentId);
  const payments = studentPayments(store, studentId);
  const editing = paymentId ? payments.find((row) => row.paymentId === paymentId) : undefined;
  const slip = editing || receiptPayment(payments);
  const [amountReceived, setAmountReceived] = useState(editing ? String(editing.amountPaid || editing.amount || 0) : '');
  const [method, setMethod] = useState(editing?.paymentMethod || 'cash');
  const [receivedBy, setReceivedBy] = useState(editing?.receivedBy || studentBalanceReceivedBy(store, studentId) || displayName(actor));
  const [accountNumber, setAccountNumber] = useState(editing?.accountNumber || '');
  const [fromAccountNumber, setFromAccountNumber] = useState(editing?.fromAccountNumber || '');
  const [notes, setNotes] = useState(editing?.notes || '');
  const [paymentDate, setPaymentDate] = useState((editing?.paidAt || editing?.paymentDate || '').slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(paymentId || null);

  useEffect(() => {
    const current = paymentId ? studentPayments(store, studentId).find((row) => row.paymentId === paymentId) : undefined;
    const rows = [...studentPayments(store, studentId)].reverse();
    setEditingPaymentId(paymentId || null);
    setAmountReceived(current ? String(current.amountPaid || current.amount || 0) : '');
    setMethod(current?.paymentMethod || 'cash');
    setReceivedBy(current?.receivedBy || studentBalanceReceivedBy(store, studentId) || displayName(actor));
    setAccountNumber(current?.accountNumber || rows.find((row) => (row.accountNumber || '').trim())?.accountNumber || '');
    setFromAccountNumber(current?.fromAccountNumber || rows.find((row) => (row.fromAccountNumber || '').trim())?.fromAccountNumber || '');
    setNotes(current?.notes || '');
    setPaymentDate((current?.paidAt || current?.paymentDate || '').slice(0, 10));
    setError(null);
    setNotice(current ? 'Edit these payment details, then save.' : null);
  }, [actor, paymentId, studentId]);

  if (!student) return null;

  async function saveReceived() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = editingPaymentId
        ? updateStudentPayment(store, editingPaymentId, amountReceived, actor.userId, {
            method,
            receivedBy,
            accountNumber: accountNumber.trim(),
            fromAccountNumber: fromAccountNumber.trim(),
            notes: notes.trim(),
            paymentDate,
          })
        : recordStudentAmountReceived(
            store,
            studentId,
            amountReceived,
            actor.userId,
            receivedBy,
            accountNumber.trim(),
            fromAccountNumber.trim(),
            method,
            notes.trim(),
            paymentDate,
          );
      await save(next);
      const due = studentPaymentBalance(next, studentId).due;
      setEditingPaymentId(null);
      setAmountReceived('');
      setNotice(`Amount received saved. Remaining balance is ₱${formatPeso(due)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the amount received.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminModal
      title={`${studentDisplay(student)} · ${editingPaymentId ? 'Edit payment details' : 'Amount received'}`}
      stacked={stacked}
      onClose={onClose}
      footer={
        <Button type="button" disabled={busy} onClick={() => void saveReceived()}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <div className="balance-detail">
        <p className="muted balance-detail-lead">
          Tuition fee ₱{formatPeso(studentTuitionFee(store, studentId))}. Total paid ₱{formatPeso(studentTotalPaid(store, studentId))}. Remaining balance ₱{formatPeso(bill.due)}.
        </p>
        <div className="balance-detail-fields">
          <Field label="Amount received" hint="Money collected from the parent for this student.">
            <Input type="number" min={0} step="0.01" value={amountReceived} disabled={busy} onChange={(event) => setAmountReceived(event.target.value)} />
          </Field>
          <Field label="Method">
            <Input value={method} disabled={busy} onChange={(event) => setMethod(event.target.value)} />
          </Field>
          <Field label="Who sent" hint="Account number of the person who sent the money.">
            <Input value={fromAccountNumber} placeholder="GCash or bank account" disabled={busy} onChange={(event) => setFromAccountNumber(event.target.value)} />
          </Field>
          <Field label="Where it was sent" hint="Account number where this money was sent.">
            <Input value={accountNumber} placeholder="GCash or bank account" disabled={busy} onChange={(event) => setAccountNumber(event.target.value)} />
          </Field>
          <PaymentReceivedByField store={store} actor={actor} value={receivedBy} onChange={setReceivedBy} disabled={busy} />
          <Field label="Payment date" optional>
            <Input type="date" value={paymentDate} disabled={busy} onChange={(event) => setPaymentDate(event.target.value)} />
          </Field>
          <Field label="Notes" optional>
            <Input value={notes} disabled={busy} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          <PaymentReceiptField
            paymentId={slip?.paymentId || ''}
            receiptName={slip?.receiptName}
            busy={busy}
            onBusy={setBusy}
            onUploaded={(next) => save(next)}
            onNotice={setNotice}
            onError={(message) => {
              setNotice(null);
              setError(message || null);
            }}
          />
        </div>
        {error ? <p className="hlc-field-error">{error}</p> : null}
        {notice ? <p className="form-ok">{notice}</p> : null}
        <section className="balance-detail-history">
          <h3>Amounts received</h3>
          {payments.length === 0 ? (
            <p className="muted">No amount has been received for this student yet.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Who sent</th>
                  <th>Where it was sent</th>
                  <th>Received by</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((row) => (
                  <tr key={row.paymentId}>
                    <td>{(row.paidAt || row.paymentDate || '').slice(0, 10) || '—'}</td>
                    <td>{studentPaymentTypeLabel(store, row)}</td>
                    <td>₱{formatPeso(Number(row.amountPaid || row.amount || 0))}</td>
                    <td>{row.fromAccountNumber || '—'}</td>
                    <td>{row.accountNumber || '—'}</td>
                    <td>{row.receivedBy || '—'}</td>
                    <td>
                      {(row.paymentStatus || '').toLowerCase() === 'cancelled' ? null : (
                        <>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            setEditingPaymentId(row.paymentId);
                            setAmountReceived(String(row.amountPaid || row.amount || 0));
                            setMethod(row.paymentMethod || 'cash');
                            setReceivedBy(row.receivedBy || displayName(actor));
                            setAccountNumber(row.accountNumber || '');
                            setFromAccountNumber(row.fromAccountNumber || '');
                            setNotes(row.notes || '');
                            setPaymentDate((row.paidAt || row.paymentDate || '').slice(0, 10));
                            setNotice('Edit these payment details, then save.');
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            void (async () => {
                              setBusy(true);
                              setError(null);
                              try {
                                await save(cancelStudentPayment(store, row.paymentId, actor.userId));
                                setNotice('Payment cancelled. Totals were recalculated.');
                              } catch (err) {
                                setError(err instanceof Error ? err.message : 'Could not cancel payment.');
                              } finally {
                                setBusy(false);
                              }
                            })();
                          }}
                        >
                          Cancel
                        </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      </div>
    </AdminModal>
  );
}

export default function AdminPaymentsPage() {
  const { user } = useAuth();
  const { store, loading, save } = useStore();
  const searchParams = useSearchParams();
  const paymentLane = parsePaymentLane(searchParams.get('lane'));
  const [editing, setEditing] = useState<Payment | 'new' | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [receivedId, setReceivedId] = useState<string | null>(null);
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);
  const [teacherPaymentId, setTeacherPaymentId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const scrubbedPayments = useRef(false);
  const current = editing && editing !== 'new' ? editing : null;
  useEffect(() => {
    if (scrubbedPayments.current || loading) return;
    const next = scrubLeftoverPaymentData(store);
    if (!next) return;
    scrubbedPayments.current = true;
    void save(next).catch(() => {
      scrubbedPayments.current = false;
    });
  }, [store, save, loading]);

  const teachers = useMemo(
    () => store.users.filter((item) => item.role === 'teacher' || item.role === 'staff'),
    [store.users],
  );
  const teacherRows = useMemo(() => store.payments.filter((row) => isTeacherPayment(row)), [store.payments]);
  const balanceRows = useMemo(
    () =>
      [...store.students]
        .sort(compareStudentNames)
        .map((student) => ({
          student,
          bill: studentPaymentBalance(store, student.studentId),
          label: paymentBalanceLabel(store, student.studentId),
          dueAt: studentBalanceDueAt(store, student.studentId),
          receivedBy: studentBalanceReceivedBy(store, student.studentId),
          parents: parentsForStudent(store, student.studentId),
        })),
    [store],
  );

  async function notifyParentsFor(studentId: string) {
    setNotice(null);
    try {
      const result = await api.notifyStudentBalance(studentId);
      const refreshed = await api.getStore();
      await save(refreshed);
      const parentNames = parentsForStudent(store, studentId).map((parent) => displayName(parent)).filter(Boolean).join(', ') || 'the parent';
      if (!result.emailed) throw new Error(result.emailError || 'The email was not sent. Check SMTP on the API and the parent personal email.');
      setNotice(`Email sent to ${result.to || parentNames}.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not notify parent.');
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (paymentLane !== 'teachers') {
      try {
        await save(
          upsertStudentBalance(
            store,
            String(form.get('payeeId') || ''),
            String(form.get('amount') || ''),
            '',
            user?.userId || '',
            String(form.get('dueAt') || ''),
          ),
        );
        setEditing(null);
        setNotice('Tuition fee saved. Remaining balance is tuition fee minus total paid.');
      } catch (err) {
        setNotice(err instanceof Error ? err.message : 'Could not save the tuition fee.');
      }
      return;
    }
    try {
      await save(
        applyTeacherPayment(store, {
          paymentId: current?.paymentId,
          teacherId: String(form.get('payeeId') || ''),
          amount: String(form.get('amount') || ''),
          amountPaid: String(form.get('amountPaid') || ''),
          paymentMethod: String(form.get('paymentMethod') || 'cash'),
          paymentStatus: String(form.get('paymentStatus') || 'paid'),
          notes: String(form.get('notes') || ''),
          recordedBy: current?.recordedBy || user?.userId || '',
          receivedBy: user ? displayName(user) : '',
        }),
      );
      setEditing(null);
      setNotice('Teacher payment saved. It now appears in Center cash flow for this month.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not save the teacher payment.');
    }
  }

  if (loading) return <Loading />;

  if (paymentLane === 'teachers') {
    return (
      <>
        <AdminPageHeader
          kicker="Records"
          title="Teachers payment"
          description="Pay records for teachers and staff. Saved payments are listed in Center cash flow as Teachers salary."
          actions={
            <button type="button" className="dash-action dash-action-primary" onClick={() => setEditing('new')}>
              Add payment
            </button>
          }
        />
        {notice ? (
          <p className={noticeClass(notice)}>{notice}</p>
        ) : null}
        {teacherRows.length === 0 ? (
          <EmptyState title="No teacher payments" hint="Record a teacher or staff payment here." />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Method</th>
                <th>Status</th>
                <th>Notify</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {teacherRows.map((row) => {
                const teacher = teachers.find((item) => item.userId === row.studentId);
                return (
                  <tr
                    key={row.paymentId}
                    className="row-open"
                    title="Double-click to open payment details"
                    onDoubleClick={() => setTeacherPaymentId(row.paymentId)}
                  >
                    <td>{teacher ? displayName(teacher) : row.studentId || '—'}</td>
                    <td>₱{formatPeso(Number(row.amount || 0))}</td>
                    <td>₱{formatPeso(Number(row.amountPaid || 0))}</td>
                    <td>{row.paymentMethod || '—'}</td>
                    <td>
                      <StatusBadge status={row.paymentStatus} />
                    </td>
                    <td>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={!row.studentId}
                        onClick={(event) => {
                          event.stopPropagation();
                          void (async () => {
                            setNotice(null);
                            try {
                              try {
                                const result = await api.notifyTeacherPayment(row.paymentId);
                                const refreshed = await api.getStore();
                                await save(refreshed);
                                setNotice(
                                  result.emailed && result.to
                                    ? `Email sent to ${teacher ? displayName(teacher) : 'the teacher'}.`
                                    : 'Notified on their account. Email will send once SMTP is set on the API.',
                                );
                              } catch {
                                const result = notifyTeacherPayment(store, row.paymentId, user?.userId || '');
                                await save(result.store);
                                setNotice(`Notified ${displayName(result.teacher)} on their account. Email will send once SMTP is set on the API.`);
                              }
                            } catch (err) {
                              setNotice(err instanceof Error ? err.message : 'Could not notify teacher.');
                            }
                          })();
                        }}
                      >
                        Notify
                      </Button>
                    </td>
                    <td>
                      <Button type="button" variant="ghost" onClick={() => setTeacherPaymentId(row.paymentId)}>
                        Open
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => {
                          const who = teacher ? displayName(teacher) : 'this payment';
                          if (!window.confirm(`Delete the payment for ${who}? This cannot be undone.`)) return;
                          void save({
                            ...store,
                            payments: store.payments.filter((item) => item.paymentId !== row.paymentId),
                          }).then(() => setNotice('Payment deleted.'));
                        }}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {editing && user ? (
          <AdminModal
            title={current ? 'Edit teacher payment' : 'Add teacher payment'}
            onClose={() => setEditing(null)}
            footer={
              <>
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" form="payment-form">
                  Save
                </Button>
              </>
            }
          >
            <form id="payment-form" onSubmit={onSubmit}>
              <Field label="Teacher" required>
                <Select name="payeeId" defaultValue={current?.studentId || ''} required>
                  <option value="">Select</option>
                  {teachers.map((item) => (
                    <option key={item.userId} value={item.userId}>
                      {displayName(item)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Amount">
                <Input name="amount" type="number" min={0} defaultValue={current?.amount ?? ''} />
              </Field>
              <Field label="Amount paid" hint="This amount is recorded as Teachers salary in Center cash flow.">
                <Input name="amountPaid" type="number" min={0} defaultValue={current?.amountPaid ?? ''} />
              </Field>
              <Field label="Method">
                <Input name="paymentMethod" defaultValue={current?.paymentMethod || 'cash'} />
              </Field>
              <Field label="Status">
                <Select name="paymentStatus" defaultValue={current?.paymentStatus || 'paid'}>
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                  <option value="pending">Pending</option>
                </Select>
              </Field>
              <Field label="Notes" optional>
                <Input name="notes" defaultValue={current?.notes || ''} />
              </Field>
            </form>
          </AdminModal>
        ) : null}
        {teacherPaymentId && user ? (
          <TeacherPaymentModal
            store={store}
            paymentId={teacherPaymentId}
            actor={user}
            save={save}
            onClose={() => setTeacherPaymentId(null)}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        kicker="Records"
        title="Student balance"
        description="Open balance for each learner. Double-click a row to review payment records and edit balance or due date."
        actions={
          <button type="button" className="dash-action dash-action-primary" onClick={() => setEditing('new')}>
            Set tuition fee
          </button>
        }
      />
      {notice ? (
        <p className={noticeClass(notice)}>{notice}</p>
      ) : null}
      {balanceRows.length === 0 ? (
        <EmptyState title="No students" hint="Add students first, then balances appear here." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Program</th>
              <th>Tuition fee</th>
              <th>Total paid</th>
              <th>Remaining balance</th>
              <th>Due</th>
              <th>Received by</th>
              <th>Status</th>
              <th>Received</th>
              <th>Notify</th>
            </tr>
          </thead>
          <tbody>
            {balanceRows.map((row) => (
              <tr
                key={row.student.studentId}
                className="row-open"
                title="Double-click to open balance details"
                onDoubleClick={() => setDetailId(row.student.studentId)}
              >
                <td>{studentDisplay(row.student)}</td>
                <td>{programForStudent(store, row.student.studentId)?.name || row.student.program || '—'}</td>
                <td>₱{formatPeso(studentTuitionFee(store, row.student.studentId))}</td>
                <td>₱{formatPeso(studentTotalPaid(store, row.student.studentId))}</td>
                <td>
                  <span className="balance-cell">₱{formatPeso(row.bill.due)}</span>
                </td>
                <td>{formatDueLabel(row.dueAt)}</td>
                <td>{row.receivedBy || '—'}</td>
                <td>
                  <StatusBadge status={row.bill.status || (row.bill.due > 0 ? 'balance due' : 'paid')} />
                </td>
                <td>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      setReceivedId(row.student.studentId);
                    }}
                  >
                    Amount received
                  </Button>
                </td>
                <td>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!row.parents.length}
                    title={
                      row.parents.length
                        ? `Notify ${row.parents.map((item) => displayName(item)).join(', ')}`
                        : 'No linked parent'
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      void notifyParentsFor(row.student.studentId);
                    }}
                  >
                    Notify
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {editing ? (
        <AdminModal
          title="Set tuition fee"
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" form="payment-form">
                Save
              </Button>
            </>
          }
        >
          <form id="payment-form" onSubmit={onSubmit}>
            <Field label="Student" required>
              <Select name="payeeId" defaultValue={current?.studentId || ''} required>
                <option value="">Select</option>
                {[...store.students].sort(compareStudentNames).map((item) => (
                  <option key={item.studentId} value={item.studentId}>
                    {studentDisplay(item)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tuition fee" hint="Total amount required. Remaining balance is this fee minus total paid.">
              <Input name="amount" type="number" min={0} step="0.01" defaultValue="" />
            </Field>
            <Field label="Due date" optional>
              <Input name="dueAt" type="date" />
            </Field>
          </form>
        </AdminModal>
      ) : null}
      {detailId && user ? (
        <StudentBalanceModal
          store={store}
          studentId={detailId}
          actorId={user.userId}
          save={save}
          onReceive={() => {
            setEditPaymentId(null);
            setReceivedId(detailId);
          }}
          onEditPayment={(id) => {
            setEditPaymentId(id);
            setReceivedId(detailId);
          }}
          onClose={() => setDetailId(null)}
        />
      ) : null}
      {receivedId && user ? (
        <StudentReceivedModal
          store={store}
          studentId={receivedId}
          actor={user}
          save={save}
          stacked={Boolean(detailId)}
          paymentId={editPaymentId}
          onClose={() => {
            setReceivedId(null);
            setEditPaymentId(null);
          }}
        />
      ) : null}
    </>
  );
}
