import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { AppButton, Body, Caption, EmptyState, Field, Screen } from '../src/components/ui';
import { api, useAuth } from '../src/auth';
import { useCenter } from '../src/store';
import { friendlyError } from '../src/selectors';
import { colors, space } from '../src/theme';

export default function MessagesScreen() {
  const { user } = useAuth();
  const { store, refresh } = useCenter();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const log = useRef<ScrollView>(null);

  const rows = useMemo(
    () =>
      store.alerts
        .filter((item) => item.kind === 'direct' && item.recipientId === user?.userId)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')),
    [store.alerts, user?.userId],
  );

  const incomingUnread = store.alerts.filter(
    (item) => item.kind === 'direct' && item.recipientId === user?.userId && !item.read && item.status !== 'sent',
  ).length;

  useEffect(() => {
    log.current?.scrollToEnd({ animated: true });
  }, [rows.length]);

  useEffect(() => {
    if (!user?.userId || incomingUnread === 0) return;
    void api
      .putStore({
        ...store,
        alerts: store.alerts.map((item) =>
          item.kind === 'direct' && item.recipientId === user.userId && !item.read && item.status !== 'sent'
            ? { ...item, read: true, status: 'read' }
            : item,
        ),
      })
      .then(() => refresh())
      .catch(() => undefined);
  }, [incomingUnread, user?.userId]);

  async function send() {
    const body = draft.trim();
    if (!body) {
      setError('Write a message first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.sendDirectMessage('', body);
      setDraft('');
      await refresh();
    } catch (err) {
      setError(friendlyError(err, 'Could not send that message. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll={false} padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Caption style={{ paddingHorizontal: space.md, paddingTop: space.md, marginBottom: space.sm }}>
          This thread is saved for you and the Super Administrator. Replies stay here — they are not treated as News alerts.
        </Caption>
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
                  }}
                >
                  <Body style={mine ? { color: colors.cream } : undefined}>{row.message}</Body>
                  <Caption style={{ marginTop: 6, color: mine ? 'rgba(244,241,233,0.75)' : colors.muted }}>
                    {mine ? 'You' : row.title || 'Center'} ·{' '}
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : ''}
                  </Caption>
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
