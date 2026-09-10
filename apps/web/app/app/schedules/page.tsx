'use client';

import { useStore } from '@/components/StoreProvider';
import { EmptyState, Loading, StatusBadge, Table } from '@hiraya/ui';

export default function SchedulesPage() {
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  return (
    <>
      <h1>Schedules</h1>
      {store.schedules.length === 0 ? (
        <EmptyState title="No schedules" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Kind</th>
              <th>Start</th>
              <th>End</th>
              <th>Room</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {store.schedules.map((row) => (
              <tr key={row.scheduleId}>
                <td>{row.title}</td>
                <td>{row.kind}</td>
                <td>{row.startAt}</td>
                <td>{row.endAt}</td>
                <td>{row.room}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
