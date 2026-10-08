import { useMemo, useState } from 'react';
import { expenseCategoryLabel, formatPeso, incomeBucketLabel, type CashFlowLine } from '@hiraya/utils';

function categoryName(kind: string, id: string) {
  return kind === 'income' ? incomeBucketLabel(id) : expenseCategoryLabel(id);
}

export function FinanceLinesDelete({
  lines,
  busy,
  onDelete,
}: {
  lines: CashFlowLine[];
  busy?: boolean;
  onDelete: (ids: string[]) => Promise<void> | void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const ids = useMemo(() => lines.map((row) => row.id), [lines]);
  const allOn = ids.length > 0 && ids.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allOn ? new Set() : new Set(ids));
  }

  async function removeSelected() {
    const idsToDrop = ids.filter((id) => selected.has(id));
    if (!idsToDrop.length) return;
    if (!window.confirm(`Delete ${idsToDrop.length === 1 ? 'this line' : `${idsToDrop.length} lines`} from income and expenses?`)) {
      return;
    }
    await onDelete(idsToDrop);
    setSelected(new Set());
  }

  return (
    <div className="finance-lines">
      <div className="finance-lines-bar">
        <label className="finance-lines-check">
          <input type="checkbox" checked={allOn} disabled={!ids.length || busy} onChange={toggleAll} aria-label="Select all income and expense lines" />
          Select
        </label>
        <button type="button" className="hlc-btn hlc-btn-danger" disabled={busy || selected.size === 0} onClick={() => void removeSelected()}>
          Delete
        </button>
        <span className="finance-lines-count">
          {selected.size ? `${selected.size} selected` : lines.length ? `${lines.length} this month` : 'No lines this month'}
        </span>
      </div>
      {lines.length ? (
        <div className="table-scroll">
          <table className="finance-lines-table">
            <thead>
              <tr>
                <th className="col-check" />
                <th>Date</th>
                <th>Type</th>
                <th>Details</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={`${line.source}-${line.id}`}>
                  <td className="col-check">
                    <input
                      type="checkbox"
                      checked={selected.has(line.id)}
                      disabled={busy}
                      aria-label={`Select ${line.detail || line.id}`}
                      onChange={() => toggle(line.id)}
                    />
                  </td>
                  <td>{line.date}</td>
                  <td>{line.kind === 'income' ? 'Income' : 'Expense'}</td>
                  <td>
                    {line.detail || categoryName(line.kind, line.category)}
                  </td>
                  <td>₱{formatPeso(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
