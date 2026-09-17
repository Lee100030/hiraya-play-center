import type { HirayaDatabase, HirayaUser } from '@hiraya/types';
import { displayName, roleLabel } from '@hiraya/utils';
import { Button, Field, Textarea } from '@hiraya/ui';
import { FormEvent, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { api } from '../lib/api';
import { markThreadRead, messageContacts, threadMessages } from '../lib/messages';
import { PAGE_COPY } from '../lib/views';

function stamp(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function MessengerInbox({
  store,
  user,
  onStore,
  saveStore,
}: {
  store: HirayaDatabase;
  user: HirayaUser;
  onStore: (next: HirayaDatabase) => void;
  saveStore: (next: HirayaDatabase) => Promise<void>;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messageContacts(store.users)
      .map((person) => {
        const thread = threadMessages(store.alerts, user.userId, person.userId);
        const last = thread[thread.length - 1];
        const unread = thread.some((item) => !item.read && item.status !== 'sent');
        return { person, last, unread };
      })
      .filter(
        (row) =>
          !q ||
          `${displayName(row.person)} ${row.person.role} ${row.last?.message || ''}`.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        if (a.unread !== b.unread) return a.unread ? -1 : 1;
        return (b.last?.createdAt || '').localeCompare(a.last?.createdAt || '');
      });
  }, [query, store.alerts, store.users, user.userId]);

  const active = people.find((row) => row.person.userId === activeId) || null;
  const rows = active ? threadMessages(store.alerts, user.userId, active.person.userId) : [];

  async function openThread(person: HirayaUser) {
    setActiveId(person.userId);
    setError(null);
    const nextAlerts = markThreadRead(store.alerts, user.userId, person.userId);
    if (!nextAlerts.some((item, index) => item !== store.alerts[index])) return;
    try {
      await saveStore({ ...store, alerts: nextAlerts });
    } catch {
      onStore({ ...store, alerts: nextAlerts });
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!active || !body) {
      setError('Write a message first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onStore(await api.sendDirectMessage(active.person.userId, body));
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that message.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="messenger">
      <aside className="messenger-list">
        <input
          className="messenger-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search teachers and parents"
          aria-label="Search conversations"
        />
        {people.length === 0 ? (
          <p className="muted messenger-empty">No teachers or parents to message yet.</p>
        ) : (
          people.map(({ person, last, unread }) => (
            <button
              key={person.userId}
              type="button"
              className={person.userId === activeId ? 'messenger-item is-active' : 'messenger-item'}
              onClick={() => void openThread(person)}
            >
              <span className="messenger-avatar">{displayName(person).slice(0, 1).toUpperCase()}</span>
              <span>
                <strong>
                  {displayName(person)}
                  {unread ? <em className="messenger-unread" /> : null}
                </strong>
                <small>
                  {roleLabel(person.role)}
                  {last?.message ? ` · ${last.message}` : ' · Start a conversation'}
                </small>
              </span>
            </button>
          ))
        )}
      </aside>
      <section className="messenger-thread">
        {active ? (
          <>
            <header>
              <strong>{displayName(active.person)}</strong>
              <span>{roleLabel(active.person.role)}</span>
            </header>
            <div className="messenger-log">
              {rows.length === 0 ? (
                <p className="muted">No messages yet. Replies are saved for both of you in this thread.</p>
              ) : (
                rows.map((row) => (
                  <article key={row.alertId} className={row.status === 'sent' ? 'dm-bubble is-mine' : 'dm-bubble'}>
                    <p>{row.message}</p>
                    <small>
                      {row.status === 'sent' ? 'You' : displayName(active.person)} · {stamp(row.createdAt)}
                    </small>
                  </article>
                ))
              )}
            </div>
            <form className="messenger-compose" onSubmit={(event) => void send(event)}>
              {error ? <p className="form-error">{error}</p> : null}
              <Field label="Message" required>
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={3}
                  placeholder={`Write to ${displayName(active.person)}`}
                />
              </Field>
              <Button type="submit" disabled={busy}>
                {busy ? 'Sending…' : 'Send'}
              </Button>
            </form>
          </>
        ) : (
          <div className="messenger-placeholder">
            <p>Select a teacher or parent to open the conversation.</p>
            <p className="muted">The other person can reply from the phone. This stays in Messages, not Notifications.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export function MessagesPage({
  store,
  user,
  onStore,
  saveStore,
}: {
  store: HirayaDatabase;
  user: HirayaUser;
  onStore: (next: HirayaDatabase) => void;
  saveStore: (next: HirayaDatabase) => Promise<void>;
}) {
  return (
    <>
      <PageHeader title={PAGE_COPY.messages.title} description={PAGE_COPY.messages.description} />
      <MessengerInbox store={store} user={user} onStore={onStore} saveStore={saveStore} />
    </>
  );
}
