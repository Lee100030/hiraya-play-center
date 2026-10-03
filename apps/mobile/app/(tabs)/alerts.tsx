import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { SystemAlert } from '@hiraya/types';
import { Body, Caption, ErrorState, LoadingState, AppHeader, EmptyState } from '../../src/components/ui';
import { Enter } from '../../src/components/home/motion';
import { useAuth } from '../../src/auth';
import { api } from '../../src/auth';
import { useCenter } from '../../src/store';
import { adminAnnouncements, formatWhen } from '../../src/selectors';
import { isMobileTeacher } from '../../src/rbac';
import { colors, fonts, space } from '../../src/theme';

const KINDS = ['all', 'enrollment', 'schedule', 'task', 'attendance', 'progress', 'payment', 'announcement'] as const;

function kindMeta(kind?: string): { icon: keyof typeof Ionicons.glyphMap; tint: string } {
  const key = (kind || '').toLowerCase();
  if (key.includes('direct') || key.includes('message')) return { icon: 'chatbubble-ellipses-outline', tint: colors.gold };
  if (key.includes('attendance')) return { icon: 'checkmark-circle-outline', tint: colors.success };
  if (key.includes('progress')) return { icon: 'trending-up-outline', tint: colors.greenMid };
  if (key.includes('payment')) return { icon: 'card-outline', tint: colors.warn };
  if (key.includes('schedule')) return { icon: 'calendar-outline', tint: colors.green };
  if (key.includes('task')) return { icon: 'checkbox-outline', tint: colors.gold };
  if (key.includes('enroll')) return { icon: 'people-outline', tint: colors.gold };
  return { icon: 'notifications-outline', tint: colors.greenMid };
}

export default function NotificationsTab() {
  const { user } = useAuth();
  const { store, loading, error, refresh } = useCenter();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<(typeof KINDS)[number]>('all');
  const [localRead, setLocalRead] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const teacher = isMobileTeacher(user?.role);
  const news = adminAnnouncements(store);

  const rows = useMemo(() => {
    return store.alerts
      .filter((item) => (item.kind || '').toLowerCase() !== 'direct')
      .filter((item) => !hidden.includes(item.alertId))
      .filter((item) => kind === 'all' || (item.kind || '').toLowerCase().includes(kind))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [store.alerts, kind, hidden]);

  const unreadCount = rows.filter((item) => !item.read && !localRead.includes(item.alertId)).length;

  async function markRead(ids: string[]) {
    setLocalRead((current) => [...new Set([...current, ...ids])]);
    try {
      await api.putStore(
        {
          ...store,
          alerts: store.alerts.map((item) => (ids.includes(item.alertId) ? { ...item, read: true } : item)),
        },
        store,
      );
      await refresh();
    } catch {
      /* keep local read */
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  if (loading && !store.alerts.length && !news.length) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <LoadingState label="Loading notifications…" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <AppHeader title={teacher ? 'News' : 'Notifications'} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.gold} colors={[colors.gold]} progressBackgroundColor={colors.cream} />
        }
      >
        {error ? (
          <View style={{ paddingHorizontal: space.lg, marginBottom: space.sm }}>
            <ErrorState message={error} onRetry={() => void refresh()} />
          </View>
        ) : null}

        {teacher ? (
          news.length === 0 ? (
            <EmptyState
              icon="megaphone-outline"
              title="No announcements yet"
              hint="When the center admin publishes news, it will show here."
              actionLabel="Contact the center"
              onAction={() => router.push('/(tabs)/profile')}
            />
          ) : (
            <Enter index={1} style={styles.list}>
              {news.map((item) => (
                <View key={item.newsId} style={styles.row}>
                  <View style={[styles.badge, { backgroundColor: colors.goldSoft }]}>
                    <Ionicons name="megaphone-outline" size={18} color={colors.green} />
                  </View>
                  <View style={styles.rowBody}>
                    <Body style={styles.rowTitle} numberOfLines={2}>
                      {item.title}
                    </Body>
                    <Caption numberOfLines={2}>{item.body}</Caption>
                  </View>
                  <Caption style={styles.time}>{formatWhen(item.publishedAt)}</Caption>
                </View>
              ))}
            </Enter>
          )
        ) : (
          <>
            <Enter index={0}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                {KINDS.map((item) => {
                  const active = kind === item;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setKind(item)}
                      style={[styles.chip, active ? styles.chipOn : styles.chipOff]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={item}
                    >
                      <Caption style={[styles.chipText, active ? styles.chipTextOn : styles.chipTextOff]}>
                        {item === 'direct' ? 'Messages' : item}
                      </Caption>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Enter>

            {unreadCount ? (
              <Pressable onPress={() => void markRead(rows.map((item) => item.alertId))} style={styles.markAll}>
                <Caption style={styles.markAllText}>Mark all as read</Caption>
              </Pressable>
            ) : null}

            {rows.length === 0 ? (
              <EmptyState
                icon="notifications-outline"
                title="No notifications yet"
                hint="Center alerts for your account will appear here."
              />
            ) : (
              <Enter index={1} style={styles.list}>
                {rows.map((item) => (
                  <AlertRow
                    key={item.alertId}
                    item={item}
                    read={item.read || localRead.includes(item.alertId)}
                    onRead={() => void markRead([item.alertId])}
                    onDismiss={() => setHidden((current) => [...current, item.alertId])}
                  />
                ))}
              </Enter>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function AlertRow({
  item,
  read,
  onRead,
  onDismiss,
}: {
  item: SystemAlert;
  read: boolean;
  onRead: () => void;
  onDismiss: () => void;
}) {
  const meta = kindMeta(item.kind);
  return (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <Pressable onPress={onDismiss} style={styles.swipeHide} accessibilityLabel="Hide notification">
          <Caption style={styles.swipeHideText}>Hide</Caption>
        </Pressable>
      )}
    >
      <Pressable onPress={onRead} style={styles.row} accessibilityRole="button">
        <View style={[styles.badge, { backgroundColor: `${meta.tint}22` }]}>
          <Ionicons name={meta.icon} size={18} color={meta.tint} />
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Body style={styles.rowTitle} numberOfLines={1}>
              {item.title || item.kind || 'Notification'}
            </Body>
            {!read ? <View style={styles.unread} /> : null}
          </View>
          {item.message ? (
            <Caption numberOfLines={2} style={styles.preview}>
              {item.message}
            </Caption>
          ) : null}
        </View>
        <Caption style={styles.time}>{formatWhen(item.createdAt)}</Caption>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    paddingHorizontal: space.lg,
    paddingBottom: 4,
  },
  scroll: { flexGrow: 1, paddingBottom: 28 },
  chips: {
    paddingHorizontal: space.lg,
    paddingVertical: 4,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipOn: { backgroundColor: colors.green, borderWidth: 1, borderColor: colors.green },
  chipOff: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gold },
  chipText: {
    textTransform: 'capitalize',
    fontFamily: fonts.poppinsSemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  chipTextOn: { color: colors.cream },
  chipTextOff: { color: colors.green },
  markAll: {
    alignSelf: 'flex-start',
    marginLeft: space.lg,
    marginTop: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  markAllText: { color: colors.green },
  list: {
    marginTop: 8,
    marginHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 39, 0.22)',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(11, 31, 20, 0.08)',
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, fontFamily: fonts.poppinsSemiBold, color: colors.text },
  preview: { marginTop: 2 },
  time: { maxWidth: 78, textAlign: 'right' },
  unread: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  swipeHide: {
    width: 88,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeHideText: { color: colors.cream, fontFamily: fonts.poppinsSemiBold },
});
