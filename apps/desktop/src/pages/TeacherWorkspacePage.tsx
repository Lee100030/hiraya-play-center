import type {
  AttendanceRecord,
  HirayaDatabase,
  HirayaUser,
  Schedule,
  StaffTask,
  Student,
  TeacherAdminNote,
  TeacherComment,
} from '@hiraya/types';
import { displayName, newId, studentDisplay } from '@hiraya/utils';
import { Button, Field, Input, Select, StatusBadge, Textarea, EmptyValue } from '@hiraya/ui';
import { FormEvent, useMemo, useState, type ReactNode } from 'react';
import { DeskModal } from '../components/DeskModal';
import { EditorModal, FormSection } from '../components/EditorModal';
import { assigned, NameCell, RecordTable, StatusCell } from '../components/RecordTable';
import { Icons } from '../icons';
import { api } from '../lib/api';
import {
  assignedStudentsForTeacher,
  programsForTeacher,
  remainingSessionsFor,
  studentPlacement,
} from '../lib/crud';
import { StaffForm } from './TeacherForm';

type Tab =
  | 'overview'
  | 'info'
  | 'students'
  | 'classes'
  | 'calendar'
  | 'tasks'
  | 'attendance'
  | 'todo'
  | 'comments'
  | 'notes'
  | 'activity';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'info', label: 'Teacher Information' },
  { id: 'students', label: 'Assigned Students' },
  { id: 'classes', label: 'Classes' },
  { id: 'calendar', label: 'Monthly Calendar' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'todo', label: 'To-Do' },
  { id: 'comments', label: 'Comments' },
  { id: 'notes', label: 'Admin Notes' },
  { id: 'activity', label: 'Activity' },
];

function nowIso() {
  return new Date().toISOString();
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatStamp(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function eventLabel(store: HirayaDatabase, row: Schedule) {
  const student = store.students.find((item) => item.studentId === row.studentId);
  if (student) return studentDisplay(student);
  return store.classes.find((item) => item.classId === row.classId)?.name || row.title || 'Session';
}

function localInput(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function TeacherWorkspacePage({
  teacherId,
  store,
  actor,
  saveStore,
  onStore,
  onBack,
}: {
  teacherId: string;
  store: HirayaDatabase;
  actor: HirayaUser;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onStore: (next: HirayaDatabase) => void;
  onBack: () => void;
}) {
  const teacher = store.users.find((item) => item.userId === teacherId && item.role === 'teacher');
  const profile = (store.teacherProfiles || []).find((item) => item.userId === teacherId);
  const [tab, setTab] = useState<Tab>('overview');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [editingTeacher, setEditingTeacher] = useState(false);
  const [modal, setModal] = useState<'student' | 'schedule' | 'task' | 'attendance' | 'todo' | 'comment' | 'note' | 'class' | null>(null);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [editTask, setEditTask] = useState<StaffTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);

  const students = assignedStudentsForTeacher(store, teacherId);
  const classes = store.classes.filter((row) => row.teacherId === teacherId);
  const programs = programsForTeacher(store, teacherId);
  const tasks = (store.staffTasks || []).filter((row) =>
    (row.teacherIds || '')
      .split(',')
      .map((item) => item.trim())
      .includes(teacherId),
  );
  const todos = store.schedules.filter((row) => row.kind === 'teacherTask' && row.teacherId === teacherId);
  const comments = (store.teacherComments || []).filter((row) => row.teacherId === teacherId && row.status !== 'archived');
  const notes = (store.teacherNotes || []).filter((row) => row.teacherId === teacherId && row.status !== 'archived');
  const attendance = store.attendance.filter(
    (row) => row.kind === 'employee' && (row.employeeId === teacherId || row.recordedBy === teacherId),
  );
  const schedules = store.schedules.filter(
    (row) => row.teacherId === teacherId && row.kind !== 'teacherTask' && row.status !== 'cancelled',
  );

  const monthSchedules = useMemo(() => {
    const key = monthKey(month);
    return schedules.filter((row) => (row.startAt || '').slice(0, 7) === key);
  }, [schedules, month]);

  const pendingTasks = tasks.filter((row) => !['completed', 'cancelled'].includes(row.status)).length;
  const completedTasks = tasks.filter((row) => row.status === 'completed').length;
  const present = attendance.filter((row) => row.status === 'present' || row.status === 'late').length;
  const attendanceRate = attendance.length ? Math.round((present / attendance.length) * 100) : null;

  const upcoming = useMemo(() => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    return [...schedules]
      .filter((row) => row.startAt && !Number.isNaN(new Date(row.startAt).getTime()) && new Date(row.startAt).getTime() >= cutoff)
      .sort((a, b) => (a.startAt || '').localeCompare(b.startAt || ''))
      .slice(0, 5);
  }, [schedules]);

  const openTaskRows = useMemo(
    () => tasks.filter((row) => !['completed', 'cancelled'].includes(row.status)).slice(0, 5),
    [tasks],
  );

  const activityRows = useMemo(() => {
    const name = teacher ? displayName(teacher).toLowerCase() : '';
    return (store.auditLogs || []).filter(
      (row) =>
        row.entityId === teacherId ||
        (name && (row.summary || '').toLowerCase().includes(name)) ||
        row.actorId === teacherId,
    );
  }, [store.auditLogs, teacher, teacherId]);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    const weekday = (first.getDay() + 6) % 7;
    start.setDate(first.getDate() - weekday);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [month]);

  if (!teacher) {
    return (
      <div className="panel">
        <p>That teacher was not found.</p>
        <Button type="button" onClick={onBack}>
          Back to Teacher Management
        </Button>
      </div>
    );
  }

  async function persist(next: HirayaDatabase, message: string) {
    try {
      await saveStore(next);
      setNotice(message);
      setModal(null);
      setEditSchedule(null);
      setEditTask(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Those changes could not be saved.');
    }
  }

  async function onSaveTeacher(event: FormEvent<HTMLFormElement>) {
    if (!teacher) return;
    const form = new FormData(event.currentTarget);
    const firstName = String(form.get('firstName') || teacher.firstName);
    const middleName = String(form.get('middleName') || '');
    const lastName = String(form.get('lastName') || teacher.lastName);
    const fullname = String(form.get('fullname') || [firstName, middleName, lastName].filter(Boolean).join(' '));
    setBusy(true);
    setStaffError(null);
    try {
      const saved = await api.saveStaff({
        userId: teacher.userId,
        profileId: profile?.profileId,
        fullname,
        firstName,
        middleName,
        lastName,
        email: String(form.get('email') || ''),
        phone: String(form.get('phone') || ''),
        address: String(form.get('address') || ''),
        notes: String(form.get('notes') || ''),
        role: 'teacher',
        employeeCode: String(form.get('employeeCode') || ''),
        position: String(form.get('position') || ''),
        specialty: String(form.get('specialty') || ''),
        bio: String(form.get('bio') || ''),
        status: String(form.get('status') || 'active'),
        password: String(form.get('password') || '') || undefined,
        confirmPassword: String(form.get('confirmPassword') || '') || undefined,
      });
      onStore(saved.store);
      setEditingTeacher(false);
      setNotice('Teacher saved.');
    } catch (err) {
      setStaffError(err instanceof Error ? err.message : 'Unable to save teacher. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function assignStudents(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const classId = String(form.get('classId') || '');
    const ids = form.getAll('studentId').map(String).filter(Boolean);
    if (!ids.length) {
      setError('Select at least one student.');
      return;
    }
    const cls = store.classes.find((item) => item.classId === classId);
    let enrollments = [...store.enrollments];
    for (const studentId of ids) {
      if (assignedStudentsForTeacher(store, teacherId).some((item) => item.studentId === studentId) && !classId) continue;
      const existing = enrollments.find((row) => row.studentId === studentId && (!classId || row.classId === classId));
      if (existing) {
        enrollments = enrollments.map((row) =>
          row.enrollmentId === existing.enrollmentId ? { ...row, teacherId, classId: classId || row.classId, status: row.status || 'active' } : row,
        );
      } else {
        enrollments.push({
          enrollmentId: newId('enr'),
          studentId,
          classId,
          programId: cls?.programId || '',
          teacherId,
          period: '',
          status: 'active',
          enrollmentDate: nowIso().slice(0, 10),
          approvedBy: actor.userId,
        });
      }
    }
    const nextClasses = classId
      ? store.classes.map((row) => (row.classId === classId ? { ...row, teacherId } : row))
      : store.classes;
    await persist({ ...store, enrollments, classes: nextClasses }, 'Student assignment saved. The teacher mobile app will show these children.');
  }

  async function removeStudent(student: Student) {
    if (!window.confirm(`Remove ${studentDisplay(student)} from this teacher?`)) return;
    await persist(
      {
        ...store,
        enrollments: store.enrollments.map((row) =>
          row.studentId === student.studentId && row.teacherId === teacherId ? { ...row, teacherId: '' } : row,
        ),
      },
      'Student removed from this teacher.',
    );
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const start = String(form.get('startAt') || '');
    const end = String(form.get('endAt') || '');
    if (start && end && new Date(end) <= new Date(start)) {
      setError('End time must be after start time.');
      return;
    }
    const next: Schedule = {
      scheduleId: editSchedule?.scheduleId || newId('sch'),
      title: String(form.get('title') || '').trim() || 'Class session',
      kind: 'classSession',
      scheduleType: 'classSession',
      classId: String(form.get('classId') || ''),
      studentId: String(form.get('studentId') || ''),
      teacherId,
      programId: String(form.get('programId') || ''),
      startAt: start ? new Date(start).toISOString() : nowIso(),
      endAt: end ? new Date(end).toISOString() : nowIso(),
      room: String(form.get('room') || '').trim(),
      notes: String(form.get('notes') || '').trim(),
      status: String(form.get('status') || 'confirmed'),
    };
    await persist(
      {
        ...store,
        schedules: editSchedule
          ? store.schedules.map((item) => (item.scheduleId === next.scheduleId ? next : item))
          : [...store.schedules, next],
      },
      'Schedule saved. The teacher calendar on mobile uses this record.',
    );
  }

  async function saveTask(event: FormEvent<HTMLFormElement>, asTodo = false) {
    const form = new FormData(event.currentTarget);
    const stamp = nowIso();
    if (asTodo) {
      const next: Schedule = {
        scheduleId: newId('todo'),
        title: String(form.get('title') || '').trim(),
        kind: 'teacherTask',
        scheduleType: 'teacherTask',
        classId: '',
        studentId: '',
        teacherId,
        programId: '',
        startAt: String(form.get('dueAt') || '') ? new Date(String(form.get('dueAt'))).toISOString() : stamp,
        endAt: String(form.get('dueAt') || '') ? new Date(String(form.get('dueAt'))).toISOString() : stamp,
        room: String(form.get('priority') || 'normal'),
        notes: String(form.get('description') || '').trim(),
        status: String(form.get('status') || 'assigned'),
      };
      if (!next.title) {
        setError('Title is required.');
        return;
      }
      await persist({ ...store, schedules: [...store.schedules, next] }, 'To-do assigned to this teacher.');
      return;
    }
    const next: StaffTask = {
      taskId: editTask?.taskId || newId('tsk'),
      title: String(form.get('title') || '').trim(),
      description: String(form.get('description') || '').trim(),
      priority: String(form.get('priority') || 'normal'),
      dueAt: String(form.get('dueAt') || ''),
      teacherIds: teacherId,
      classId: String(form.get('classId') || ''),
      studentId: String(form.get('studentId') || ''),
      status: String(form.get('status') || 'assigned'),
      response: editTask?.response || '',
      attachmentName: '',
      assignedBy: actor.userId,
      completedAt: editTask?.completedAt || '',
      completedBy: editTask?.completedBy || '',
      createdAt: editTask?.createdAt || stamp,
      updatedAt: stamp,
    };
    if (!next.title) {
      setError('Task title is required.');
      return;
    }
    await persist(
      {
        ...store,
        staffTasks: editTask
          ? (store.staffTasks || []).map((item) => (item.taskId === next.taskId ? next : item))
          : [...(store.staffTasks || []), next],
      },
      'Task saved. The teacher will see it on mobile.',
    );
  }

  async function saveAttendance(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const date = String(form.get('attendanceDate') || '');
    if (!date) {
      setError('Date is required.');
      return;
    }
    if (attendance.some((row) => row.attendanceDate === date)) {
      setError('This teacher already has attendance for that date.');
      return;
    }
    const next: AttendanceRecord = {
      attendanceId: newId('att'),
      kind: 'employee',
      studentId: '',
      employeeId: teacherId,
      classId: '',
      qrCode: '',
      timeIn: date,
      timeOut: '',
      attendanceDate: date,
      status: String(form.get('status') || 'present'),
      notes: String(form.get('notes') || ''),
      recordedBy: actor.userId,
    };
    await persist({ ...store, attendance: [...store.attendance, next] }, 'Attendance saved.');
  }

  async function saveComment(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const next: TeacherComment = {
      commentId: newId('cmt'),
      teacherId,
      createdBy: actor.userId,
      content: String(form.get('content') || '').trim(),
      visibility: String(form.get('visibility') || 'teacher'),
      status: 'active',
      reply: '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    if (!next.content) {
      setError('Comment is required.');
      return;
    }
    await persist({ ...store, teacherComments: [...(store.teacherComments || []), next] }, 'Comment saved.');
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const next: TeacherAdminNote = {
      noteId: newId('note'),
      teacherId,
      title: String(form.get('title') || '').trim(),
      content: String(form.get('content') || '').trim(),
      priority: String(form.get('priority') || 'normal'),
      reminderDate: String(form.get('reminderDate') || ''),
      visibility: String(form.get('visibility') || 'private'),
      status: 'open',
      createdBy: actor.userId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    if (!next.title || !next.content) {
      setError('Title and note are required.');
      return;
    }
    await persist({ ...store, teacherNotes: [...(store.teacherNotes || []), next] }, 'Admin note saved.');
  }

  async function assignClass(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const classId = String(form.get('classId') || '');
    if (!classId) {
      setError('Select a class.');
      return;
    }
    await persist(
      {
        ...store,
        classes: store.classes.map((row) => (row.classId === classId ? { ...row, teacherId } : row)),
      },
      'Class assigned to this teacher.',
    );
  }

  return (
    <div className="teacher-workspace">
      <button type="button" className="text-link" onClick={onBack}>
        ← Back to Teacher Management
      </button>
      {notice ? (
        <DeskModal title="Saved" tone="success" onClose={() => setNotice(null)}>
          <p>{notice}</p>
        </DeskModal>
      ) : null}
      {error && !modal ? (
        <DeskModal title="Couldn’t save" tone="error" onClose={() => setError(null)}>
          <p>{error}</p>
        </DeskModal>
      ) : null}
      <header className="page-head ws-head">
        <div className="ws-hero">
          {teacher.profileImagePath ? (
            <img
              className="ws-photo"
              src={api.profileMediaUrl(teacher.userId, teacher.updatedAt || teacher.profileImagePath)}
              alt={displayName(teacher)}
            />
          ) : (
            <span className="ws-photo ws-photo-empty" aria-hidden="true">
              {(displayName(teacher) || '?').trim().slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="page-head-copy">
            <p className="page-crumb">HIRAYA / Teacher Management / Workspace</p>
            <div className="ws-title-row">
              <h1>{displayName(teacher)}</h1>
              <StatusBadge status={teacher.status} />
            </div>
            <p className="ws-meta">
              {[teacher.email, teacher.phone, profile?.specialty || 'No specialization'].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="hlc-crud-bar page-head-actions" role="toolbar" aria-label="Teacher actions">
          <Button type="button" onClick={() => setEditingTeacher(true)}>
            <Icons.pencil width={14} height={14} />
            Edit Teacher
          </Button>
          <Button type="button" variant="ghost" onClick={() => setModal('student')}>
            <Icons.students width={14} height={14} />
            Assign Student
          </Button>
          <Button type="button" variant="ghost" onClick={() => setModal('task')}>
            <Icons.tasks width={14} height={14} />
            Assign Task
          </Button>
          <Button type="button" variant="ghost" onClick={() => setModal('schedule')}>
            <Icons.calendar width={14} height={14} />
            Create Schedule
          </Button>
        </div>
      </header>

      <div className="ws-tabs" role="tablist" aria-label="Teacher workspace">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'ws-tab is-on' : 'ws-tab'}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <>
          <section className="stat-row ws-stats" aria-label="Teacher snapshot">
            <WsStat
              icon={<Icons.students />}
              label="Assigned Students"
              value={students.length}
              hint={students.length ? 'On this teacher’s roster' : 'None assigned yet'}
              onClick={() => setTab('students')}
            />
            <WsStat
              icon={<Icons.classes />}
              label="Assigned Classes"
              value={classes.length}
              hint={classes.length ? classes.map((item) => item.name).slice(0, 2).join(', ') : 'None assigned yet'}
              onClick={() => setTab('classes')}
            />
            <WsStat
              icon={<Icons.calendar />}
              label="This Month’s Sessions"
              value={monthSchedules.length}
              hint={month.toLocaleString(undefined, { month: 'long' })}
              onClick={() => setTab('calendar')}
            />
            <WsStat
              icon={<Icons.tasks />}
              label="Pending Tasks"
              value={pendingTasks}
              hint={pendingTasks ? 'Needs follow-up' : 'Nothing waiting'}
              tone={pendingTasks > 0 ? 'warn' : undefined}
              onClick={() => setTab('tasks')}
            />
            <WsStat
              icon={<Icons.check />}
              label="Completed Tasks"
              value={completedTasks}
              hint={`${tasks.length} total`}
              onClick={() => setTab('tasks')}
            />
            <WsStat
              icon={<Icons.attendance />}
              label="Attendance"
              value={attendanceRate == null ? 'Not tracked yet' : `${attendanceRate}%`}
              hint={attendance.length ? `${attendance.length} records` : 'No attendance logged'}
              empty={attendanceRate == null}
              onClick={() => setTab('attendance')}
            />
          </section>
          <section className="ws-overview">
            <article className="panel dash-panel">
              <h2>Upcoming sessions</h2>
              {upcoming.length === 0 ? (
                <p className="panel-empty">No upcoming class sessions on this teacher’s calendar.</p>
              ) : (
                <ul className="feed-list">
                  {upcoming.map((row) => (
                    <li key={row.scheduleId}>
                      <button type="button" className="dash-link" onClick={() => setTab('calendar')}>
                        <span>
                          <strong>{eventLabel(store, row)}</strong>
                          <small>{formatStamp(row.startAt)}{row.room ? ` · ${row.room}` : ''}</small>
                        </span>
                        <Icons.chevronRight />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>
            <article className="panel dash-panel">
              <h2>Open tasks</h2>
              {openTaskRows.length === 0 ? (
                <p className="panel-empty">No pending tasks for this teacher.</p>
              ) : (
                <ul className="feed-list">
                  {openTaskRows.map((row) => (
                    <li key={row.taskId}>
                      <button type="button" className="dash-link" onClick={() => setTab('tasks')}>
                        <span>
                          <strong>{row.title}</strong>
                          <small>{row.dueAt ? `Due ${row.dueAt.slice(0, 10)}` : 'No due date'} · {row.status}</small>
                        </span>
                        <Icons.chevronRight />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>
            <article className="panel dash-panel">
              <h2>Recent activity</h2>
              {activityRows.length === 0 ? (
                <p className="panel-empty">Nothing has been logged for this teacher yet.</p>
              ) : (
                <ul className="feed-list">
                  {activityRows.slice(0, 6).map((row) => (
                    <li key={row.auditId}>
                      <button type="button" className="dash-link" onClick={() => setTab('activity')}>
                        <span>
                          <strong>{row.action || 'Update'}</strong>
                          <small>{formatStamp(row.createdAt) || (row.createdAt || '').slice(0, 16)}</small>
                        </span>
                        <Icons.chevronRight />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>
        </>
      ) : null}

      {tab === 'info' ? (
        <section className="panel">
          <h2>Personal information</h2>
          <p>Name: {displayName(teacher)}</p>
          <p>Email: {assigned(teacher.email)}</p>
          <p>Contact: {assigned(teacher.phone)}</p>
          <p>Address: {assigned(teacher.address)}</p>
          <h2>Professional information</h2>
          <p>Specialization: {assigned(profile?.specialty)}</p>
          <p>Programs: {assigned(programs.map((item) => item.name).join(', '))}</p>
          <p>Classes: {assigned(classes.map((item) => item.name).join(', '))}</p>
          <p>
            Status: <StatusBadge status={teacher.status} />
          </p>
          <h2>Notes</h2>
          <p>{teacher.notes || 'None'}</p>
          <Button type="button" onClick={() => setEditingTeacher(true)}>
            Edit Teacher
          </Button>
        </section>
      ) : null}

      {tab === 'students' ? (
        <RecordTable
          title="Assigned Students"
          description="These children appear on the teacher mobile app."
          rows={students}
          rowKey={(row) => row.studentId}
          search={(row, q) => studentDisplay(row).toLowerCase().includes(q)}
          searchPlaceholder="Search assigned students"
          emptyTitle="No students assigned"
          emptyHint="Assign a student so this teacher can see them on mobile."
          crud={{
            addLabel: '+ Assign Student',
            onAdd: () => setModal('student'),
            archiveLabel: 'Remove',
            onArchive: async (rows) => {
              for (const row of rows) await removeStudent(row);
            },
          }}
          columns={[
            { key: 'name', header: 'Student', render: (row) => <NameCell name={studentDisplay(row)} /> },
            { key: 'program', header: 'Program', render: (row) => assigned(studentPlacement(store, row.studentId).programName || row.program) },
            { key: 'class', header: 'Class', render: (row) => assigned(studentPlacement(store, row.studentId).className) },
            {
              key: 'sessions',
              header: 'Sessions remaining',
              render: (row) => {
                const left = remainingSessionsFor(store, row.studentId);
                return left == null ? <EmptyValue /> : String(left);
              },
            },
            { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
            {
              key: 'actions',
              header: '',
              render: (row) => (
                <Button type="button" variant="ghost" onClick={() => void removeStudent(row)}>
                  Remove
                </Button>
              ),
            },
          ]}
        />
      ) : null}

      {tab === 'classes' ? (
        <RecordTable
          title="Classes"
          description="Classes assigned to this teacher."
          rows={classes}
          rowKey={(row) => row.classId}
          search={(row, q) => row.name.toLowerCase().includes(q)}
          searchPlaceholder="Search classes"
          emptyTitle="No classes assigned"
          emptyHint="Assign a class to this teacher."
          crud={{ addLabel: '+ Assign class', onAdd: () => setModal('class') }}
          columns={[
            { key: 'name', header: 'Class', render: (row) => row.name },
            {
              key: 'program',
              header: 'Program',
              render: (row) => assigned(store.programs.find((item) => item.programId === row.programId)?.name),
            },
            {
              key: 'students',
              header: 'Students',
              render: (row) =>
                String(store.enrollments.filter((item) => item.classId === row.classId && item.status !== 'cancelled').length),
            },
            { key: 'room', header: 'Room', render: (row) => assigned(row.room) },
            { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
            {
              key: 'actions',
              header: '',
              render: (row) => (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    void persist(
                      { ...store, classes: store.classes.map((item) => (item.classId === row.classId ? { ...item, teacherId: '' } : item)) },
                      'Teacher removed from class.',
                    )
                  }
                >
                  Remove teacher
                </Button>
              ),
            },
          ]}
        />
      ) : null}

      {tab === 'calendar' ? (
        <section className="panel">
          <div className="cal-nav">
            <Button type="button" variant="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
              Previous Month
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
              Today
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
              Next Month
            </Button>
            <strong>
              {month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
            </strong>
            <Button type="button" onClick={() => setModal('schedule')}>
              + Create Schedule
            </Button>
          </div>
          <div className="month-cal">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
              <div key={label} className="month-cal-head">
                {label}
              </div>
            ))}
            {days.map((date) => {
              const key = date.toISOString().slice(0, 10);
              const inMonth = date.getMonth() === month.getMonth();
              const events = schedules.filter((row) => (row.startAt || '').slice(0, 10) === key);
              return (
                <div key={key + inMonth} className={inMonth ? 'month-cal-cell' : 'month-cal-cell is-out'}>
                  <span>{date.getDate()}</span>
                  {events.map((row) => (
                    <button
                      key={row.scheduleId}
                      type="button"
                      className="month-cal-event"
                      onClick={() => {
                        setEditSchedule(row);
                        setModal('schedule');
                      }}
                    >
                      {new Date(row.startAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{' '}
                      {store.students.find((item) => item.studentId === row.studentId)
                        ? studentDisplay(store.students.find((item) => item.studentId === row.studentId)!)
                        : store.classes.find((item) => item.classId === row.classId)?.name || row.title}{' '}
                      {row.room}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === 'tasks' ? (
        <RecordTable
          title="Tasks"
          description="Assigned work. Teachers update status on mobile."
          rows={tasks}
          rowKey={(row) => row.taskId}
          search={(row, q) => `${row.title} ${row.description}`.toLowerCase().includes(q)}
          searchPlaceholder="Search tasks"
          emptyTitle="No tasks"
          emptyHint="Assign a task for this teacher."
          statusOf={(row) => row.status}
          crud={{
            addLabel: '+ Assign Task',
            onAdd: () => {
              setEditTask(null);
              setModal('task');
            },
            onEdit: (row) => {
              setEditTask(row);
              setModal('task');
            },
          }}
          columns={[
            { key: 'title', header: 'Task', render: (row) => row.title },
            { key: 'due', header: 'Due', render: (row) => assigned(row.dueAt) },
            { key: 'priority', header: 'Priority', render: (row) => row.priority },
            { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
            { key: 'response', header: 'Teacher response', render: (row) => assigned(row.response) },
            { key: 'done', header: 'Completed', render: (row) => (row.completedAt ? `${row.completedBy || 'teacher'} · ${row.completedAt.slice(0, 10)}` : '—') },
          ]}
        />
      ) : null}

      {tab === 'attendance' ? (
        <RecordTable
          title="Attendance"
          description="This teacher's own attendance history."
          rows={attendance}
          rowKey={(row) => row.attendanceId}
          search={(row, q) => `${row.attendanceDate} ${row.status}`.toLowerCase().includes(q)}
          searchPlaceholder="Search attendance"
          emptyTitle="No attendance records"
          emptyHint="Add a present, absent, late, or excused record."
          statusOf={(row) => row.status}
          crud={{ addLabel: '+ Add attendance', onAdd: () => setModal('attendance') }}
          columns={[
            { key: 'date', header: 'Date', render: (row) => row.attendanceDate },
            { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
            { key: 'notes', header: 'Remarks', render: (row) => assigned(row.notes) },
          ]}
        />
      ) : null}

      {tab === 'todo' ? (
        <RecordTable
          title="To-Do"
          description="Reminders stored as teacher tasks. Completing them on mobile updates this list."
          rows={todos}
          rowKey={(row) => row.scheduleId}
          search={(row, q) => row.title.toLowerCase().includes(q)}
          searchPlaceholder="Search to-dos"
          emptyTitle="No to-do items"
          emptyHint="Create a to-do for this teacher."
          statusOf={(row) => row.status}
          crud={{ addLabel: '+ Add to-do', onAdd: () => setModal('todo') }}
          columns={[
            { key: 'title', header: 'Title', render: (row) => row.title },
            { key: 'due', header: 'Due', render: (row) => (row.startAt || '').slice(0, 10) },
            { key: 'priority', header: 'Priority', render: (row) => row.room || 'normal' },
            { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
            { key: 'notes', header: 'Notes', render: (row) => assigned(row.notes) },
          ]}
        />
      ) : null}

      {tab === 'comments' ? (
        <RecordTable
          title="Comments"
          description="Visible comments appear on the teacher mobile app."
          rows={comments}
          rowKey={(row) => row.commentId}
          search={(row, q) => row.content.toLowerCase().includes(q)}
          searchPlaceholder="Search comments"
          emptyTitle="No comments"
          emptyHint="Add a comment for this teacher."
          crud={{ addLabel: '+ Add Comment', onAdd: () => setModal('comment') }}
          columns={[
            { key: 'content', header: 'Comment', render: (row) => row.content },
            { key: 'vis', header: 'Visibility', render: (row) => row.visibility },
            { key: 'by', header: 'Created by', render: (row) => displayName(store.users.find((item) => item.userId === row.createdBy)) || row.createdBy },
            { key: 'at', header: 'Date', render: (row) => row.createdAt.slice(0, 10) },
            { key: 'reply', header: 'Reply', render: (row) => assigned(row.reply) },
          ]}
        />
      ) : null}

      {tab === 'notes' ? (
        <RecordTable
          title="Admin Notes"
          description="Private notes stay on desktop. Visible to teacher notes sync to mobile."
          rows={notes}
          rowKey={(row) => row.noteId}
          search={(row, q) => `${row.title} ${row.content}`.toLowerCase().includes(q)}
          searchPlaceholder="Search notes"
          emptyTitle="No admin notes"
          emptyHint="Create a private or visible note."
          crud={{ addLabel: '+ Add note', onAdd: () => setModal('note') }}
          columns={[
            { key: 'title', header: 'Title', render: (row) => row.title },
            { key: 'priority', header: 'Priority', render: (row) => row.priority },
            { key: 'vis', header: 'Visibility', render: (row) => row.visibility },
            { key: 'status', header: 'Status', render: (row) => row.status },
            { key: 'when', header: 'Date', render: (row) => row.createdAt.slice(0, 10) },
          ]}
        />
      ) : null}

      {tab === 'activity' ? (
        <RecordTable
          title="Activity"
          description="Real audit rows for this teacher. Empty means nothing has been logged yet."
          rows={activityRows}
          rowKey={(row) => row.auditId}
          search={(row, q) => `${row.action} ${row.summary}`.toLowerCase().includes(q)}
          searchPlaceholder="Search activity"
          emptyTitle="No activity recorded"
          emptyHint="Assigning students, schedules, and tasks writes audit rows when the API logs them."
          columns={[
            { key: 'action', header: 'Action', render: (row) => row.action },
            { key: 'user', header: 'User', render: (row) => row.actorName || row.actorId },
            { key: 'date', header: 'Date', render: (row) => (row.createdAt || '').slice(0, 10) },
            { key: 'time', header: 'Time', render: (row) => (row.createdAt || '').slice(11, 19) },
            { key: 'related', header: 'Related record', render: (row) => row.entityId || '—' },
            { key: 'summary', header: 'Summary', render: (row) => row.summary },
          ]}
        />
      ) : null}

      {editingTeacher ? (
        <StaffForm
          user={teacher}
          profile={profile}
          specialties={store.teacherRoleOptions.map((item) => item.name).filter(Boolean)}
          error={staffError}
          busy={busy}
          onClose={() => setEditingTeacher(false)}
          onSubmit={onSaveTeacher}
        />
      ) : null}

      {modal === 'student' ? (
        <EditorModal title={`Assign student · ${displayName(teacher)}`} error={error} busy={false} submitLabel="Assign" onClose={() => setModal(null)} onSubmit={assignStudents}>
          <FormSection title="Students">
          <Field label="Class" optional>
            <Select name="classId" defaultValue={classes[0]?.classId || ''}>
              <option value="">No class change</option>
              {store.classes.map((row) => (
                <option key={row.classId} value={row.classId}>
                  {row.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="form-span">
            {store.students.map((row) => (
              <label key={row.studentId} className="check-row">
                <input type="checkbox" name="studentId" value={row.studentId} />
                {studentDisplay(row)} · {row.program || 'No program'}
              </label>
            ))}
          </div>
          </FormSection>
        </EditorModal>
      ) : null}

      {modal === 'class' ? (
        <EditorModal title={`Assign class · ${displayName(teacher)}`} error={error} busy={false} submitLabel="Assign" onClose={() => setModal(null)} onSubmit={assignClass}>
          <FormSection title="Class">
          <Field label="Class" required>
            <Select name="classId" required defaultValue="">
              <option value="" disabled>
                Select class
              </option>
              {store.classes.map((row) => (
                <option key={row.classId} value={row.classId}>
                  {row.name} {row.teacherId === teacherId ? '(already assigned)' : ''}
                </option>
              ))}
            </Select>
          </Field>
          </FormSection>
        </EditorModal>
      ) : null}

      {modal === 'schedule' ? (
        <EditorModal
          title={editSchedule ? `Edit ${editSchedule.title || 'schedule'}` : 'Create schedule'}
          error={error}
          busy={false}
          submitLabel="Save schedule"
          onClose={() => {
            setModal(null);
            setEditSchedule(null);
          }}
          onSubmit={saveSchedule}
        >
          <Field label="Title" required>
            <Input name="title" defaultValue={editSchedule?.title} required />
          </Field>
          <Field label="Start" required>
            <Input name="startAt" type="datetime-local" defaultValue={localInput(editSchedule?.startAt)} required />
          </Field>
          <Field label="End" required>
            <Input name="endAt" type="datetime-local" defaultValue={localInput(editSchedule?.endAt)} required />
          </Field>
          <Field label="Program">
            <Select name="programId" defaultValue={editSchedule?.programId || ''}>
              <option value="">—</option>
              {store.programs.map((row) => (
                <option key={row.programId} value={row.programId}>
                  {row.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Class">
            <Select name="classId" defaultValue={editSchedule?.classId || ''}>
              <option value="">—</option>
              {store.classes.map((row) => (
                <option key={row.classId} value={row.classId}>
                  {row.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Student">
            <Select name="studentId" defaultValue={editSchedule?.studentId || ''}>
              <option value="">—</option>
              {store.students.map((row) => (
                <option key={row.studentId} value={row.studentId}>
                  {studentDisplay(row)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Location">
            <Input name="room" defaultValue={editSchedule?.room} />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={editSchedule?.status || 'confirmed'}>
              <option value="confirmed">confirmed</option>
              <option value="cancelled">cancelled</option>
              <option value="rescheduled">rescheduled</option>
            </Select>
          </Field>
          <Field label="Notes">
            <Textarea name="notes" defaultValue={editSchedule?.notes} />
          </Field>
        </EditorModal>
      ) : null}

      {modal === 'task' ? (
        <EditorModal
          title={editTask ? `Edit ${editTask.title}` : 'Assign task'}
          error={error}
          busy={false}
          submitLabel="Save task"
          onClose={() => {
            setModal(null);
            setEditTask(null);
          }}
          onSubmit={(event) => void saveTask(event, false)}
        >
          <Field label="Task title" required>
            <Input name="title" defaultValue={editTask?.title} required />
          </Field>
          <Field label="Description">
            <Textarea name="description" defaultValue={editTask?.description} />
          </Field>
          <Field label="Related student">
            <Select name="studentId" defaultValue={editTask?.studentId || ''}>
              <option value="">—</option>
              {students.map((row) => (
                <option key={row.studentId} value={row.studentId}>
                  {studentDisplay(row)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Related class">
            <Select name="classId" defaultValue={editTask?.classId || ''}>
              <option value="">—</option>
              {classes.map((row) => (
                <option key={row.classId} value={row.classId}>
                  {row.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select name="priority" defaultValue={editTask?.priority || 'high'}>
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
            </Select>
          </Field>
          <Field label="Due date">
            <Input name="dueAt" type="date" defaultValue={(editTask?.dueAt || '').slice(0, 10)} />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={editTask?.status || 'assigned'}>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="submitted">Submitted</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
        </EditorModal>
      ) : null}

      {modal === 'todo' ? (
        <EditorModal title="Add to-do" error={error} busy={false} submitLabel="Save to-do" onClose={() => setModal(null)} onSubmit={(event) => void saveTask(event, true)}>
          <Field label="Title" required>
            <Input name="title" required />
          </Field>
          <Field label="Description">
            <Textarea name="description" />
          </Field>
          <Field label="Due date">
            <Input name="dueAt" type="date" />
          </Field>
          <Field label="Priority">
            <Select name="priority" defaultValue="normal">
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue="assigned">
              <option value="assigned">open</option>
              <option value="completed">completed</option>
            </Select>
          </Field>
        </EditorModal>
      ) : null}

      {modal === 'attendance' ? (
        <EditorModal title="Add attendance" error={error} busy={false} submitLabel="Save" onClose={() => setModal(null)} onSubmit={saveAttendance}>
          <Field label="Date" required>
            <Input name="attendanceDate" type="date" required />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue="present">
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
              <option value="excused">Excused</option>
            </Select>
          </Field>
          <Field label="Remarks">
            <Input name="notes" />
          </Field>
        </EditorModal>
      ) : null}

      {modal === 'comment' ? (
        <EditorModal title="Add comment" error={error} busy={false} submitLabel="Save" onClose={() => setModal(null)} onSubmit={saveComment}>
          <Field label="Comment" required>
            <Textarea name="content" required />
          </Field>
          <Field label="Visibility">
            <Select name="visibility" defaultValue="teacher">
              <option value="teacher">Visible to teacher</option>
              <option value="private">Private</option>
            </Select>
          </Field>
        </EditorModal>
      ) : null}

      {modal === 'note' ? (
        <EditorModal title="Add admin note" error={error} busy={false} submitLabel="Save" onClose={() => setModal(null)} onSubmit={saveNote}>
          <Field label="Title" required>
            <Input name="title" required />
          </Field>
          <Field label="Note" required>
            <Textarea name="content" required />
          </Field>
          <Field label="Priority">
            <Select name="priority" defaultValue="normal">
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
            </Select>
          </Field>
          <Field label="Reminder date">
            <Input name="reminderDate" type="date" />
          </Field>
          <Field label="Visibility">
            <Select name="visibility" defaultValue="private">
              <option value="private">Private</option>
              <option value="teacher">Visible to Teacher</option>
            </Select>
          </Field>
        </EditorModal>
      ) : null}
    </div>
  );
}

function WsStat({
  icon,
  label,
  value,
  hint,
  onClick,
  tone,
  empty,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  hint: string;
  onClick: () => void;
  tone?: 'warn';
  empty?: boolean;
}) {
  return (
    <button type="button" className={['stat-card', tone === 'warn' ? 'is-warn' : '', empty ? 'is-empty' : ''].filter(Boolean).join(' ')} onClick={onClick}>
      <span className="stat-icon">{icon}</span>
      <div className="stat-copy">
        <p>{label}</p>
        <strong className={empty ? 'stat-empty' : undefined}>{typeof value === 'number' ? value.toLocaleString('en-PH') : value}</strong>
        <small>{hint}</small>
      </div>
    </button>
  );
}

