import { useEffect, useRef, useState } from 'react';
import { EXPENSE_CATEGORIES, INCOME_BUCKETS, expenseCategoryLabel, formatPeso, incomeBucketLabel, type CashFlowLine } from '@hiraya/utils';

export type CashFlowDraft = {
  id?: string;
  date: string;
  kind: 'income' | 'expense';
  category: string;
  detail: string;
  amount: string;
  party: string;
  handledBy: string;
  note: string;
};

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function blankDraft(): CashFlowDraft {
  return {
    date: todayKey(),
    kind: 'expense',
    category: 'rent_bills',
    detail: '',
    amount: '',
    party: '',
    handledBy: '',
    note: '',
  };
}

function draftFromLine(line: CashFlowLine): CashFlowDraft {
  return {
    id: line.id,
    date: line.date,
    kind: line.kind,
    category: line.category,
    detail: line.detail,
    amount: String(line.amount || ''),
    party: line.party,
    handledBy: line.handledBy,
    note: line.note,
  };
}

function categoryName(kind: string, id: string) {
  return kind === 'income' ? incomeBucketLabel(id) : expenseCategoryLabel(id);
}

function sourceLabel(source: CashFlowLine['source']) {
  if (source === 'payment') return 'Student payment';
  if (source === 'salary') return 'Teacher pay';
  return 'Entered here';
}

const TEACHER_SALARY = 'teacher_salary';

function withPatch(current: CashFlowDraft, patch: Partial<CashFlowDraft>, teachers: string[]): CashFlowDraft {
  const kind = patch.kind || current.kind;
  let category = patch.category || current.category;
  if (patch.kind && patch.kind !== current.kind) category = kind === 'income' ? 'other' : 'rent_bills';
  let detail = patch.detail !== undefined ? patch.detail : current.detail;
  if (category !== current.category && category === TEACHER_SALARY) detail = teachers.includes(current.detail) ? current.detail : '';
  else if (category !== current.category && current.category === TEACHER_SALARY) detail = '';
  return { ...current, ...patch, kind, category, detail };
}

export function CashFlowSheet({
  monthLabel,
  lines,
  teachers = [],
  busy,
  onSave,
  onRemove,
}: {
  monthLabel: string;
  lines: CashFlowLine[];
  teachers?: string[];
  busy?: boolean;
  onSave: (draft: CashFlowDraft) => Promise<void> | void;
  onRemove: (id: string) => Promise<void> | void;
}) {
  const [drafts, setDrafts] = useState<Record<string, CashFlowDraft>>({});
  const [fresh, setFresh] = useState<CashFlowDraft>(blankDraft);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const income = lines.filter((row) => row.kind === 'income').reduce((sum, row) => sum + row.amount, 0);
  const expenses = lines.filter((row) => row.kind === 'expense').reduce((sum, row) => sum + row.amount, 0);

  useEffect(() => {
    const next: Record<string, CashFlowDraft> = {};
    for (const line of lines) {
      if (line.source === 'book') next[line.id] = draftFromLine(line);
    }
    setDrafts(next);
  }, [lines]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      setEdges({
        left: el.scrollLeft > 6,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 6,
      });
    };
    measure();
    el.addEventListener('scroll', measure);
    window.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [lines]);

  function updateDraft(id: string, patch: Partial<CashFlowDraft>) {
    setDrafts((current) => {
      const row = current[id];
      if (!row) return current;
      return { ...current, [id]: withPatch(row, patch, teachers) };
    });
  }

  function download() {
    const header = ['Date', 'Type', 'Category', 'Details', 'Amount', 'From / To', 'Handled by', 'Note', 'Source'];
    const body = lines.map((row) =>
      [row.date, row.kind === 'income' ? 'Income' : 'Expense', categoryName(row.kind, row.category), row.detail, String(row.amount), row.party, row.handledBy, row.note, sourceLabel(row.source)]
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [header.join(','), ...body].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `Hiraya cash flow ${monthLabel}.csv`;
    link.click();
    URL.revokeObjectURL(href);
  }

  return (
    <section className="panel cash-sheet">
      <div className="cash-sheet-head">
        <div>
          <h2>Cash flow sheet · {monthLabel}</h2>
          <p>Type each income or expense on its own row. Student payments and teacher salary are already listed from those records.</p>
        </div>
        <button
          type="button"
          className="hlc-btn hlc-btn-ghost cash-download"
          onClick={download}
          disabled={lines.length === 0}
          title={lines.length === 0 ? 'Add a cash row before downloading.' : 'Download this month as a spreadsheet'}
        >
          Download Excel
        </button>
      </div>
      <p className="cash-legend">
        <span className="cash-swatch income" title="Income" />
        Income
        <span className="cash-swatch expense" title="Expense" />
        Expense
      </p>
      <div ref={scrollRef} className={['cash-sheet-scroll', edges.left ? 'has-back' : '', edges.right ? 'has-more' : ''].filter(Boolean).join(' ')}>
        <table className="cash-grid">
          <colgroup>
            <col className="cash-col-date" />
            <col className="cash-col-type" />
            <col className="cash-col-category" />
            <col className="cash-col-detail" />
            <col className="cash-col-amount" />
            <col className="cash-col-party" />
            <col className="cash-col-by" />
            <col className="cash-col-more" />
            <col className="cash-col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Category</th>
              <th>Details</th>
              <th>Amount</th>
              <th>From / to</th>
              <th>By</th>
              <th />
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) =>
              line.source === 'book' && drafts[line.id] ? (
                <EditableRow
                  key={line.id}
                  draft={drafts[line.id]}
                  teachers={teachers}
                  busy={busy}
                  onChange={(patch) => updateDraft(line.id, patch)}
                  onSave={() => void onSave(drafts[line.id])}
                  onRemove={() => void onRemove(line.id)}
                />
              ) : (
                <ReadOnlyRow key={`${line.source}-${line.id}`} line={line} />
              ),
            )}
            <EditableRow
              draft={fresh}
              teachers={teachers}
              busy={busy}
              fresh
              onChange={(patch) => setFresh((current) => withPatch(current, patch, teachers))}
              onSave={async () => {
                await onSave(fresh);
                setFresh(blankDraft());
              }}
            />
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Income ₱{formatPeso(income)}</td>
              <td colSpan={3}>Expenses ₱{formatPeso(expenses)}</td>
              <td colSpan={2}>Net ₱{formatPeso(Math.round((income - expenses) * 100) / 100)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function ReadOnlyRow({ line }: { line: CashFlowLine }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className={line.kind === 'income' ? 'cash-income' : 'cash-expense'} title={line.kind === 'income' ? 'Income' : 'Expense'}>
        <td>{line.date}</td>
        <td>{line.kind === 'income' ? 'Income' : 'Expense'}</td>
        <td>{categoryName(line.kind, line.category)}</td>
        <td>{line.detail}</td>
        <td>₱{formatPeso(line.amount)}</td>
        <td>{line.party}</td>
        <td>{line.handledBy}</td>
        <td className="cash-more-cell">
          <MoreButton open={open} onToggle={() => setOpen((value) => !value)} />
        </td>
        <td />
      </tr>
      {open ? (
        <tr className="cash-more-row">
          <td colSpan={9}>
            <div className="cash-more-fields">
              <p>Note <strong>{line.note || 'None'}</strong></p>
              <p>Source <strong>{sourceLabel(line.source)}</strong></p>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function MoreButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={open ? 'cash-more is-open' : 'cash-more'} aria-expanded={open} aria-label="Note and source" title="Note and source" onClick={onToggle}>
      ⋯
    </button>
  );
}

function EditableRow({
  draft,
  teachers,
  busy,
  fresh,
  onChange,
  onSave,
  onRemove,
}: {
  draft: CashFlowDraft;
  teachers: string[];
  busy?: boolean;
  fresh?: boolean;
  onChange: (patch: Partial<CashFlowDraft>) => void;
  onSave: () => void;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const options = draft.kind === 'income' ? INCOME_BUCKETS : EXPENSE_CATEGORIES;
  return (
    <>
    <tr className={draft.kind === 'income' ? 'cash-income' : 'cash-expense'} title={draft.kind === 'income' ? 'Income' : 'Expense'}>
      <td>
        <input className="cash-cell" type="date" value={draft.date} disabled={busy} onChange={(event) => onChange({ date: event.target.value })} />
      </td>
      <td>
        <select className="cash-cell cash-type" title={draft.kind === 'income' ? 'Income' : 'Expense'} value={draft.kind} disabled={busy} onChange={(event) => onChange({ kind: event.target.value === 'income' ? 'income' : 'expense' })}>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
      </td>
      <td>
        <select className="cash-cell cash-category" title={categoryName(draft.kind, draft.category)} value={draft.category} disabled={busy} onChange={(event) => onChange({ category: event.target.value })}>
          {options.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
        </select>
      </td>
      <td>
        {draft.kind === 'expense' && draft.category === TEACHER_SALARY ? (
          <select className="cash-cell cash-detail" title={draft.detail || (teachers.length ? 'Choose a teacher' : 'No teachers yet')} value={teachers.includes(draft.detail) ? draft.detail : ''} disabled={busy} onChange={(event) => onChange({ detail: event.target.value })}>
            <option value="">{teachers.length ? 'Choose a teacher' : 'No teachers yet'}</option>
            {teachers.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        ) : (
          <input className="cash-cell cash-detail" title={draft.detail || 'What this line is'} value={draft.detail} placeholder={fresh ? 'Line item' : ''} disabled={busy} onChange={(event) => onChange({ detail: event.target.value })} />
        )}
      </td>
      <td>
        <label className="peso-field cash-peso">
          <span aria-hidden="true">₱</span>
          <input aria-label="Amount" type="number" min="0" step="0.01" value={draft.amount} placeholder="0.00" disabled={busy} onChange={(event) => onChange({ amount: event.target.value })} />
        </label>
      </td>
      <td>
        <input className="cash-cell cash-party" title={draft.party || 'From or paid to'} value={draft.party} placeholder="Name" disabled={busy} onChange={(event) => onChange({ party: event.target.value })} />
      </td>
      <td>
        <input className="cash-cell cash-handled" title={draft.handledBy || 'Who handled it'} value={draft.handledBy} placeholder="Name" disabled={busy} onChange={(event) => onChange({ handledBy: event.target.value })} />
      </td>
      <td className="cash-more-cell">
        <MoreButton open={open} onToggle={() => setOpen((value) => !value)} />
      </td>
      <td className="cash-actions">
        <button type="button" className="hlc-btn hlc-btn-primary" disabled={busy} onClick={onSave}>
          {fresh ? 'Add row' : 'Save'}
        </button>
        {onRemove ? (
          <button type="button" className="hlc-btn hlc-btn-icon cash-remove" aria-label="Remove row" title="Remove row" disabled={busy} onClick={onRemove}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
            </svg>
          </button>
        ) : null}
      </td>
    </tr>
    {open ? (
      <tr className="cash-more-row">
        <td colSpan={9}>
          <div className="cash-more-fields">
            <label>
              Note
              <input value={draft.note} disabled={busy} onChange={(event) => onChange({ note: event.target.value })} />
            </label>
            <p>Source <strong>{fresh ? 'New row' : 'Entered here'}</strong></p>
          </div>
        </td>
      </tr>
    ) : null}
    </>
  );
}
