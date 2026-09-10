'use client';

import { useStore } from '@/components/StoreProvider';
import { Loading, Table } from '@hiraya/ui';
import { PERMISSION_LABELS, UserRoles } from '@hiraya/types';
import { allows } from '@hiraya/utils';

const roles = Object.values(UserRoles);

export default function RolesPage() {
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  return (
    <>
      <h1>Roles & permissions</h1>
      <Table>
        <thead>
          <tr>
            <th>Permission</th>
            {roles.map((role) => (
              <th key={role}>{role}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_LABELS.map((perm) => (
            <tr key={perm.key}>
              <td>{perm.label}</td>
              {roles.map((role) => (
                <td key={role}>{allows(store, role, perm.key) ? 'Yes' : '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
