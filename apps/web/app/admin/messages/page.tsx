'use client';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminModal } from '@/components/admin/AdminModal';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { api } from '@/lib/api';
import { Button, EmptyState, Field, Input, Loading, PersonAvatar, Textarea } from '@hiraya/ui';
import {
  displayName,
  directThreadKey,
  groupMemberNames,
  groupThreadKey,
  isAlertRead,
  markThreadRead,
  messageContacts,
  myChatGroups,
  packedMemberIds,
  roleLabel,
  threadMessages,
} from '@hiraya/utils';
import type { ChatGroup, HirayaUser, SystemAlert } from '@hiraya/types';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type ActiveThread =
  | { kind: 'dm'; person: HirayaUser; threadId: string }
  | { kind: 'group'; group: ChatGroup; threadId: string };

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
  if (sameDay) return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function photoFor(user?: HirayaUser | null) {
  if (!user?.profileImagePath) return undefined;
  return api.profileMediaUrl(user.userId, user.updatedAt || user.profileImagePath);
}

function resolveSender(row: SystemAlert, storeUsers: HirayaUser[], actor: HirayaUser, active: ActiveThread) {
  if (row.status === 'sent') return actor;
  if (active.kind === 'dm') return active.person;
  const byHref = storeUsers.find((item) => item.userId === row.href);
  if (byHref && byHref.userId !== active.group.groupId) return byHref;
  const title = (row.title || '').trim().toLowerCase();
  return (
    storeUsers.find((item) => displayName(item).trim().toLowerCase() === title) ||
    ({ userId: '', fullname: row.title || 'Member', firstName: row.title || 'Member', lastName: '', role: 'teacher' } as HirayaUser)
  );
}

export default function AdminMessagesPage() {
  const { user } = useAuth();
  const { store, loading, save } = useStore();
  const [active, setActive] = useState<ActiveThread | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [pickedMembers, setPickedMembers] = useState<string[]>([]);
  const [membersOpen, setMembersOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const people = useMemo(() => {
    if (!user) return [];
    return messageContacts(store, user).map((person) => {
      const threadId = directThreadKey(user.userId, person.userId);
      const messages = threadMessages(store.alerts, user.userId, threadId);
      const last = messages[messages.length - 1];
      return {
        kind: 'dm' as const,
        person,
        threadId,
        messages,
        preview: last?.message || 'Start a conversation',
        timestamp: last?.createdAt || '',
        unread: messages.some((item) => !isAlertRead(item) && item.status !== 'sent'),
      };
    });
  }, [store, user]);

  const groups = useMemo(() => {
    if (!user) return [];
    return myChatGroups(store, user.userId).map((group) => {
      const threadId = groupThreadKey(group.groupId);
      const messages = threadMessages(store.alerts, user.userId, threadId);
      const last = messages[messages.length - 1];
      return {
        kind: 'group' as const,
        group,
        threadId,
        messages,
        preview: last?.message || 'No messages yet',
        timestamp: last?.createdAt || '',
        unread: messages.some((item) => !isAlertRead(item) && item.status !== 'sent'),
      };
    });
  }, [store, user]);

  const inbox = useMemo(
    () =>
      [...groups, ...people].sort((a, b) => {
        if (a.unread !== b.unread) return a.unread ? -1 : 1;
        return String(b.timestamp).localeCompare(String(a.timestamp));
      }),
    [groups, people],
  );

  const current = active
    ? inbox.find((item) =>
        item.kind === 'group' && active.kind === 'group'
          ? item.group.groupId === active.group.groupId
          : item.kind === 'dm' && active.kind === 'dm'
            ? item.person.userId === active.person.userId
            : false,
      ) || null
    : null;

  const groupMembers =
    active?.kind === 'group'
      ? packedMemberIds(active.group.memberIds)
          .map((id) => store.users.find((item) => item.userId === id))
          .filter((item): item is HirayaUser => Boolean(item))
      : [];

  const candidateMembers = store.users.filter(
    (item) =>
      item.userId !== user?.userId &&
      (item.role === 'teacher' || item.role === 'parent' || item.role === 'admin' || item.role === 'super_admin') &&
      (item.status || 'active').toLowerCase() === 'active',
  );

  useEffect(() => {
    const node = logRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [current?.messages.length, active?.threadId]);

  async function openThread(next: ActiveThread) {
    setActive(next);
    setMembersOpen(false);
    setError('');
    if (!user) return;
    const marked = markThreadRead(store.alerts, user.userId, next.threadId);
    if (marked.some((item, index) => item !== store.alerts[index])) {
      try {
        await save({ ...store, alerts: marked });
      } catch {
        /* keep local thread open */
      }
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || !active) return;
    setBusy(true);
    setError('');
    try {
      if (active.kind === 'group') await api.sendDirectMessage('', draft.trim(), active.group.groupId);
      else await api.sendDirectMessage(active.person.userId, draft.trim());
      setDraft('');
      await save(await api.getStore());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteMessage(alertId: string) {
    if (!window.confirm('Delete this message for everyone in the conversation?')) return;
    setBusy(true);
    try {
      await api.deleteDirectMessage(alertId);
      await save(await api.getStore());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.');
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
    setError('');
    try {
      const next = await api.createChatGroup(name, pickedMembers);
      await save(next);
      const created = (next.chatGroups || [])
        .filter((group) => packedMemberIds(group.memberIds).includes(user?.userId || ''))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
      setCreatingGroup(false);
      setGroupName('');
      setPickedMembers([]);
      if (created) await openThread({ kind: 'group', group: created, threadId: groupThreadKey(created.groupId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create that group.');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <Loading />;

  return (
    <>
      <AdminPageHeader
        kicker="Communication"
        title="Messages"
        description="1:1 threads and group chats. Create a group for teachers or parents; they can also message peers on mobile."
        actions={
          <button type="button" className="dash-action dash-action-primary" onClick={() => setCreatingGroup(true)}>
            + New group chat
          </button>
        }
      />
      <div className="messenger">
        <aside className="messenger-list">
          {inbox.length === 0 ? (
            <EmptyState title="No conversations" hint="Message a teacher or parent, or create a group." />
          ) : (
            inbox.map((row) => {
              const title = row.kind === 'group' ? row.group.name : displayName(row.person);
              const meta =
                row.kind === 'group'
                  ? `${packedMemberIds(row.group.memberIds).length} members`
                  : roleLabel(row.person.role);
              const when = listStamp(row.timestamp);
              const activeRow =
                row.kind === 'group'
                  ? active?.kind === 'group' && active.group.groupId === row.group.groupId
                  : active?.kind === 'dm' && active.person.userId === row.person.userId;
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
                      {when ? <time dateTime={row.timestamp}>{when}</time> : null}
                    </span>
                    {meta ? <em className="messenger-item-role">{meta}</em> : null}
                    <small className="messenger-item-preview">{row.preview}</small>
                  </span>
                  {row.unread ? <span className="messenger-unread" aria-label="Unread" /> : null}
                </button>
              );
            })
          )}
        </aside>
        <section className="messenger-thread">
          {current && active ? (
            <>
              {active.kind === 'group' ? (
                <header className="messenger-thread-head">
                  <div className="messenger-thread-head-main">
                    <button
                      type="button"
                      className="messenger-avatar-stack"
                      onClick={() => setMembersOpen((value) => !value)}
                      aria-expanded={membersOpen}
                    >
                      {groupMembers.slice(0, 3).map((person) => (
                        <span key={person.userId} className="messenger-avatar-stack-item" title={displayName(person)}>
                          <PersonAvatar name={displayName(person)} photo={photoFor(person)} size="sm" />
                        </span>
                      ))}
                      {groupMembers.length > 3 ? (
                        <span className="messenger-avatar-overflow">+{groupMembers.length - 3}</span>
                      ) : null}
                    </button>
                    <div className="messenger-thread-head-copy">
                      <strong>{active.group.name}</strong>
                      <span>{groupMembers.length} members</span>
                    </div>
                  </div>
                  {membersOpen ? (
                    <ul className="messenger-member-list">
                      {groupMembers.map((person) => (
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
                {current.messages.length === 0 ? (
                  <p className="muted messenger-log-empty">No messages yet. Say hello below.</p>
                ) : (
                  current.messages.map((item, index) => {
                    const mine = item.status === 'sent';
                    const sender = resolveSender(item, store.users, user, active);
                    const key = sender.userId || (mine ? user.userId : item.title || item.alertId);
                    const prev = current.messages[index - 1];
                    const next = current.messages[index + 1];
                    const prevKey = prev
                      ? resolveSender(prev, store.users, user, active).userId ||
                        (prev.status === 'sent' ? user.userId : prev.title || prev.alertId)
                      : null;
                    const nextKey = next
                      ? resolveSender(next, store.users, user, active).userId ||
                        (next.status === 'sent' ? user.userId : next.title || next.alertId)
                      : null;
                    const startCluster = prevKey !== key;
                    const endCluster = nextKey !== key;
                    const showAvatar = !mine && endCluster;
                    return (
                      <article
                        key={item.alertId}
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
                              <span>{mine ? 'You' : displayName(sender) || item.title || 'Member'}</span>
                              <span className="dm-meta-sep" aria-hidden>
                                ·
                              </span>
                              <time dateTime={item.createdAt}>{stamp(item.createdAt)}</time>
                            </div>
                          ) : null}
                          <div className={mine ? 'dm-bubble-wrap is-mine' : 'dm-bubble-wrap'}>
                            <div className={mine ? 'dm-bubble is-mine' : 'dm-bubble'}>
                              <p>{item.message}</p>
                            </div>
                            {mine ? (
                              <button
                                type="button"
                                className="dm-msg-more"
                                disabled={busy}
                                title="Delete message"
                                aria-label="Delete message"
                                onClick={() => void deleteMessage(item.alertId)}
                              >
                                ⋯
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
                {error && !creatingGroup ? <p className="hlc-field-error">{error}</p> : null}
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
                    {busy ? '…' : '➤'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="messenger-placeholder">
              <EmptyState title="Select a conversation" hint="Choose a person or group on the left." />
            </div>
          )}
        </section>
      </div>

      {creatingGroup ? (
        <AdminModal
          title="New group chat"
          onClose={() => {
            if (busy) return;
            setCreatingGroup(false);
            setError('');
          }}
          footer={
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
          {error ? <p className="hlc-field-error">{error}</p> : null}
          <Field label="Group name" required>
            <Input value={groupName} onChange={(event) => setGroupName(event.target.value)} autoFocus />
          </Field>
          <p className="hlc-field-hint">Select teachers and parents. You are added automatically.</p>
          <div style={{ display: 'grid', gap: 8, maxHeight: 280, overflow: 'auto' }}>
            {candidateMembers.map((person) => {
              const checked = pickedMembers.includes(person.userId);
              return (
                <label key={person.userId} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
        </AdminModal>
      ) : null}
    </>
  );
}
