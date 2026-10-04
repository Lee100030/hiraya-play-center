import type { HirayaDatabase, Schedule } from '@hiraya/types';
import { displayName, localDateKey, newId } from '@hiraya/utils';
import { Button } from '@hiraya/ui';
import { useMemo, useState } from 'react';
import { DeskModal } from './DeskModal';

const SLOT_WINDOWS = [
  ['08:00', '10:30'],
  ['10:30', '11:30'],
  ['11:30', '13:30'],
  ['13:30', '15:00'],
  ['15:00', '16:30'],
  ['16:30', '17:00'],
] as const;

function dayTitle(day: string) {
  const date = new Date(`${day}T12:00:00`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function teacherHead(name: string) {
  const first = name.trim().split(/\s+/)[0] || 'Teacher';
  return /^t['’]/i.test(first) ? first : `T' ${first}`;
}

function cellTone(text: string) {
  const value = text.trim().toLowerCase();
  if (!value) return 'empty';
  if (value === 'off' || value.startsWith('off\n') || value.startsWith('off ')) return 'off';
  if (value.includes('playgroup')) return 'play';
  if (value.includes('pre-k') || value.includes('prek') || value.includes('pre k')) return 'prek';
  if (value.includes('lunch')) return 'lunch';
  if (value.includes('tutorial')) return 'tutor';
  if (value.includes('clean') || value.includes('prep') || value.includes('pack')) return 'chore';
  return 'note';
}

function slotClock(index: number) {
  const preset = SLOT_WINDOWS[index];
  if (preset) return preset;
  const startHour = 17 + (index - SLOT_WINDOWS.length);
  const pad = (n: number) => String(n).padStart(2, '0');
  return [`${pad(startHour)}:00`, `${pad(startHour + 1)}:00`] as const;
}

function boardRows(store: HirayaDatabase, day: string, teacherIds: string[]) {
  const saved = (store.schedules || []).filter(
    (row) => row.kind === 'dayBoard' && row.status !== 'cancelled' && localDateKey(row.startAt) === day,
  );
  let count: number = SLOT_WINDOWS.length;
  for (const row of saved) {
    if ((row.room || '').startsWith('slot:')) count = Math.max(count, Number(row.room.slice(5)) + 1);
  }
  const cells: Record<string, string[]> = {};
  for (const id of teacherIds) cells[id] = Array.from({ length: count }, () => '');
  for (const row of saved) {
    const id = (row.teacherId || '').split(',')[0]?.trim();
    if (!id || !cells[id]) continue;
    const slot = (row.room || '').startsWith('slot:') ? Number(row.room.slice(5)) : 0;
    if (!Number.isFinite(slot) || slot < 0) continue;
    cells[id][slot] = row.notes || row.title || '';
  }
  return cells;
}

export function DayScheduleBoard({
  day,
  store,
  saveStore,
  onClose,
}: {
  day: string;
  store: HirayaDatabase;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onClose: () => void;
}) {
  const teachers = useMemo(
    () =>
      store.users
        .filter((item) => item.role === 'teacher' && (item.status || 'active') !== 'inactive')
        .slice()
        .sort((a, b) => displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base' })),
    [store.users],
  );
  const [cells, setCells] = useState<Record<string, string[]>>(() =>
    boardRows(
      store,
      day,
      teachers.map((item) => item.userId),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rowCount = Math.max(1, ...Object.values(cells).map((column) => column.length));

  function setCell(teacherId: string, index: number, value: string) {
    setCells((current) => ({
      ...current,
      [teacherId]: (current[teacherId] || Array.from({ length: rowCount }, () => '')).map((cell, cellIndex) =>
        cellIndex === index ? value : cell,
      ),
    }));
  }

  function addRow() {
    setCells((current) => {
      const next: Record<string, string[]> = {};
      for (const teacher of teachers) next[teacher.userId] = [...(current[teacher.userId] || []), ''];
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const kept = (store.schedules || []).filter(
        (row) => !(row.kind === 'dayBoard' && localDateKey(row.startAt) === day),
      );
      const added: Schedule[] = [];
      for (const teacher of teachers) {
        const column = cells[teacher.userId] || [];
        column.forEach((raw, index) => {
          const text = raw.trim();
          if (!text) return;
          const [start, end] = slotClock(index);
          added.push({
            scheduleId: newId('sch'),
            title: text.split('\n')[0].slice(0, 80),
            kind: 'dayBoard',
            scheduleType: 'dayBoard',
            classId: '',
            studentId: '',
            teacherId: teacher.userId,
            programId: '',
            startAt: `${day}T${start}:00`,
            endAt: `${day}T${end}:00`,
            room: `slot:${index}`,
            notes: text,
            status: 'confirmed',
          });
        });
      }
      await saveStore({ ...store, schedules: [...kept, ...added] });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this day.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <DeskModal
      title={dayTitle(day)}
      size="board"
      onClose={() => !busy && onClose()}
      actions={
        <>
          <Button type="button" variant="ghost" disabled={busy} onClick={addRow}>
            Add row
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
            Close
          </Button>
          <Button type="button" disabled={busy || teachers.length === 0} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save day'}
          </Button>
        </>
      }
    >
      {teachers.length === 0 ? (
        <p>Add teachers first, then this day can be filled in.</p>
      ) : (
        <div className="day-board-scroll">
          <table className="day-board">
            <thead>
              <tr>
                {teachers.map((teacher) => (
                  <th key={teacher.userId} scope="col">
                    {teacherHead(displayName(teacher))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rowCount }, (_, index) => (
                <tr key={index}>
                  {teachers.map((teacher) => {
                    const value = cells[teacher.userId]?.[index] || '';
                    return (
                      <td key={teacher.userId} className={`day-cell is-${cellTone(value)}`}>
                        <textarea
                          aria-label={`${teacherHead(displayName(teacher))} row ${index + 1}`}
                          value={value}
                          placeholder="OFF"
                          rows={3}
                          onChange={(event) => setCell(teacher.userId, index, event.target.value)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="day-board-hint">Type each duty in the teacher’s column. OFF, Playgroup, Pre K, lunch, and tutorial each keep their own color.</p>
      {error ? <p className="hlc-field-error">{error}</p> : null}
    </DeskModal>
  );
}
