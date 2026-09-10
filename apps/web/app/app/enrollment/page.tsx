'use client';

import { useStore } from '@/components/StoreProvider';
import { Button, EmptyState, Loading, StatusBadge, Table } from '@hiraya/ui';
import { newId, studentDisplay } from '@hiraya/utils';

export default function EnrollmentPage() {
  const { store, loading, save } = useStore();
  if (loading) return <Loading />;

  async function setApplicationStatus(id: string, status: string) {
    await save({
      ...store,
      enrollmentApplications: store.enrollmentApplications.map((row) =>
        row.applicationId === id ? { ...row, status } : row,
      ),
    });
  }

  return (
    <>
      <h1>Enrollment</h1>
      <h2>Applications</h2>
      {store.enrollmentApplications.length === 0 ? (
        <EmptyState title="No applications" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Parent</th>
              <th>Program</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {store.enrollmentApplications.map((row) => (
              <tr key={row.applicationId}>
                <td>{row.studentFullname}</td>
                <td>
                  {row.parentFullname}
                  <br />
                  {row.parentEmail}
                </td>
                <td>{row.preferredProgram}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>
                  {row.status === 'pending_review' ? (
                    <>
                      <Button type="button" onClick={() => setApplicationStatus(row.applicationId, 'approved')}>
                        Approve
                      </Button>{' '}
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setApplicationStatus(row.applicationId, 'rejected')}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <h2>Class enrollments</h2>
      <Table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Class</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {store.enrollments.map((row) => (
            <tr key={row.enrollmentId || newId('enr')}>
              <td>
                {store.students.find((s) => s.studentId === row.studentId)
                  ? studentDisplay(store.students.find((s) => s.studentId === row.studentId)!)
                  : row.studentId}
              </td>
              <td>{store.classes.find((c) => c.classId === row.classId)?.name}</td>
              <td>
                <StatusBadge status={row.status} />
              </td>
              <td>{row.enrollmentDate}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
