'use client';

import { useSearchParams } from 'next/navigation';
import { useStore } from '@/components/StoreProvider';
import { EmptyState, Loading, PageHeader, StatusBadge, Table } from '@hiraya/ui';
import { childrenOfParent, displayName, laneLabel, parentInLane, parsePeopleLane, studentDisplay } from '@hiraya/utils';

export default function ParentsPage() {
  const { store, loading } = useStore();
  const lane = parsePeopleLane(useSearchParams().get('lane'));
  if (loading) return <Loading />;
  const parents = store.users.filter((u) => u.role === 'parent' && parentInLane(store, u.userId, lane));
  return (
    <>
      <PageHeader
        crumb="Parents"
        kicker="Management"
        title={lane ? `Parents · ${laneLabel(lane)}` : 'Parents'}
        description={
          lane
            ? `Guardians with children in ${laneLabel(lane)}.`
            : 'Guardians and linked children. Use the program sublabels to open a group.'
        }
      />
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
                  {childrenOfParent(store, parent.userId).map(studentDisplay).join(', ') ||
                    String(store.parentStudents.filter((l) => l.parentId === parent.userId && l.isActive).length)}
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
