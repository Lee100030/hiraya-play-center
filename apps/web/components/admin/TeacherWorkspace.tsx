'use client';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { api } from '@/lib/api';
import { assignedStudentsForTeacher, displayName, localDateKey, newId, packedTeacherIds, remainingSessionsFor, scheduleAssignedTo, staffDisplayRole, studentDisplay } from '@hiraya/utils';
import { Button, EmptyState, Field, Input, Loading, PersonAvatar, PhotoCardPicker, Select, StatusBadge, Textarea, emptyCell } from '@hiraya/ui';
import type { Schedule, StaffTask } from '@hiraya/types';
import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';

export function TeacherWorkspace({ teacherId }: { teacherId: string }) {
  const { user } = useAuth();
  const { store, loading, save } = useStore();
  const [tab, setTab] = useState('overview');
  const [actionsOpen, setActionsOpen] = useState(false);
  const teacher = store.users.find((item) => item.userId === teacherId && item.role === 'teacher');
  const students = assignedStudentsForTeacher(store, teacherId);
  const classes = store.classes.filter((row) => row.teacherId === teacherId);
  const tasks = (store.staffTasks || []).filter((row) =>
    (row.teacherIds || '')
      .split(',')
      .map((item) => item.trim())
      .includes(teacherId),
  );
  const schedules = store.schedules.filter((row) => scheduleAssignedTo(row, teacherId) && row.kind !== 'teacherTask');
  const comments = (store.teacherComments || []).filter((row) => row.teacherId === teacherId && row.status !== 'archived');
  const notes = (store.teacherNotes || []).filter((row) => row.teacherId === teacherId && row.status !== 'archived');
  const attendance = store.attendance.filter((row) => row.kind === 'employee' && row.employeeId === teacherId);
  const teacherPeople = useMemo(
    () =>
      store.users
        .filter((item) => item.role === 'teacher')
        .map((item) => ({
          id: item.userId,
          name: displayName(item),
          photo: item.profileImagePath ? api.profileMediaUrl(item.userId, item.updatedAt || item.profileImagePath) : undefined,
          role: staffDisplayRole(item.role, store.teacherProfiles.find((row) => row.userId === item.userId)?.specialty),
        })),
    [store.users, store.teacherProfiles],
  );
  const tabs = useMemo(
    () => [
      ['overview', 'Overview'],
      ['students', 'Assigned Students'],
      ['classes', 'Classes'],
      ['calendar', 'Monthly Calendar'],
      ['tasks', 'Tasks'],
      ['attendance', 'Attendance'],
      ['todo', 'To-Do'],
      ['comments', 'Comments'],
      ['notes', 'Admin Notes'],
      ['activity', 'Activity'],
    ],
    [],
  );

  async function assignStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const studentId = String(new FormData(event.currentTarget).get('studentId') || '');
    const classId = String(new FormData(event.currentTarget).get('classId') || '');
    if (!studentId) return;
    const now = new Date().toISOString().slice(0, 10);
    const cls = store.classes.find((item) => item.classId === classId);
    const existing = store.enrollments.find((row) => row.studentId === studentId && (!classId || row.classId === classId));
    const enrollments = existing
      ? store.enrollments.map((row) =>
          row.enrollmentId === existing.enrollmentId ? { ...row, teacherId, classId: classId || row.classId, status: row.status || 'active' } : row,
        )
      : [
          ...store.enrollments,
          {
            enrollmentId: newId('enr'),
            studentId,
            classId,
            programId: cls?.programId || '',
            teacherId,
            period: '',
            status: 'active',
            enrollmentDate: now,
            approvedBy: user?.userId || '',
          },
        ];
    const classes = classId
      ? store.classes.map((row) => (row.classId === classId ? { ...row, teacherId } : row))
      : store.classes;
    await save({ ...store, enrollments, classes });
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = String(new FormData(event.currentTarget).get('body') || '').trim();
    if (!body) return;
    const now = new Date().toISOString();
    await save({
      ...store,
      teacherNotes: [
        ...(store.teacherNotes || []),
        {
          noteId: newId('note'),
          teacherId,
          title: 'Admin note',
          content: body,
          priority: 'normal',
          reminderDate: '',
          visibility: 'private',
          status: 'open',
          createdBy: user?.userId || '',
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    event.currentTarget.reset();
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = String(new FormData(event.currentTarget).get('body') || '').trim();
    if (!body) return;
    const now = new Date().toISOString();
    await save({
      ...store,
      teacherComments: [
        ...(store.teacherComments || []),
        {
          commentId: newId('cmt'),
          teacherId,
          createdBy: user?.userId || '',
          content: body,
          visibility: 'teacher',
          status: 'active',
          reply: '',
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    event.currentTarget.reset();
  }

  async function addSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: Schedule = {
      scheduleId: newId('sch'),
      title: String(form.get('title') || '').trim(),
      kind: 'classSession',
      scheduleType: 'classSession',
      classId: String(form.get('classId') || ''),
      studentId: String(form.get('studentId') || ''),
      teacherId: form.getAll('teacherIds').map(String).filter(Boolean).join(',') || teacherId,
      startAt: new Date(String(form.get('startAt') || '')).toISOString(),
      endAt: new Date(String(form.get('endAt') || '')).toISOString(),
      room: String(form.get('room') || ''),
      notes: '',
      status: 'confirmed',
      programId: '',
    };
    await save({ ...store, schedules: [...store.schedules, next] });
    event.currentTarget.reset();
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: StaffTask = {
      taskId: newId('tsk'),
      title: String(form.get('title') || '').trim(),
      description: String(form.get('description') || ''),
      priority: 'normal',
      dueAt: String(form.get('dueAt') || ''),
      teacherIds: form.getAll('teacherIds').map(String).filter(Boolean).join(',') || teacherId,
      classId: '',
      studentId: String(form.get('studentId') || ''),
      status: 'assigned',
      response: '',
      attachmentName: '',
      assignedBy: user?.userId || '',
      completedAt: '',
      completedBy: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await save({ ...store, staffTasks: [...(store.staffTasks || []), next] });
    event.currentTarget.reset();
  }

  if (loading) return <Loading />;
  if (!teacher) {
    return (
      <EmptyState
        title="Teacher not found"
        hint="Return to Teachers Management."
      />
    );
  }

  return (
    <>
      <AdminPageHeader
        kicker="Teachers"
        title={displayName(teacher)}
        description="Same workspace actions as the desktop Teacher Workspace. Assignments save to the shared store."
        actions={
          <>
            <StatusBadge status={teacher.status || 'active'} />
            <button type="button" className="dash-action dash-action-primary" onClick={() => setTab('students')}>
              Assign student
            </button>
            <div className="actions-menu">
              <button type="button" className="dash-action" onClick={() => setActionsOpen((value) => !value)}>
                Actions
              </button>
              {actionsOpen ? (
                <div className="actions-menu-list">
                  <Link className="dash-action" href="/admin/staff" onClick={() => setActionsOpen(false)}>
                    Back to teachers
                  </Link>
                  <button
                    type="button"
                    className="dash-action"
                    onClick={() => {
                      setTab('notes');
                      setActionsOpen(false);
                    }}
                  >
                    Add admin note
                  </button>
                </div>
              ) : null}
            </div>
          </>
        }
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <PersonAvatar
          name={displayName(teacher)}
          photo={teacher.profileImagePath ? api.profileMediaUrl(teacher.userId, teacher.updatedAt) : undefined}
          size="md"
          hint={!teacher.profileImagePath}
        />
      </div>
      <div className="workspace-tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'dash-action dash-action-primary' : 'dash-action'} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <section className="stat-row clickable">
          <article className="hlc-card" role="button" tabIndex={0} onClick={() => setTab('students')}>
            <p>Assigned students</p>
            <strong>{students.length}</strong>
          </article>
          <article className="hlc-card" role="button" tabIndex={0} onClick={() => setTab('classes')}>
            <p>Classes</p>
            <strong>{classes.length}</strong>
          </article>
          <article className="hlc-card" role="button" tabIndex={0} onClick={() => setTab('tasks')}>
            <p>Open tasks</p>
            <strong>{tasks.filter((row) => !['completed', 'cancelled'].includes(row.status)).length}</strong>
          </article>
        </section>
      ) : null}

      {tab === 'students' ? (
        <>
          <form className="hlc-card form-grid" onSubmit={assignStudent}>
            <Field label="Student" required>
              <Select name="studentId" required>
                <option value="">Select</option>
                {store.students.map((item) => (
                  <option key={item.studentId} value={item.studentId}>
                    {studentDisplay(item)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Class">
              <Select name="classId">
                <option value="">None</option>
                {store.classes.map((item) => (
                  <option key={item.classId} value={item.classId}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit">Assign</Button>
          </form>
          {students.length === 0 ? (
            <EmptyState title="No assigned students" />
          ) : (
            students.map((item) => (
              <article key={item.studentId} className="hlc-card">
                <h3>{studentDisplay(item)}</h3>
                <p>Sessions remaining: {remainingSessionsFor(store, item.studentId) ?? <span className="cell-empty">Not assigned</span>}</p>
              </article>
            ))
          )}
        </>
      ) : null}

      {tab === 'classes' ? (
        classes.length === 0 ? (
          <EmptyState title="No classes assigned" />
        ) : (
          classes.map((item) => (
            <article key={item.classId} className="hlc-card">
              <h3>{item.name}</h3>
              <StatusBadge status={item.status} />
            </article>
          ))
        )
      ) : null}

      {tab === 'calendar' ? (
        <>
          <form className="hlc-card form-grid" onSubmit={addSchedule}>
            <Field label="Title" required>
              <Input name="title" required />
            </Field>
            <Field label="Teachers" required>
              <PhotoCardPicker name="teacherIds" people={teacherPeople} defaultSelected={[teacherId]} />
            </Field>
            <Field label="Start" required>
              <Input name="startAt" type="datetime-local" required />
            </Field>
            <Field label="End" required>
              <Input name="endAt" type="datetime-local" required />
            </Field>
            <Field label="Room">
              <Input name="room" />
            </Field>
            <Button type="submit">Assign schedule</Button>
          </form>
          {schedules.map((row) => (
            <article key={row.scheduleId} className="hlc-card">
              <h3>{row.title}</h3>
              <p>{localDateKey(row.startAt)}</p>
              <p className="month-cal-teacher">
                {(packedTeacherIds(row.teacherId).length
                  ? packedTeacherIds(row.teacherId).map((id) => displayName(store.users.find((item) => item.userId === id))).filter(Boolean)
                  : ['Unassigned']
                ).map((name) => (
                  <span key={name}>{name}</span>
                ))}
              </p>
            </article>
          ))}
        </>
      ) : null}

      {tab === 'tasks' ? (
        <>
          <form className="hlc-card form-grid" onSubmit={addTask}>
            <Field label="Title" required>
              <Input name="title" required />
            </Field>
            <Field label="Teachers" required>
              <PhotoCardPicker name="teacherIds" people={teacherPeople} defaultSelected={[teacherId]} />
            </Field>
            <Field label="Due">
              <Input name="dueAt" type="date" />
            </Field>
            <Button type="submit">Assign task</Button>
          </form>
          {tasks.map((row) => (
            <article key={row.taskId} className="hlc-card">
              <h3>{row.title}</h3>
              <StatusBadge status={row.status} />
            </article>
          ))}
        </>
      ) : null}

      {tab === 'attendance' ? (
        attendance.length === 0 ? (
          <EmptyState title="No teacher attendance yet" />
        ) : (
          attendance.map((row) => (
            <article key={row.attendanceId} className="hlc-card">
              <p>{row.attendanceDate}</p>
              <StatusBadge status={row.status} />
            </article>
          ))
        )
      ) : null}

      {tab === 'todo' ? (
        <p>To-do items are teacher tasks on the calendar (kind teacherTask), same as desktop.</p>
      ) : null}

      {tab === 'comments' ? (
        <form className="hlc-card form-grid" onSubmit={addComment}>
          <Field label="Comment" required>
            <Textarea name="body" required />
          </Field>
          <Button type="submit">Add comment</Button>
          {comments.map((row) => (
            <p key={row.commentId}>{row.content}</p>
          ))}
        </form>
      ) : null}

      {tab === 'notes' ? (
        <form className="hlc-card form-grid" onSubmit={addNote}>
          <Field label="Admin note" required>
            <Textarea name="body" required />
          </Field>
          <Button type="submit">Add note</Button>
          {notes.map((row) => (
            <p key={row.noteId}>{row.title}: {row.content}</p>
          ))}
        </form>
      ) : null}

      {tab === 'activity' ? (
        (store.auditLogs || [])
          .filter((row) => row.entityId === teacherId || row.actorId === teacherId)
          .slice(0, 20)
          .map((row) => (
            <article key={row.auditId} className="hlc-card">
              <p>{row.summary}</p>
            </article>
          ))
      ) : null}
    </>
  );
}
