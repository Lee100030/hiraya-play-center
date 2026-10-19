'use client';

import { AdminModal } from '@/components/admin/AdminModal';
import { BlueprintHero } from '@/components/admin/BlueprintHero';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { api } from '@/lib/api';
import { displayName, localDateKey, newId, packedTeacherIds, staffDisplayRole, studentDisplay } from '@hiraya/utils';
import { Button, Field, Input, Loading, PhotoCardPicker, Select, Textarea } from '@hiraya/ui';
import type { Schedule, StaffTask } from '@hiraya/types';
import { FormEvent, useMemo, useState } from 'react';

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

function atHour(day: string, hour: number) {
  return `${day}T${String(hour).padStart(2, '0')}:00`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function inMonthValue(value: string | undefined, key: string) {
  return (value || '').slice(0, 7) === key;
}

export default function SchedulesPage() {
  const { user } = useAuth();
  const { store, loading, save } = useStore();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Schedule | 'new' | null>(null);
  const [task, setTask] = useState<StaffTask | 'new' | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const current = schedule && schedule !== 'new' ? schedule : null;
  const currentTask = task && task !== 'new' ? task : null;
  const today = dateKey(new Date());
  const days = useMemo(() => dayCells(month), [month]);
  const viewedMonth = monthKey(month);
  const monthLabel = month.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const monthSchedules = (store.schedules || []).filter(
    (row) => inMonthValue(row.startAt, viewedMonth) && row.status !== 'cancelled',
  );
  const monthTasks = (store.staffTasks || []).filter(
    (row) => inMonthValue(row.dueAt, viewedMonth) && row.status !== 'cancelled',
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

  function teacherLines(packed?: string) {
    const names = packedTeacherIds(packed)
      .map((id) => displayName(store.users.find((item) => item.userId === id)))
      .filter(Boolean);
    return names.length ? names : ['Unassigned'];
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const start = String(form.get('startAt') || '');
    const end = String(form.get('endAt') || '');
    const teacherIds = form.getAll('teacherIds').map(String).filter(Boolean).join(',');
    const next: Schedule = {
      scheduleId: current?.scheduleId || newId('sch'),
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
    if (!next.title || !next.teacherId) return;
    await save({
      ...store,
      schedules: current
        ? store.schedules.map((item) => (item.scheduleId === next.scheduleId ? next : item))
        : [...store.schedules, next],
    });
    setSchedule(null);
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: StaffTask = {
      taskId: currentTask?.taskId || newId('tsk'),
      title: String(form.get('title') || '').trim(),
      description: String(form.get('description') || '').trim(),
      priority: String(form.get('priority') || 'normal'),
      dueAt: String(form.get('dueAt') || pickedDay || today),
      teacherIds: form.getAll('teacherIds').map(String).filter(Boolean).join(','),
      classId: '',
      studentId: '',
      status: 'assigned',
      response: currentTask?.response || '',
      attachmentName: '',
      assignedBy: user?.userId || '',
      completedAt: '',
      completedBy: '',
      createdAt: currentTask?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const rows = store.staffTasks || [];
    await save({
      ...store,
      staffTasks: currentTask ? rows.map((item) => (item.taskId === next.taskId ? next : item)) : [...rows, next],
    });
    setTask(null);
  }

  async function clearMonthAssignments() {
    if (!monthAssignCount) return;
    setBusy(true);
    try {
      await save({
        ...store,
        schedules: (store.schedules || []).filter((row) => !inMonthValue(row.startAt, viewedMonth)),
        staffTasks: (store.staffTasks || []).filter((row) => !inMonthValue(row.dueAt, viewedMonth)),
      });
      setClearOpen(false);
      setSchedule(null);
      setTask(null);
      setPickedDay(null);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <>
      <BlueprintHero
        kicker="HIRAYA calendar"
        title="Center calendar"
        description="One calendar for everyone. Assign a class schedule or a teacher task to one or more teachers; they are notified on mobile."
        actions={
          <>
            <button
              type="button"
              className="dash-action"
              onClick={() => {
                setPickedDay(today);
                setSchedule('new');
              }}
            >
              Assign schedule
            </button>
            <button
              type="button"
              className="dash-action dash-action-primary"
              onClick={() => {
                setPickedDay(today);
                setTask('new');
              }}
            >
              Assign task
            </button>
            <button
              type="button"
              className="dash-action dash-action-danger"
              disabled={!monthAssignCount || busy}
              onClick={() => setClearOpen(true)}
            >
              Clear calendar for this month
            </button>
          </>
        }
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
      </div>

      {clearOpen ? (
        <AdminModal
          title={`Clear calendar for ${monthLabel}`}
          description={`This clears the ${monthLabel} calendar: ${monthSchedules.length} schedule${monthSchedules.length === 1 ? '' : 's'} and ${monthTasks.length} task${monthTasks.length === 1 ? '' : 's'}. Holidays stay.`}
          onClose={() => !busy && setClearOpen(false)}
          footer={
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
          <p>Teachers will no longer see those times on mobile.</p>
        </AdminModal>
      ) : null}

      <div className="month-cal">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
          <div key={label} className="month-cal-head">
            {label}
          </div>
        ))}
        {days.map((date) => {
          const key = dateKey(date);
          const inMonth = date.getMonth() === month.getMonth();
          const schedules = store.schedules.filter((row) => localDateKey(row.startAt) === key && row.status !== 'cancelled');
          const holidays = (store.centerHolidays || []).filter((row) => localDateKey(row.date) === key);
          const tasks = (store.staffTasks || []).filter((row) => localDateKey(row.dueAt) === key && row.status !== 'cancelled');
          return (
            <button
              key={key}
              type="button"
              className={['month-cal-cell', inMonth ? '' : 'is-out', key === today ? 'is-today' : ''].filter(Boolean).join(' ')}
              onClick={() => {
                setPickedDay(key);
                setSchedule('new');
              }}
            >
              <span>{date.getDate()}</span>
              {holidays.map((row) => (
                <em key={row.holidayId} className="month-cal-event is-holiday">
                  {row.title}
                </em>
              ))}
              {schedules.map((row) => (
                <span
                  key={row.scheduleId}
                  className="month-cal-event"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSchedule(row);
                  }}
                >
                  {row.title}
                  <strong className="month-cal-teacher">
                    {teacherLines(row.teacherId).map((name) => (
                      <span key={name}>{name}</span>
                    ))}
                  </strong>
                </span>
              ))}
              {tasks.map((row) => (
                <span
                  key={row.taskId}
                  className="month-cal-event is-task"
                  onClick={(event) => {
                    event.stopPropagation();
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

      {schedule ? (
        <AdminModal title={current ? `Edit ${current.title}` : 'Assign schedule'} onClose={() => setSchedule(null)}>
          <form className="form-grid" onSubmit={saveSchedule}>
            <Field label="Title" required>
              <Input name="title" defaultValue={current?.title} required />
            </Field>
            <Field label="Teachers" required>
              <PhotoCardPicker
                key={current?.scheduleId || 'new-schedule'}
                name="teacherIds"
                people={teacherPeople}
                defaultSelected={packedTeacherIds(current?.teacherId)}
              />
            </Field>
            <Field label="Class" optional>
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
              <Input name="startAt" type="datetime-local" defaultValue={(current?.startAt || '').slice(0, 16) || atHour(pickedDay || today, 8)} required />
            </Field>
            <Field label="End" required>
              <Input name="endAt" type="datetime-local" defaultValue={(current?.endAt || '').slice(0, 16) || atHour(pickedDay || today, 9)} required />
            </Field>
            <Field label="Room" optional>
              <Input name="room" defaultValue={current?.room} />
            </Field>
            <Button type="submit">Save schedule</Button>
          </form>
        </AdminModal>
      ) : null}

      {task ? (
        <AdminModal title={currentTask ? `Edit ${currentTask.title}` : 'Assign task'} onClose={() => setTask(null)}>
          <form className="form-grid" onSubmit={saveTask}>
            <Field label="Title" required>
              <Input name="title" defaultValue={currentTask?.title} required />
            </Field>
            <Field label="Description" optional>
              <Textarea name="description" defaultValue={currentTask?.description} />
            </Field>
            <Field label="Due">
              <Input name="dueAt" type="date" defaultValue={(currentTask?.dueAt || pickedDay || today).slice(0, 10)} />
            </Field>
            <Field label="Teachers" required>
              <PhotoCardPicker
                key={currentTask?.taskId || 'new-task'}
                name="teacherIds"
                people={teacherPeople}
                defaultSelected={packedTeacherIds(currentTask?.teacherIds)}
              />
            </Field>
            <Button type="submit">Assign task</Button>
          </form>
        </AdminModal>
      ) : null}
    </>
  );
}
