'use client';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useStore } from '@/components/StoreProvider';
import { Button, CashFlowSheet, EmptyState, FinanceLinesDelete, Loading, type CashFlowDraft } from '@hiraya/ui';
import {
  cashFlowLines,
  cashFlowTeacherNames,
  currentMonthKey,
  financeMonth,
  formatPeso,
  incomeBucketLabel,
  remittanceForDay,
  removeCashFlowLine,
  scrubLeftoverCenterRecords,
  upsertCenterExpense,
  upsertOpeningBalance,
} from '@hiraya/utils';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

function newId() {
  return `exp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function AdminExpensesPage() {
  const { store, loading, save } = useStore();
  const [month, setMonth] = useState(currentMonthKey);
  const [day, setDay] = useState(todayKey);
  const [opening, setOpening] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const book = financeMonth(store, month);
  const lines = useMemo(() => cashFlowLines(store, book.month), [store, book.month]);
  const teachers = useMemo(() => cashFlowTeacherNames(store), [store]);
  const remittance = remittanceForDay(store, day);
  const scrubbedLeftovers = useRef(false);

  useEffect(() => {
    setOpening(book.opening ? String(book.opening) : '');
  }, [book.month, book.opening]);

  useEffect(() => {
    if (loading || scrubbedLeftovers.current) return;
    const next = scrubLeftoverCenterRecords(store);
    if (!next) return;
    scrubbedLeftovers.current = true;
    void save(next).catch(() => {
      scrubbedLeftovers.current = false;
    });
  }, [loading, store, save]);

  async function saveOpening(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await save(upsertOpeningBalance(store, book.month, opening));
      setMessage('Opening cash saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save opening cash.');
    } finally {
      setBusy(false);
    }
  }

  async function saveLine(draft: CashFlowDraft) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const now = new Date().toISOString();
      const existing = (store.centerExpenses || []).find((row) => row.expenseId === draft.id);
      await save(
        upsertCenterExpense(store, {
          expenseId: draft.id || newId(),
          expenseDate: draft.date || todayKey(),
          item: draft.detail,
          category: draft.category,
          amount: Number(draft.amount || 0),
          paidTo: draft.party,
          paidBy: draft.handledBy,
          note: draft.note,
          kind: draft.kind,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        }),
      );
      setMessage(draft.id ? 'Row saved.' : 'Row added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that row.');
    } finally {
      setBusy(false);
    }
  }

  async function removeLine(expenseId: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await save(removeCashFlowLine(store, expenseId));
      setMessage('Row removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that row.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <div className="finance-page">
      <AdminPageHeader
        kicker="Records"
        title="Center Cash flow"
        description="One sheet for every income and expense line. Student tuition stays on Payments and is listed here. A uniform a parent pays is income. A uniform the center buys is an expense."
      />
      <label>
        Month
        <input type="month" value={book.month} onChange={(event) => setMonth(event.target.value)} />
      </label>
      {message ? <p className="form-ok">{message}</p> : null}
      {error ? <p className="hlc-field-error">{error}</p> : null}
      <div className="finance-kpis">
        <article>
          <p>Income</p>
          <strong>₱{formatPeso(book.income)}</strong>
        </article>
        <article>
          <p>Expenses</p>
          <strong>₱{formatPeso(book.expenses)}</strong>
        </article>
        <article>
          <p>Net</p>
          <strong>₱{formatPeso(book.net)}</strong>
        </article>
      </div>
      <FinanceLinesDelete
        lines={lines}
        busy={busy}
        onDelete={async (ids) => {
          setBusy(true);
          setError('');
          setMessage('');
          try {
            let next = store;
            for (const id of ids) {
              try {
                next = removeCashFlowLine(next, id);
              } catch {
                /* already gone */
              }
            }
            await save(next);
            setMessage(ids.length === 1 ? 'Row removed from income and expenses.' : `${ids.length} rows removed from income and expenses.`);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not remove those rows.');
          } finally {
            setBusy(false);
          }
        }}
      />
      <form className="lane-session-package cash-opening" onSubmit={(event) => void saveOpening(event)}>
        <label>
          Opening cash for {book.label}
          <span className="peso-field">
            <span aria-hidden="true">₱</span>
            <input
              aria-label={`Opening cash for ${book.label}`}
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={opening}
              disabled={busy}
              onChange={(event) => setOpening(event.target.value)}
            />
          </span>
        </label>
        <Button type="submit" className="cash-opening-save" disabled={busy}>
          Save opening cash
        </Button>
        <p>Carried cash from the previous month. It is shown on the dashboard and is not counted as a new sale.</p>
      </form>
      <CashFlowSheet monthLabel={book.label} lines={lines} teachers={teachers} busy={busy} onSave={saveLine} onRemove={removeLine} />
      <section className="hlc-card">
        <h2>Daily remittance</h2>
        <label>
          Day
          <input type="date" value={day} onChange={(event) => setDay(event.target.value)} />
        </label>
        {remittance.length === 0 ? (
          <div className="cash-empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 10h18M8 15h3" />
            </svg>
            <EmptyState title="No remittance this day" hint="Counted student payments for the selected day will show here." />
          </div>
        ) : (
          <table className="tuition-table">
            <thead>
              <tr>
                <th>Received by</th>
                <th>Buckets</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {remittance.map((row) => (
                <tr key={row.receivedBy}>
                  <td>{row.receivedBy}</td>
                  <td>
                    {Object.entries(row.buckets)
                      .map(([id, amount]) => `${incomeBucketLabel(id)} ₱${formatPeso(amount)}`)
                      .join(' · ')}
                  </td>
                  <td>₱{formatPeso(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
