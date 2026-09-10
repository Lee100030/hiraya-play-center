'use client';

import { useStore } from '@/components/StoreProvider';
import { EmptyState, Loading, StatusBadge, Table } from '@hiraya/ui';
import { studentDisplay } from '@hiraya/utils';

export default function PaymentsPage() {
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  return (
    <>
      <h1>Payments</h1>
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
