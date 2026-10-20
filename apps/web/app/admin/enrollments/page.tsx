'use client';

import { AdminModal } from '@/components/admin/AdminModal';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTable } from '@/components/admin/AdminTable';
import { useStore } from '@/components/StoreProvider';
import { enrollmentStatusLabel } from '@/lib/enrollment';
import { api } from '@/lib/api';
import { Alert, Button, EmptyState, Loading, StatusBadge, emptyCell } from '@hiraya/ui';
import { formatDate, isTeacherApplication, teacherApplicationOpen } from '@hiraya/utils';
import type { EnrollmentApplication } from '@hiraya/types';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';

const kinds = [
  { id: 'student', label: 'Student enrollment' },
  { id: 'teacher', label: 'Teacher applications' },
];

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

export default function AdminEnrollmentsPage() {
  const { store, loading, refresh } = useStore();
  const pathname = usePathname();
  const [kind, setKind] = useState(pathname.includes('teacher-applications') ? 'teacher' : 'student');
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState<EnrollmentApplication | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [interviewWhen, setInterviewWhen] = useState('');
  const [interviewPlace, setInterviewPlace] = useState('');
  const [interviewNote, setInterviewNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const rows = useMemo(() => {
    return store.enrollmentApplications.filter((row) => {
      const teacher = isTeacherApplication(row);
      if (kind === 'teacher' ? !teacher : teacher) return false;
      const current = enrollmentStatusLabel(row.status).toLowerCase();
      return tab === 'all' || current === tab;
    });
  }, [store.enrollmentApplications, tab, kind]);
  const teacher = kind === 'teacher';

  function awaitingDecision(row: EnrollmentApplication) {
    return isTeacherApplication(row)
      ? teacherApplicationOpen(row.status)
      : row.status === 'pending_review' || row.status === 'pending';
  }

  async function openResume(row: EnrollmentApplication) {
    setResumeError(null);
    try {
      await api.openTeacherResume(row.applicationId);
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : 'Could not open that resume.');
    }
  }

  async function setStatusFor(id: string, next: string) {
    setActionError(null);
    try {
      if (next === 'approved') {
        await api.approveEnrollment(id);
        try {
          await api.importApprovedTeachers();
        } catch {
          /* older API still marks the application approved */
        }
      }
      else if (next === 'rejected') await api.rejectEnrollment(id);
      else if (next === 'cancelled') await api.cancelEnrollment(id);
      else if (next === 'interview') {
        await api.scheduleTeacherInterview(id, interviewWhen, interviewPlace, interviewNote);
      } else return;
      await refresh();
      setSelected((current) => (current?.applicationId === id ? { ...current, status: next } : current));
      setOk(true);
      setMessage(
        next === 'approved' && !teacher
          ? 'Approved for class. The parent and child were already saved and linked when they applied. Set a parent password on Desktop if they still cannot sign in on the phone.'
          : `Application ${enrollmentStatusLabel(next).toLowerCase()}.`,
      );
      setConfirm(null);
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Could not update the application.';
      setOk(false);
      setActionError(text);
      setMessage(text);
    }
  }

  if (loading) return <Loading />;

  return (
    <>
      <AdminPageHeader
        kicker="Admissions"
        title="Enrollments"
        description="Student enrollment and teacher applications are listed separately. Approving a teacher adds them to Teacher management."
      />
      {message ? <Alert kind={ok ? 'success' : 'danger'}>{message}</Alert> : null}
      <div className="admin-tabs" role="tablist" aria-label="Application type">
        {kinds.map((item) => (
          <button
            key={item.id}
            type="button"
            className={kind === item.id ? 'admin-tab active' : 'admin-tab'}
            onClick={() => {
              setKind(item.id);
              setSelected(null);
              setConfirm(null);
            }}
          >
            {item.label}
            {item.id === 'teacher'
              ? ` (${store.enrollmentApplications.filter((row) => isTeacherApplication(row) && teacherApplicationOpen(row.status)).length})`
              : ''}
          </button>
        ))}
      </div>
      <div className="admin-tabs" role="tablist" aria-label="Enrollment status">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'admin-tab active' : 'admin-tab'}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <AdminTable
        rows={rows}
        rowKey={(row) => row.applicationId}
        empty={
          <EmptyState
            title={teacher ? 'No teacher applications' : 'No enrollments'}
            hint={teacher ? 'Apply as a teacher on the public website. Those applications appear here.' : 'Submitted applications will appear here.'}
          />
        }
        columns={[
          { key: 'name', header: teacher ? 'Applicant' : 'Student Name', sortValue: (row) => row.studentFullname, render: (row) => row.studentFullname },
          { key: 'program', header: teacher ? 'Role' : 'Program', sortValue: (row) => row.preferredProgram, render: (row) => emptyCell(row.preferredProgram) },
          ...(teacher
            ? [
                {
                  key: 'email',
                  header: 'Email',
                  sortValue: (row: EnrollmentApplication) => row.parentEmail,
                  render: (row: EnrollmentApplication) => emptyCell(row.parentEmail),
                },
                {
                  key: 'resume',
                  header: 'Resume',
                  sortValue: (row: EnrollmentApplication) => row.resumeFileName || '',
                  render: (row: EnrollmentApplication) =>
                    row.resumeFileName ? (
                      <button type="button" className="icon-btn" aria-label={`Open resume for ${row.studentFullname}`} onClick={() => void openResume(row)}>
                        Open
                      </button>
                    ) : (
                      emptyCell('')
                    ),
                },
              ]
            : []),
          {
            key: 'date',
            header: 'Enrollment Date',
            sortValue: (row) => row.submittedAt || '',
            render: (row) => emptyCell(formatDate(row.submittedAt)),
          },
          {
            key: 'status',
            header: 'Status',
            sortValue: (row) => enrollmentStatusLabel(row.status),
            render: (row) => <StatusBadge status={enrollmentStatusLabel(row.status)} />,
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div className="icon-actions">
                <button type="button" className="icon-btn" aria-label={`View ${row.studentFullname}`} onClick={() => setSelected(row)}>
                  👁
                </button>
                {awaitingDecision(row) ? (
                  <>
                    <button type="button" className="icon-btn" aria-label="Approve" onClick={() => { setSelected(row); setConfirm('approved'); }}>
                      ✓
                    </button>
                    <button type="button" className="icon-btn danger" aria-label="Reject" onClick={() => { setSelected(row); setConfirm('rejected'); }}>
                      ✕
                    </button>
                  </>
                ) : null}
              </div>
            ),
          },
        ]}
        renderCard={(row) => (
          <article className="admin-stack-card">
            <h3>{row.studentFullname}</h3>
            <p>{row.preferredProgram}</p>
            <p>{row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : '—'}</p>
            <StatusBadge status={enrollmentStatusLabel(row.status)} />
            <Button type="button" variant="ghost" onClick={() => setSelected(row)}>
              View
            </Button>
          </article>
        )}
      />

      {selected ? (
        <AdminModal
          title={selected.studentFullname}
          description={selected.preferredProgram}
          onClose={() => {
            setSelected(null);
            setConfirm(null);
          }}
          footer={
            awaitingDecision(selected) ? (
              <>
                {isTeacherApplication(selected) && (selected.status === 'pending_review' || selected.status === 'pending') ? (
                  <Button type="button" variant="ghost" onClick={() => setConfirm('interview')}>
                    Interview
                  </Button>
                ) : null}
                <Button type="button" onClick={() => setConfirm('approved')}>
                  Approve
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirm('rejected')}>
                  Reject
                </Button>
              </>
            ) : undefined
          }
        >
          {isTeacherApplication(selected) ? (
            <>
              <p>
                <strong>Teacher application.</strong> Approving this adds the person to Teacher management. It does not create a student.
              </p>
              <p>
                <strong>Resume:</strong>{' '}
                {selected.resumeFileName ? (
                  <>
                    {selected.resumeFileName}
                    {selected.resumeSizeBytes ? ` · ${Math.max(1, Math.round(selected.resumeSizeBytes / 1024))} KB` : ''}{' '}
                    <Button type="button" variant="ghost" onClick={() => void openResume(selected)}>
                      Open resume
                    </Button>
                  </>
                ) : (
                  'No file uploaded'
                )}
              </p>
              {resumeError ? <Alert>{resumeError}</Alert> : null}
            </>
          ) : (
            <>
              <p>
                <strong>Date of birth:</strong> {selected.studentBirthdate || '—'}
              </p>
              <p>
                <strong>Age:</strong> {selected.studentAge || '—'}
              </p>
              <p>
                <strong>Parent / guardian:</strong> {selected.parentFullname}
              </p>
            </>
          )}
          <p>
            <strong>Contact:</strong> {selected.parentPhone} · {selected.parentEmail}
          </p>
          <p>
            <strong>Submitted:</strong> {selected.submittedAt ? new Date(selected.submittedAt).toLocaleString() : '—'}
          </p>
          <p>
            <strong>Status:</strong> {enrollmentStatusLabel(selected.status)}
          </p>
          {selected.notes ? <pre className="admin-notes">{selected.notes}</pre> : null}
        </AdminModal>
      ) : null}

      {confirm && selected ? (
        <AdminModal
          title={`${enrollmentStatusLabel(confirm)} application`}
          description={`This will mark ${selected.studentFullname} as ${enrollmentStatusLabel(confirm).toLowerCase()}.`}
          onClose={() => {
            setConfirm(null);
            setActionError(null);
          }}
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setConfirm(null);
                  setActionError(null);
                }}
              >
                Cancel
              </Button>
              <Button type="button" variant={confirm === 'rejected' ? 'danger' : 'primary'} onClick={() => void setStatusFor(selected.applicationId, confirm)}>
                Confirm
              </Button>
            </>
          }
        >
          {confirm === 'interview' ? (
            <div className="admin-form-grid">
              <label>
                Date and time
                <input value={interviewWhen} onChange={(event) => setInterviewWhen(event.target.value)} placeholder="October 20, 2026, 9:00 AM" />
              </label>
              <label>
                Location or link
                <input value={interviewPlace} onChange={(event) => setInterviewPlace(event.target.value)} placeholder="Hiraya campus, main office" />
              </label>
              <label>
                Instructions
                <input value={interviewNote} onChange={(event) => setInterviewNote(event.target.value)} placeholder="Bring a valid ID." />
              </label>
            </div>
          ) : (
            <p>
              {isTeacherApplication(selected)
                ? 'The teacher is added to Teacher management. This does not enroll a child.'
                : 'The family record stays in Student enrollment with the updated status badge.'}
            </p>
          )}
          {actionError ? <Alert>{actionError}</Alert> : null}
        </AdminModal>
      ) : null}
    </>
  );
}
