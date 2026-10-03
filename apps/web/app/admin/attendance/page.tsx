'use client';

import { AdminModal } from '@/components/admin/AdminModal';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { Button, EmptyState, Field, Input, Loading, Select, StatusBadge, Table } from '@hiraya/ui';
import {
  displayName,
  findDuplicateStaffGroups,
  isTeacherSalaryMonthPaid,
  markTeacherAttendance,
  markTeacherSalaryMonthPaid,
  mergeDuplicateStaffUsers,
  nextAttendanceMonth,
  staffTeachers,
  teacherAttendanceSummaries,
  teacherDayAttendance,
  todayIsoDate,
  upsertTeacherAttendanceDay,
} from '@hiraya/utils';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

export default function AdminAttendancePage() {
  const { user } = useAuth();
  const { store, loading, save } = useStore();
  const [month, setMonth] = useState(todayIsoDate().slice(0, 7));
  const [markDate, setMarkDate] = useState(todayIsoDate());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const dedupeRan = useRef(false);
  const teachers = useMemo(() => staffTeachers(store), [store]);
  const summaries = useMemo(() => teacherAttendanceSummaries(store, month), [store, month]);
  const detail = summaries.find((row) => row.teacher.userId === detailId) || null;
  const isToday = markDate === todayIsoDate();
  const salaryPaid = isTeacherSalaryMonthPaid(store, month);
  const monthClosed = isTeacherSalaryMonthPaid(store, markDate.slice(0, 7));

  useEffect(() => {
    if (dedupeRan.current) return;
    if (!findDuplicateStaffGroups(store).length) return;
    dedupeRan.current = true;
    const result = mergeDuplicateStaffUsers(store);
    if (!result.merged) return;
    void save(result.store).catch(() => {
      dedupeRan.current = false;
    });
  }, [store, save]);

  async function markStatus(teacherId: string, status: 'present' | 'absent' | 'excused' | '') {
    if (!status) return;
    setBusyId(teacherId);
    setError('');
    try {
      await save(markTeacherAttendance(store, teacherId, status, user?.userId || '', markDate));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update attendance.');
    } finally {
      setBusyId(null);
    }
  }

  async function paySalaryMonth() {
    if (salaryPaid) {
      const next = nextAttendanceMonth(month);
      setMonth(next);
      setMarkDate(`${next}-01`);
      return;
    }
    if (
      !window.confirm(
        `Mark teacher salary paid for ${month}? Attendance for that month stays in history, and the next month starts fresh.`,
      )
    ) {
      return;
    }
    setError('');
    try {
      const result = markTeacherSalaryMonthPaid(store, month, user?.userId || '');
      await save(result.store);
      setMonth(result.nextMonth);
      setMarkDate(`${result.nextMonth}-01`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not close that salary month.');
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const next = upsertTeacherAttendanceDay(
        store,
        String(form.get('teacherId') || ''),
        String(form.get('attendanceDate') || todayIsoDate()),
        String(form.get('status') || 'present'),
        user?.userId || '',
        String(form.get('notes') || ''),
      );
      await save(next);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save attendance.');
    }
  }

  if (loading) return <Loading />;

  return (
    <>
      <AdminPageHeader
        kicker="Records"
        title="Teachers Attendance record"
        description="Confirm on site, absent, or excused. When salary is paid, close the month and the next month starts fresh."
        actions={
          <>
            <button type="button" className="dash-action" onClick={() => void paySalaryMonth()}>
              {salaryPaid ? 'Open next month' : 'Salary paid — refresh next month'}
            </button>
            <button type="button" className="dash-action dash-action-primary" onClick={() => setOpen(true)} disabled={monthClosed}>
              Record day
            </button>
          </>
        }
      />
      <div className="form-grid" style={{ marginBottom: 16, alignItems: 'end' }}>
        <Field label="Month summary">
          <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </Field>
        <Field label="Confirm for date">
          <Input
            type="date"
            value={markDate}
            onChange={(event) => {
              const next = event.target.value || todayIsoDate();
              setMarkDate(next);
              setMonth(next.slice(0, 7));
            }}
          />
        </Field>
        <p className="hlc-field-hint" style={{ margin: 0 }}>
          {salaryPaid
            ? `Salary for ${month} is paid. History stays; mark attendance in the next month.`
            : 'Days worked / present / absent update live from each status change.'}
        </p>
      </div>
      {error ? <p className="hlc-field-error">{error}</p> : null}
      {summaries.length === 0 ? (
        <EmptyState title="No teachers" hint="Add teachers first, then confirm who is on site here." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Teacher</th>
              <th>{isToday ? 'Today on site' : `Status · ${markDate}`}</th>
              <th>Days worked</th>
              <th>Present</th>
              <th>Absent</th>
              <th>Excused</th>
              <th>Days logged</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((row) => {
              const today = teacherDayAttendance(store, row.teacher.userId, markDate);
              const busy = busyId === row.teacher.userId;
              const value = today?.status === 'late' ? 'present' : today?.status || '';
              return (
                <tr key={row.teacher.userId}>
                  <td>{displayName(row.teacher)}</td>
                  <td>
                    {monthClosed ? (
                      today?.status ? <StatusBadge status={today.status} /> : <span className="muted">Month closed</span>
                    ) : (
                      <div className="teacher-att-status">
                        <Select
                          className="teacher-att-select"
                          aria-label={`Attendance for ${displayName(row.teacher)}`}
                          disabled={busy}
                          value={value}
                          onChange={(event) =>
                            void markStatus(row.teacher.userId, event.target.value as 'present' | 'absent' | 'excused' | '')
                          }
                        >
                          <option value="">Not marked</option>
                          <option value="present">On site</option>
                          <option value="absent">Absent</option>
                          <option value="excused">Excused</option>
                        </Select>
                      </div>
                    )}
                  </td>
                  <td>
                    <strong>{row.worked}</strong>
                  </td>
                  <td>{row.present}</td>
                  <td>{row.absent}</td>
                  <td>{row.excused}</td>
                  <td>
                    <Button type="button" variant="ghost" onClick={() => setDetailId(row.teacher.userId)}>
                      {row.recorded} day{row.recorded === 1 ? '' : 's'}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {open ? (
        <AdminModal
          title="Record teacher day"
          onClose={() => {
            setOpen(false);
            setError('');
          }}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" form="teacher-attendance-form">
                Save
              </Button>
            </>
          }
        >
          {error ? <p className="hlc-field-error">{error}</p> : null}
          <form id="teacher-attendance-form" onSubmit={onSubmit}>
            <Field label="Teacher" required>
              <Select name="teacherId" required>
                <option value="">Select</option>
                {teachers.map((item) => (
                  <option key={item.userId} value={item.userId}>
                    {displayName(item)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date">
              <Input name="attendanceDate" type="date" defaultValue={markDate} />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue="present">
                <option value="present">Present / on site</option>
                <option value="late">Late (counts as work)</option>
                <option value="absent">Absent</option>
                <option value="excused">Excused / leave</option>
              </Select>
            </Field>
            <Field label="Notes" optional>
              <Input name="notes" placeholder="Optional note for payroll" />
            </Field>
          </form>
        </AdminModal>
      ) : null}
      {detail ? (
        <AdminModal title={`${displayName(detail.teacher)} · ${month}`} onClose={() => setDetailId(null)}>
          <p className="hlc-field-hint">
            Worked {detail.worked} day{detail.worked === 1 ? '' : 's'} · Absent {detail.absent} · Excused {detail.excused}
            {salaryPaid ? ' · Salary paid for this month' : ''}
          </p>
          {detail.records.length === 0 ? (
            <EmptyState title="No days logged this month" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {[...detail.records]
                  .sort((a, b) => (a.attendanceDate || '').localeCompare(b.attendanceDate || ''))
                  .map((row) => (
                    <tr key={row.attendanceId}>
                      <td>{row.attendanceDate}</td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                      <td>{row.notes || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </Table>
          )}
        </AdminModal>
      ) : null}
    </>
  );
}
