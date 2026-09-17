import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth';
import { useCenter } from '../../src/store';
import { useSessionProfile } from '../../src/profilePhoto';
import { ErrorState } from '../../src/components/ui';
import { Enter } from '../../src/components/home/motion';
import { HomeHero } from '../../src/components/home/Hero';
import { HomeStats } from '../../src/components/home/StatRow';
import { HomeHighlights } from '../../src/components/home/Highlights';
import { HomeQuickActions } from '../../src/components/home/QuickActions';
import { HomeActivity } from '../../src/components/home/ActivityFeed';
import {
  adminAnnouncements,
  nextHighlight,
  overallProgress,
  remainingForStudent,
  reportsForStudent,
  schedulesForDay,
  teacherModules,
  todayAttendanceStatus,
  todayKey,
} from '../../src/selectors';
import { isMobileParent, isMobileTeacher } from '../../src/rbac';
import { colors, space } from '../../src/theme';

export default function HomeTab() {
  const { user } = useAuth();
  const profile = useSessionProfile();
  const { store, error, refresh, children, selected, setSelectedId } = useCenter();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const family = isMobileParent(user?.role);
  const teacher = isMobileTeacher(user?.role);
  const child = family ? selected : undefined;
  const today = schedulesForDay(store, todayKey(), child, teacher ? user?.userId : undefined);
  const unread = store.alerts.filter((item) => !item.read && item.kind !== 'direct').length;
  const upcoming = nextHighlight(store, child, teacher ? user?.userId : undefined);
  const remaining = remainingForStudent(store, child?.studentId);
  const progress = overallProgress(reportsForStudent(store, child?.studentId));
  const modules = teacherModules(store, user?.userId);
  const news = adminAnnouncements(store);
  const activity = useMemo(
    () =>
      [...store.alerts]
        .filter((item) => item.kind !== 'direct')
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, 6),
    [store.alerts],
  );

  const stats = family
    ? [
        {
          key: 'kids',
          label: 'Kids assigned',
          value: children.length ? String(children.length) : 'None',
          icon: 'people-outline' as const,
          onPress: () => (selected ? router.push(`/student/${selected.studentId}`) : undefined),
        },
        {
          key: 'progress',
          label: 'Progress',
          value: `${progress}%`,
          icon: 'trending-up-outline' as const,
          onPress: () => router.push('/(tabs)/progress'),
        },
        {
          key: 'attendance',
          label: "Today's attendance",
          value: todayAttendanceStatus(store, child?.studentId),
          icon: 'checkmark-circle-outline' as const,
          onPress: () => router.push('/attendance'),
        },
        {
          key: 'sessions',
          label: remaining.daysLabel,
          value: remaining.sessionsLabel,
          icon: 'hourglass-outline' as const,
          onPress: () => router.push('/sessions'),
        },
      ]
    : [
        {
          key: 'class',
          label: "Today's schedule",
          value: today.length ? `${today.length} ${today.length === 1 ? 'session' : 'sessions'}` : 'None today',
          icon: 'time-outline' as const,
          onPress: () => router.push('/(tabs)/schedule'),
        },
        {
          key: 'calendar',
          label: 'Next on calendar',
          value: upcoming.title,
          icon: 'calendar-outline' as const,
          onPress: () => router.push('/(tabs)/schedule'),
        },
        {
          key: 'kids',
          label: 'My students',
          value: children.length ? String(children.length) : 'None',
          icon: 'people-outline' as const,
          onPress: () => router.push('/students'),
        },
        {
          key: 'tasks',
          label: 'Pending tasks',
          value: `${(store.staffTasks || []).filter((item) => !['completed', 'cancelled'].includes(item.status)).length} open`,
          icon: 'checkbox-outline' as const,
          onPress: () => router.push('/tasks'),
        },
      ];

  const actions = family
    ? [
        { key: 'sheet', label: 'Student sheet', icon: 'happy-outline' as const, onPress: () => (selected ? router.push(`/student/${selected.studentId}`) : router.push('/(tabs)/progress')) },
        { key: 'progress', label: 'Milestones', icon: 'trending-up-outline' as const, onPress: () => router.push('/(tabs)/progress') },
        { key: 'attendance', label: 'Attendance', icon: 'checkbox-outline' as const, onPress: () => router.push('/attendance') },
        { key: 'pay', label: 'Payments', icon: 'card-outline' as const, onPress: () => router.push('/payments') },
        { key: 'calendar', label: 'HIRAYA calendar', icon: 'calendar-outline' as const, onPress: () => router.push('/(tabs)/schedule') },
        { key: 'sessions', label: 'Sessions left', icon: 'hourglass-outline' as const, onPress: () => router.push('/sessions') },
      ]
    : [
        { key: 'tasks', label: 'My tasks', icon: 'checkbox-outline' as const, onPress: () => router.push('/tasks') },
        { key: 'students', label: 'My students', icon: 'people-outline' as const, onPress: () => router.push('/students') },
        { key: 'calendar', label: 'My schedule', icon: 'calendar-outline' as const, onPress: () => router.push('/(tabs)/schedule') },
        { key: 'notes', label: 'Notes', icon: 'document-text-outline' as const, onPress: () => router.push('/notes') },
      ];

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
          <HomeHero
            user={profile}
            family={family}
        childrenList={children}
        selected={selected}
        onOpenProfile={() => router.push('/(tabs)/profile')}
        onSelectChild={setSelectedId}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 24) + 16 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.gold} colors={[colors.gold]} progressBackgroundColor={colors.cream} />
        }
      >
        <View style={styles.body}>
          {error ? (
            <View style={{ marginBottom: space.md }}>
              <ErrorState message={error} onRetry={() => void refresh()} />
            </View>
          ) : null}
          <Enter index={1}>
            <HomeStats items={stats} />
          </Enter>
          <Enter index={2} style={styles.section}>
            <HomeHighlights news={news} onOpen={() => router.push(teacher ? '/(tabs)/alerts' : '/announcements')} />
          </Enter>
          <Enter index={3} style={styles.section}>
            <HomeQuickActions items={actions} />
          </Enter>
          <Enter index={4} style={styles.section}>
            <HomeActivity items={activity} onOpen={() => router.push('/(tabs)/alerts')} />
          </Enter>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scroll: {
    flexGrow: 1,
  },
  body: {
    paddingHorizontal: space.lg,
    paddingTop: 20,
  },
  section: {
    marginTop: 20,
  },
});
