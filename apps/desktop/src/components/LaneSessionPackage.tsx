import type { HirayaDatabase } from '@hiraya/types';
import { Button } from '@hiraya/ui';
import { assignLaneSessionPackage, laneLabel, programForLane, type ManagementLaneId } from '@hiraya/utils';
import { useEffect, useState } from 'react';

export function LaneSessionPackage({
  store,
  lane,
  saveStore,
}: {
  store: HirayaDatabase;
  lane: ManagementLaneId;
  saveStore: (next: HirayaDatabase) => Promise<void>;
}) {
  const label = laneLabel(lane, store) || 'This program';
  const savedCount = programForLane(store, lane)?.packageSessions || 0;
  const saved = savedCount > 0 ? String(savedCount) : '';
  const [value, setValue] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setValue(saved);
  }, [saved, lane]);

  async function save() {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await saveStore(assignLaneSessionPackage(store, lane, value));
      setMessage(`${label} package saved.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the session package.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="lane-session-package"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label>
        Sessions in package
        <input
          aria-label={`${label} sessions in package`}
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          placeholder="10"
          value={value}
          disabled={busy}
          onChange={(event) => {
            setMessage('');
            setError('');
            setValue(event.target.value);
          }}
        />
      </label>
      <Button type="submit" disabled={busy || !value.trim() || value.trim() === saved}>
        {busy ? 'Saving…' : 'Save package'}
      </Button>
      <p className={error ? 'form-error' : message ? 'form-ok' : undefined}>
        {error || message || `${label} is one package for every learner in this program. Sessions already used stay used.`}
      </p>
    </form>
  );
}
