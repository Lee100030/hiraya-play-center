import type { HirayaDatabase, HirayaUser, NewsItem, Schedule, SessionPackage, StaffTask } from '@hiraya/types';
import { displayName, isAdmin, newId, studentDisplay, completeOneSession, normalizeSessionPackage } from '@hiraya/utils';
import { Field, Input, Select, Textarea } from '@hiraya/ui';
import { FormEvent, useState } from 'react';
import { EditorModal, FormSection } from '../components/EditorModal';
import { RecordTable, StatusCell, assigned } from '../components/RecordTable';
import { PAGE_COPY } from '../lib/views';

function nowIso() {
  return new Date().toISOString();
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
      teacherId: String(form.get('teacherId') || ''),
      programId: String(form.get('programId') || ''),
      startAt: start ? new Date(start).toISOString() : nowIso(),
      endAt: end ? new Date(end).toISOString() : nowIso(),
      room: String(form.get('room') || '').trim(),
      notes: String(form.get('notes') || '').trim(),
      status: String(form.get('status') || 'confirmed'),
    };
    if (!next.title || !next.teacherId) {
      setError('Title and teacher are required.');
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
            render: (row) => assigned(displayName(store.users.find((item) => item.userId === row.teacherId))),
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
          <Field label="Teacher" required>
            <Select name="teacherId" defaultValue={current?.teacherId || ''}>
              <option value="">Select teacher</option>
              {store.users
                .filter((item) => item.role === 'teacher')
                .map((item) => (
                  <option key={item.userId} value={item.userId}>
                    {displayName(item)}
                  </option>
                ))}
            </Select>
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
          <Field label="Teachers" required>
            <select name="teacherIds" multiple defaultValue={current?.teacherIds.split(',').filter(Boolean)} style={{ minHeight: 96 }}>
              {store.users
                .filter((item) => item.role === 'teacher')
                .map((item) => (
                  <option key={item.userId} value={item.userId}>
                    {displayName(item)}
                  </option>
                ))}
            </select>
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
}: {
  store: HirayaDatabase;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState<SessionPackage | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = editing && editing !== 'new' ? editing : null;
  const rows = store.sessionPackages || [];

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
      await saveStore({
        ...store,
        sessionPackages: current ? rows.map((item) => (item.packageId === next.packageId ? next : item)) : [...rows, next],
      });
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save package');
    } finally {
      setBusy(false);
    }
  }

  async function completeOne(row: SessionPackage) {
    try {
      await saveStore(completeOneSession(store, row.packageId));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not complete session');
    }
  }

  return (
    <>
      <RecordTable
        title={PAGE_COPY.sessions.title}
        description={PAGE_COPY.sessions.description}
        rows={rows}
        rowKey={(row) => row.packageId}
        search={(row, q) => `${row.studentId} ${row.status}`.toLowerCase().includes(q)}
        searchPlaceholder="Filter this list of packages"
        emptyTitle="No session packages"
        emptyHint="Create a package with a total session count for a student."
        statusOf={(row) => row.status}
        crud={{
          addLabel: '+ Add Package',
          onAdd: () => setEditing('new'),
          onEdit: (row) => setEditing(row),
          onRefresh,
          singleActions: [
            {
              icon: 'check',
              label: 'Complete session',
              needOneMessage: 'Please select only one package to complete a session.',
              onClick: (row) => void completeOne(row),
            },
          ],
        }}
        columns={[
          {
            key: 'student',
            header: 'Student',
            render: (row) => {
              const student = store.students.find((item) => item.studentId === row.studentId);
              return assigned(student ? studentDisplay(student) : row.studentId);
            },
          },
          { key: 'total', header: 'Total', render: (row) => String(row.totalSessions) },
          { key: 'used', header: 'Used', render: (row) => String(row.usedSessions) },
          { key: 'left', header: 'Remaining', render: (row) => String(row.remainingSessions) },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
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
            <Select name="studentId" defaultValue={current?.studentId || ''} required>
              <option value="">Select student</option>
              {store.students.map((item) => (
                <option key={item.studentId} value={item.studentId}>
                  {studentDisplay(item)}
                </option>
              ))}
            </Select>
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
