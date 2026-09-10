'use client';

import { useStore } from '@/components/StoreProvider';
import { EmptyState, Loading, Table } from '@hiraya/ui';

export default function AuditPage() {
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  return (
    <>
      <h1>Audit log</h1>
      {store.auditLogs.length === 0 ? (
        <EmptyState title="No audit entries" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Module</th>
              <th>Action</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {store.auditLogs.slice(0, 100).map((row) => (
              <tr key={row.auditId}>
                <td>{row.createdAt}</td>
                <td>{row.actorName}</td>
                <td>{row.module}</td>
                <td>{row.action}</td>
                <td>{row.summary}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
