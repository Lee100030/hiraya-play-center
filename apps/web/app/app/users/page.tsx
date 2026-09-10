'use client';

import { useStore } from '@/components/StoreProvider';
import { EmptyState, Loading, StatusBadge, Table } from '@hiraya/ui';
import { displayName, roleLabel } from '@hiraya/utils';

export default function UsersPage() {
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  return (
    <>
      <h1>Users</h1>
      {store.users.length === 0 ? (
        <EmptyState title="No users" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {store.users.map((row) => (
              <tr key={row.userId}>
                <td>{displayName(row)}</td>
                <td>{row.username}</td>
                <td>{roleLabel(row.role)}</td>
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
