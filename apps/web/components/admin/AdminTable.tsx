'use client';

import { useMemo, useState, type ReactNode } from 'react';

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
}: {
  rows: T[];
  columns: AdminColumn<T>[];
  rowKey: (row: T) => string;
  renderCard: (row: T) => ReactNode;
  pageSize?: number;
  empty?: ReactNode;
}) {
  const [sortKey, setSortKey] = useState(columns[0]?.key || '');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

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

  if (rows.length === 0) return <>{empty}</>;

  return (
    <>
      <div className="admin-table-wrap">
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
              <tr key={rowKey(row)}>
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
      <div className="admin-card-list">{slice.map((row) => <div key={rowKey(row)}>{renderCard(row)}</div>)}</div>
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
