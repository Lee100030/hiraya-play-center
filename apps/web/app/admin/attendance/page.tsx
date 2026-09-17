'use client';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { Button, EmptyState, Field, Loading, Select, StatusBadge, Table } from '@hiraya/ui';
import { newId, studentDisplay, todayIsoDate } from '@hiraya/utils';
import type { AttendanceRecord } from '@hiraya/types';
import { FormEvent, useMemo, useState } from 'react';

export default function AdminAttendancePage() {
  const { user } = useAuth();
  const { store, loading, save } = useStore();
  const [month, setMonth] = useState(todayIsoDate().slice(0, 7));
  const rows = useMemo(
    () => store.attendance.filter((row) => (row.attendanceDate || '').startsWith(month)),
    [store.attendance, month],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const studentId = String(form.get('studentId') || '');
    const attendanceDate = String(form.get('attendanceDate') || todayIsoDate());
    const duplicate = store.attendance.some(
      (row) => row.kind === 'student' && row.studentId === studentId && row.attendanceDate === attendanceDate,
    );
    if (duplicate) {
      window.alert('That student already has attendance for this date.');
      return;
    }
    const record: AttendanceRecord = {
      attendanceId: newId('att'),
      kind: 'student',
      studentId,
      employeeId: '',
      classId: String(form.get('classId') || ''),
      qrCode: '',
      timeIn: new Date().toISOString(),
      timeOut: null,
      attendanceDate,
      status: String(form.get('status') || 'present'),
      notes: String(form.get('notes') || ''),
      recordedBy: user?.userId || '',
    };
    await save({ ...store, attendance: [record, ...store.attendance] });
    event.currentTarget.reset();
  }

  async function updateStatus(row: AttendanceRecord, status: string) {
    await save({
      ...store,
      attendance: store.attendance.map((item) => (item.attendanceId === row.attendanceId ? { ...item, status } : item)),
    });
  }

  if (loading) return <Loading />;
  return (
    <>
      <AdminPageHeader
        kicker="Records"
        title="Attendance"
        description="The same attendance records appear on desktop and on parent/teacher mobile."
      />
      <form className="hlc-card form-grid" onSubmit={onSubmit}>
        <Field label="Student" required>
          <Select name="studentId" required>
            <option value="">Select</option>
            {store.students.map((s) => (
              <option key={s.studentId} value={s.studentId}>
                {studentDisplay(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Class">
          <Select name="classId" defaultValue="">
            <option value="">—</option>
            {store.classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date">
          <input className="hlc-input" type="date" name="attendanceDate" defaultValue={todayIsoDate()} />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue="present">
            <option value="present">present</option>
            <option value="late">late</option>
            <option value="absent">absent</option>
            <option value="excused">excused</option>
          </Select>
        </Field>
        <Button type="submit">Record</Button>
      </form>
      <Field label="Month">
        <input className="hlc-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </Field>
      {rows.length === 0 ? (
        <EmptyState title="No attendance this month" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Student</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.attendanceId}>
                <td>{row.attendanceDate}</td>
                <td>
                  {store.students.find((s) => s.studentId === row.studentId)
                    ? studentDisplay(store.students.find((s) => s.studentId === row.studentId)!)
                    : row.studentId}
                </td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>
                  <Select defaultValue={row.status} onChange={(e) => void updateStatus(row, e.target.value)}>
                    <option value="present">present</option>
                    <option value="late">late</option>
                    <option value="absent">absent</option>
                    <option value="excused">excused</option>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
