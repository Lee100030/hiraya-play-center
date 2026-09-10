'use client';

import { useStore } from '@/components/StoreProvider';
import { EmptyState, Loading, StatusBadge, Table } from '@hiraya/ui';
import { displayName } from '@hiraya/utils';

export default function ParentsPage() {
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  const parents = store.users.filter((u) => u.role === 'parent');
  return (
    <>
      <h1>Parents</h1>
      {parents.length === 0 ? (
        <EmptyState title="No parent accounts" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Children</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {parents.map((parent) => (
              <tr key={parent.userId}>
                <td>{displayName(parent)}</td>
                <td>{parent.email}</td>
                <td>
                  {store.parentStudents.filter((l) => l.parentId === parent.userId && l.isActive).length}
                </td>
                <td>
                  <StatusBadge status={parent.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
