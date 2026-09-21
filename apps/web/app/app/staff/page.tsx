'use client';

import { useSearchParams } from 'next/navigation';
import { useStore } from '@/components/StoreProvider';
import { EmptyState, Loading, PageHeader, StatusBadge, Table } from '@hiraya/ui';
import { displayName, laneLabel, parsePeopleLane, teacherInLane } from '@hiraya/utils';
import { StaffMessageHost, UserMessageButton } from '@/components/StaffMessage';
import { useState } from 'react';

export default function StaffPage() {
  const { store, loading, save } = useStore();
  const [messageTo, setMessageTo] = useState<{ label: string; hint?: string; recipientIds: string[] } | null>(null);
  const lane = parsePeopleLane(useSearchParams().get('lane'));
  if (loading) return <Loading />;
  const people = store.users.filter(
    (u) => ['teacher', 'staff', 'admin', 'super_admin'].includes(u.role) && teacherInLane(store, u.userId, lane),
  );
  return (
    <>
      <PageHeader
        crumb="Teachers"
        kicker="Management"
        title={lane ? `Teachers · ${laneLabel(lane)}` : 'Teachers & staff'}
        description={
          lane
            ? `Teachers assigned to ${laneLabel(lane)}.`
            : 'Open a teacher to review status and assignments. Use the program sublabels to open a group.'
        }
      />
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
              <th></th>
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
                <td>
                  <UserMessageButton
                    user={person}
                    hint="Sent to this teacher’s mobile Alerts tab."
                    onOpen={setMessageTo}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <StaffMessageHost store={store} save={save} target={messageTo} onClose={() => setMessageTo(null)} />
    </>
  );
}
