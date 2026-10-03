import { Button, EmptyState, PersonAvatar, StatusBadge, Table } from '@hiraya/ui';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icons } from '../icons';
import { statusLabel } from '../lib/views';
import { DeskModal } from './DeskModal';
import { PageHeader, Toolbar } from './PageHeader';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  priority?: 'primary' | 'secondary';
};

export type RecordCrud<T> = {
  addLabel?: string;
  editLabel?: string;
  archiveLabel?: string;
  deleteLabel?: string;
  onAdd?: () => void;
  onEdit?: (row: T) => void;
  onArchive?: (rows: T[]) => void | boolean | Promise<void | boolean>;
  onDelete?: (rows: T[]) => void | boolean | Promise<void | boolean>;
  onRefresh?: () => void | boolean | Promise<void | boolean>;
  extra?: ReactNode;
  singleActions?: { label: string; icon?: keyof typeof Icons; onClick: (row: T) => void; needOneMessage?: string }[];
};

export function EmptyCell({ label = 'Not assigned' }: { label?: string }) {
  return <span className="cell-empty">{label}</span>;
}

export function assigned(value?: string | number | null) {
  if (value == null) return <EmptyCell />;
  const text = String(value).trim();
  if (!text || text === '—') return <EmptyCell />;
  return text;
}

export type RecordCard<T> = {
  name: (row: T) => string;
  photo?: (row: T) => string | undefined;
  role: (row: T) => string;
  stat: (row: T) => ReactNode;
};

export function RecordTable<T>({
  title,
  description,
  kicker,
  rows,
  columns,
  search,
  searchPlaceholder,
  emptyTitle,
  emptyHint,
  statusOf,
  actions,
  rowKey,
  crud,
  onRowOpen,
  card,
}: {
  title: string;
  description: string;
  kicker?: string;
  rows: T[];
  columns: Column<T>[];
  search: (row: T, query: string) => boolean;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyHint: string;
  statusOf?: (row: T) => string | undefined;
  actions?: ReactNode;
  rowKey?: (row: T, index: number) => string;
  crud?: RecordCrud<T>;
  onRowOpen?: (row: T) => void;
  card?: RecordCard<T>;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const [layout, setLayout] = useState<'table' | 'cards'>(() => {
    if (!card) return 'table';
    try {
      return localStorage.getItem('hiraya.peopleLayout') === 'table' ? 'table' : 'cards';
    } catch {
      return 'cards';
    }
  });
  const headerCheck = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageSize = 12;
  const selectable = Boolean(crud);
  const keyOf = (row: T, index: number) => (rowKey ? rowKey(row, index) : String(index));

  useEffect(() => {
    function apply(event: Event) {
      const next = (event as CustomEvent<{ query?: string }>).detail?.query;
      if (typeof next === 'string') {
        setQuery(next);
        setPage(0);
      }
    }
    try {
      const pending = sessionStorage.getItem('hiraya.assistantQuery');
      if (pending) {
        setQuery(pending);
        setPage(0);
        sessionStorage.removeItem('hiraya.assistantQuery');
      }
    } catch {
      /* ignore */
    }
    window.addEventListener('hiraya-assistant-filter', apply);
    return () => window.removeEventListener('hiraya-assistant-filter', apply);
  }, []);

  const statuses = useMemo(() => {
    if (!statusOf) return [];
    return Array.from(new Set(rows.map(statusOf).filter(Boolean))) as string[];
  }, [rows, statusOf]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = !q || search(row, q);
      const matchesStatus = status === 'all' || (statusOf ? statusOf(row) === status : true);
      return matchesQuery && matchesStatus;
    });
  }, [rows, query, search, status, statusOf]);

  const filteredKeys = useMemo(() => filtered.map((row, index) => keyOf(row, index)), [filtered, rowKey]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = filtered.slice(current * pageSize, current * pageSize + pageSize);

  const selectedOnPage = slice.filter((row, index) => selected.has(keyOf(row, current * pageSize + index)));
  const allFilteredSelected = filteredKeys.length > 0 && filteredKeys.every((key) => selected.has(key));
  const someFilteredSelected = filteredKeys.some((key) => selected.has(key));

  function measureOverflow() {
    const el = scrollRef.current;
    if (!el) return;
    setOverflow({
      left: el.scrollLeft > 6,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 6,
    });
  }

  useEffect(() => {
    if (!headerCheck.current) return;
    headerCheck.current.indeterminate = someFilteredSelected && !allFilteredSelected;
  }, [someFilteredSelected, allFilteredSelected]);

  useEffect(() => {
    setSelected((current) => {
      const live = new Set(rows.map((row, index) => keyOf(row, index)));
      const next = new Set([...current].filter((key) => live.has(key)));
      return next.size === current.size ? current : next;
    });
  }, [rows]);

  useEffect(() => {
    measureOverflow();
    const el = scrollRef.current;
    if (!el) return;
    const onResize = () => measureOverflow();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [slice, columns, layout]);

  useEffect(() => {
    if (!card) return;
    try {
      localStorage.setItem('hiraya.peopleLayout', layout);
    } catch {
      /* ignore */
    }
  }, [layout, card]);

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setNotice(null);
  }

  function toggleAllFiltered() {
    setSelected((current) => {
      if (allFilteredSelected) {
        const next = new Set(current);
        for (const key of filteredKeys) next.delete(key);
        return next;
      }
      return new Set([...current, ...filteredKeys]);
    });
    setNotice(null);
  }

  function selectedRows(): T[] {
    return rows.filter((row, index) => selected.has(keyOf(row, index)));
  }

  async function run(action: () => void | boolean | Promise<void | boolean>) {
    setBusy(true);
    setNotice(null);
    try {
      const result = await action();
      if (result === false) return;
      setSelected(new Set());
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'That action could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  function onEditClick() {
    const picked = selectedRows();
    if (picked.length !== 1) {
      setNotice('Please select only one record to edit.');
      return;
    }
    crud?.onEdit?.(picked[0]);
  }

  const filterPlaceholder = searchPlaceholder.toLowerCase().startsWith('filter')
    ? searchPlaceholder
    : `Filter this list · ${searchPlaceholder.replace(/^search\s+/i, '')}`;

  const addLabel = (crud?.addLabel || '+ Add').replace(/^\+\s*/, '');
  const archiveLabel = crud?.archiveLabel || 'Archive';
  const deleteLabel = crud?.deleteLabel || 'Delete';
  const hasSelection = selected.size > 0;

  const scrollClass = [
    'table-scroll',
    overflow.left ? 'has-back' : '',
    overflow.right ? 'has-more' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {title || description ? <PageHeader kicker={kicker} crumb={`HIRAYA / ${title}`} title={title} description={description} actions={selectable ? undefined : actions} /> : null}
      {crud ? (
        <div className="crud-bar" role="toolbar" aria-label="Record actions">
          {crud.onAdd ? (
            <Button type="button" onClick={crud.onAdd} disabled={busy}>
              <Icons.plus width={14} height={14} />
              {addLabel}
            </Button>
          ) : null}
          {crud.onEdit ? (
            <Button type="button" variant="ghost" onClick={onEditClick} disabled={busy || selected.size !== 1}>
              <Icons.pencil width={14} height={14} />
              {crud.editLabel || 'Edit'}
            </Button>
          ) : null}
          {(crud.singleActions || []).map((action) => {
            const Icon = action.icon ? Icons[action.icon] : Icons.link;
            return (
              <Button
                key={action.label}
                type="button"
                variant="ghost"
                disabled={busy || selected.size !== 1}
                onClick={() => {
                  const picked = selectedRows();
                  if (picked.length !== 1) {
                    setNotice(action.needOneMessage || 'Please select only one record to edit.');
                    return;
                  }
                  action.onClick(picked[0]);
                }}
              >
                <Icon width={14} height={14} />
                {action.label}
              </Button>
            );
          })}
          {crud.onArchive ? (
            <Button
              type="button"
              variant="ghost"
              disabled={busy || selected.size === 0}
              onClick={() => void run(() => crud.onArchive!(selectedRows()))}
            >
              <Icons.archive width={14} height={14} />
              {archiveLabel}
            </Button>
          ) : null}
          {crud.onDelete ? (
            <Button
              type="button"
              variant="danger"
              className={hasSelection ? undefined : 'is-idle'}
              disabled={busy || !hasSelection}
              onClick={() => void run(() => crud.onDelete!(selectedRows()))}
            >
              <Icons.trash width={14} height={14} />
              {deleteLabel}
            </Button>
          ) : null}
          {crud.onRefresh ? (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              aria-label="Refresh this list"
              title="Refresh this list"
              onClick={() => void run(() => crud.onRefresh!())}
            >
              <Icons.refresh width={14} height={14} />
              Refresh
            </Button>
          ) : null}
          {card ? (
            <>
              <Button
                type="button"
                variant={layout === 'cards' ? 'primary' : 'ghost'}
                aria-pressed={layout === 'cards'}
                onClick={() => setLayout('cards')}
              >
                Cards
              </Button>
              <Button
                type="button"
                variant={layout === 'table' ? 'primary' : 'ghost'}
                aria-pressed={layout === 'table'}
                onClick={() => setLayout('table')}
              >
                Table
              </Button>
            </>
          ) : null}
          {crud.extra}
          {selectable ? (
            <span className="crud-selected">
              {selected.size} selected
            </span>
          ) : null}
        </div>
      ) : null}
      {notice ? (
        <DeskModal
          title={notice.startsWith('Please') ? 'Select a record' : 'Notice'}
          tone={notice.startsWith('Please') ? 'info' : 'error'}
          onClose={() => setNotice(null)}
        >
          <p>{notice}</p>
        </DeskModal>
      ) : null}
      <Toolbar
        query={query}
        onQuery={(value) => {
          setQuery(value);
          setPage(0);
        }}
        placeholder={filterPlaceholder}
        extra={
          statuses.length ? (
            <select
              className="hlc-select toolbar-filter"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(0);
              }}
              aria-label="Filter this list by status"
            >
              <option value="all">All statuses</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {statusLabel(item) || item}
                </option>
              ))}
            </select>
          ) : null
        }
        showReset={Boolean(query || status !== 'all')}
        onReset={() => {
          setQuery('');
          setStatus('all');
          setPage(0);
        }}
      />
      {filtered.length === 0 ? (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      ) : layout === 'cards' && card ? (
        <>
          <div className="people-grid">
            {slice.map((row, index) => {
              const absolute = current * pageSize + index;
              const key = keyOf(row, absolute);
              const isOn = selected.has(key);
              return (
                <article
                  key={key}
                  className={['people-card', isOn ? 'is-selected' : '', onRowOpen ? 'is-openable' : ''].filter(Boolean).join(' ')}
                  onClick={(event) => {
                    if (!onRowOpen) return;
                    const target = event.target as HTMLElement;
                    if (target.closest('input, button, label')) return;
                    onRowOpen(row);
                  }}
                >
                  {selectable ? (
                    <label className="people-card-select" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isOn}
                        onChange={() => toggle(key)}
                        aria-label={`Select ${card.name(row)}`}
                      />
                    </label>
                  ) : null}
                  {isOn ? (
                    <span className="people-card-check" aria-hidden>
                      ✓
                    </span>
                  ) : null}
                  <PersonAvatar name={card.name(row)} photo={card.photo?.(row)} size="lg" />
                  <h3>{card.name(row)}</h3>
                  <p className="people-card-role">{card.role(row)}</p>
                  <p className="people-card-stat">{card.stat(row)}</p>
                </article>
              );
            })}
          </div>
          <div className="pager">
            <span className="pager-count">
              {filtered.length} record{filtered.length === 1 ? '' : 's'}
              {selected.size ? ` · ${selected.size} selected` : ''}
            </span>
            <span className="pager-page">
              Page {current + 1} of {pages}
            </span>
            <div className="pager-nav">
              <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>
                Previous
              </button>
              <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="table-card">
            <div className={scrollClass} ref={scrollRef} onScroll={measureOverflow}>
            <Table>
              <thead>
                <tr>
                  {selectable ? (
                    <th className="col-check">
                      <input
                        ref={headerCheck}
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleAllFiltered}
                        aria-label="Select all"
                      />
                    </th>
                  ) : null}
                  {columns.map((col) => (
                    <th key={col.key} className={col.priority === 'secondary' ? 'col-secondary' : undefined}>
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.map((row, index) => {
                  const absolute = current * pageSize + index;
                  const key = keyOf(row, absolute);
                  const isOn = selected.has(key);
                  return (
                    <tr
                      key={key}
                      className={[isOn ? 'row-selected' : '', onRowOpen || crud?.onEdit ? 'row-open' : ''].filter(Boolean).join(' ') || undefined}
                      title={
                        onRowOpen && crud?.onEdit
                          ? 'Click to open profile. Double-click to edit.'
                          : onRowOpen
                            ? 'Click to open profile'
                            : crud?.onEdit
                              ? 'Double-click to edit'
                              : undefined
                      }
                      onClick={(event) => {
                        if (!onRowOpen) return;
                        const target = event.target as HTMLElement;
                        if (target.closest('input, button, a, label, select, textarea')) return;
                        onRowOpen(row);
                      }}
                      onDoubleClick={(event) => {
                        if (!crud?.onEdit) return;
                        const target = event.target as HTMLElement;
                        if (target.closest('input, button, a, label, select, textarea')) return;
                        setSelected(new Set([key]));
                        setNotice(null);
                        crud.onEdit(row);
                      }}
                    >
                      {selectable ? (
                        <td className="col-check">
                          <input
                            type="checkbox"
                            checked={isOn}
                            onChange={() => toggle(key)}
                            aria-label={`Select ${key}`}
                          />
                        </td>
                      ) : null}
                      {columns.map((col) => (
                        <td key={col.key} className={col.priority === 'secondary' ? 'col-secondary' : undefined}>
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            </div>
          </div>
          <div className="pager">
            <span className="pager-count">
              {filtered.length} record{filtered.length === 1 ? '' : 's'}
              {selectedOnPage.length ? ` · ${selected.size} selected` : ''}
            </span>
            <span className="pager-page">
              Page {current + 1} of {pages}
            </span>
            <div className="pager-nav">
              <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>
                Previous
              </button>
              <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export function StatusCell({ value }: { value?: string }) {
  return <StatusBadge status={statusLabel(value)} />;
}

export function NameCell({ name, photo }: { name: string; photo?: string }) {
  return (
    <div className="name-cell">
      <PersonAvatar name={name} photo={photo} size="sm" />
      <span title={name}>{name}</span>
    </div>
  );
}
