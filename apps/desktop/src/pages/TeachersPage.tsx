import type { HirayaDatabase, HirayaUser } from '@hiraya/types';
import { displayName } from '@hiraya/utils';
import { FormEvent, useEffect, useState } from 'react';
import { DirectMessageModal } from '../components/DirectMessageModal';
import { CertificateModal } from '../components/CertificateModal';
import { saveAccountPhoto } from '../components/ProfilePhotoField';
import { EmptyCell, NameCell, RecordTable, StatusCell, assigned } from '../components/RecordTable';
import { api } from '../lib/api';
import { PAGE_COPY } from '../lib/views';
import { assignedStudentsForTeacher, programsForTeacher } from '../lib/crud';
import { TeacherWorkspacePage } from './TeacherWorkspacePage';
import { StaffForm } from './TeacherForm';

export function TeachersPage({
  store,
  onStore,
  saveStore,
  onRefresh,
  actor,
}: {
  store: HirayaDatabase;
  onStore: (next: HirayaDatabase) => void;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
  actor: HirayaUser;
}) {
  const rows = store.users.filter((item) => item.role === 'teacher');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [editing, setEditing] = useState<HirayaUser | null | 'new'>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [messaging, setMessaging] = useState<HirayaUser | null>(null);
  const [certificate, setCertificate] = useState<HirayaUser | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function apply(event: Event) {
      const teacherId = (event as CustomEvent<{ teacherId?: string }>).detail?.teacherId;
      if (teacherId) setWorkspaceId(teacherId);
    }
    try {
      const pending = sessionStorage.getItem('hiraya.openTeacherId');
      if (pending) {
        sessionStorage.removeItem('hiraya.openTeacherId');
        setWorkspaceId(pending);
      }
    } catch {
      /* ignore */
    }
    window.addEventListener('hiraya-assistant-workspace', apply);
    return () => window.removeEventListener('hiraya-assistant-workspace', apply);
  }, []);

  const current = editing && editing !== 'new' ? editing : null;
  const profile = current
    ? (store.teacherProfiles || []).find((item) => item.userId === current.userId)
    : undefined;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');
    const email = String(form.get('email') || '').trim();
    const formEl = event.currentTarget;
    setBusy(true);
    setError(null);
    try {
      const saved = await api.saveStaff({
        userId: current?.userId,
        profileId: profile?.profileId,
        fullname: [String(form.get('firstName') || ''), String(form.get('middleName') || ''), String(form.get('lastName') || '')]
          .filter(Boolean)
          .join(' ') || String(form.get('fullname') || ''),
        firstName: String(form.get('firstName') || ''),
        middleName: String(form.get('middleName') || ''),
        lastName: String(form.get('lastName') || ''),
        email,
        phone: String(form.get('phone') || ''),
        address: String(form.get('address') || ''),
        notes: String(form.get('notes') || ''),
        role: String(form.get('role') || 'teacher'),
        employeeCode: String(form.get('employeeCode') || ''),
        position: String(form.get('position') || ''),
        specialty: String(form.get('specialty') || ''),
        bio: String(form.get('bio') || ''),
        status: String(form.get('status') || 'active'),
        hireDate: String(form.get('hireDate') || ''),
        password: password || undefined,
        confirmPassword: confirmPassword || undefined,
      });
      const userId =
        saved.userId ||
        current?.userId ||
        (saved.store?.users || []).find((item) => (item.email || '').toLowerCase() === email.toLowerCase())?.userId;
      onStore(saved.store);
      try {
        const withPhoto = await saveAccountPhoto(userId, form, formEl);
        if (withPhoto) onStore(withPhoto);
        setEditing(null);
        setNotice(current ? 'Teacher saved.' : 'Teacher created.');
      } catch (photoErr) {
        setError(
          photoErr instanceof Error
            ? `Account saved, but the photo did not upload: ${photoErr.message}. Restart the HIRAYA API (port 5188), then edit this person and upload the photo again.`
            : 'Account saved, but the photo did not upload. Restart the HIRAYA API and try the photo again.',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save teacher');
    } finally {
      setBusy(false);
    }
  }

  async function archiveRows(picked: HirayaUser[]) {
    const targets = picked.filter((row) => row.status === 'active');
    if (!targets.length) {
      window.alert('Select active teachers to deactivate.');
      return false;
    }
    if (!window.confirm(`Deactivate ${targets.length === 1 ? displayName(targets[0]) : `${targets.length} teachers`}?`)) {
      return false;
    }
    let next = store;
    for (const row of targets) {
      next = await api.setStaffActive(row.userId, false);
    }
    onStore(next);
    setNotice(targets.length === 1 ? 'Teacher deactivated.' : `${targets.length} teachers deactivated.`);
  }

  async function removeRows(picked: HirayaUser[]) {
    if (!picked.length) return false;
    if (
      !window.confirm(
        `Permanently delete ${picked.length === 1 ? displayName(picked[0]) : `${picked.length} teachers`}? This cannot be undone.`,
      )
    ) {
      return false;
    }
    let next = store;
    for (const row of picked) {
      next = await api.deleteStaff(row.userId);
    }
    onStore(next);
    setNotice(picked.length === 1 ? 'Teacher deleted.' : `${picked.length} teachers deleted.`);
  }

  if (workspaceId) {
    return (
      <TeacherWorkspacePage
        teacherId={workspaceId}
        store={store}
        actor={actor}
        saveStore={saveStore}
        onStore={onStore}
        onBack={() => setWorkspaceId(null)}
      />
    );
  }

  return (
    <>
      {notice ? (
        <p className="crud-notice" role="status" style={{ color: '#1f6b3a' }}>
          {notice}
        </p>
      ) : null}
      <RecordTable
        title={PAGE_COPY.teachers.title}
        description={PAGE_COPY.teachers.description}
        rows={rows}
        rowKey={(row) => row.userId}
        search={(row, q) => `${displayName(row)} ${row.email} ${row.phone}`.toLowerCase().includes(q)}
        searchPlaceholder="Filter this list of teachers"
        emptyTitle="No teachers found"
        emptyHint="Add a teacher. Do not leave this page empty — use + Add Teacher."
        statusOf={(row) => row.status}
        crud={{
          addLabel: '+ Add Teacher',
          archiveLabel: 'Archive',
          onAdd: () => {
            setNotice(null);
            setEditing('new');
          },
          onEdit: (row) => {
            setNotice(null);
            setEditing(row);
          },
          onArchive: archiveRows,
          onDelete: removeRows,
          onRefresh,
          singleActions: [
            {
              icon: 'file',
              label: 'Certificate',
              needOneMessage: 'Please select only one teacher to issue a certificate.',
              onClick: (row) => {
                setNotice(null);
                setCertificate(row);
              },
            },
            {
              icon: 'chat',
              label: 'Message',
              needOneMessage: 'Please select only one teacher to message.',
              onClick: (row) => {
                setNotice(null);
                setMessaging(row);
              },
            },
            {
              icon: 'teachers',
              label: 'Open workspace',
              needOneMessage: 'Please select only one teacher to open.',
              onClick: (row) => setWorkspaceId(row.userId),
            },
          ],
        }}
        columns={[
          {
            key: 'name',
            header: 'Teacher',
            render: (row) => (
              <NameCell name={displayName(row)} photo={row.profileImagePath ? api.profileMediaUrl(row.userId, row.updatedAt || row.profileImagePath) : undefined} />
            ),
          },
          { key: 'contact', header: 'Contact', render: (row) => assigned(row.phone || row.email) },
          {
            key: 'specialty',
            header: 'Specialization',
            render: (row) =>
              assigned((store.teacherProfiles || []).find((item) => item.userId === row.userId)?.specialty || row.position),
          },
          {
            key: 'programs',
            header: 'Programs',
            priority: 'secondary',
            render: (row) => assigned(programsForTeacher(store, row.userId).map((item) => item.name).join(', ')),
          },
          {
            key: 'classes',
            header: 'Classes',
            priority: 'secondary',
            render: (row) => assigned(store.classes.filter((item) => item.teacherId === row.userId).map((item) => item.name).join(', ')),
          },
          {
            key: 'students',
            header: 'Assigned students',
            render: (row) => {
              const kids = assignedStudentsForTeacher(store, row.userId);
              return kids.length ? String(kids.length) : <EmptyCell />;
            },
          },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
        ]}
      />
      {certificate ? (
        <CertificateModal
          user={certificate}
          profile={(store.teacherProfiles || []).find((item) => item.userId === certificate.userId)}
          settings={store.settings}
          onClose={() => setCertificate(null)}
        />
      ) : null}
      {messaging ? (
        <DirectMessageModal
          key={store.alerts.length}
          person={messaging}
          actorId={actor.userId}
          alerts={store.alerts}
          error={error}
          busy={busy}
          onClose={() => {
            setMessaging(null);
            setError(null);
          }}
          onSend={async (body) => {
            if (!body) {
              setError('Write a message first.');
              return;
            }
            setBusy(true);
            setError(null);
            try {
              onStore(await api.sendDirectMessage(messaging.userId, body));
              setNotice(`Message sent to ${displayName(messaging)}.`);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not send that message.');
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
      {editing ? (
        <StaffForm
          user={current}
          profile={profile}
          specialties={store.teacherRoleOptions.map((item) => item.name).filter(Boolean)}
          error={error}
          busy={busy}
          onClose={() => setEditing(null)}
          onSubmit={onSubmit}
        />
      ) : null}
    </>
  );
}

