'use client';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { api } from '@/lib/api';
import { Button, EmptyState, Field, Loading, Textarea } from '@hiraya/ui';
import { displayName, roleLabel } from '@hiraya/utils';
import { FormEvent, useMemo, useState } from 'react';

function isDirect(kind?: string) {
  return (kind || '').toLowerCase() === 'direct';
}

function threadKey(a: string, b: string) {
  const [left, right] = [a, b].sort((x, y) => x.localeCompare(y, undefined, { sensitivity: 'base' }));
  return `dm:${left}:${right}`;
}

export default function AdminMessagesPage() {
  const { user } = useAuth();
  const { store, loading, save, refresh } = useStore();
  const [active, setActive] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const people = useMemo(() => {
    if (!user) return [];
    return store.users
      .filter((item) => item.role === 'teacher' || item.role === 'parent')
      .map((person) => {
        const id = threadKey(user.userId, person.userId);
        const messages = store.alerts
          .filter(
            (item) =>
              isDirect(item.kind) && item.relatedRecordId === id && item.recipientId === user.userId,
          )
          .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
        const last = messages[messages.length - 1];
        return {
          person,
          messages,
          preview: last?.message || '',
          timestamp: last?.createdAt || '',
          unread: messages.some((item) => !item.read && item.status !== 'sent'),
        };
      })
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  }, [store.alerts, store.users, user]);

  const current = people.find((item) => item.person.userId === active) || null;

  async function openThread(userId: string) {
    setActive(userId);
    setError('');
    if (!user) return;
    const id = threadKey(user.userId, userId);
    const next = store.alerts.map((item) =>
      isDirect(item.kind) && item.relatedRecordId === id && item.recipientId === user.userId && !item.read
        ? { ...item, read: true, status: item.status === 'sent' ? 'sent' : 'read' }
        : item,
    );
    if (next.some((item, index) => item !== store.alerts[index])) {
      try {
        await save({ ...store, alerts: next });
      } catch {
        /* keep local thread open */
      }
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || !current) return;
    setBusy(true);
    setError('');
    try {
      await api.sendDirectMessage(current.person.userId, draft.trim());
      await refresh();
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that message.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (!user) return null;

  return (
    <>
      <AdminPageHeader
        kicker="Inbox"
        title="Messages"
        description="Private threads with teachers and parents. Replies are stored for both people and do not pop up as notifications."
      />
      {people.length === 0 ? (
        <EmptyState title="No conversations" hint="Add a teacher or parent account first." />
      ) : (
        <div className={current ? 'inbox show-thread' : 'inbox'}>
          <div className="inbox-list">
            {people.map((thread) => (
              <button
                key={thread.person.userId}
                type="button"
                className={thread.person.userId === active ? 'inbox-item active' : 'inbox-item'}
                onClick={() => void openThread(thread.person.userId)}
              >
                <span className="inbox-avatar">{displayName(thread.person).slice(0, 1).toUpperCase()}</span>
                <span>
                  <strong>{displayName(thread.person)}</strong>
                  <p>{thread.preview.slice(0, 72) || `Message this ${roleLabel(thread.person.role).toLowerCase()}`}</p>
                </span>
                <time dateTime={thread.timestamp}>
                  {thread.timestamp ? new Date(thread.timestamp).toLocaleDateString() : ''}
                </time>
              </button>
            ))}
          </div>
          <div className="inbox-thread">
            {current ? (
              <>
                <button type="button" className="inbox-back dash-action" onClick={() => setActive(null)}>
                  Back to messages
                </button>
                <h2>{displayName(current.person)}</h2>
                <ul>
                  {current.messages.length === 0 ? (
                    <li className="bubble">
                      <p>No messages yet. Write the first note — it is saved for both of you.</p>
                    </li>
                  ) : (
                    current.messages.map((item) => (
                      <li key={item.alertId} className={item.status === 'sent' ? 'bubble is-mine' : 'bubble'}>
                        <strong>{item.status === 'sent' ? 'You' : displayName(current.person)}</strong>
                        <p>{item.message}</p>
                        <time dateTime={item.createdAt}>
                          {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                        </time>
                      </li>
                    ))
                  )}
                </ul>
                <form className="admin-filter-bar" onSubmit={(event) => void send(event)}>
                  {error ? <p className="form-error">{error}</p> : null}
                  <Field label="Message">
                    <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a reply…" />
                  </Field>
                  <Button type="submit" disabled={busy}>
                    {busy ? 'Sending…' : 'Send'}
                  </Button>
                </form>
              </>
            ) : (
              <p>Select a teacher or parent to read and reply.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
