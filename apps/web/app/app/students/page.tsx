'use client';

import { useStore } from '@/components/StoreProvider';
import { Button, EmptyState, Field, Input, Loading, Select, StatusBadge, Table } from '@hiraya/ui';
import { newId, studentDisplay } from '@hiraya/utils';
import type { Student } from '@hiraya/types';
import { FormEvent, useEffect, useMemo, useState } from 'react';

export default function StudentsPage() {
  const { store, loading, save } = useStore();
  const [query, setQuery] = useState('');
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setQuery(q);
  }, []);
  const [editing, setEditing] = useState<Student | null>(null);

  const rows = useMemo(
    () =>
      store.students.filter((s) =>
        studentDisplay(s).toLowerCase().includes(query.toLowerCase()),
      ),
    [store.students, query],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: Student = {
      studentId: editing?.studentId || newId('stu'),
      firstName: String(form.get('firstName') || ''),
      middleName: String(form.get('middleName') || ''),
      lastName: String(form.get('lastName') || ''),
      fullname: '',
      birthdate: String(form.get('birthdate') || ''),
      age: Number(form.get('age') || 0),
      gender: String(form.get('gender') || ''),
      address: String(form.get('address') || ''),
      contactNumber: String(form.get('contactNumber') || ''),
      parentId: editing?.parentId || '',
      emergencyContact: String(form.get('emergencyContact') || ''),
      emergencyPhone: String(form.get('emergencyPhone') || ''),
      qrCode: editing?.qrCode || '',
      gradeLevel: String(form.get('gradeLevel') || ''),
      program: String(form.get('program') || ''),
      status: String(form.get('status') || 'active'),
      enrollmentDate: editing?.enrollmentDate || new Date().toISOString().slice(0, 10),
      notes: String(form.get('notes') || ''),
    };
    next.fullname = [next.firstName, next.middleName, next.lastName].filter(Boolean).join(' ');
    const students = editing
      ? store.students.map((s) => (s.studentId === next.studentId ? next : s))
      : [...store.students, next];
    await save({ ...store, students });
    setEditing(null);
    event.currentTarget.reset();
  }

  if (loading) return <Loading />;

  return (
    <>
      <div className="toolbar">
        <h1>Students</h1>
        <Input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <form className="hlc-card form-grid" onSubmit={onSubmit}>
        <Field label="First name">
          <Input name="firstName" defaultValue={editing?.firstName} required />
        </Field>
        <Field label="Middle name">
          <Input name="middleName" defaultValue={editing?.middleName} />
        </Field>
        <Field label="Last name">
          <Input name="lastName" defaultValue={editing?.lastName} required />
        </Field>
        <Field label="Birthdate">
          <Input name="birthdate" type="date" defaultValue={editing?.birthdate} />
        </Field>
        <Field label="Age">
          <Input name="age" type="number" defaultValue={editing?.age || 0} />
        </Field>
        <Field label="Program">
          <Input name="program" defaultValue={editing?.program} />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={editing?.status || 'active'}>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </Select>
        </Field>
        <Field label="Contact">
          <Input name="contactNumber" defaultValue={editing?.contactNumber} />
        </Field>
        <div>
          <Button type="submit">{editing ? 'Save student' : 'Add student'}</Button>
        </div>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No students" hint="Add a learner or adjust search." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Program</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.studentId}>
                <td>{studentDisplay(row)}</td>
                <td>{row.program}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>
                  <Button variant="ghost" type="button" onClick={() => setEditing(row)}>
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
