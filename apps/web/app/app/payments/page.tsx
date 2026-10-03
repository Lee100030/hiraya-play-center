'use client';

import { useStore } from '@/components/StoreProvider';
import { Button, EmptyState, Field, Input, Loading, Select, StatusBadge, Table } from '@hiraya/ui';
import { formatPeso, isTeacherPayment, recordStudentAmountReceived, studentDisplay, studentPaymentBalance, studentPaymentTypeLabel } from '@hiraya/utils';
import { FormEvent, useState } from 'react';

export default function PaymentsPage() {
  const { store, loading, save } = useStore();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const rows = store.payments.filter((row) => !isTeacherPayment(row));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const studentId = String(form.get('studentId') || '');
    setError('');
    try {
      await save(
        recordStudentAmountReceived(
          store,
          studentId,
          String(form.get('amount') || ''),
          '',
          String(form.get('receivedBy') || ''),
          '',
          '',
          String(form.get('paymentMethod') || 'cash'),
          String(form.get('notes') || ''),
          String(form.get('paymentDate') || ''),
          String(form.get('referenceNumber') || ''),
        ),
      );
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the payment.');
    }
  }

  if (loading) return <Loading />;

  return (
    <>
      <div className="toolbar">
        <h1>Payments</h1>
        <Button type="button" onClick={() => setOpen(true)}>
          Add payment
        </Button>
      </div>
      {open ? (
        <form className="hlc-card form-grid" onSubmit={onSubmit}>
          <Field label="Student" required>
            <Select name="studentId" required defaultValue="">
              <option value="" disabled>
                Select
              </option>
              {store.students.map((student) => {
                const bill = studentPaymentBalance(store, student.studentId);
                return (
                  <option key={student.studentId} value={student.studentId}>
                    {studentDisplay(student)} · remaining ₱{formatPeso(bill.due)}
                  </option>
                );
              })}
            </Select>
          </Field>
          <Field label="Payment amount" required>
            <Input name="amount" type="number" min={0} step="0.01" required />
          </Field>
          <Field label="Received by" required>
            <Input name="receivedBy" required />
          </Field>
          <Field label="Payment method">
            <Select name="paymentMethod" defaultValue="cash">
              <option value="cash">cash</option>
              <option value="bank">bank</option>
              <option value="gcash">gcash</option>
            </Select>
          </Field>
          <Field label="Payment date">
            <Input name="paymentDate" type="date" />
          </Field>
          <Field label="Reference number">
            <Input name="referenceNumber" />
          </Field>
          <Field label="Notes">
            <Input name="notes" />
          </Field>
          {error ? <p className="hlc-field-error">{error}</p> : null}
          <div>
            <Button type="submit">Save</Button>{' '}
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState title="No payment history" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Type</th>
              <th>Payment amount</th>
              <th>Remaining balance</th>
              <th>Method</th>
              <th>Payment status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const student = store.students.find((item) => item.studentId === row.studentId);
              const bill = studentPaymentBalance(store, row.studentId);
              return (
                <tr key={row.paymentId}>
                  <td>{student ? studentDisplay(student) : row.studentId}</td>
                  <td>{studentPaymentTypeLabel(store, row)}</td>
                  <td>₱{formatPeso(Number(row.amountPaid || 0))}</td>
                  <td>₱{formatPeso(bill.due)}</td>
                  <td>{row.paymentMethod}</td>
                  <td>
                    <StatusBadge status={bill.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
