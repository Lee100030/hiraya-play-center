'use client';

import { AdminModal } from '@/components/admin/AdminModal';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useStore } from '@/components/StoreProvider';
import { Button, Field, Loading, Select, Textarea } from '@hiraya/ui';
import {
  ABA_SLOTS,
  abaCellKey,
  abaCellLines,
  abaCellTone,
  abaStudents,
  abaTherapistLabel,
  abaTherapists,
  abaWeekDates,
  abaWeekRangeLabel,
  abaWeekdayLabel,
  addDays,
  displayName,
  mondayOf,
  readAbaWeek,
  sessionLeftFor,
  studentDisplay,
  writeAbaWeek,
  type AbaCell,
  type AbaCellKind,
} from '@hiraya/utils';
import { FormEvent, useEffect, useMemo, useState } from 'react';

function cloneAbaCells(source: Record<string, AbaCell>) {
  return Object.fromEntries(Object.entries(source).map(([key, cell]) => [key, { ...cell }]));
}

export default function AdminAbaSchedulePage() {
  const { store, loading, save } = useStore();
  const therapists = useMemo(() => abaTherapists(store), [store]);
  const students = useMemo(() => abaStudents(store), [store]);
  const [teacherId, setTeacherId] = useState('');
  const [monday, setMonday] = useState(() => mondayOf());
  const [cells, setCells] = useState<Record<string, AbaCell>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{ day: string; slotId: string } | null>(null);
  const [undoStack, setUndoStack] = useState<Record<string, AbaCell>[]>([]);
  const days = useMemo(() => abaWeekDates(monday), [monday]);
  const therapist = store.users.find((item) => item.userId === teacherId);
  const editSlot = editing ? ABA_SLOTS.find((item) => item.id === editing.slotId) : undefined;
  const editCell = editing ? cells[abaCellKey(editing.day, editing.slotId)] : undefined;

  useEffect(() => {
    if (!teacherId && therapists[0]) setTeacherId(therapists[0].userId);
  }, [teacherId, therapists]);

  useEffect(() => {
    if (!teacherId) return;
    setCells(readAbaWeek(store, teacherId, monday));
    setUndoStack([]);
  }, [teacherId, monday]);

  useEffect(() => {
    if (!teacherId) return;
    setCells(readAbaWeek(store, teacherId, monday));
  }, [store, teacherId, monday]);

  async function persist(nextCells: Record<string, AbaCell>) {
    if (!teacherId) return;
    setBusy(true);
    setError('');
    try {
      await save({ ...store, schedules: writeAbaWeek(store, teacherId, monday, nextCells) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this ABA week.');
      setCells(readAbaWeek(store, teacherId, monday));
    } finally {
      setBusy(false);
    }
  }

  function applyCells(nextCells: Record<string, AbaCell>) {
    setUndoStack((stack) => [...stack.slice(-19), cloneAbaCells(cells)]);
    setCells(nextCells);
    void persist(nextCells);
  }

  function undoLast() {
    const prior = undoStack[undoStack.length - 1];
    if (!prior || busy) return;
    setUndoStack((stack) => stack.slice(0, -1));
    setCells(prior);
    void persist(prior);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z' || event.shiftKey) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      event.preventDefault();
      undoLast();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function setCell(day: string, slotId: string, cell: AbaCell) {
    applyCells({ ...cells, [abaCellKey(day, slotId)]: cell });
  }

  function markDayOff(day: string) {
    if (!window.confirm(`Mark ${abaWeekdayLabel(day)} OFF for every ABA slot? Use Undo if this is a mistake.`)) return;
    const next = { ...cells };
    for (const slot of ABA_SLOTS) {
      if (slot.kind === 'break') continue;
      next[abaCellKey(day, slot.id)] = { kind: 'off', studentId: '', notes: '', status: 'off' };
    }
    applyCells(next);
  }

  function clearDay(day: string) {
    if (!window.confirm(`Clear ${abaWeekdayLabel(day)} back to empty slots?`)) return;
    const next = { ...cells };
    for (const slot of ABA_SLOTS) {
      if (slot.kind === 'break') continue;
      next[abaCellKey(day, slot.id)] = { kind: 'empty', studentId: '', notes: '', status: 'confirmed' };
    }
    applyCells(next);
  }

  async function onEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !editSlot || editSlot.kind === 'break') return;
    const form = new FormData(event.currentTarget);
    const kind = String(form.get('kind') || 'session') as AbaCellKind;
    const studentId = String(form.get('studentId') || '');
    const notes = String(form.get('notes') || '').trim();
    if ((kind === 'session' || kind === 'makeup') && !studentId) {
      setError('Pick the student for this ABA slot.');
      return;
    }
    const cell: AbaCell =
      kind === 'off'
        ? { kind: 'off', studentId: '', notes, status: 'off' }
        : kind === 'prep'
          ? { kind: 'prep', studentId: '', notes, status: 'confirmed' }
          : kind === 'makeup'
            ? { kind: 'makeup', studentId, notes, status: 'pending_approval' }
            : { kind: 'session', studentId, notes, status: 'confirmed' };
    setEditing(null);
    setCell(editing.day, editing.slotId, cell);
  }

  if (loading) return <Loading />;

  return (
    <>
      <AdminPageHeader
        kicker="Management"
        title="ABA schedule"
        description="Weekly ABA therapy board per therapist: 2-hour sessions, 30-minute breaks, prep, day-off, and makeup slots that wait for approval."
        actions={
          <>
            <Select value={teacherId} disabled={busy} onChange={(event) => setTeacherId(event.target.value)} aria-label="ABA therapist">
              {therapists.length === 0 ? <option value="">No therapists yet</option> : null}
              {therapists.map((item) => (
                <option key={item.userId} value={item.userId}>
                  {displayName(item)}
                </option>
              ))}
            </Select>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setMonday(addDays(monday, -7))}>
              Previous week
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setMonday(mondayOf())}>
              This week
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setMonday(addDays(monday, 7))}>
              Next week
            </Button>
            <Button type="button" disabled={busy || undoStack.length === 0} onClick={undoLast}>
              Undo
            </Button>
          </>
        }
      />
      {error ? <p className="hlc-field-error">{error}</p> : null}
      {!teacherId ? (
        <p>Add an ABA therapist in Teacher management, then plot this week.</p>
      ) : (
        <div className="aba-sheet">
          <header className="aba-sheet-head">
            <p>HIRAYA KIDS LEARNING CENTER</p>
            <h2>{abaTherapistLabel(therapist)}</h2>
            <p className="aba-sheet-range">{abaWeekRangeLabel(monday)}</p>
          </header>
          <div className="aba-sheet-scroll">
            <table>
              <thead>
                <tr>
                  <th>DAY</th>
                  {ABA_SLOTS.map((slot) => (
                    <th key={slot.id}>{slot.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day}>
                    <th scope="row">
                      <span>{abaWeekdayLabel(day)}</span>
                      <button type="button" className="aba-day-off" disabled={busy} onClick={() => markDayOff(day)}>
                        Mark OFF
                      </button>
                      <button type="button" className="aba-day-off" disabled={busy} onClick={() => clearDay(day)}>
                        Clear day
                      </button>
                    </th>
                    {ABA_SLOTS.map((slot) => {
                      const cell =
                        cells[abaCellKey(day, slot.id)] ||
                        ({ kind: slot.kind === 'break' ? 'break' : 'empty', studentId: '', notes: '', status: 'confirmed' } satisfies AbaCell);
                      const assigned = store.students.find((item) => item.studentId === cell.studentId);
                      return (
                        <td key={slot.id} className={`aba-cell is-${abaCellTone(cell, slot.kind)}`}>
                          <button
                            type="button"
                            disabled={slot.kind === 'break' || busy}
                            onClick={() => {
                              setError('');
                              setEditing({ day, slotId: slot.id });
                            }}
                          >
                            {abaCellLines(cell, assigned ? studentDisplay(assigned) : '').map((line) => (
                              <span key={line}>{line}</span>
                            ))}
                          </button>
                          {cell.kind === 'makeup' && cell.status !== 'approved' ? (
                            <button
                              type="button"
                              className="aba-approve"
                              disabled={busy}
                              onClick={() => setCell(day, slot.id, { ...cell, status: 'approved' })}
                            >
                              Approve
                            </button>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="aba-sheet-hint">
            2-hour ABA blocks with 30-minute lunch breaks. Undo reverses the last change (or press Ctrl+Z). Clear day removes
            an accidental OFF. Makeup stays for approval until confirmed. Plotting does not use a package session until
            attendance is taken.
          </p>
        </div>
      )}
      {editing && editSlot && editSlot.kind !== 'break' ? (
        <AdminModal
          title={`${abaWeekdayLabel(editing.day)} · ${editSlot.label}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setCell(editing.day, editing.slotId, { kind: 'empty', studentId: '', notes: '', status: 'confirmed' });
                  setEditing(null);
                }}
              >
                Clear slot
              </Button>
              <Button type="submit" form="aba-slot-form" disabled={busy}>
                Save slot
              </Button>
            </>
          }
        >
          <form id="aba-slot-form" className="form-grid" onSubmit={onEditSubmit}>
            <Field label="Type" required>
              <Select name="kind" defaultValue={editCell?.kind === 'empty' ? 'session' : editCell?.kind || 'session'}>
                <option value="session">Student session (2hrs)</option>
                <option value="prep">ABA PREP</option>
                <option value="off">OFF</option>
                <option value="makeup">Makeup (needs approval)</option>
              </Select>
            </Field>
            <Field label="Student" optional hint="Required for a session or makeup.">
              <Select name="studentId" defaultValue={editCell?.studentId || ''}>
                <option value="">None</option>
                {students.map((student) => {
                  const left = sessionLeftFor(store, student.studentId);
                  return (
                    <option key={student.studentId} value={student.studentId}>
                      {studentDisplay(student)}
                      {left.hasPackage ? ` · ${left.remaining} sessions left` : ''}
                    </option>
                  );
                })}
              </Select>
            </Field>
            <Field label="Notes" optional>
              <Textarea name="notes" defaultValue={editCell?.notes || ''} rows={4} />
            </Field>
          </form>
        </AdminModal>
      ) : null}
    </>
  );
}
