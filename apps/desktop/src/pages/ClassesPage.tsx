import type { HirayaDatabase, LearningClass } from '@hiraya/types';
import { displayName, newId } from '@hiraya/utils';
import { Button, Field, Input, Select } from '@hiraya/ui';
import { FormEvent, useState } from 'react';
import { EditorModal, FormSection } from '../components/EditorModal';
import { RecordTable, StatusCell, assigned } from '../components/RecordTable';
import { teacherOptions } from '../lib/crud';
import { PAGE_COPY } from '../lib/views';

export function ClassesPage({
  store,
  saveStore,
}: {
  store: HirayaDatabase;
  saveStore: (next: HirayaDatabase) => Promise<void>;
}) {
  const [editing, setEditing] = useState<LearningClass | null | 'new'>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = editing && editing !== 'new' ? editing : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const next: LearningClass = {
      classId: current?.classId || newId('cls'),
      name: String(form.get('name') || '').trim(),
      programId: String(form.get('programId') || ''),
      teacherId: String(form.get('teacherId') || ''),
      room: String(form.get('room') || ''),
      capacity: Number(form.get('capacity') || 0),
      scheduleNotes: String(form.get('scheduleNotes') || ''),
      status: String(form.get('status') || 'active'),
    };
    setBusy(true);
    setError(null);
    try {
      await saveStore({
        ...store,
        classes: current
          ? store.classes.map((item) => (item.classId === next.classId ? next : item))
          : [...store.classes, next],
      });
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save class');
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: LearningClass) {
    const used = store.enrollments.some((item) => item.classId === row.classId && item.status === 'active');
    if (used) {
      if (!window.confirm('This class has enrollments. Archive it instead of deleting?')) return;
      await saveStore({
        ...store,
        classes: store.classes.map((item) =>
          item.classId === row.classId ? { ...item, status: 'archived' } : item,
        ),
      });
      return;
    }
    if (!window.confirm(`Delete class ${row.name}?`)) return;
    await saveStore({
      ...store,
      classes: store.classes.filter((item) => item.classId !== row.classId),
    });
  }

  return (
    <>
      <RecordTable
        title={PAGE_COPY.classes.title}
        description="Create class groups, set capacity, assign a teacher and program, then use them when approving enrollment."
        rows={store.classes}
        rowKey={(row) => row.classId}
        search={(row, q) => `${row.name} ${row.room}`.toLowerCase().includes(q)}
        searchPlaceholder="Search classes"
        emptyTitle="No classes found"
        emptyHint="Add a class after you have a program and teacher."
        statusOf={(row) => row.status}
        actions={
          <Button type="button" onClick={() => setEditing('new')}>
            Add class
          </Button>
        }
        columns={[
          { key: 'name', header: 'Class', render: (row) => row.name },
          {
            key: 'program',
            header: 'Program',
            render: (row) => assigned(store.programs.find((item) => item.programId === row.programId)?.name),
          },
          {
            key: 'teacher',
            header: 'Teacher',
            render: (row) => assigned(displayName(store.users.find((item) => item.userId === row.teacherId))),
          },
          { key: 'room', header: 'Room', render: (row) => assigned(row.room) },
          { key: 'cap', header: 'Capacity', render: (row) => row.capacity },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
          {
            key: 'actions',
            header: '',
            render: (row) => (
              <div className="row-actions">
                <Button type="button" variant="ghost" onClick={() => setEditing(row)}>
                  Edit
                </Button>
                <Button type="button" variant="danger" onClick={() => void remove(row)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />
      {editing ? (
        <EditorModal
          title={current ? `Edit ${current.name}` : 'Add class'}
          error={error}
          busy={busy}
          submitLabel={current ? 'Save class' : 'Create class'}
          onClose={() => setEditing(null)}
          onSubmit={onSubmit}
        >
          <FormSection title="Class details">
            <Field label="Class name" required>
              <Input name="name" defaultValue={current?.name} required />
            </Field>
            <Field label="Program" required>
              <Select name="programId" defaultValue={current?.programId || ''} required>
                <option value="">Select program</option>
                {store.programs.map((program) => (
                  <option key={program.programId} value={program.programId}>
                    {program.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Teacher" optional>
              <Select name="teacherId" defaultValue={current?.teacherId || ''}>
                <option value="">Unassigned</option>
                {teacherOptions(store).map((teacher) => (
                  <option key={teacher.userId} value={teacher.userId}>
                    {displayName(teacher)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Room" optional>
              <Input name="room" defaultValue={current?.room} />
            </Field>
            <Field label="Capacity" optional>
              <Input name="capacity" type="number" min={0} defaultValue={current?.capacity ?? 15} />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={current?.status || 'active'}>
                <option value="active">active</option>
                <option value="archived">archived</option>
              </Select>
            </Field>
            <div className="form-span">
              <Field label="Schedule notes" optional>
                <Input name="scheduleNotes" defaultValue={current?.scheduleNotes} />
              </Field>
            </div>
          </FormSection>
        </EditorModal>
      ) : null}
    </>
  );
}
