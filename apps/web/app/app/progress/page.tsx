'use client';

import { useStore } from '@/components/StoreProvider';
import { EmptyState, Loading, StatusBadge, Table } from '@hiraya/ui';
import { studentDisplay } from '@hiraya/utils';

export default function ProgressPage() {
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  return (
    <>
      <h1>Progress</h1>
      {store.reports.length === 0 ? (
        <EmptyState title="No progress reports" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Area</th>
              <th>Rating</th>
              <th>Status</th>
              <th>Period</th>
            </tr>
          </thead>
          <tbody>
            {store.reports.map((row) => (
              <tr key={row.reportId}>
                <td>
                  {(() => {
                    const student = store.students.find((s) => s.studentId === row.studentId);
                    return student ? studentDisplay(student) : row.studentId;
                  })()}
                </td>
                <td>{row.area}</td>
                <td>{row.rating}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>{row.period}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
