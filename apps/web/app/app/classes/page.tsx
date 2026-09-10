'use client';

import { useStore } from '@/components/StoreProvider';
import { EmptyState, Loading, StatusBadge, Table } from '@hiraya/ui';
import { displayName } from '@hiraya/utils';

export default function ClassesPage() {
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  return (
    <>
      <h1>Classes</h1>
      {store.classes.length === 0 ? (
        <EmptyState title="No classes" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Class</th>
              <th>Program</th>
              <th>Teacher</th>
              <th>Capacity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {store.classes.map((row) => (
              <tr key={row.classId}>
                <td>{row.name}</td>
                <td>{store.programs.find((p) => p.programId === row.programId)?.name}</td>
                <td>{displayName(store.users.find((u) => u.userId === row.teacherId))}</td>
                <td>{row.capacity}</td>
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
