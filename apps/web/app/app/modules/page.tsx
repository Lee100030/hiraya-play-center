'use client';

import { useStore } from '@/components/StoreProvider';
import { EmptyState, Loading, StatusBadge, Table } from '@hiraya/ui';

export default function ModulesPage() {
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  return (
    <>
      <h1>Learning modules</h1>
      {store.learningModules.length === 0 ? (
        <EmptyState title="No modules" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Version</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {store.learningModules.map((row) => (
              <tr key={row.moduleId}>
                <td>{row.title}</td>
                <td>{row.moduleType}</td>
                <td>{row.version}</td>
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
