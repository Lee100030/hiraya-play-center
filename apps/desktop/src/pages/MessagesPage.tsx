import type { ChatGroup, HirayaDatabase, HirayaUser, SystemAlert } from '@hiraya/types';
import {
  displayName,
  groupMemberNames,
  groupThreadKey,
  directThreadKey,
  markThreadRead,
  messageContacts,
  myChatGroups,
  packedMemberIds,
  roleLabel,
  threadMessages,
} from '@hiraya/utils';
import { Button, Field, Input, PersonAvatar, Textarea } from '@hiraya/ui';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { DeskModal } from '../components/DeskModal';
import { Icons } from '../icons';
import { api } from '../lib/api';
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

function listStamp(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function photoFor(user?: HirayaUser | null) {
  if (!user?.profileImagePath) return undefined;
  return api.profileMediaUrl(user.userId, user.updatedAt || user.profileImagePath);
}

type ActiveThread =
  | { kind: 'dm'; person: HirayaUser; threadId: string }
  | { kind: 'group'; group: ChatGroup; threadId: string };

function GroupHeader({ store, group }: { store: HirayaDatabase; group: ChatGroup }) {
  const [open, setOpen] = useState(false);
  const members = packedMemberIds(group.memberIds)
    .map((id) => store.users.find((item) => item.userId === id))
    .filter((item): item is HirayaUser => Boolean(item));
  const shown = members.slice(0, 3);
  const overflow = Math.max(0, members.length - shown.length);

  return (
    <header className="messenger-thread-head">
      <div className="messenger-thread-head-main">
        <button
          type="button"
          className="messenger-avatar-stack"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? 'Hide group members' : 'Show group members'}
        >
          {shown.map((person) => (
            <span key={person.userId} className="messenger-avatar-stack-item" title={displayName(person)}>
              <PersonAvatar name={displayName(person)} photo={photoFor(person)} size="sm" />
            </span>
          ))}
          {overflow > 0 ? <span className="messenger-avatar-overflow">+{overflow}</span> : null}
        </button>
        <div className="messenger-thread-head-copy">
          <strong>{group.name}</strong>
          <span>{members.length} members</span>
        </div>
      </div>
      {open ? (
        <ul className="messenger-member-list">
          {members.map((person) => (
            <li key={person.userId}>
              <PersonAvatar name={displayName(person)} photo={photoFor(person)} size="sm" />
              <span>
                <em>{displayName(person)}</em>
                <small>{roleLabel(person.role)}</small>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  );
}

function resolveSender(
  row: SystemAlert,
  store: HirayaDatabase,
  actor: HirayaUser,
  active: ActiveThread,
): HirayaUser {
  if (row.status === 'sent') return actor;
  if (active.kind === 'dm') return active.person;
  const byHref = store.users.find((item) => item.userId === row.href);
  if (byHref && byHref.userId !== active.group.groupId) return byHref;
  const title = (row.title || '').trim().toLowerCase();
  return (
    store.users.find((item) => displayName(item).trim().toLowerCase() === title) ||
    ({
      userId: '',
      firstName: row.title || 'Member',
      lastName: '',
      fullname: row.title || 'Member',
      role: 'teacher',
    } as HirayaUser)
  );
}

function senderKey(row: SystemAlert, store: HirayaDatabase, actor: HirayaUser, active: ActiveThread) {
  return resolveSender(row, store, actor, active).userId || (row.status === 'sent' ? actor.userId : row.title || row.alertId);
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
  const isAdmin = user.role === 'super_admin' || user.role === 'admin';
  const [active, setActive] = useState<ActiveThread | null>(null);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [pickedMembers, setPickedMembers] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messageContacts(store, user)
      .map((person) => {
        const threadId = directThreadKey(user.userId, person.userId);
        const thread = threadMessages(store.alerts, user.userId, threadId);
        const last = thread[thread.length - 1];
        const unread = thread.some((item) => !item.read && item.status !== 'sent');
        return { kind: 'dm' as const, person, threadId, last, unread };
      })
      .filter(
        (row) =>
          !q ||
          `${displayName(row.person)} ${row.person.role} ${row.last?.message || ''}`.toLowerCase().includes(q),
      );
  }, [query, store, user]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return myChatGroups(store, user.userId)
      .map((group) => {
        const threadId = groupThreadKey(group.groupId);
        const thread = threadMessages(store.alerts, user.userId, threadId);
        const last = thread[thread.length - 1];
        const unread = thread.some((item) => !item.read && item.status !== 'sent');
        return { kind: 'group' as const, group, threadId, last, unread };
      })
      .filter((row) => !q || `${row.group.name} ${groupMemberNames(store, row.group)}`.toLowerCase().includes(q));
  }, [query, store, user.userId]);

  const inbox = useMemo(() => {
    return [...groups, ...people].sort((a, b) => {
      if (a.unread !== b.unread) return a.unread ? -1 : 1;
      return (b.last?.createdAt || '').localeCompare(a.last?.createdAt || '');
    });
  }, [groups, people]);

  const rows = active ? threadMessages(store.alerts, user.userId, active.threadId) : [];
  const candidateMembers = store.users.filter(
    (item) =>
      item.userId !== user.userId &&
      (item.role === 'teacher' || item.role === 'parent' || item.role === 'admin' || item.role === 'super_admin') &&
      (item.status || 'active').toLowerCase() === 'active',
  );

  useEffect(() => {
    const node = logRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [rows.length, active?.threadId, draft]);

  async function openThread(next: ActiveThread) {
    setActive(next);
    setError(null);
    const nextAlerts = markThreadRead(store.alerts, user.userId, next.threadId);
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
      if (active.kind === 'group') {
        onStore(await api.sendDirectMessage('', body, active.group.groupId));
      } else {
        onStore(await api.sendDirectMessage(active.person.userId, body));
      }
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that message.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteMessage(alertId: string) {
    if (!window.confirm('Delete this message for everyone in the conversation?')) return;
    setBusy(true);
    setError(null);
    try {
      onStore(await api.deleteDirectMessage(alertId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete that message.');
    } finally {
      setBusy(false);
    }
  }

  async function createGroup() {
    const name = groupName.trim();
    if (!name) {
      setError('Give the group a name.');
      return;
    }
    if (!pickedMembers.length) {
      setError('Pick at least one teacher or parent.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await api.createChatGroup(name, pickedMembers);
      onStore(next);
      const created = (next.chatGroups || [])
        .filter((group) => packedMemberIds(group.memberIds).includes(user.userId))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
      setCreatingGroup(false);
      setGroupName('');
      setPickedMembers([]);
      if (created) {
        await openThread({ kind: 'group', group: created, threadId: groupThreadKey(created.groupId) });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create that group.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="messenger">
        <aside className="messenger-list">
          <input
            className="messenger-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people and groups"
            aria-label="Search conversations"
          />
          {isAdmin ? (
            <button
              type="button"
              className="messenger-item messenger-item-new"
              onClick={() => {
                setError(null);
                setCreatingGroup(true);
              }}
            >
              <span className="messenger-avatar messenger-avatar-new">+</span>
              <span className="messenger-item-copy">
                <strong>New group chat</strong>
                <small>Invite teachers and parents</small>
              </span>
            </button>
          ) : null}
          {inbox.length === 0 ? (
            <p className="muted messenger-empty">
              {isAdmin
                ? 'No teachers, parents, or groups yet.'
                : 'Message other teachers, co-parents, or the center admin.'}
            </p>
          ) : (
            inbox.map((row) => {
              const activeRow =
                row.kind === 'group'
                  ? active?.kind === 'group' && active.group.groupId === row.group.groupId
                  : active?.kind === 'dm' && active.person.userId === row.person.userId;
              const title = row.kind === 'group' ? row.group.name : displayName(row.person);
              const preview = row.last?.message || (row.kind === 'group' ? 'No messages yet' : 'Start a conversation');
              const meta =
                row.kind === 'dm' ? roleLabel(row.person.role) : `${packedMemberIds(row.group.memberIds).length} members`;
              const when = listStamp(row.last?.createdAt);
              return (
                <button
                  key={row.kind === 'group' ? row.group.groupId : row.person.userId}
                  type="button"
                  className={activeRow ? 'messenger-item is-active' : 'messenger-item'}
                  onClick={() => void openThread(row)}
                >
                  {row.kind === 'group' ? (
                    <span className="messenger-avatar messenger-avatar-group" aria-hidden>
                      G
                    </span>
                  ) : (
                    <PersonAvatar name={displayName(row.person)} photo={photoFor(row.person)} size="sm" />
                  )}
                  <span className="messenger-item-copy">
                    <span className="messenger-item-top">
                      <strong>{title}</strong>
                      {when ? <time dateTime={row.last?.createdAt}>{when}</time> : null}
                    </span>
                    {meta ? <em className="messenger-item-role">{meta}</em> : null}
                    <small className="messenger-item-preview">{preview}</small>
                  </span>
                  {row.unread ? <span className="messenger-unread" aria-label="Unread" /> : null}
                </button>
              );
            })
          )}
        </aside>
        <section className="messenger-thread">
          {active ? (
            <>
              {active.kind === 'group' ? (
                <GroupHeader store={store} group={active.group} />
              ) : (
                <header className="messenger-thread-head">
                  <div className="messenger-thread-head-main">
                    <PersonAvatar name={displayName(active.person)} photo={photoFor(active.person)} size="sm" />
                    <div className="messenger-thread-head-copy">
                      <strong>{displayName(active.person)}</strong>
                      <span>{roleLabel(active.person.role)}</span>
                    </div>
                  </div>
                </header>
              )}
              <div className="messenger-log" ref={logRef}>
                {rows.length === 0 ? (
                  <p className="muted messenger-log-empty">No messages yet. Say hello below.</p>
                ) : (
                  rows.map((row, index) => {
                    const mine = row.status === 'sent';
                    const sender = resolveSender(row, store, user, active);
                    const key = senderKey(row, store, user, active);
                    const prev = rows[index - 1];
                    const next = rows[index + 1];
                    const prevKey = prev ? senderKey(prev, store, user, active) : null;
                    const nextKey = next ? senderKey(next, store, user, active) : null;
                    const startCluster = prevKey !== key;
                    const endCluster = nextKey !== key;
                    const showAvatar = !mine && endCluster;
                    return (
                      <article
                        key={row.alertId}
                        className={[
                          'dm-row',
                          mine ? 'is-mine' : 'is-theirs',
                          startCluster ? 'is-cluster-start' : '',
                          endCluster ? 'is-cluster-end' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {!mine ? (
                          showAvatar ? (
                            <PersonAvatar name={displayName(sender)} photo={photoFor(sender)} size="sm" />
                          ) : (
                            <span className="dm-row-spacer" aria-hidden />
                          )
                        ) : null}
                        <div className="dm-col">
                          {startCluster ? (
                            <div className="dm-meta">
                              <span>{mine ? 'You' : displayName(sender) || row.title || 'Member'}</span>
                              <span className="dm-meta-sep" aria-hidden>
                                ·
                              </span>
                              <time dateTime={row.createdAt}>{stamp(row.createdAt)}</time>
                            </div>
                          ) : null}
                          <div className={mine ? 'dm-bubble-wrap is-mine' : 'dm-bubble-wrap'}>
                            <div className={mine ? 'dm-bubble is-mine' : 'dm-bubble'}>
                              <p>{row.message}</p>
                            </div>
                            {mine ? (
                              <button
                                type="button"
                                className="dm-msg-more"
                                disabled={busy}
                                title="Delete message"
                                aria-label="Delete message"
                                onClick={() => void deleteMessage(row.alertId)}
                              >
                                <Icons.more width={16} height={16} />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
              <form className="messenger-compose" onSubmit={(event) => void send(event)}>
                {error && !creatingGroup ? <p className="form-error">{error}</p> : null}
                <div className="messenger-compose-row">
                  <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={1}
                    placeholder={
                      active.kind === 'group'
                        ? `Write to ${active.group.name}`
                        : `Write to ${displayName(active.person)}`
                    }
                    aria-label="Message"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                  />
                  <button
                    type="submit"
                    className="messenger-send"
                    disabled={busy || !draft.trim()}
                    aria-label={busy ? 'Sending' : 'Send message'}
                  >
                    <Icons.send width={18} height={18} />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="messenger-placeholder">
              <p>Select a person or group to open the conversation.</p>
              <p className="muted">
                Teachers can message other teachers. Parents can message co-parents. Everyone can reach the center admin.
              </p>
            </div>
          )}
        </section>
      </div>
      {creatingGroup ? (
        <DeskModal
          title="New group chat"
          onClose={() => {
            if (busy) return;
            setCreatingGroup(false);
            setError(null);
          }}
          actions={
            <>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setCreatingGroup(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={busy} onClick={() => void createGroup()}>
                {busy ? 'Creating…' : 'Create group'}
              </Button>
            </>
          }
        >
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <Field label="Group name" required>
            <Input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="e.g. Playgroup teachers" autoFocus />
          </Field>
          <p className="hlc-field-hint">Select teachers and parents to include. You are added automatically.</p>
          <div className="form-span" style={{ display: 'grid', gap: 8, maxHeight: 280, overflow: 'auto' }}>
            {candidateMembers.map((person) => {
              const checked = pickedMembers.includes(person.userId);
              return (
                <label key={person.userId} className="status-switch" style={{ justifyContent: 'flex-start', gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setPickedMembers((current) =>
                        checked ? current.filter((id) => id !== person.userId) : [...current, person.userId],
                      )
                    }
                  />
                  <PersonAvatar name={displayName(person)} photo={photoFor(person)} size="sm" />
                  <span>
                    {displayName(person)} · {roleLabel(person.role)}
                  </span>
                </label>
              );
            })}
          </div>
        </DeskModal>
      ) : null}
    </>
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
      <PageHeader
        title={PAGE_COPY.messages.title}
        description="Private threads and group chats. Teachers can message teachers, parents can message co-parents, and admin can create groups."
      />
      <MessengerInbox store={store} user={user} onStore={onStore} saveStore={saveStore} />
    </>
  );
}
