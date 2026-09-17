'use client';

import { useStore } from '@/components/StoreProvider';
import { Button, EmptyState, Field, Input, Loading, Select, StatusBadge, Table } from '@hiraya/ui';
import { newId, studentDisplay } from '@hiraya/utils';
import type { Payment } from '@hiraya/types';
import { FormEvent, useState } from 'react';

export default function PaymentsPage() {
  const { store, loading, save } = useStore();
  const [open, setOpen] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: Payment = {
      paymentId: newId('pay'),
      enrollmentId: '',
      studentId: String(form.get('studentId') || ''),
      amount: Number(form.get('amount') || 0),
      amountPaid: Number(form.get('amountPaid') || 0),
      paymentMethod: String(form.get('paymentMethod') || 'cash'),
      paymentStatus: String(form.get('paymentStatus') || 'pending'),
      referenceNumber: String(form.get('referenceNumber') || ''),
      paymentDate: new Date().toISOString().slice(0, 10),
      dueAt: String(form.get('dueAt') || ''),
      paidAt: '',
      recordedBy: '',
      notes: String(form.get('notes') || ''),
      history: [],
    };
    await save({ ...store, payments: [...store.payments, next] });
    setOpen(false);
  }

  if (loading) return <Loading />;

  return (
    <>
      <div className="toolbar">
        <h1>Payments</h1>
        <Button type="button" onClick={() => setOpen(true)}>
          Add charge
        </Button>
      </div>
      {open ? (
        <form className="hlc-card form-grid" onSubmit={onSubmit}>
          <Field label="Student" required>
            <Select name="studentId" required defaultValue="">
              <option value="" disabled>
                Select
              </option>
              {store.students.map((student) => (
                <option key={student.studentId} value={student.studentId}>
                  {studentDisplay(student)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amount">
            <Input name="amount" type="number" defaultValue={0} />
          </Field>
          <Field label="Paid">
            <Input name="amountPaid" type="number" defaultValue={0} />
          </Field>
          <Field label="Method">
            <Select name="paymentMethod" defaultValue="cash">
              <option value="cash">cash</option>
              <option value="bank">bank</option>
              <option value="gcash">gcash</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select name="paymentStatus" defaultValue="pending">
              <option value="pending">pending</option>
              <option value="partial">partial</option>
              <option value="paid">paid</option>
              <option value="overdue">overdue</option>
            </Select>
          </Field>
          <Field label="Due">
            <Input name="dueAt" type="date" />
          </Field>
          <Field label="Reference">
            <Input name="referenceNumber" />
          </Field>
          <div>
            <Button type="submit">Save</Button>{' '}
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {store.payments.length === 0 ? (
        <EmptyState title="No payment records" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Amount</th>
              <th>Paid</th>
              <th>Method</th>
              <th>Status</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {store.payments.map((row) => (
              <tr key={row.paymentId}>
                <td>
                  {store.students.find((s) => s.studentId === row.studentId)
                    ? studentDisplay(store.students.find((s) => s.studentId === row.studentId)!)
                    : row.studentId}
                </td>
                <td>{row.amount}</td>
                <td>{row.amountPaid}</td>
                <td>{row.paymentMethod}</td>
                <td>
                  <StatusBadge status={row.paymentStatus} />
                </td>
                <td>{row.referenceNumber}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
