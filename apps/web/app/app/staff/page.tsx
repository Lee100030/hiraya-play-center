'use client';

import { useStore } from '@/components/StoreProvider';
import { EmptyState, Loading, StatusBadge, Table } from '@hiraya/ui';
import { displayName } from '@hiraya/utils';

export default function StaffPage() {
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  const people = store.users.filter((u) => ['teacher', 'staff', 'admin', 'super_admin'].includes(u.role));
  return (
    <>
      <h1>Teachers & staff</h1>
      {people.length === 0 ? (
        <EmptyState title="No staff records" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Email</th>
              <th>Specialty</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.userId}>
                <td>{displayName(person)}</td>
                <td>{person.role}</td>
                <td>{person.email}</td>
                <td>{store.teacherProfiles.find((p) => p.userId === person.userId)?.specialty}</td>
                <td>
                  <StatusBadge status={person.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
