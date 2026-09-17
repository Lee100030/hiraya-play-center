'use client';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { Button, EmptyState, Field, Input, Loading, Select, StatusBadge, Table, Textarea } from '@hiraya/ui';
import { newId, studentDisplay } from '@hiraya/utils';
import type { Payment } from '@hiraya/types';
import { FormEvent, useState } from 'react';

export default function AdminPaymentsPage() {
  const { user } = useAuth();
  const { store, loading, save } = useStore();
  const [editing, setEditing] = useState<Payment | 'new' | null>(null);
  const current = editing && editing !== 'new' ? editing : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get('amount') || 0);
    const amountPaid = Number(form.get('amountPaid') || 0);
    const next: Payment = {
      paymentId: current?.paymentId || newId('pay'),
      enrollmentId: current?.enrollmentId || '',
      studentId: String(form.get('studentId') || ''),
      amount,
      amountPaid,
      paymentMethod: String(form.get('paymentMethod') || 'cash'),
      paymentStatus: String(form.get('paymentStatus') || 'pending'),
      referenceNumber: String(form.get('referenceNumber') || ''),
      paymentDate: String(form.get('paymentDate') || new Date().toISOString().slice(0, 10)),
      dueAt: String(form.get('dueAt') || ''),
      paidAt: amountPaid > 0 ? new Date().toISOString() : current?.paidAt || '',
      recordedBy: current?.recordedBy || user?.userId || '',
      notes: String(form.get('notes') || ''),
      history: current?.history || [],
    };
    await save({
      ...store,
      payments: current
        ? store.payments.map((item) => (item.paymentId === next.paymentId ? next : item))
        : [...store.payments, next],
    });
    setEditing(null);
  }

  if (loading) return <Loading />;
  return (
    <>
      <AdminPageHeader
        kicker="Records"
        title="Payments"
        description="The same payment rows are used by desktop and parent mobile. Only Super Admin can edit them."
        actions={
          <button type="button" className="dash-action dash-action-primary" onClick={() => setEditing('new')}>
            Add charge
          </button>
        }
      />
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
              <th></th>
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
                <td>
                  <button type="button" className="dash-action" onClick={() => setEditing(row)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {editing ? (
        <form className="hlc-card form-grid" onSubmit={onSubmit}>
          <Field label="Student" required>
            <Select name="studentId" defaultValue={current?.studentId || ''} required>
              <option value="">Select</option>
              {store.students.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  {studentDisplay(s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amount">
            <Input name="amount" type="number" min={0} step="0.01" defaultValue={current?.amount || 0} />
          </Field>
          <Field label="Amount paid">
            <Input name="amountPaid" type="number" min={0} step="0.01" defaultValue={current?.amountPaid || 0} />
          </Field>
          <Field label="Method">
            <Input name="paymentMethod" defaultValue={current?.paymentMethod || 'cash'} />
          </Field>
          <Field label="Status">
            <Select name="paymentStatus" defaultValue={current?.paymentStatus || 'pending'}>
              <option value="pending">pending</option>
              <option value="partial">partial</option>
              <option value="paid">paid</option>
            </Select>
          </Field>
          <Field label="Reference">
            <Input name="referenceNumber" defaultValue={current?.referenceNumber} />
          </Field>
          <Field label="Date">
            <Input name="paymentDate" type="date" defaultValue={current?.paymentDate} />
          </Field>
          <Field label="Notes">
            <Textarea name="notes" defaultValue={current?.notes} />
          </Field>
          <Button type="submit">Save</Button>{' '}
          <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </form>
      ) : null}
    </>
  );
}
