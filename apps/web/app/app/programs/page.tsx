'use client';

import { useStore } from '@/components/StoreProvider';
import { EmptyState, Loading, StatusBadge, Table } from '@hiraya/ui';

export default function ProgramsAdminPage() {
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  return (
    <>
      <h1>Programs</h1>
      {store.programs.length === 0 ? (
        <EmptyState title="No programs yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {store.programs.map((row) => (
              <tr key={row.programId}>
                <td>{row.name}</td>
                <td>{row.description}</td>
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
