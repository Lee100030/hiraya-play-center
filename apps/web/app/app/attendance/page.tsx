'use client';

import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { Button, Field, Loading, Select, StatusBadge, Table } from '@hiraya/ui';
import { newId, studentDisplay, todayIsoDate } from '@hiraya/utils';
import { FormEvent } from 'react';

export default function AttendancePage() {
  const { user } = useAuth();
  const { store, loading, save } = useStore();
  if (loading) return <Loading />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const record = {
      attendanceId: newId('att'),
      kind: String(form.get('kind') || 'student'),
      studentId: String(form.get('studentId') || ''),
      employeeId: String(form.get('employeeId') || ''),
      classId: String(form.get('classId') || ''),
      qrCode: '',
      timeIn: new Date().toISOString(),
      timeOut: null,
      attendanceDate: String(form.get('attendanceDate') || todayIsoDate()),
      status: String(form.get('status') || 'present'),
      notes: '',
      recordedBy: user?.userId || '',
    };
    await save({ ...store, attendance: [record, ...store.attendance] });
    event.currentTarget.reset();
  }

  return (
    <>
      <h1>Attendance</h1>
      <form className="hlc-card form-grid" onSubmit={onSubmit}>
        <Field label="Kind">
          <Select name="kind" defaultValue="student">
            <option value="student">Student</option>
            <option value="employee">Employee</option>
          </Select>
        </Field>
        <Field label="Student">
          <Select name="studentId" defaultValue="">
            <option value="">—</option>
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
            <option>present</option>
            <option>late</option>
            <option>absent</option>
            <option>excused</option>
            <option>leave</option>
          </Select>
        </Field>
        <div>
          <Button type="submit">Record</Button>
        </div>
      </form>
      <Table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Who</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {store.attendance.slice(0, 50).map((row) => (
            <tr key={row.attendanceId}>
              <td>{row.attendanceDate}</td>
              <td>
                {row.kind === 'employee'
                  ? store.users.find((u) => u.userId === row.employeeId)?.fullname
                  : (() => {
                      const student = store.students.find((s) => s.studentId === row.studentId);
                      return student ? studentDisplay(student) : row.studentId;
                    })()}
              </td>
              <td>
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
