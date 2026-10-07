import type { AttendanceRecord, HirayaDatabase, HirayaUser, Payment, ProgressReport } from '@hiraya/types';
import {
  compareStudentNames,
  displayName,
  findDuplicateStaffGroups,
  formatPeso,
  isTeacherPayment,
  isTeacherSalaryMonthPaid,
  markTeacherAttendance,
  markTeacherSalaryMonthPaid,
  mergeDuplicateStaffUsers,
  nextAttendanceMonth,
  newId,
  ownedPersonalEmail,
  personalEmailError,
  personalEmailOwnerError,
  openTeacherPayslipMailto,
  parentsForStudent,
  parsePaymentLane,
  paymentBalanceLabel,
  roleLabel,
  staffTeachers,
  studentBalanceDueAt,
  studentBalanceReceivedBy,
  studentDisplay,
  studentPaymentBalance,
  setTeacherMonthAttendanceCounts,
  studentPayments,
  teacherAttendanceSummaries,
  teacherDayAttendance,
  teacherPaymentRows,
  todayIsoDate,
  upsertStudentBalance,
  applyTeacherPayment,
  programForStudent,
  studentTuitionFee,
  studentTotalPaid,
  scrubLeftoverPaymentData,
  studentPaymentTypeLabel,
  updateStudentPayment,
  cancelStudentPayment,
  upsertTeacherAttendanceDay,
} from '@hiraya/utils';
import { Button, EmptyState, Field, Input, Select, Textarea } from '@hiraya/ui';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api';
import { EditorModal, FormSection } from '../components/EditorModal';
import { DeskModal } from '../components/DeskModal';
import { PageHeader } from '../components/PageHeader';
import { RecordTable, StatusCell } from '../components/RecordTable';
import { PAGE_COPY } from '../lib/views';

function studentName(store: HirayaDatabase, studentId?: string) {
  const student = store.students.find((item) => item.studentId === studentId);
  return student ? studentDisplay(student) : studentId || '—';
}

function teacherName(store: HirayaDatabase, userId?: string) {
  const teacher = store.users.find((item) => item.userId === userId);
  return teacher ? displayName(teacher) : userId || '—';
}

function assertMailed(who: string, result: { emailed?: boolean; to?: string; emailError?: string | null }) {
  if (result.emailed) return `Email sent to ${result.to || who}.`;
  throw new Error((result.emailError || '').trim() || 'The email was not sent. Check SMTP on the API and the parent personal email.');
}

function parentLabel(parents: HirayaUser[]) {
  const names = parents.map((parent) => displayName(parent)).filter(Boolean);
  if (names.length === 0) return 'the parent';
  return names.join(', ');
}

function parentMailRecipients(parents: HirayaUser[], emails: Record<string, string>) {
  for (const parent of parents) {
    const value = (emails[parent.userId] || '').trim();
    if (!value) continue;
    const error = personalEmailError(value);
    if (error) throw new Error(`${displayName(parent)}: ${error}`);
  }
  return parents
    .map((parent) => ({ userId: parent.userId, personalEmail: (emails[parent.userId] || '').trim() }))
    .filter((item) => item.personalEmail);
}

function noticeClass(text: string) {
  return /could not|failed|error|incorrect|required|forbidden|do not match|invalid/i.test(text) ? 'form-error' : 'form-ok';
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
}: {
  store: HirayaDatabase;
  actor: HirayaUser;
  defaultValue?: string;
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
  const startsCustom = Boolean(defaultValue) && !known.has(defaultValue);
  const [customMode, setCustomMode] = useState(startsCustom);

  return (
    <>
      <Field label="Received by" required hint="Who received or handed out this money.">
        <Select
          name="receivedByPick"
          defaultValue={startsCustom ? '__custom__' : defaultValue || actorName}
          required
          onChange={(event) => setCustomMode(event.target.value === '__custom__')}
        >
          <option value={actorName}>{actorName} (you)</option>
          {people
            .filter((item) => item.userId !== actor.userId)
            .map((item) => (
              <option key={item.userId} value={displayName(item)}>
                {displayName(item)}
                {item.role === 'teacher' || item.role === 'staff' ? ` · ${roleLabel(item.role)}` : ''}
              </option>
            ))}
          <option value="__custom__">Other (type name)…</option>
        </Select>
      </Field>
      {customMode ? (
        <Field label="Custom name" required>
          <Input
            name="receivedByCustom"
            defaultValue={startsCustom ? defaultValue : ''}
            required
            placeholder="Who received the money"
          />
        </Field>
      ) : null}
    </>
  );
}

function BalanceReceivedByField({
  store,
  actor,
  value,
  onChange,
  disabled,
}: {
  store: HirayaDatabase;
  actor: HirayaUser;
  value: string;
  onChange: (next: string) => void;
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
  const names = useMemo(() => new Set(people.map((item) => displayName(item))), [people]);
  const actorName = displayName(actor);
  const custom = Boolean(value) && value !== actorName && !names.has(value);
  const [customMode, setCustomMode] = useState(custom);

  return (
    <>
      <Field label="Received by" required hint="Who received the payment from this student.">
        <Select
          value={customMode ? '__custom__' : value || actorName}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value;
            if (next === '__custom__') {
              setCustomMode(true);
              if (names.has(value) || value === actorName) onChange('');
              return;
            }
            setCustomMode(false);
            onChange(next);
          }}
        >
          <option value={actorName}>{actorName} (you)</option>
          {people
            .filter((item) => item.userId !== actor.userId)
            .map((item) => (
              <option key={item.userId} value={displayName(item)}>
                {displayName(item)}
                {item.role === 'teacher' || item.role === 'staff' ? ` · ${roleLabel(item.role)}` : ''}
              </option>
            ))}
          <option value="__custom__">Other (type name)…</option>
        </Select>
      </Field>
      {customMode ? (
        <Field label="Custom name" required>
          <Input
            value={custom ? value : value}
            disabled={disabled}
            placeholder="Who received the money"
            onChange={(event) => onChange(event.target.value)}
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

function StudentBalanceModal({
  store,
  studentId,
  actor,
  saveStore,
  onRefresh,
  onReceive,
  onEditPayment,
  onClose,
}: {
  store: HirayaDatabase;
  studentId: string;
  actor: HirayaUser;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
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
      await saveStore(upsertStudentBalance(store, studentId, balance, '', actor.userId, dueAt));
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
      const recipients = parentMailRecipients(parents, parentEmails);
      const rows = [...studentPayments(store, studentId)].reverse();
      const result = await api.notifyStudentBalance(
        studentId,
        recipients,
        rows.find((row) => (row.accountNumber || '').trim())?.accountNumber || '',
        rows.find((row) => (row.fromAccountNumber || '').trim())?.fromAccountNumber || '',
      );
      await onRefresh?.();
      setNotice(assertMailed(parentLabel(parents), result));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not notify parent.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <DeskModal
      title={`${studentDisplay(student)} · Remaining balance`}
      size="wide"
      onClose={onClose}
      actions={
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
        {error ? <p className="form-error">{error}</p> : null}
        {notice ? <p className="form-ok">{notice}</p> : null}
        <section className="balance-detail-history">
          <h3>Payment records</h3>
          {payments.length === 0 ? (
            <p className="muted">No payment charges yet for this student.</p>
          ) : (
            <div className="table-scroll">
              <table className="hlc-table">
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
                        <StatusCell value={row.paymentStatus} />
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
              </table>
            </div>
          )}
        </section>
      </div>
    </DeskModal>
  );
}

function StudentReceivedModal({
  store,
  studentId,
  actor,
  saveStore,
  onRefresh,
  stacked,
  paymentId,
  onClose,
}: {
  store: HirayaDatabase;
  studentId: string;
  actor: HirayaUser;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
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
      await saveStore(next);
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
    <DeskModal
      title={`${studentDisplay(student)} · ${editingPaymentId ? 'Edit payment details' : 'Amount received'}`}
      size="wide"
      stacked={stacked}
      onClose={onClose}
      actions={
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
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amountReceived}
              onChange={(event) => setAmountReceived(event.target.value)}
              disabled={busy}
            />
          </Field>
          <Field label="Method">
            <Input value={method} onChange={(event) => setMethod(event.target.value)} disabled={busy} />
          </Field>
          <Field label="Who sent" hint="Account number of the person who sent the money.">
            <Input
              value={fromAccountNumber}
              placeholder="GCash or bank account"
              disabled={busy}
              onChange={(event) => setFromAccountNumber(event.target.value)}
            />
          </Field>
          <Field label="Where it was sent" hint="Account number where this money was sent.">
            <Input
              value={accountNumber}
              placeholder="GCash or bank account"
              disabled={busy}
              onChange={(event) => setAccountNumber(event.target.value)}
            />
          </Field>
          <BalanceReceivedByField store={store} actor={actor} value={receivedBy} onChange={setReceivedBy} disabled={busy} />
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
            onUploaded={async () => {
              await onRefresh?.();
            }}
            onNotice={setNotice}
            onError={(message) => {
              setNotice(null);
              setError(message || null);
            }}
          />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {notice ? <p className="form-ok">{notice}</p> : null}
        <section className="balance-detail-history">
          <h3>Amounts received</h3>
          {payments.length === 0 ? (
            <p className="muted">No amount has been received for this student yet.</p>
          ) : (
            <div className="table-scroll">
              <table className="hlc-table">
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
                                  await saveStore(cancelStudentPayment(store, row.paymentId, actor.userId));
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
              </table>
            </div>
          )}
        </section>
      </div>
    </DeskModal>
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
  saveStore,
  onRefresh,
  onClose,
}: {
  store: HirayaDatabase;
  paymentId: string;
  actor: HirayaUser;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
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
      await saveStore(
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
    if (typed) {
      const invalid = personalEmailError(typed);
      if (invalid) {
        setError(invalid);
        setBusy(false);
        return;
      }
    }
    try {
      const result = await api.notifyTeacherPayment(
        current.paymentId,
        typed,
        accountNumber.trim(),
        fromAccountNumber.trim(),
        Math.max(0, Number(amount) || 0),
        Math.max(0, Number(amountPaid) || 0),
      );
      await onRefresh?.();
      setNotice(assertMailed(displayName(person), result));
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
      await saveStore(
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
      await onRefresh?.();
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
    <DeskModal
      title={`${displayName(person)} · Payment`}
      size="wide"
      onClose={onClose}
      actions={
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
            onUploaded={async () => {
              await onRefresh?.();
            }}
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
        {error ? <p className="form-error">{error}</p> : null}
        {notice ? <p className="form-ok">{notice}</p> : null}
        <section className="balance-detail-history">
          <h3>Payment records</h3>
          {history.length === 0 ? (
            <EmptyState title="No payment records yet" hint="Saved salary payments for this teacher will show up here." />
          ) : (
            <div className="table-scroll">
              <table className="hlc-table">
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
                    <tr key={row.paymentId} className={row.paymentId === current.paymentId ? 'row-selected' : undefined}>
                      <td>{(row.paymentDate || row.paidAt || '').slice(0, 10) || '—'}</td>
                      <td>₱{formatPeso(Number(row.amount || 0))}</td>
                      <td>₱{formatPeso(Number(row.amountPaid || 0))}</td>
                      <td>{row.fromAccountNumber || '—'}</td>
                      <td>{row.accountNumber || '—'}</td>
                      <td>
                        <StatusCell value={row.paymentStatus} />
                      </td>
                      <td>{row.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DeskModal>
    </>
  );
}

export function AttendanceManagePage({
  store,
  user,
  saveStore,
  onRefresh,
}: {
  store: HirayaDatabase;
  user: HirayaUser;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
}) {
  const [month, setMonth] = useState(todayIsoDate().slice(0, 7));
  const [markDate, setMarkDate] = useState(todayIsoDate());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const dedupeRan = useRef(false);
  const summaries = useMemo(() => teacherAttendanceSummaries(store, month), [store, month]);
  const teachers = useMemo(() => staffTeachers(store), [store]);
  const detail = summaries.find((row) => row.teacher.userId === detailId) || null;
  const editing = summaries.find((row) => row.teacher.userId === editId) || null;
  const isToday = markDate === todayIsoDate();
  const salaryPaid = isTeacherSalaryMonthPaid(store, month);
  const monthClosed = isTeacherSalaryMonthPaid(store, markDate.slice(0, 7));

  useEffect(() => {
    if (dedupeRan.current) return;
    if (!findDuplicateStaffGroups(store).length) return;
    dedupeRan.current = true;
    const result = mergeDuplicateStaffUsers(store);
    if (!result.merged) return;
    void saveStore(result.store).catch(() => {
      dedupeRan.current = false;
    });
  }, [store, saveStore]);

  async function markStatus(teacherId: string, status: 'present' | 'absent' | 'excused' | '') {
    if (!status) return;
    setBusyId(teacherId);
    setError(null);
    try {
      await saveStore(markTeacherAttendance(store, teacherId, status, user.userId, markDate));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update attendance.');
    } finally {
      setBusyId(null);
    }
  }

  async function paySalaryMonth() {
    if (salaryPaid) {
      setMonth(nextAttendanceMonth(month));
      setMarkDate(`${nextAttendanceMonth(month)}-01`);
      return;
    }
    if (
      !window.confirm(
        `Mark teacher salary paid for ${month}? Attendance for that month stays in history, and the next month starts fresh.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      const result = markTeacherSalaryMonthPaid(store, month, user.userId);
      await saveStore(result.store);
      setMonth(result.nextMonth);
      setMarkDate(`${result.nextMonth}-01`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not close that salary month.');
    }
  }

  async function saveCounts(event: FormEvent<HTMLFormElement>) {
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      const next = setTeacherMonthAttendanceCounts(
        store,
        editing.teacher.userId,
        month,
        {
          worked: Number(form.get('worked')),
          absent: Number(form.get('absent')),
          excused: Number(form.get('excused')),
        },
        user.userId,
      );
      await saveStore(next);
      setEditId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save attendance counts.');
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    try {
      const next = upsertTeacherAttendanceDay(
        store,
        String(form.get('teacherId') || ''),
        String(form.get('attendanceDate') || todayIsoDate()),
        String(form.get('status') || 'present'),
        user.userId,
        String(form.get('notes') || ''),
      );
      await saveStore(next);
      setOpen(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save attendance.');
    }
  }

  return (
    <>
      <div className="page-toolbar" style={{ display: 'flex', gap: 12, alignItems: 'end', marginBottom: 12, flexWrap: 'wrap' }}>
        <Field label="Month summary">
          <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </Field>
        <Field label="Confirm for date">
          <Input
            type="date"
            value={markDate}
            onChange={(event) => {
              const next = event.target.value || todayIsoDate();
              setMarkDate(next);
              setMonth(next.slice(0, 7));
            }}
          />
        </Field>
        <Button type="button" variant={salaryPaid ? 'ghost' : 'primary'} onClick={() => void paySalaryMonth()}>
          {salaryPaid ? 'Open next month' : 'Salary paid — refresh next month'}
        </Button>
        <p className="hlc-field-hint" style={{ margin: 0, maxWidth: 440 }}>
          {salaryPaid
            ? `Salary for ${month} is paid. Counts for that month stay in history; mark attendance in the next month.`
            : 'When teachers get their salary, close this month. The next month starts fresh for attendance and salary.'}
        </p>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <RecordTable
        title={PAGE_COPY.attendance.title}
        description={PAGE_COPY.attendance.description}
        rows={summaries}
        rowKey={(row) => row.teacher.userId}
        search={(row, q) => displayName(row.teacher).toLowerCase().includes(q)}
        searchPlaceholder="Search teachers"
        emptyTitle="No teachers"
        emptyHint="Add teachers first, then confirm who is on site here."
        statusOf={(row) => teacherDayAttendance(store, row.teacher.userId, markDate)?.status || 'pending'}
        crud={{
          addLabel: '+ Record day',
          onAdd: () => setOpen(true),
          onEdit: (row) => {
            if (salaryPaid) {
              setError('Salary for that month is already paid. Open the next month to edit attendance.');
              return;
            }
            setError(null);
            setEditId(row.teacher.userId);
          },
          onRefresh,
        }}
        columns={[
          { key: 'name', header: 'Teacher', render: (row) => displayName(row.teacher) },
          {
            key: 'site',
            header: isToday ? 'Today on site' : `Status · ${markDate}`,
            render: (row) => {
              const today = teacherDayAttendance(store, row.teacher.userId, markDate);
              const busy = busyId === row.teacher.userId;
              const value = today?.status === 'late' ? 'present' : today?.status || '';
              if (monthClosed) {
                return today?.status ? <StatusCell value={today.status} /> : <span className="muted">Month closed</span>;
              }
              return (
                <div className="teacher-att-status" onClick={(event) => event.stopPropagation()}>
                  <Select
                    className="teacher-att-select"
                    aria-label={`Attendance for ${displayName(row.teacher)}`}
                    disabled={busy}
                    value={value}
                    onChange={(event) => void markStatus(row.teacher.userId, event.target.value as 'present' | 'absent' | 'excused' | '')}
                  >
                    <option value="">Not marked</option>
                    <option value="present">On site</option>
                    <option value="absent">Absent</option>
                    <option value="excused">Excused</option>
                  </Select>
                </div>
              );
            },
          },
          { key: 'worked', header: 'Days worked', render: (row) => String(row.worked) },
          { key: 'present', header: 'Present', render: (row) => String(row.present) },
          { key: 'absent', header: 'Absent', render: (row) => String(row.absent) },
          { key: 'excused', header: 'Excused', render: (row) => String(row.excused) },
          {
            key: 'days',
            header: 'Days logged',
            render: (row) => (
              <button type="button" className="dash-link" onClick={() => setDetailId(row.teacher.userId)}>
                {row.recorded} day{row.recorded === 1 ? '' : 's'}
              </button>
            ),
          },
        ]}
      />
      {open ? (
        <EditorModal
          title="Record teacher day"
          error={error}
          submitLabel="Save"
          onClose={() => {
            setOpen(false);
            setError(null);
          }}
          onSubmit={onSubmit}
        >
          <FormSection title="Attendance">
            <Field label="Teacher" required>
              <Select name="teacherId" required>
                <option value="">Select</option>
                {teachers.map((item) => (
                  <option key={item.userId} value={item.userId}>
                    {displayName(item)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date">
              <Input name="attendanceDate" type="date" defaultValue={markDate} />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue="present">
                <option value="present">Present / on site</option>
                <option value="late">Late (counts as work)</option>
                <option value="absent">Absent</option>
                <option value="excused">Excused / leave</option>
              </Select>
            </Field>
            <Field label="Notes" optional>
              <Input name="notes" placeholder="Optional note for payroll" />
            </Field>
          </FormSection>
        </EditorModal>
      ) : null}
      {editing ? (
        <EditorModal
          key={editing.teacher.userId}
          title={`Edit ${displayName(editing.teacher)} · ${month}`}
          error={error}
          submitLabel="Save counts"
          onClose={() => {
            setEditId(null);
            setError(null);
          }}
          onSubmit={saveCounts}
        >
          <FormSection title="Days this month">
            <p className="hlc-field-hint form-span">
              Double-click a teacher to change how many days count this month. Present follows days worked.
            </p>
            <Field label="Days worked" required>
              <Input name="worked" type="number" min={0} max={31} step={1} defaultValue={editing.worked} required />
            </Field>
            <Field label="Absent" required>
              <Input name="absent" type="number" min={0} max={31} step={1} defaultValue={editing.absent} required />
            </Field>
            <Field label="Excused" required>
              <Input name="excused" type="number" min={0} max={31} step={1} defaultValue={editing.excused} required />
            </Field>
          </FormSection>
        </EditorModal>
      ) : null}
      {detail ? (
        <DeskModal
          title={`${displayName(detail.teacher)} · ${month}`}
          onClose={() => setDetailId(null)}
          actions={
            <Button type="button" onClick={() => setDetailId(null)}>
              Close
            </Button>
          }
        >
          <p className="hlc-field-hint">
            Worked {detail.worked} day{detail.worked === 1 ? '' : 's'} · Absent {detail.absent} · Excused {detail.excused}
          </p>
          {detail.records.length === 0 ? (
            <p>No days logged this month.</p>
          ) : (
            <div className="table-scroll">
              <table className="hlc-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {[...detail.records]
                    .sort((a, b) => (a.attendanceDate || '').localeCompare(b.attendanceDate || ''))
                    .map((row) => (
                      <tr key={row.attendanceId}>
                        <td>{row.attendanceDate}</td>
                        <td>
                          <StatusCell value={row.status} />
                        </td>
                        <td>{row.notes || '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </DeskModal>
      ) : null}
    </>
  );
}

export function ProgressManagePage({
  store,
  user,
  saveStore,
  onRefresh,
}: {
  store: HirayaDatabase;
  user: HirayaUser;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const now = new Date().toISOString();
    const next: ProgressReport = {
      reportId: newId('prgnote'),
      studentId: String(form.get('studentId') || ''),
      teacherId: user.userId,
      classId: '',
      period: String(form.get('period') || ''),
      area: String(form.get('area') || ''),
      rating: String(form.get('rating') || ''),
      evaluation: String(form.get('evaluation') || ''),
      behaviorReport: '',
      developmentalReport: '',
      remarks: String(form.get('remarks') || ''),
      uploadedMedia: '',
      status: 'published',
      createdAt: now,
      updatedAt: now,
      history: [],
    };
    await saveStore({ ...store, reports: [next, ...store.reports] });
    setOpen(false);
  }

  return (
    <>
      <RecordTable
        title={PAGE_COPY.progress.title}
        description={PAGE_COPY.progress.description}
        rows={store.reports}
        search={(row, q) => `${row.area} ${row.rating} ${row.studentId}`.toLowerCase().includes(q)}
        searchPlaceholder="Search progress"
        emptyTitle="No progress records"
        emptyHint="Add a progress note; parents see published notes for linked children."
        statusOf={(row) => row.status}
        crud={{ addLabel: '+ Add progress', onAdd: () => setOpen(true), onRefresh }}
        columns={[
          { key: 'student', header: 'Student', render: (row) => studentName(store, row.studentId) },
          { key: 'area', header: 'Area', render: (row) => row.area || '—' },
          { key: 'rating', header: 'Rating', render: (row) => row.rating || '—' },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
        ]}
      />
      {open ? (
        <EditorModal title="Add progress" submitLabel="Save" onClose={() => setOpen(false)} onSubmit={onSubmit}>
          <FormSection title="Progress">
            <Field label="Student" required>
              <Select name="studentId" required>
                <option value="">Select</option>
                {store.students.map((item) => (
                  <option key={item.studentId} value={item.studentId}>
                    {studentDisplay(item)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Area">
              <Input name="area" />
            </Field>
            <Field label="Rating">
              <Input name="rating" />
            </Field>
            <Field label="Remarks">
              <Textarea name="evaluation" />
            </Field>
          </FormSection>
        </EditorModal>
      ) : null}
    </>
  );
}

export function PaymentsManagePage({
  store,
  user,
  saveStore,
  onRefresh,
  lane,
}: {
  store: HirayaDatabase;
  user: HirayaUser;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
  lane?: string | null;
}) {
  const paymentLane = parsePaymentLane(lane);
  const scrubbedPayments = useRef(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (scrubbedPayments.current) return;
    const next = scrubLeftoverPaymentData(store);
    if (!next) return;
    scrubbedPayments.current = true;
    void saveStore(next).catch(() => {
      scrubbedPayments.current = false;
    });
  }, [store, saveStore]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [receivedId, setReceivedId] = useState<string | null>(null);
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);
  const [teacherPaymentId, setTeacherPaymentId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const teachers = useMemo(
    () => store.users.filter((item) => item.role === 'teacher' || item.role === 'staff'),
    [store.users],
  );
  const teacherRows = useMemo(
    () => store.payments.filter((row) => isTeacherPayment(row)),
    [store.payments],
  );
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
      await onRefresh?.();
      setNotice(assertMailed(parentLabel(parentsForStudent(store, studentId)), result));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not notify parent.');
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    if (paymentLane !== 'teachers') {
      try {
        await saveStore(
          upsertStudentBalance(
            store,
            String(form.get('payeeId') || ''),
            String(form.get('amount') || ''),
            '',
            user.userId,
            String(form.get('dueAt') || ''),
          ),
        );
        setOpen(false);
        setNotice('Tuition fee saved. Remaining balance is tuition fee minus total paid.');
      } catch (err) {
        setNotice(err instanceof Error ? err.message : 'Could not save the tuition fee.');
      }
      return;
    }
    try {
      await saveStore(
        applyTeacherPayment(store, {
          teacherId: String(form.get('payeeId') || ''),
          amount: String(form.get('amount') || ''),
          amountPaid: String(form.get('amountPaid') || ''),
          paymentMethod: String(form.get('paymentMethod') || 'cash'),
          paymentStatus: String(form.get('paymentStatus') || 'paid'),
          notes: String(form.get('notes') || ''),
          recordedBy: user.userId,
          receivedBy: displayName(user),
        }),
      );
      setOpen(false);
      setNotice('Teacher payment saved. It now appears in Center cash flow for this month.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not save the teacher payment.');
    }
  }

  if (paymentLane === 'teachers') {
    return (
      <>
        {notice ? (
          <p className={noticeClass(notice)}>{notice}</p>
        ) : null}
        <RecordTable
          title="Teachers payment"
          description="Pay records for teachers and staff. Saved payments are listed in Center cash flow as Teachers salary."
          rows={teacherRows}
          rowKey={(row) => row.paymentId}
          search={(row, q) =>
            `${teacherName(store, row.studentId)} ${row.receivedBy || ''} ${row.paymentStatus} ${row.referenceNumber} ${row.notes}`
              .toLowerCase()
              .includes(q)
          }
          searchPlaceholder="Search teacher payments"
          emptyTitle="No teacher payments"
          emptyHint="Record a teacher or staff payment here."
          statusOf={(row) => row.paymentStatus}
          crud={{
            addLabel: '+ Add payment',
            editLabel: 'Open payment',
            deleteLabel: 'Delete',
            onAdd: () => setOpen(true),
            onEdit: (row) => setTeacherPaymentId(row.paymentId),
            onDelete: async (rows) => {
              if (!rows.length) return false;
              const label = rows.length === 1 ? teacherName(store, rows[0].studentId) : `${rows.length} teacher payments`;
              if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return false;
              const ids = new Set(rows.map((row) => row.paymentId));
              await saveStore({ ...store, payments: store.payments.filter((row) => !ids.has(row.paymentId)) });
              setNotice(rows.length === 1 ? 'Payment deleted.' : `${rows.length} payments deleted.`);
            },
            onRefresh,
            singleActions: [
              {
                label: 'Notify teacher',
                icon: 'send',
                needOneMessage: 'Select one payment to notify that teacher.',
                onClick: (row) => {
                  void (async () => {
                    setNotice(null);
                    try {
                      const result = await api.notifyTeacherPayment(row.paymentId);
                      await onRefresh?.();
                      setNotice(assertMailed(teacherName(store, row.studentId), result));
                    } catch (err) {
                      setNotice(err instanceof Error ? err.message : 'Could not notify teacher.');
                    }
                  })();
                },
              },
            ],
          }}
          columns={[
            { key: 'teacher', header: 'Teacher', render: (row) => teacherName(store, row.studentId) },
            { key: 'amount', header: 'Amount', render: (row) => `₱${formatPeso(Number(row.amount || 0))}` },
            { key: 'paid', header: 'Paid', render: (row) => `₱${formatPeso(Number(row.amountPaid || 0))}` },
            { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.paymentStatus} /> },
            {
              key: 'notify',
              header: 'Notify',
              render: (row) => (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!row.studentId}
                  title="Notify this teacher about the payment"
                  onClick={(event) => {
                    event.stopPropagation();
                    void (async () => {
                      setNotice(null);
                      try {
                        const result = await api.notifyTeacherPayment(row.paymentId);
                        await onRefresh?.();
                        setNotice(assertMailed(teacherName(store, row.studentId), result));
                      } catch (err) {
                        setNotice(err instanceof Error ? err.message : 'Could not notify teacher.');
                      }
                    })();
                  }}
                >
                  Notify
                </Button>
              ),
            },
          ]}
        />
        {open ? (
          <EditorModal title="Add teacher payment" submitLabel="Save" onClose={() => setOpen(false)} onSubmit={onSubmit}>
            <FormSection title="Payment">
              <Field label="Teacher" required>
                <Select name="payeeId" required>
                  <option value="">Select</option>
                  {teachers.map((item) => (
                    <option key={item.userId} value={item.userId}>
                      {displayName(item)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Amount">
                <Input name="amount" type="number" min={0} />
              </Field>
              <Field label="Amount paid" hint="This amount is recorded as Teachers salary in Center cash flow.">
                <Input name="amountPaid" type="number" min={0} />
              </Field>
              <Field label="Method">
                <Input name="paymentMethod" defaultValue="cash" />
              </Field>
              <Field label="Status">
                <Select name="paymentStatus" defaultValue="paid">
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                  <option value="pending">Pending</option>
                </Select>
              </Field>
              <Field label="Notes" optional>
                <Input name="notes" />
              </Field>
            </FormSection>
          </EditorModal>
        ) : null}
        {teacherPaymentId ? (
          <TeacherPaymentModal
            store={store}
            paymentId={teacherPaymentId}
            actor={user}
            saveStore={saveStore}
            onRefresh={onRefresh}
            onClose={() => setTeacherPaymentId(null)}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      {notice ? <p className={noticeClass(notice)}>{notice}</p> : null}
      <RecordTable
        title="Student balance"
        description="Remaining balance is the tuition fee minus every valid payment. A down payment is the first payment and is included once."
        rows={balanceRows}
        rowKey={(row) => row.student.studentId}
        search={(row, q) => `${studentDisplay(row.student)} ${row.label} ${row.student.program}`.toLowerCase().includes(q)}
        searchPlaceholder="Search student balances"
        emptyTitle="No students"
        emptyHint="Add students first, then balances appear here."
        statusOf={(row) => row.bill.status || (row.bill.due > 0 ? 'balance due' : 'paid')}
        crud={{
          addLabel: 'Set tuition fee',
          editLabel: 'Open balance',
          onAdd: () => setOpen(true),
          onEdit: (row) => setDetailId(row.student.studentId),
          onRefresh,
          singleActions: [
            {
              label: 'Amount received',
              needOneMessage: 'Select one student to record the amount received.',
              onClick: (row) => {
                setEditPaymentId(null);
                setReceivedId(row.student.studentId);
              },
            },
            {
              label: 'Notify parent',
              icon: 'send',
              needOneMessage: 'Select one student to notify their parent.',
              onClick: (row) => void notifyParentsFor(row.student.studentId),
            },
          ],
        }}
        columns={[
          { key: 'student', header: 'Student', render: (row) => studentDisplay(row.student) },
          {
            key: 'program',
            header: 'Program',
            render: (row) => programForStudent(store, row.student.studentId)?.name || row.student.program || '—',
          },
          {
            key: 'tuition',
            header: 'Tuition fee',
            render: (row) => `₱${formatPeso(studentTuitionFee(store, row.student.studentId))}`,
          },
          {
            key: 'paid',
            header: 'Total paid',
            render: (row) => `₱${formatPeso(studentTotalPaid(store, row.student.studentId))}`,
          },
          {
            key: 'due',
            header: 'Remaining balance',
            render: (row) => (
              <span className="balance-cell" title="Double-click row to open the tuition fee">
                ₱{formatPeso(row.bill.due)}
              </span>
            ),
          },
          {
            key: 'dueAt',
            header: 'Due',
            priority: 'secondary',
            render: (row) => formatDueLabel(row.dueAt),
          },
          {
            key: 'received',
            header: 'Received by',
            priority: 'secondary',
            render: (row) => row.receivedBy || '—',
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusCell value={row.bill.status || (row.bill.due > 0 ? 'balance due' : 'paid')} />,
          },
          {
            key: 'notify',
            header: 'Notify',
            render: (row) => (
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
            ),
          },
        ]}
      />
      {open ? (
        <EditorModal title="Set tuition fee" submitLabel="Save" onClose={() => setOpen(false)} onSubmit={onSubmit}>
          <FormSection title="Tuition">
            <Field label="Student" required>
              <Select name="payeeId" required>
                <option value="">Select</option>
                {[...store.students].sort(compareStudentNames).map((item) => (
                  <option key={item.studentId} value={item.studentId}>
                    {studentDisplay(item)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tuition fee" hint="Total amount required. Remaining balance is this fee minus total paid.">
              <Input name="amount" type="number" min={0} step="0.01" />
            </Field>
            <Field label="Due date" optional>
              <Input name="dueAt" type="date" />
            </Field>
          </FormSection>
        </EditorModal>
      ) : null}
      {detailId ? (
        <StudentBalanceModal
          store={store}
          studentId={detailId}
          actor={user}
          saveStore={saveStore}
          onRefresh={onRefresh}
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
      {receivedId ? (
        <StudentReceivedModal
          store={store}
          studentId={receivedId}
          actor={user}
          saveStore={saveStore}
          onRefresh={onRefresh}
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

const SETTINGS_TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Password' },
  { id: 'notifications', label: 'Alerts' },
  { id: 'system', label: 'Center' },
] as const;

export function SettingsPage({
  store,
  user,
  saveStore,
  onRefresh,
  onUser,
}: {
  store: HirayaDatabase;
  user: HirayaUser;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
  onUser?: (next: HirayaUser) => void;
}) {
  const live = store.users.find((item) => item.userId === user.userId) || user;
  const [tab, setTab] = useState<(typeof SETTINGS_TABS)[number]['id']>('profile');
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [notify, setNotify] = useState({
    attendance: store.settings.notifyAttendance,
    payments: store.settings.notifyPayments,
    schedule: store.settings.notifySchedule,
    progress: store.settings.notifyProgress,
  });

  async function run(task: () => Promise<void>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      await task();
      setOk(true);
      setMessage(done);
    } catch (err) {
      setOk(false);
      setMessage(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const firstName = String(form.get('firstName') || '').trim();
    const lastName = String(form.get('lastName') || '').trim();
    const fullname = String(form.get('fullname') || '').trim();
    const parts = fullname.split(/\s+/).filter(Boolean);
    await run(async () => {
      const saved = await api.saveProfile({
        firstName: firstName || parts[0] || live.firstName,
        lastName: lastName || parts.slice(1).join(' ') || live.lastName,
        middleName: live.middleName || '',
        username: live.username,
        email: String(form.get('email') || live.email).trim(),
        phone: String(form.get('phone') || ''),
        address: String(form.get('address') || ''),
        position: live.position || '',
      });
      onUser?.(saved);
      await onRefresh?.();
    }, 'Profile saved.');
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = String(form.get('newPassword') || '');
    if (next !== String(form.get('confirmPassword') || '')) {
      setOk(false);
      setMessage('New passwords do not match.');
      return;
    }
    await run(async () => {
      await api.changePassword(live.userId, String(form.get('currentPassword') || ''), next, {
        verificationCode: String(form.get('verificationCode') || ''),
        confirmPassword: String(form.get('confirmPassword') || ''),
      });
      event.currentTarget.reset();
    }, 'Password updated. Other signed-in sessions must sign in again.');
  }

  async function sendPasswordCode(formEl: HTMLFormElement) {
    setCodeBusy(true);
    setMessage(null);
    try {
      const result = await api.requestPasswordCode(String(new FormData(formEl).get('currentPassword') || ''));
      setOk(true);
      setMessage(`Verification code sent${result.to ? ` to ${result.to}` : ''}.`);
    } catch (err) {
      setOk(false);
      setMessage(err instanceof Error ? err.message : 'Could not send a verification code.');
    } finally {
      setCodeBusy(false);
    }
  }

  async function saveAlerts() {
    await run(
      () =>
        saveStore({
          ...store,
          settings: {
            ...store.settings,
            notifyAttendance: notify.attendance,
            notifyPayments: notify.payments,
            notifySchedule: notify.schedule,
            notifyProgress: notify.progress,
            notificationsEnabled: notify.attendance || notify.payments || notify.schedule || notify.progress,
            updatedAt: new Date().toISOString(),
          },
        }),
      'Alert preferences saved.',
    );
  }

  async function saveCenter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(
      () =>
        saveStore({
          ...store,
          settings: {
            ...store.settings,
            centerName: String(form.get('centerName') || store.settings.centerName),
            phone: String(form.get('phone') || ''),
            email: String(form.get('email') || ''),
            address: String(form.get('address') || ''),
            website: String(form.get('website') || ''),
            businessHours: String(form.get('businessHours') || ''),
            timeZone: String(form.get('timeZone') || store.settings.timeZone),
            defaultPeriod: String(form.get('defaultPeriod') || store.settings.defaultPeriod),
            defaultAttendanceStatus: String(form.get('defaultAttendanceStatus') || store.settings.defaultAttendanceStatus),
            defaultPaymentMethod: String(form.get('defaultPaymentMethod') || store.settings.defaultPaymentMethod),
            updatedAt: new Date().toISOString(),
          },
        }),
      'Center settings saved. Website admin and the public site read the same record.',
    );
  }

  return (
    <>
      <PageHeader title={PAGE_COPY.settings.title} description={PAGE_COPY.settings.description} />
      {message ? <p className={ok ? 'form-ok' : 'form-error'}>{message}</p> : null}
      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {SETTINGS_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'settings-tab is-active' : 'settings-tab'}
            onClick={() => {
              setTab(item.id);
              setMessage(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? (
        <form key={live.updatedAt} className="panel settings-form" onSubmit={saveProfile}>
          <h2>Administrator profile</h2>
          <p className="muted">
            Signed in as {roleLabel(live.role)} · {live.username || live.email}
          </p>
          <Field label="Display name">
            <Input name="fullname" defaultValue={displayName(live)} />
          </Field>
          <Field label="First name">
            <Input name="firstName" defaultValue={live.firstName} />
          </Field>
          <Field label="Last name">
            <Input name="lastName" defaultValue={live.lastName} />
          </Field>
          <Field label="Email" required>
            <Input name="email" type="email" defaultValue={live.email} required />
          </Field>
          <Field label="Phone">
            <Input name="phone" defaultValue={live.phone || ''} />
          </Field>
          <Field label="Address">
            <Input name="address" defaultValue={live.address || ''} />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save profile'}
          </Button>
        </form>
      ) : null}

      {tab === 'security' ? (
        <form className="panel settings-form" onSubmit={savePassword}>
          <h2>Password</h2>
          <p className="muted">
            Administrator password changes require the current password and an emailed verification code. Passwords are
            stored as hashes, never in plaintext.
          </p>
          <Field label="Current password">
            <Input name="currentPassword" type="password" required autoComplete="current-password" />
          </Field>
          <Field label="New password">
            <Input name="newPassword" type="password" minLength={8} required autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password">
            <Input name="confirmPassword" type="password" minLength={8} required autoComplete="new-password" />
          </Field>
          <Field label="Email verification code" required>
            <Input name="verificationCode" inputMode="numeric" autoComplete="one-time-code" />
          </Field>
          <div className="icon-actions">
            <Button
              type="button"
              variant="ghost"
              disabled={codeBusy || busy}
              onClick={(event) => {
                const form = event.currentTarget.closest('form');
                if (form) void sendPasswordCode(form);
              }}
            >
              {codeBusy ? 'Sending…' : 'Email verification code'}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Update password'}
            </Button>
          </div>
        </form>
      ) : null}

      {tab === 'notifications' ? (
        <section className="panel settings-form">
          <h2>Alert preferences</h2>
          <p className="muted">These flags are stored on the center settings record shared with the website.</p>
          {(
            [
              ['attendance', 'Attendance alerts'],
              ['payments', 'Payment alerts'],
              ['schedule', 'Schedule alerts'],
              ['progress', 'Progress reports'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="settings-check">
              <input
                type="checkbox"
                checked={notify[key]}
                onChange={(event) => setNotify((current) => ({ ...current, [key]: event.target.checked }))}
              />
              {label}
            </label>
          ))}
          <Button type="button" disabled={busy} onClick={() => void saveAlerts()}>
            {busy ? 'Saving…' : 'Save alerts'}
          </Button>
        </section>
      ) : null}

      {tab === 'system' ? (
        <form key={store.settings.updatedAt} className="panel settings-form" onSubmit={saveCenter}>
          <h2>Center identity</h2>
          <Field label="Center name" required>
            <Input name="centerName" defaultValue={store.settings.centerName} required />
          </Field>
          <Field label="Phone">
            <Input name="phone" defaultValue={store.settings.phone} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={store.settings.email} />
          </Field>
          <Field label="Website">
            <Input name="website" defaultValue={store.settings.website} />
          </Field>
          <Field label="Address">
            <Input name="address" defaultValue={store.settings.address} />
          </Field>
          <Field label="Business hours">
            <Input name="businessHours" defaultValue={store.settings.businessHours} />
          </Field>
          <Field label="Time zone">
            <Input name="timeZone" defaultValue={store.settings.timeZone} />
          </Field>
          <Field label="Default period">
            <Input name="defaultPeriod" defaultValue={store.settings.defaultPeriod} />
          </Field>
          <Field label="Default attendance status">
            <Select name="defaultAttendanceStatus" defaultValue={store.settings.defaultAttendanceStatus || 'present'}>
              <option value="present">present</option>
              <option value="late">late</option>
              <option value="absent">absent</option>
              <option value="excused">excused</option>
            </Select>
          </Field>
          <Field label="Default payment method">
            <Input name="defaultPaymentMethod" defaultValue={store.settings.defaultPaymentMethod} />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save center settings'}
          </Button>
        </form>
      ) : null}
    </>
  );
}

const DEFAULT_HEADLINE = 'Growing minds.\nBuilding futures.';

function headlineForEditor(welcomeTitle?: string) {
  const title = (welcomeTitle || '').trim();
  if (!title || /^welcome to\b/i.test(title)) return DEFAULT_HEADLINE;
  return title;
}

export function WebsiteCmsPage({
  store,
  onRefresh,
}: {
  store: HirayaDatabase;
  onRefresh?: () => Promise<void> | void;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const s = store.settings;
  const programs = store.programs.filter((program) => program.status === 'active');

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage('');
    try {
      await api.publishWebsite({
        centerName: String(form.get('centerName') || ''),
        welcomeTitle: String(form.get('welcomeTitle') || ''),
        welcomeMessage: String(form.get('welcomeMessage') || ''),
        aboutTitle: String(form.get('aboutTitle') || ''),
        description: String(form.get('description') || ''),
        mission: String(form.get('mission') || ''),
        vision: String(form.get('vision') || ''),
        values: String(form.get('values') || ''),
        address: String(form.get('address') || ''),
        phone: String(form.get('phone') || ''),
        email: String(form.get('email') || ''),
        website: String(form.get('website') || ''),
        businessHours: String(form.get('businessHours') || ''),
        programs: programs.map((program) => ({
          programId: program.programId,
          name: String(form.get(`programName:${program.programId}`) || ''),
          description: String(form.get(`programDescription:${program.programId}`) || ''),
        })),
      });
      await onRefresh?.();
      setMessage('Published. Refresh the website — it loads this text from the center, so the live site updates without a new Vercel build.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not publish the website.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Marketing site"
        description="Edit the public website, then publish. The live site reads this from the center as soon as you refresh it."
      />
      {message ? <p className="muted">{message}</p> : null}
      <form key={s.updatedAt} className="panel" style={{ display: 'grid', gap: 12 }} onSubmit={publish}>
        <h2>Home</h2>
        <Field label="Center name">
          <Input name="centerName" defaultValue={s.centerName} />
        </Field>
        <Field label="Home headline" hint="One line, or two lines. This is the large title on the home page.">
          <Textarea name="welcomeTitle" rows={2} defaultValue={headlineForEditor(s.welcomeTitle)} />
        </Field>
        <Field label="Home introduction">
          <Textarea name="welcomeMessage" defaultValue={s.welcomeMessage} />
        </Field>
        <h2>About</h2>
        <Field label="About title">
          <Input name="aboutTitle" defaultValue={s.aboutTitle} />
        </Field>
        <Field label="About description">
          <Textarea name="description" defaultValue={s.description} />
        </Field>
        <Field label="Mission">
          <Textarea name="mission" defaultValue={s.mission} />
        </Field>
        <Field label="Vision">
          <Textarea name="vision" defaultValue={s.vision} />
        </Field>
        <Field label="Values">
          <Textarea name="values" defaultValue={s.values} />
        </Field>
        <h2>Contact</h2>
        <Field label="Address">
          <Input name="address" defaultValue={s.address} />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={s.phone} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={s.email} />
        </Field>
        <Field label="Website or Facebook link">
          <Input name="website" defaultValue={s.website} />
        </Field>
        <Field label="Business hours">
          <Input name="businessHours" defaultValue={s.businessHours} />
        </Field>
        <h2>Programs</h2>
        <p className="muted">Name and description shown on the website. Tuition and session counts stay on the program record.</p>
        {programs.length === 0 ? <p className="muted">No active programs.</p> : null}
        {programs.map((program) => (
          <div key={program.programId} style={{ display: 'grid', gap: 8 }}>
            <Field label="Program name">
              <Input name={`programName:${program.programId}`} defaultValue={program.name} />
            </Field>
            <Field label="Public description">
              <Textarea name={`programDescription:${program.programId}`} defaultValue={program.description} />
            </Field>
          </div>
        ))}
        <Button type="submit" disabled={busy}>
          {busy ? 'Publishing…' : 'Publish'}
        </Button>
      </form>
    </>
  );
}
