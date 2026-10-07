import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, KeyboardAvoidingView, Platform, ScrollView, View, Alert } from 'react-native';
import {
  directThreadKey,
  displayName,
  groupMemberNames,
  groupThreadKey,
  markThreadRead,
  messageContacts,
  myChatGroups,
  packedMemberIds,
  roleLabel,
  threadMessages,
} from '@hiraya/utils';
import type { ChatGroup, HirayaUser } from '@hiraya/types';
import { AppButton, Body, Caption, EmptyState, Field, Screen } from '../src/components/ui';
import { api, useAuth } from '../src/auth';
import { useCenter } from '../src/store';
import { friendlyError } from '../src/selectors';
import { colors, space } from '../src/theme';

type ActiveThread =
  | { kind: 'dm'; person: HirayaUser; threadId: string }
  | { kind: 'group'; group: ChatGroup; threadId: string };

export default function MessagesScreen() {
  const { user } = useAuth();
  const { store, refresh } = useCenter();
  const [active, setActive] = useState<ActiveThread | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const log = useRef<ScrollView>(null);

  const people = useMemo(() => {
    if (!user) return [];
    return messageContacts(store, user).map((person) => {
      const threadId = directThreadKey(user.userId, person.userId);
      const thread = threadMessages(store.alerts, user.userId, threadId);
      const last = thread[thread.length - 1];
      return {
        kind: 'dm' as const,
        person,
        threadId,
        last,
        unread: thread.some((item) => !item.read && item.status !== 'sent'),
      };
    });
  }, [store, user]);

  const groups = useMemo(() => {
    if (!user) return [];
    return myChatGroups(store, user.userId).map((group) => {
      const threadId = groupThreadKey(group.groupId);
      const thread = threadMessages(store.alerts, user.userId, threadId);
      const last = thread[thread.length - 1];
      return {
        kind: 'group' as const,
        group,
        threadId,
        last,
        unread: thread.some((item) => !item.read && item.status !== 'sent'),
      };
    });
  }, [store, user]);

  const inbox = useMemo(
    () =>
      [...groups, ...people].sort((a, b) => {
        if (a.unread !== b.unread) return a.unread ? -1 : 1;
        return (b.last?.createdAt || '').localeCompare(a.last?.createdAt || '');
      }),
    [groups, people],
  );

  const rows = useMemo(
    () => (user && active ? threadMessages(store.alerts, user.userId, active.threadId) : []),
    [active, store.alerts, user],
  );

  useEffect(() => {
    log.current?.scrollToEnd({ animated: true });
  }, [rows.length, active?.threadId]);

  useEffect(() => {
    if (!user || !active) return;
    const marked = markThreadRead(store.alerts, user.userId, active.threadId);
    if (!marked.some((item, index) => item !== store.alerts[index])) return;
    void api
      .putStore({ ...store, alerts: marked }, store)
      .then(() => refresh())
      .catch(() => undefined);
  }, [active?.threadId, user?.userId]);

  async function send() {
    if (!active || !user) return;
    const body = draft.trim();
    if (!body) {
      setError('Write a message first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (active.kind === 'group') await api.sendDirectMessage('', body, active.group.groupId);
      else await api.sendDirectMessage(active.person.userId, body);
      setDraft('');
      await refresh();
    } catch (err) {
      setError(friendlyError(err, 'Could not send that message. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  function deleteMessage(alertId: string) {
    Alert.alert('Delete message', 'Delete this message for everyone in the conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            setError('');
            try {
              await api.deleteDirectMessage(alertId);
              await refresh();
            } catch (err) {
              setError(friendlyError(err, 'Could not delete that message.'));
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }

  if (!user) return null;

  if (!active) {
    return (
      <Screen>
        <Caption style={{ marginBottom: space.sm }}>
          Message the center admin, other teachers, co-parents, or groups the admin created for you.
        </Caption>
        {inbox.length === 0 ? (
          <EmptyState
            icon="chatbubble-ellipses-outline"
            title="No conversations yet"
            hint="When the center messages you, or you start a chat, it appears here."
          />
        ) : (
          inbox.map((row) => (
            <Pressable
              key={row.kind === 'group' ? row.group.groupId : row.person.userId}
              onPress={() => setActive(row)}
              hitSlop={8}
              delayPressIn={0}
              android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
              style={{
                backgroundColor: colors.white,
                borderColor: colors.line,
                borderWidth: 1,
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
                zIndex: 1,
              }}
            >
              <Body>
                {row.kind === 'group' ? row.group.name : displayName(row.person)}
                {row.unread ? ' · unread' : ''}
              </Body>
              <Caption style={{ marginTop: 4 }}>
                {row.kind === 'group'
                  ? `Group · ${packedMemberIds(row.group.memberIds).length} members`
                  : roleLabel(row.person.role)}
                {row.last?.message ? ` · ${row.last.message}` : ''}
              </Caption>
            </Pressable>
          ))
        )}
      </Screen>
    );
  }

  return (
    <Screen scroll={false} padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingHorizontal: space.md, paddingTop: space.md, gap: 6 }}>
          <Pressable onPress={() => setActive(null)} hitSlop={8}>
            <Caption style={{ color: colors.green }}>← All conversations</Caption>
          </Pressable>
          <Body>
            {active.kind === 'group' ? active.group.name : displayName(active.person)}
          </Body>
          <Caption>
            {active.kind === 'group'
              ? groupMemberNames(store, active.group) || 'Group chat'
              : roleLabel(active.person.role)}
          </Caption>
        </View>
        <ScrollView
          ref={log}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: space.md, gap: 8, paddingBottom: 24 }}
        >
          {rows.length === 0 ? (
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title="No messages yet"
              hint="Ask about a schedule, a child, or anything the center should know."
              fill={false}
            />
          ) : (
            rows.map((row) => {
              const mine = row.status === 'sent';
              return (
                <View
                  key={row.alertId}
                  style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    backgroundColor: mine ? colors.green : '#fff',
                    borderColor: mine ? colors.green : colors.line,
                    borderWidth: 1,
                    borderRadius: 16,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    maxWidth: '88%',
                    gap: 6,
                  }}
                >
                  <Body style={mine ? { color: colors.cream } : undefined}>{row.message}</Body>
                  <Caption style={{ color: mine ? 'rgba(244,241,233,0.75)' : colors.muted }}>
                    {mine ? 'You' : row.title || 'Member'} ·{' '}
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : ''}
                  </Caption>
                  {mine ? (
                    <Pressable onPress={() => void deleteMessage(row.alertId)} disabled={busy} hitSlop={8}>
                      <Caption style={{ color: mine ? 'rgba(244,241,233,0.9)' : colors.danger }}>Delete</Caption>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
        <View style={{ padding: space.md, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.cream }}>
          {error ? <Caption style={{ color: colors.danger, marginBottom: 8 }}>{error}</Caption> : null}
          <Field
            label="Message"
            required
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a message"
            multiline
            style={{ minHeight: 72, textAlignVertical: 'top' }}
          />
          <AppButton label={busy ? 'Sending…' : 'Send'} onPress={() => void send()} disabled={busy} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
