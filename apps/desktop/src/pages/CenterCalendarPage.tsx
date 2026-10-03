import type { HirayaDatabase, HirayaUser, Schedule, StaffTask } from '@hiraya/types';
import { displayName, isAdmin, localDateKey, newId, staffDisplayRole, studentDisplay } from '@hiraya/utils';
import { Button, Field, Input, PhotoCardPicker, Select, Textarea } from '@hiraya/ui';
import { FormEvent, useMemo, useRef, useState } from 'react';
import { DayScheduleBoard } from '../components/DayScheduleBoard';
import { DeskModal } from '../components/DeskModal';
import { EditorModal, FormSection } from '../components/EditorModal';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  const weekday = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - weekday);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function localInput(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function atHour(day: string, hour: number) {
  return `${day}T${String(hour).padStart(2, '0')}:00`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function CenterCalendarPage({
  store,
  user,
  saveStore,
}: {
  store: HirayaDatabase;
  user: HirayaUser;
  saveStore: (next: HirayaDatabase) => Promise<void>;
}) {
  const canManage = isAdmin(user.role);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [dayBoard, setDayBoard] = useState<string | null>(null);
  const dayClick = useRef<number | null>(null);
  const [schedule, setSchedule] = useState<Schedule | 'new' | null>(null);
  const [task, setTask] = useState<StaffTask | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const currentSchedule = schedule && schedule !== 'new' ? schedule : null;
  const currentTask = task && task !== 'new' ? task : null;
  const today = dateKey(new Date());
  const days = useMemo(() => dayCells(month), [month]);
  const viewedMonth = monthKey(month);
  const monthLabel = month.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const monthSchedules = (store.schedules || []).filter(
    (row) => localDateKey(row.startAt).slice(0, 7) === viewedMonth && row.status !== 'cancelled',
  );
  const monthTasks = (store.staffTasks || []).filter(
    (row) => localDateKey(row.dueAt).slice(0, 7) === viewedMonth && row.status !== 'cancelled',
  );
  const monthAssignCount = monthSchedules.length + monthTasks.length;
  const teachers = store.users.filter((item) => item.role === 'teacher');
  const teacherPeople = useMemo(
    () =>
      teachers.map((item) => ({
        id: item.userId,
        name: displayName(item),
        photo: item.profileImagePath ? api.profileMediaUrl(item.userId, item.updatedAt || item.profileImagePath) : undefined,
        role: staffDisplayRole(item.role, store.teacherProfiles.find((row) => row.userId === item.userId)?.specialty),
      })),
    [teachers, store.teacherProfiles],
  );

  function teacherName(id?: string) {
    const name = displayName(store.users.find((item) => item.userId === id));
    return name || '';
  }

  function teacherNameList(packed?: string) {
    return (packed || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => teacherName(id))
      .filter(Boolean);
  }

  function scheduleTeachers(row: Schedule) {
    const named = teacherNameList(row.teacherId);
    if (named.length) return named;
    const fromClass = teacherName(store.classes.find((item) => item.classId === row.classId)?.teacherId);
    return fromClass ? [fromClass] : ['Unassigned'];
  }

  function teacherLines(packed?: string, fallback?: string) {
    const names = teacherNameList(packed);
    if (names.length) return names;
    return fallback ? [fallback] : ['Unassigned'];
  }

  function eventsOn(day: string) {
    const schedules = (store.schedules || []).filter(
      (row) => localDateKey(row.startAt) === day && row.status !== 'cancelled',
    );
    const holidays = (store.centerHolidays || []).filter((row) => localDateKey(row.date) === day);
    const tasks = (store.staffTasks || []).filter(
      (row) => localDateKey(row.dueAt) === day && row.status !== 'cancelled',
    );
    return { schedules, holidays, tasks };
  }

  function openDay(day: string) {
    if (!canManage) return;
    setPickedDay(day);
    setError(null);
  }

  function queueDay(day: string) {
    if (dayClick.current) window.clearTimeout(dayClick.current);
    dayClick.current = window.setTimeout(() => {
      dayClick.current = null;
      openDay(day);
    }, 240);
  }

  function openDayBoard(day: string) {
    if (dayClick.current) window.clearTimeout(dayClick.current);
    dayClick.current = null;
    setPickedDay(null);
    setSchedule(null);
    setTask(null);
    setDayBoard(day);
    setError(null);
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const start = String(form.get('startAt') || '');
    const end = String(form.get('endAt') || '');
    const teacherIds = form.getAll('teacherIds').map(String).filter(Boolean).join(',');
    const next: Schedule = {
      scheduleId: currentSchedule?.scheduleId || newId('sch'),
      title: String(form.get('title') || '').trim(),
      kind: 'classSession',
      scheduleType: 'classSession',
      classId: String(form.get('classId') || ''),
      studentId: String(form.get('studentId') || ''),
      teacherId: teacherIds,
      programId: String(form.get('programId') || ''),
      startAt: start ? new Date(start).toISOString() : new Date().toISOString(),
      endAt: end ? new Date(end).toISOString() : new Date().toISOString(),
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
        schedules: currentSchedule
          ? store.schedules.map((item) => (item.scheduleId === next.scheduleId ? next : item))
          : [...store.schedules, next],
      });
      setSchedule(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save schedule');
    } finally {
      setBusy(false);
    }
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const teacherIds = form.getAll('teacherIds').map(String).filter(Boolean).join(',');
    const next: StaffTask = {
      taskId: currentTask?.taskId || newId('tsk'),
      title: String(form.get('title') || '').trim(),
      description: String(form.get('description') || '').trim(),
      priority: String(form.get('priority') || 'normal'),
      dueAt: String(form.get('dueAt') || pickedDay || ''),
      teacherIds,
      classId: String(form.get('classId') || ''),
      studentId: String(form.get('studentId') || ''),
      status: String(form.get('status') || currentTask?.status || 'assigned'),
      response: currentTask?.response || '',
      attachmentName: currentTask?.attachmentName || '',
      assignedBy: currentTask?.assignedBy || user.userId,
      completedAt: currentTask?.completedAt || '',
      completedBy: currentTask?.completedBy || '',
      createdAt: currentTask?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (!next.title || !next.teacherIds) {
      setError('Title and at least one teacher are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const rows = store.staffTasks || [];
      await saveStore({
        ...store,
        staffTasks: currentTask ? rows.map((item) => (item.taskId === next.taskId ? next : item)) : [...rows, next],
      });
      setTask(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save task');
    } finally {
      setBusy(false);
    }
  }

  async function clearMonthAssignments() {
    if (!canManage || !monthAssignCount) return;
    setBusy(true);
    setError(null);
    try {
      await saveStore({
        ...store,
        schedules: (store.schedules || []).filter((row) => localDateKey(row.startAt).slice(0, 7) !== viewedMonth),
        staffTasks: (store.staffTasks || []).filter((row) => localDateKey(row.dueAt).slice(0, 7) !== viewedMonth),
      });
      setClearOpen(false);
      setSchedule(null);
      setTask(null);
      setPickedDay(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear assignments');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        kicker="HIRAYA calendar"
        title="Center calendar"
        description="One calendar for the center. Double-click a day to edit that day’s teacher schedule. A single click still assigns one schedule or task."
      />
      <div className="cal-nav">
        <Button type="button" variant="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          Previous
        </Button>
        <Button type="button" variant="ghost" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
          Today
        </Button>
        <Button type="button" variant="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
          Next
        </Button>
        <strong>{month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</strong>
        {canManage ? (
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPickedDay(today);
                setSchedule('new');
              }}
            >
              Assign schedule
            </Button>
            <Button
              type="button"
              onClick={() => {
                setPickedDay(today);
                setTask('new');
              }}
            >
              Assign task
            </Button>
            <Button type="button" variant="danger" disabled={!monthAssignCount || busy} onClick={() => setClearOpen(true)}>
              Clear calendar for this month
            </Button>
          </>
        ) : null}
      </div>
      <div className="month-cal">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
          <div key={label} className="month-cal-head">
            {label}
          </div>
        ))}
        {days.map((date) => {
          const key = dateKey(date);
          const inMonth = date.getMonth() === month.getMonth();
          const { schedules, holidays, tasks } = eventsOn(key);
          const boardCount = schedules.filter((row) => row.kind === 'dayBoard' && !/^off$/i.test((row.title || '').trim())).length;
          const listed = schedules.filter((row) => row.kind !== 'dayBoard');
          return (
            <button
              key={key}
              type="button"
              className={['month-cal-cell', inMonth ? '' : 'is-out', key === today ? 'is-today' : ''].filter(Boolean).join(' ')}
              onClick={() => queueDay(key)}
              onDoubleClick={() => openDayBoard(key)}
            >
              <span>{date.getDate()}</span>
              {holidays.map((row) => (
                <em key={row.holidayId} className="month-cal-event is-holiday">
                  {row.title}
                </em>
              ))}
              {boardCount > 0 ? <em className="month-cal-event">Day schedule</em> : null}
              {listed.map((row) => (
                <span
                  key={row.scheduleId}
                  className="month-cal-event"
                  role="presentation"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!canManage) return;
                    if (dayClick.current) window.clearTimeout(dayClick.current);
                    setSchedule(row);
                  }}
                  onDoubleClick={(event) => event.stopPropagation()}
                >
                  {new Date(row.startAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} {row.title}
                  <strong className="month-cal-teacher">
                    {scheduleTeachers(row).map((name) => (
                      <span key={name}>{name}</span>
                    ))}
                  </strong>
                </span>
              ))}
              {tasks.map((row) => (
                <span
                  key={row.taskId}
                  className="month-cal-event is-task"
                  role="presentation"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!canManage) return;
                    setTask(row);
                  }}
                >
                  Task · {row.title}
                  <strong className="month-cal-teacher">
                    {teacherLines(row.teacherIds).map((name) => (
                      <span key={name}>{name}</span>
                    ))}
                  </strong>
                </span>
              ))}
            </button>
          );
        })}
      </div>
      {error && !schedule && !task && !clearOpen ? <p className="hlc-field-error">{error}</p> : null}

      {clearOpen ? (
        <DeskModal
          title={`Clear calendar for ${monthLabel}`}
          onClose={() => !busy && setClearOpen(false)}
          actions={
            <>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setClearOpen(false)}>
                Keep calendar
              </Button>
              <Button type="button" variant="danger" disabled={busy} onClick={() => void clearMonthAssignments()}>
                {busy ? 'Clearing…' : 'Clear calendar for this month'}
              </Button>
            </>
          }
        >
          <p>
            This clears the {monthLabel} calendar: {monthSchedules.length} schedule
            {monthSchedules.length === 1 ? '' : 's'} and {monthTasks.length} task
            {monthTasks.length === 1 ? '' : 's'}. Holidays stay. Teachers will no longer see those times on mobile.
          </p>
          {error ? <p className="hlc-field-error">{error}</p> : null}
        </DeskModal>
      ) : null}

      {dayBoard ? (
        <DayScheduleBoard day={dayBoard} store={store} saveStore={saveStore} onClose={() => setDayBoard(null)} />
      ) : null}

      {pickedDay && !schedule && !task && !dayBoard ? (
        <DeskModal
          title={`Assign for ${pickedDay}`}
          onClose={() => setPickedDay(null)}
          actions={
            <>
              <Button type="button" variant="ghost" onClick={() => setPickedDay(null)}>
                Close
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSchedule('new');
                }}
              >
                Assign schedule
              </Button>
              <Button type="button" onClick={() => setTask('new')}>
                Assign task
              </Button>
            </>
          }
        >
          <p>Assign one or more teachers. Each assigned teacher sees this on the mobile calendar and gets a notification.</p>
        </DeskModal>
      ) : null}

      {schedule ? (
        <EditorModal
          title={currentSchedule ? `Edit ${currentSchedule.title}` : 'Assign schedule'}
          error={error}
          busy={busy}
          submitLabel={currentSchedule ? 'Save schedule' : 'Assign schedule'}
          onClose={() => setSchedule(null)}
          onSubmit={saveSchedule}
        >
          <FormSection title="Schedule">
            <Field label="Title" required>
              <Input name="title" defaultValue={currentSchedule?.title} required />
            </Field>
            <Field label="Teachers" required hint="Tap a photo card to assign. You can pick more than one.">
              <PhotoCardPicker
                key={currentSchedule?.scheduleId || 'new-schedule'}
                name="teacherIds"
                people={teacherPeople}
                defaultSelected={(currentSchedule?.teacherId || '').split(',').filter(Boolean)}
              />
            </Field>
            <Field label="Program" optional>
              <Select name="programId" defaultValue={currentSchedule?.programId || ''}>
                <option value="">None</option>
                {store.programs.map((item) => (
                  <option key={item.programId} value={item.programId}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Class" optional>
              <Select name="classId" defaultValue={currentSchedule?.classId || ''}>
                <option value="">None</option>
                {store.classes.map((item) => (
                  <option key={item.classId} value={item.classId}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Student" optional>
              <Select name="studentId" defaultValue={currentSchedule?.studentId || ''}>
                <option value="">Whole class</option>
                {store.students.map((item) => (
                  <option key={item.studentId} value={item.studentId}>
                    {studentDisplay(item)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Start" required>
              <Input name="startAt" type="datetime-local" defaultValue={localInput(currentSchedule?.startAt) || atHour(pickedDay || today, 8)} required />
            </Field>
            <Field label="End" required>
              <Input name="endAt" type="datetime-local" defaultValue={localInput(currentSchedule?.endAt) || atHour(pickedDay || today, 9)} required />
            </Field>
            <Field label="Location" optional>
              <Input name="room" defaultValue={currentSchedule?.room} />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={currentSchedule?.status || 'confirmed'}>
                <option value="confirmed">confirmed</option>
                <option value="cancelled">cancelled</option>
              </Select>
            </Field>
            <div className="form-span">
              <Field label="Notes" optional>
                <Textarea name="notes" defaultValue={currentSchedule?.notes} />
              </Field>
            </div>
          </FormSection>
        </EditorModal>
      ) : null}

      {task ? (
        <EditorModal
          title={currentTask ? `Edit ${currentTask.title}` : 'Assign task'}
          error={error}
          busy={busy}
          submitLabel={currentTask ? 'Save task' : 'Assign task'}
          onClose={() => setTask(null)}
          onSubmit={saveTask}
        >
          <FormSection title="Task">
            <Field label="Title" required>
              <Input name="title" defaultValue={currentTask?.title} required />
            </Field>
            <Field label="Description" optional>
              <Textarea name="description" defaultValue={currentTask?.description} />
            </Field>
            <Field label="Due date">
              <Input name="dueAt" type="date" defaultValue={(currentTask?.dueAt || pickedDay || today).slice(0, 10)} />
            </Field>
            <Field label="Priority">
              <Select name="priority" defaultValue={currentTask?.priority || 'normal'}>
                <option value="low">low</option>
                <option value="normal">normal</option>
                <option value="high">high</option>
              </Select>
            </Field>
            <Field label="Teachers" required hint="Tap a photo card to assign. You can pick more than one.">
              <PhotoCardPicker
                key={currentTask?.taskId || 'new-task'}
                name="teacherIds"
                people={teacherPeople}
                defaultSelected={(currentTask?.teacherIds || '').split(',').filter(Boolean)}
              />
            </Field>
            <Field label="Related class" optional>
              <Select name="classId" defaultValue={currentTask?.classId || ''}>
                <option value="">None</option>
                {store.classes.map((item) => (
                  <option key={item.classId} value={item.classId}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={currentTask?.status || 'assigned'}>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="submitted">Submitted</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </Field>
          </FormSection>
        </EditorModal>
      ) : null}
    </>
  );
}
