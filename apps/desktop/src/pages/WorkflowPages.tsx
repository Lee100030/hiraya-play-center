import type { HirayaDatabase, HirayaUser, NewsItem, Schedule, SessionPackage, StaffTask, SystemAlert } from '@hiraya/types';
import { collapseDuplicateStaffTasks, compareStudentNames, completeOneSession, displayName, dropStudentSessionPackage, feedbackLaneLabel, formatDate, formatDateTime, isAdmin, laneLabel, newId, normalizeSessionPackage, parseFeedbackLane, placeStudentSessionPackage, programForStudent, scrubLeftoverSessionPackages, sessionLeftFor, staffDisplayRole, staffTaskKey, studentDisplay, studentInLane, studentSessionPackage, type ManagementLaneId } from '@hiraya/utils';
import { Button, Field, Input, PhotoCardPicker, Select, Textarea } from '@hiraya/ui';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { DeskModal } from '../components/DeskModal';
import { LaneSessionPackage } from '../components/LaneSessionPackage';
import { EditorModal, FormSection } from '../components/EditorModal';
import { RecordTable, StatusCell, assigned } from '../components/RecordTable';
import { api } from '../lib/api';
import { PAGE_COPY } from '../lib/views';

function nowIso() {
  return new Date().toISOString();
}

function teacherPeople(store: HirayaDatabase) {
  return store.users
    .filter((item) => item.role === 'teacher')
    .map((item) => ({
      id: item.userId,
      name: displayName(item),
      photo: item.profileImagePath ? api.profileMediaUrl(item.userId, item.updatedAt || item.profileImagePath) : undefined,
      role: staffDisplayRole(item.role, store.teacherProfiles.find((row) => row.userId === item.userId)?.specialty),
    }));
}

function localInput(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function SchedulesManagePage({
  store,
  user,
  saveStore,
  onRefresh,
}: {
  store: HirayaDatabase;
  user: HirayaUser;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
}) {
  const canManage = isAdmin(user.role);
  const [editing, setEditing] = useState<Schedule | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = editing && editing !== 'new' ? editing : null;
  const rows = store.schedules.filter((row) => row.kind !== 'teacherTask');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const start = String(form.get('startAt') || '');
    const end = String(form.get('endAt') || '');
    const next: Schedule = {
      scheduleId: current?.scheduleId || newId('sch'),
      title: String(form.get('title') || '').trim(),
      kind: 'classSession',
      scheduleType: 'classSession',
      classId: String(form.get('classId') || ''),
      studentId: String(form.get('studentId') || ''),
      teacherId: form.getAll('teacherIds').map(String).filter(Boolean).join(','),
      programId: String(form.get('programId') || ''),
      startAt: start ? new Date(start).toISOString() : nowIso(),
      endAt: end ? new Date(end).toISOString() : nowIso(),
      room: String(form.get('room') || '').trim(),
      notes: String(form.get('notes') || '').trim(),
      status: String(form.get('status') || 'confirmed'),
    };
    if (!next.title || !next.teacherId) {
      setError('Title and at least one teacher are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveStore({
        ...store,
        schedules: current
          ? store.schedules.map((item) => (item.scheduleId === next.scheduleId ? next : item))
          : [...store.schedules, next],
      });
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save schedule');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <RecordTable
        title={PAGE_COPY.calendar.title}
        description={PAGE_COPY.calendar.description}
        rows={rows}
        rowKey={(row) => row.scheduleId}
        search={(row, q) => `${row.title} ${row.room} ${row.kind}`.toLowerCase().includes(q)}
        searchPlaceholder="Filter this list of schedules"
        emptyTitle="No schedules"
        emptyHint={canManage ? 'Create a class time and assign a teacher. It will show on their mobile calendar.' : 'No assigned schedules yet.'}
        statusOf={(row) => row.status}
        crud={
          canManage
            ? {
                addLabel: '+ Add Schedule',
                onAdd: () => setEditing('new'),
                onEdit: (row) => setEditing(row),
                onRefresh,
              }
            : onRefresh
              ? { onRefresh }
              : undefined
        }
        columns={[
          { key: 'title', header: 'Title', render: (row) => row.title },
          {
            key: 'when',
            header: 'When',
            render: (row) => `${localInput(row.startAt).replace('T', ' ')} – ${localInput(row.endAt).slice(11)}`,
          },
          {
            key: 'teacher',
            header: 'Teacher',
            render: (row) =>
              assigned(
                (row.teacherId || '')
                  .split(',')
                  .map((id) => displayName(store.users.find((item) => item.userId === id.trim())))
                  .filter(Boolean)
                  .join(', '),
              ),
          },
          {
            key: 'class',
            header: 'Class',
            priority: 'secondary',
            render: (row) => assigned(store.classes.find((item) => item.classId === row.classId)?.name),
          },
          { key: 'room', header: 'Location', priority: 'secondary', render: (row) => assigned(row.room) },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
        ]}
      />
      {editing && canManage ? (
        <EditorModal
          title={current ? `Edit ${current.title}` : 'Add schedule'}
          error={error}
          busy={busy}
          submitLabel={current ? 'Save schedule' : 'Create schedule'}
          onClose={() => setEditing(null)}
          onSubmit={onSubmit}
        >
          <FormSection title="Schedule">
          <Field label="Title" required>
            <Input name="title" defaultValue={current?.title} required />
          </Field>
          <Field label="Teachers" required hint="Tap a photo card to assign. You can pick more than one.">
            <PhotoCardPicker
              key={current?.scheduleId || 'new-schedule'}
              name="teacherIds"
              people={teacherPeople(store)}
              defaultSelected={(current?.teacherId || '').split(',').filter(Boolean)}
            />
          </Field>
          <Field label="Program">
            <Select name="programId" defaultValue={current?.programId || ''}>
              <option value="">None</option>
              {store.programs.map((item) => (
                <option key={item.programId} value={item.programId}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Class">
            <Select name="classId" defaultValue={current?.classId || ''}>
              <option value="">None</option>
              {store.classes.map((item) => (
                <option key={item.classId} value={item.classId}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Student" optional>
            <Select name="studentId" defaultValue={current?.studentId || ''}>
              <option value="">Whole class</option>
              {store.students.map((item) => (
                <option key={item.studentId} value={item.studentId}>
                  {studentDisplay(item)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Start" required>
            <Input name="startAt" type="datetime-local" defaultValue={localInput(current?.startAt)} required />
          </Field>
          <Field label="End" required>
            <Input name="endAt" type="datetime-local" defaultValue={localInput(current?.endAt)} required />
          </Field>
          <Field label="Location" optional>
            <Input name="room" defaultValue={current?.room} />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={current?.status || 'confirmed'}>
              <option value="confirmed">confirmed</option>
              <option value="cancelled">cancelled</option>
            </Select>
          </Field>
          <div className="form-span">
            <Field label="Notes" optional>
              <Textarea name="notes" defaultValue={current?.notes} />
            </Field>
          </div>
          </FormSection>
        </EditorModal>
      ) : null}
    </>
  );
}

export function TasksManagePage({
  store,
  user,
  saveStore,
  onRefresh,
}: {
  store: HirayaDatabase;
  user: HirayaUser;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
}) {
  const canManage = isAdmin(user.role);
  const [editing, setEditing] = useState<StaffTask | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = editing && editing !== 'new' ? editing : null;
  const rows = store.staffTasks || [];

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const teacherIds = form.getAll('teacherIds').map(String).filter(Boolean).join(',');
    const next: StaffTask = {
      taskId: current?.taskId || newId('tsk'),
      title: String(form.get('title') || '').trim(),
      description: String(form.get('description') || '').trim(),
      priority: String(form.get('priority') || 'normal'),
      dueAt: String(form.get('dueAt') || ''),
      teacherIds,
      classId: String(form.get('classId') || ''),
      studentId: String(form.get('studentId') || ''),
      status: String(form.get('status') || current?.status || 'assigned'),
      response: current?.response || '',
      attachmentName: String(form.get('attachmentName') || current?.attachmentName || ''),
      assignedBy: current?.assignedBy || user.userId,
      completedAt: current?.completedAt || '',
      completedBy: current?.completedBy || '',
      createdAt: current?.createdAt || nowIso(),
      updatedAt: nowIso(),
    };
    if (!next.title || !next.teacherIds) {
      setError('Title and at least one teacher are required.');
      return;
    }
    if (busy) return;
    if (!current && rows.some((row) => staffTaskKey(row) === staffTaskKey(next) && !['completed', 'cancelled'].includes((row.status || '').toLowerCase()))) {
      setError('That task is already assigned. A second click does not add another copy.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveStore({
        ...store,
        staffTasks: current ? rows.map((item) => (item.taskId === next.taskId ? next : item)) : [...rows, next],
      });
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save task');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <RecordTable
        title={PAGE_COPY.tasks.title}
        description={PAGE_COPY.tasks.description}
        rows={rows}
        rowKey={(row) => row.taskId}
        search={(row, q) => `${row.title} ${row.status} ${row.teacherIds}`.toLowerCase().includes(q)}
        searchPlaceholder="Filter this list of tasks"
        emptyTitle="No tasks"
        emptyHint={canManage ? 'Assign a task to one or more teachers.' : 'No tasks assigned to you.'}
        statusOf={(row) => row.status}
        crud={
          canManage
            ? {
                addLabel: '+ Add Task',
                onAdd: () => setEditing('new'),
                onEdit: (row) => setEditing(row),
                onRefresh,
              }
            : onRefresh
              ? { onRefresh }
              : undefined
        }
        columns={[
          { key: 'title', header: 'Task', render: (row) => row.title },
          { key: 'priority', header: 'Priority', render: (row) => <StatusCell value={row.priority} /> },
          { key: 'due', header: 'Due', render: (row) => assigned(row.dueAt) },
          {
            key: 'teachers',
            header: 'Teachers',
            render: (row) =>
              assigned(
                row.teacherIds
                  .split(',')
                  .map((id) => displayName(store.users.find((item) => item.userId === id.trim())))
                  .filter(Boolean)
                  .join(', '),
              ),
          },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
          { key: 'done', header: 'Completed', priority: 'secondary', render: (row) => assigned(row.completedAt) },
          { key: 'response', header: 'Response', priority: 'secondary', render: (row) => assigned(row.response) },
        ]}
      />
      {editing && canManage ? (
        <EditorModal
          title={current ? `Edit ${current.title}` : 'Assign task'}
          error={error}
          busy={busy}
          submitLabel={current ? 'Save task' : 'Assign task'}
          onClose={() => setEditing(null)}
          onSubmit={onSubmit}
        >
          <FormSection title="Task">
          <Field label="Title" required>
            <Input name="title" defaultValue={current?.title} required />
          </Field>
          <Field label="Description">
            <Textarea name="description" defaultValue={current?.description} />
          </Field>
          <Field label="Priority">
            <Select name="priority" defaultValue={current?.priority || 'normal'}>
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
            </Select>
          </Field>
          <Field label="Due date">
            <Input name="dueAt" type="date" defaultValue={(current?.dueAt || '').slice(0, 10)} />
          </Field>
          <Field label="Teachers" required hint="Tap a photo card to assign. You can pick more than one.">
            <PhotoCardPicker
              key={current?.taskId || 'new-task'}
              name="teacherIds"
              people={teacherPeople(store)}
              defaultSelected={(current?.teacherIds || '').split(',').filter(Boolean)}
            />
          </Field>
          <Field label="Related class">
            <Select name="classId" defaultValue={current?.classId || ''}>
              <option value="">None</option>
              {store.classes.map((item) => (
                <option key={item.classId} value={item.classId}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Related student">
            <Select name="studentId" defaultValue={current?.studentId || ''}>
              <option value="">None</option>
              {store.students.map((item) => (
                <option key={item.studentId} value={item.studentId}>
                  {studentDisplay(item)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={current?.status || 'assigned'}>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="submitted">Submitted</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
          </FormSection>
        </EditorModal>
      ) : null}
    </>
  );
}

export function AnnouncementsManagePage({
  store,
  user,
  saveStore,
  onRefresh,
}: {
  store: HirayaDatabase;
  user: HirayaUser;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState<NewsItem | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = editing && editing !== 'new' ? editing : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const publish = String(form.get('status') || 'published') === 'published';
    const next: NewsItem = {
      newsId: current?.newsId || newId('nws'),
      title: String(form.get('title') || '').trim(),
      body: String(form.get('body') || '').trim(),
      publishedAt: publish ? current?.publishedAt || nowIso() : current?.publishedAt || '',
      isPublished: publish,
      status: String(form.get('status') || 'published'),
      createdBy: current?.createdBy || user.userId,
      audience: String(form.get('audience') || 'everyone'),
      audienceId: String(form.get('audienceId') || ''),
      priority: String(form.get('priority') || 'normal'),
      expiresAt: String(form.get('expiresAt') || ''),
    };
    if (!next.title) {
      setError('Title is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveStore({
        ...store,
        news: current ? store.news.map((item) => (item.newsId === next.newsId ? next : item)) : [...store.news, next],
      });
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save announcement');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <RecordTable
        title={PAGE_COPY.announcements.title}
        description={PAGE_COPY.announcements.description}
        rows={store.news}
        rowKey={(row) => row.newsId}
        search={(row, q) => `${row.title} ${row.body} ${row.audience}`.toLowerCase().includes(q)}
        searchPlaceholder="Filter this list of announcements"
        emptyTitle="No announcements"
        emptyHint="Publish a notice for teachers, parents, or everyone."
        statusOf={(row) => row.status}
        crud={{
          addLabel: '+ Add Announcement',
          onAdd: () => setEditing('new'),
          onEdit: (row) => setEditing(row),
          onRefresh,
        }}
        columns={[
          { key: 'title', header: 'Title', render: (row) => row.title },
          { key: 'audience', header: 'Audience', render: (row) => assigned(row.audience || 'everyone') },
          { key: 'priority', header: 'Priority', priority: 'secondary', render: (row) => <StatusCell value={row.priority || 'normal'} /> },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
        ]}
      />
      {editing ? (
        <EditorModal
          title={current ? `Edit ${current.title}` : 'New announcement'}
          error={error}
          busy={busy}
          submitLabel={current ? 'Save' : 'Publish'}
          onClose={() => setEditing(null)}
          onSubmit={onSubmit}
        >
          <FormSection title="Announcement">
          <Field label="Title" required>
            <Input name="title" defaultValue={current?.title} required />
          </Field>
          <div className="form-span">
            <Field label="Content" required>
              <Textarea name="body" defaultValue={current?.body} required />
            </Field>
          </div>
          <Field label="Audience">
            <Select name="audience" defaultValue={current?.audience || 'everyone'}>
              <option value="everyone">All users</option>
              <option value="teachers">All teachers</option>
              <option value="parents">All parents</option>
              <option value="user">Specific user</option>
              <option value="class">Specific class</option>
              <option value="program">Specific program</option>
            </Select>
          </Field>
          <Field label="Audience id" optional hint="User, class, or program id when audience is specific.">
            <Input name="audienceId" defaultValue={current?.audienceId} />
          </Field>
          <Field label="Priority">
            <Select name="priority" defaultValue={current?.priority || 'normal'}>
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
            </Select>
          </Field>
          <Field label="Expires" optional>
            <Input name="expiresAt" type="datetime-local" defaultValue={localInput(current?.expiresAt)} />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={current?.status || 'published'}>
              <option value="published">published</option>
              <option value="draft">unpublished</option>
              <option value="archived">archived</option>
            </Select>
          </Field>
          </FormSection>
        </EditorModal>
      ) : null}
    </>
  );
}

export function SessionsManagePage({
  store,
  saveStore,
  onRefresh,
  lane,
}: {
  store: HirayaDatabase;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
  lane?: ManagementLaneId | null;
}) {
  const [editing, setEditing] = useState<SessionPackage | 'new' | null>(null);
  const [packageStudentId, setPackageStudentId] = useState('');
  const [packageProgramId, setPackageProgramId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scrubbedPackages = useRef(false);
  useEffect(() => {
    if (scrubbedPackages.current) return;
    const next = scrubLeftoverSessionPackages(store);
    if (!next) return;
    scrubbedPackages.current = true;
    void saveStore(next).catch(() => {
      scrubbedPackages.current = false;
    });
  }, [store, saveStore]);
  const current = editing && editing !== 'new' ? editing : null;
  const studentOptions = store.students.filter((item) => studentInLane(store, item, lane)).sort(compareStudentNames);
  const enrolledProgram = programForStudent(store, packageStudentId);

  function choosePackageStudent(studentId: string) {
    setPackageStudentId(studentId);
    setPackageProgramId(programForStudent(store, studentId)?.programId || '');
  }

  function openPackage(studentId: string, existing?: SessionPackage | null) {
    if (existing) {
      setPackageStudentId(existing.studentId || '');
      setPackageProgramId(existing.programId || programForStudent(store, existing.studentId)?.programId || '');
      setEditing(existing);
      return;
    }
    setPackageStudentId(studentId);
    setPackageProgramId(programForStudent(store, studentId)?.programId || '');
    setEditing('new');
  }
  const rows = studentOptions.map((student) => {
    const pack = sessionLeftFor(store, student.studentId);
    const latest = studentSessionPackage(store, student.studentId);
    return { student, pack, latest };
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const total = Math.max(0, Number(form.get('totalSessions') || 0));
    const used = Math.min(total, Math.max(0, Number(form.get('usedSessions') || 0)));
    const next = normalizeSessionPackage({
      packageId: current?.packageId || newId('pkg'),
      studentId: String(form.get('studentId') || ''),
      programId: String(form.get('programId') || ''),
      totalSessions: total,
      usedSessions: used,
      remainingSessions: 0,
      startDate: String(form.get('startDate') || ''),
      expirationDate: String(form.get('expirationDate') || ''),
      status: String(form.get('status') || 'active'),
      createdAt: current?.createdAt || nowIso(),
      updatedAt: nowIso(),
    });
    if (!next.studentId || total < 1) {
      setError('Student and total sessions are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveStore(placeStudentSessionPackage(store, next));
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save package');
    } finally {
      setBusy(false);
    }
  }

  async function completeOne(row: { latest: SessionPackage | null; student: { studentId: string } }) {
    if (!row.latest) {
      window.alert('Add a session package for this student first.');
      return;
    }
    try {
      await saveStore(completeOneSession(store, row.latest.packageId));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not complete session');
    }
  }

  function openEdit(row: (typeof rows)[number]) {
    openPackage(row.student.studentId, row.latest);
  }

  return (
    <>
      {lane ? <LaneSessionPackage store={store} lane={lane} saveStore={saveStore} /> : null}
      <RecordTable
        title={lane ? `Session management · ${laneLabel(lane, store)}` : PAGE_COPY.sessions.title}
        description={
          lane
            ? `Sessions left for each learner in ${laneLabel(lane, store)}.`
            : 'See how many sessions each student has left. Remaining = total − used, never below zero.'
        }
        rows={rows}
        rowKey={(row) => row.student.studentId}
        search={(row, q) =>
          `${studentDisplay(row.student)} ${row.student.studentId} ${row.pack.remaining}`.toLowerCase().includes(q)
        }
        searchPlaceholder="Filter by student name"
        emptyTitle="No students in this list"
        emptyHint="Add learners in Student management, or pick another program lane."
        statusOf={(row) => row.latest?.status || (row.pack.hasPackage ? 'active' : 'none')}
          crud={{
          addLabel: '+ Add Package',
          onAdd: () => openPackage(''),
          onEdit: (row) => openEdit(row),
          onDelete: async (selected) => {
            const withPack = selected.filter((row) => row.latest);
            if (!withPack.length) {
              window.alert('Select a student who has a session package.');
              return false;
            }
            const label =
              withPack.length === 1 ? studentDisplay(withPack[0].student) : `${withPack.length} session packages`;
            if (
              !window.confirm(
                `Delete ${label}? Counted payments for ${withPack.length === 1 ? 'this student' : 'these students'} will also leave Income and expenses.`,
              )
            ) {
              return false;
            }
            let next = store;
            for (const row of withPack) next = dropStudentSessionPackage(next, row.student.studentId);
            await saveStore(next);
          },
          deleteLabel: 'Delete package',
          onRefresh,
          singleActions: [
            {
              icon: 'check',
              label: 'Complete session',
              needOneMessage: 'Please select only one student to complete a session.',
              onClick: (row) => void completeOne(row),
            },
          ],
        }}
        columns={[
          {
            key: 'student',
            header: 'Student',
            render: (row) => assigned(studentDisplay(row.student)),
          },
          {
            key: 'left',
            header: 'Sessions left',
            render: (row) =>
              row.pack.hasPackage
                ? `${row.pack.remaining} session${row.pack.remaining === 1 ? '' : 's'} left`
                : 'No package',
          },
          {
            key: 'used',
            header: 'Used',
            render: (row) => (row.pack.hasPackage ? String(row.pack.used) : '—'),
          },
          {
            key: 'total',
            header: 'Total',
            render: (row) => (row.pack.hasPackage ? String(row.pack.total) : '—'),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusCell value={row.latest?.status || (row.pack.hasPackage ? 'active' : 'none')} />,
          },
        ]}
      />
      {editing ? (
        <EditorModal
          title={
            current
              ? `Edit package${
                  store.students.find((item) => item.studentId === current.studentId)
                    ? ` · ${studentDisplay(store.students.find((item) => item.studentId === current.studentId)!)}`
                    : ''
                }`
              : 'New session package'
          }
          error={error}
          busy={busy}
          submitLabel="Save package"
          onClose={() => setEditing(null)}
          onSubmit={onSubmit}
        >
          <FormSection title="Session package">
          <Field label="Student" required>
            <Select
              name="studentId"
              value={packageStudentId}
              required
              onChange={(event) => choosePackageStudent(event.target.value)}
            >
              <option value="">Select student</option>
              {studentOptions.map((item) => {
                const left = sessionLeftFor(store, item.studentId);
                return (
                  <option key={item.studentId} value={item.studentId}>
                    {studentDisplay(item)}
                    {left.hasPackage ? ` · ${left.remaining} sessions left` : ''}
                  </option>
                );
              })}
              {current?.studentId && !studentOptions.some((item) => item.studentId === current.studentId)
                ? (() => {
                    const student = store.students.find((item) => item.studentId === current.studentId);
                    return student ? (
                      <option key={student.studentId} value={student.studentId}>
                        {studentDisplay(student)}
                      </option>
                    ) : (
                      <option value={current.studentId}>{current.studentId}</option>
                    );
                  })()
                : null}
            </Select>
          </Field>
          <Field
            label="Program"
            hint={
              enrolledProgram && packageProgramId === enrolledProgram.programId
                ? `Filled from the program this child enrolled in: ${enrolledProgram.name}.`
                : 'Choose the child and this fills with the program their parent enrolled.'
            }
          >
            <Select name="programId" value={packageProgramId} onChange={(event) => setPackageProgramId(event.target.value)}>
              <option value="">None</option>
              {store.programs.map((item) => (
                <option key={item.programId} value={item.programId}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Total sessions" required>
            <Input name="totalSessions" type="number" min={1} defaultValue={current?.totalSessions || 10} required />
          </Field>
          <Field label="Used sessions" optional>
            <Input name="usedSessions" type="number" min={0} defaultValue={current?.usedSessions || 0} />
          </Field>
          <Field label="Start date" optional>
            <Input name="startDate" type="date" defaultValue={current?.startDate} />
          </Field>
          <Field label="Expiration" optional>
            <Input name="expirationDate" type="date" defaultValue={current?.expirationDate} />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={current?.status || 'active'}>
              <option value="active">Active</option>
              <option value="almost_finished">Almost Finished</option>
              <option value="completed">Completed</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
            </Select>
          </Field>
          </FormSection>
        </EditorModal>
      ) : null}
    </>
  );
}

function isFeedbackAlert(row: SystemAlert) {
  const href = (row.href || '').trim().toLowerCase();
  if (href === 'feedback') return true;
  const title = (row.title || '').toLowerCase();
  return title.includes('feedback');
}

function feedbackKind(row: SystemAlert) {
  const title = (row.title || '').toLowerCase();
  if (title.includes('teacher')) return 'teacher' as const;
  if (title.includes('center') || title.includes('parent')) return 'parent' as const;
  return 'other' as const;
}

function feedbackParts(message: string) {
  const text = (message || '').trim();
  const rated = text.match(/^(.+?) rated (.+?) (\d)\/5:\s*([\s\S]*)$/);
  if (rated) return { from: rated[1].trim(), about: rated[2].trim(), rating: rated[3], body: rated[4].trim() };
  const sent = text.match(/^(.+?) sent feedback for (.+?):\s*([\s\S]*)$/);
  if (sent) return { from: sent[1].trim(), about: sent[2].trim(), rating: '', body: sent[3].trim() };
  return { from: '', about: '', rating: '', body: text };
}

function feedbackPreview(message: string) {
  const text = feedbackParts(message).body.replace(/\s+/g, ' ').trim();
  if (text.length <= 96) return text || '—';
  return `${text.slice(0, 96)}…`;
}

export function FeedbackManagePage({
  store,
  user,
  saveStore,
  lane,
}: {
  store: HirayaDatabase;
  user: HirayaUser;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  lane?: string | null;
}) {
  const feedbackLane = parseFeedbackLane(lane);
  const forTeachers = feedbackLane === 'teachers';
  const [open, setOpen] = useState<SystemAlert | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOpen(null);
  }, [feedbackLane]);

  const rows = useMemo(() => {
    return store.alerts
      .filter((row) => row.recipientId === user.userId && isFeedbackAlert(row))
      .filter((row) => {
        const kind = feedbackKind(row);
        return forTeachers ? kind === 'teacher' : kind !== 'teacher';
      })
      .slice()
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }, [store.alerts, user.userId, forTeachers]);

  async function markRead(alert: SystemAlert) {
    if (alert.read) return;
    const now = new Date().toISOString();
    setBusy(true);
    try {
      await saveStore({
        ...store,
        alerts: store.alerts.map((item) =>
          item.alertId === alert.alertId ? { ...item, read: true, status: 'read', readAt: now } : item,
        ),
      });
    } finally {
      setBusy(false);
    }
  }

  async function openFeedback(row: SystemAlert) {
    setOpen(row);
    if (!row.read) {
      try {
        await markRead(row);
        setOpen({ ...row, read: true, status: 'read', readAt: new Date().toISOString() });
      } catch {
        /* keep modal open even if mark-read fails */
      }
    }
  }

  async function markAllRead() {
    const unread = rows.filter((row) => !row.read);
    if (!unread.length) return;
    const now = new Date().toISOString();
    const ids = new Set(unread.map((row) => row.alertId));
    setBusy(true);
    try {
      await saveStore({
        ...store,
        alerts: store.alerts.map((item) =>
          ids.has(item.alertId) ? { ...item, read: true, status: 'read', readAt: now } : item,
        ),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <RecordTable
        title={feedbackLaneLabel(feedbackLane)}
        description={
          forTeachers
            ? 'Feedback parents send from the mobile app about a teacher.'
            : 'Feedback parents send from the mobile app about Hiraya Kids Learning Center.'
        }
        rows={rows}
        rowKey={(row) => row.alertId}
        search={(row, q) => `${row.title} ${row.message}`.toLowerCase().includes(q)}
        searchPlaceholder={forTeachers ? 'Search teacher feedback' : 'Search parent feedback'}
        emptyTitle={forTeachers ? 'No teacher feedback yet' : 'No parent feedback yet'}
        emptyHint={
          forTeachers
            ? 'When a parent rates a teacher, it appears in this list.'
            : 'When a parent writes about the center, it appears in this list.'
        }
        statusOf={(row) => (row.read ? 'read' : 'unread')}
        onRowOpen={openFeedback}
        actions={
          rows.some((row) => !row.read) ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void markAllRead()}>
              Mark all read
            </Button>
          ) : null
        }
        columns={[
          {
            key: 'from',
            header: 'From',
            render: (row) => feedbackParts(row.message).from || 'Parent',
          },
          ...(forTeachers
            ? [
                {
                  key: 'teacher',
                  header: 'Teacher',
                  render: (row: SystemAlert) => feedbackParts(row.message).about || 'Teacher',
                },
              ]
            : []),
          { key: 'msg', header: 'Message', render: (row) => feedbackPreview(row.message) },
          {
            key: 'rating',
            header: 'Rating',
            render: (row) => {
              const rating = feedbackParts(row.message).rating;
              return rating ? `${rating}/5` : '—';
            },
          },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.read ? 'read' : 'unread'} /> },
          { key: 'date', header: 'Received', render: (row) => formatDate(row.createdAt) },
        ]}
      />
      {open ? (
        <DeskModal
          title={open.title || 'Feedback'}
          size="wide"
          onClose={() => setOpen(null)}
          actions={
            <Button type="button" onClick={() => setOpen(null)}>
              Close
            </Button>
          }
        >
          <div className="feedback-read">
            <p className="feedback-read-meta">
              <StatusCell value={open.read ? 'read' : 'unread'} />
              <span>{forTeachers ? 'Teacher feedback' : 'Parent feedback'}</span>
              <span>{formatDateTime(open.createdAt)}</span>
            </p>
            <pre className="feedback-read-body">{open.message || '—'}</pre>
          </div>
        </DeskModal>
      ) : null}
    </>
  );
}
