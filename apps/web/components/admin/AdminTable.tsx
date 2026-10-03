'use client';

import { Button } from '@hiraya/ui';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

export type AdminColumn<T> = {
  key: string;
  header: string;
  sortValue?: (row: T) => string | number;
  render: (row: T) => ReactNode;
  priority?: 'primary' | 'secondary';
};

export function AdminTable<T>({
  rows,
  columns,
  rowKey,
  renderCard,
  pageSize = 8,
  empty,
  onRowOpen,
  preferCards,
  selectable,
  onRefresh,
  cardName,
}: {
  rows: T[];
  columns: AdminColumn<T>[];
  rowKey: (row: T) => string;
  renderCard: (row: T) => ReactNode;
  pageSize?: number;
  empty?: ReactNode;
  onRowOpen?: (row: T) => void;
  preferCards?: boolean;
  selectable?: boolean;
  onRefresh?: () => void | Promise<void>;
  cardName?: (row: T) => string;
}) {
  const [sortKey, setSortKey] = useState(columns[0]?.key || '');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [layout, setLayout] = useState<'table' | 'cards'>(() => {
    if (!preferCards) return 'table';
    try {
      return localStorage.getItem('hiraya.peopleLayout') === 'table' ? 'table' : 'cards';
    } catch {
      return 'cards';
    }
  });

  useEffect(() => {
    if (!preferCards) return;
    try {
      localStorage.setItem('hiraya.peopleLayout', layout);
    } catch {
      /* ignore */
    }
  }, [layout, preferCards]);

  useEffect(() => {
    setSelected((current) => {
      const live = new Set(rows.map((row) => rowKey(row)));
      const next = new Set([...current].filter((key) => live.has(key)));
      return next.size === current.size ? current : next;
    });
  }, [rows, rowKey]);

  const sorted = useMemo(() => {
    const col = columns.find((item) => item.key === sortKey);
    const list = [...rows];
    if (!col?.sortValue) return list;
    list.sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return dir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [rows, columns, sortKey, dir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const slice = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) setDir((value) => (value === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setDir('asc');
    }
    setPage(0);
  }

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (rows.length === 0) return <>{empty}</>;

  const showCards = preferCards ? layout === 'cards' : false;
  const showToolbar = Boolean(preferCards || onRefresh);

  return (
    <>
      {showToolbar ? (
        <div className="crud-bar" role="toolbar" aria-label="List actions">
          {preferCards ? (
            <>
              <Button type="button" variant={layout === 'cards' ? 'primary' : 'ghost'} onClick={() => setLayout('cards')}>
                Cards
              </Button>
              <Button type="button" variant={layout === 'table' ? 'primary' : 'ghost'} onClick={() => setLayout('table')}>
                Table
              </Button>
            </>
          ) : null}
          {onRefresh ? (
            <Button type="button" variant="ghost" onClick={() => void onRefresh()} aria-label="Refresh this list" title="Refresh this list">
              Refresh
            </Button>
          ) : null}
        </div>
      ) : null}
      {!showCards ? (
        <div className={preferCards ? 'admin-table-wrap force-table' : 'admin-table-wrap'}>
          <table className="hlc-table striped">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className={col.priority === 'secondary' ? 'col-secondary' : undefined}>
                    {col.sortValue ? (
                      <button type="button" onClick={() => toggleSort(col.key)}>
                        {col.header}
                        {sortKey === col.key ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={onRowOpen ? 'row-open' : undefined}
                  title={onRowOpen ? 'Click to open profile' : undefined}
                  onClick={(event) => {
                    if (!onRowOpen) return;
                    const target = event.target as HTMLElement;
                    if (target.closest('input, button, a, label, select, textarea')) return;
                    onRowOpen(row);
                  }}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={col.priority === 'secondary' ? 'col-secondary' : undefined}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="people-grid">
          {slice.map((row) => {
            const key = rowKey(row);
            const isOn = selected.has(key);
            const label = cardName?.(row) || 'record';
            return (
              <div
                key={key}
                className={['people-card-shell', isOn ? 'is-selected' : '', onRowOpen ? 'is-openable' : ''].filter(Boolean).join(' ')}
                onClick={(event) => {
                  if (!onRowOpen) return;
                  const target = event.target as HTMLElement;
                  if (target.closest('input, button, a, label, select, textarea')) return;
                  onRowOpen(row);
                }}
              >
                {selectable ? (
                  <label className="people-card-select" onClick={(event) => event.stopPropagation()}>
                    <input type="checkbox" checked={isOn} onChange={() => toggle(key)} aria-label={`Select ${label}`} />
                  </label>
                ) : null}
                {isOn ? (
                  <span className="people-card-check" aria-hidden>
                    ✓
                  </span>
                ) : null}
                {renderCard(row)}
              </div>
            );
          })}
        </div>
      )}
      {pageCount > 1 ? (
        <div className="pager">
          <span>
            Page {safePage + 1} of {pageCount}
          </span>
          <button type="button" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
            Previous
          </button>
          <button
            type="button"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
          >
            Next
          </button>
        </div>
      ) : null}
    </>
  );
}
