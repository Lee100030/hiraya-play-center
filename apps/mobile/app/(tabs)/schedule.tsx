import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton, AppHeader, Body, Caption, Card, EmptyState, ErrorState, Field, Heading, LoadingState, Screen, SectionTitle, StatusBadge } from '../../src/components/ui';
import { useCenter } from '../../src/store';
import { classForStudent, eventPlace, eventTimeRange, eventTitle, formatTime, isTeacherTask, schedulesForDay, todayKey } from '../../src/selectors';
import { colors, fonts } from '../../src/theme';
import { useAuth } from '../../src/auth';
import { api } from '../../src/auth';
import { isMobileParent, isMobileTeacher } from '../../src/rbac';
import { friendlyError } from '../../src/selectors';

function addDays(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date;
}

export default function ScheduleTab() {
  const { user } = useAuth();
  const { store, loading, error, refresh, selected } = useCenter();
  const router = useRouter();
  const params = useLocalSearchParams<{ task?: string }>();
  const [offset, setOffset] = useState(0);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskBusy, setTaskBusy] = useState(false);
  const teacher = isMobileTeacher(user?.role);
  const family = isMobileParent(user?.role);
  const day = addDays(offset);
  const key = todayKey(day);
  const child = family ? selected : undefined;
  const rows = useMemo(
    () => schedulesForDay(store, key, child, teacher ? user?.userId : undefined),
    [store, key, child, user, teacher],
  );
  const classes = rows.filter((item) => !isTeacherTask(item) && Boolean(item.startAt));
  const tasks = rows.filter((item) => isTeacherTask(item));
  const days = Array.from({ length: 7 }, (_, index) => addDays(index));

  useEffect(() => {
    if (teacher && params.task === '1') {
      setTaskOpen(true);
      router.setParams({ task: undefined });
    }
  }, [params.task, teacher, router]);

  async function saveTask() {
    if (!user || !taskTitle.trim()) {
      setTaskOpen(false);
      return;
    }
    setTaskBusy(true);
    try {
      const start = new Date();
      start.setMinutes(0, 0, 0);
      if (offset) start.setDate(start.getDate() + offset);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      await api.putStore({
        ...store,
        schedules: [
          ...store.schedules,
          {
            scheduleId: `task_${Date.now()}`,
            title: taskTitle.trim(),
            kind: 'teacherTask',
            scheduleType: 'teacherTask',
            classId: '',
            studentId: '',
            teacherId: user.userId,
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            room: '',
            notes: '',
            status: 'confirmed',
          },
        ],
      });
      setTaskTitle('');
      setTaskOpen(false);
      await refresh();
    } catch (err) {
      Alert.alert('Could not save task', friendlyError(err, 'The center could not save that task. Try again.'));
    } finally {
      setTaskBusy(false);
    }
  }

  if (loading && !store.schedules.length) {
    return (
      <Screen>
        <LoadingState label="Loading calendar…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title={teacher ? 'Calendar' : 'Schedule'}
        subtitle={
          teacher
            ? 'Your classes, prep, and personal tasks for this week.'
            : child
              ? `Class times for ${child.fullname || child.firstName}`
              : 'Published class times from the center.'
        }
        action={
          teacher ? (
            <Pressable
              onPress={() => setTaskOpen(true)}
              style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.gold, justifyContent: 'center' }}
            >
              <Caption style={{ color: colors.green }}>Assign</Caption>
            </Pressable>
          ) : undefined
        }
      />
      {error ? <ErrorState message={error} onRetry={() => void refresh()} /> : null}
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 16, marginBottom: 8 }}>
        {days.map((item, index) => {
          const active = index === offset;
          return (
            <Pressable
              key={item.toISOString()}
              onPress={() => setOffset(index)}
              style={{
                flex: 1,
                minHeight: 52,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? colors.green : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.green : colors.line,
              }}
            >
              <Caption style={{ color: active ? colors.cream : colors.muted, fontFamily: fonts.poppinsSemiBold }}>
                {item.toLocaleDateString('en-PH', { weekday: 'short' })}
              </Caption>
              <Text style={{ color: active ? colors.gold : colors.green, fontFamily: fonts.poppinsBold, fontSize: 16, lineHeight: 20 }}>
                {item.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <SectionTitle title={offset === 0 ? 'Today' : key} />
      {classes.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="No classes this day"
          hint="Nothing is scheduled for this date."
          actionLabel={teacher ? 'Assign a task' : 'Contact the center'}
          onAction={() => (teacher ? setTaskOpen(true) : router.push('/(tabs)/profile'))}
        />
      ) : (
        classes.map((item) => {
          const when = eventTimeRange(item.startAt, item.endAt);
          const place = eventPlace(item.room);
          return (
            <Card key={item.scheduleId}>
              {when ? <Caption>{when}</Caption> : null}
              <Heading>{eventTitle(item)}</Heading>
              {place ? <Body>{place}</Body> : null}
              {item.notes ? <Caption>{item.notes}</Caption> : null}
              <View style={{ marginTop: 8 }}>
                <StatusBadge status={item.status || 'confirmed'} />
              </View>
            </Card>
          );
        })
      )}
      {teacher ? (
        <>
          <SectionTitle title="My tasks" />
          {tasks.length === 0 ? (
            <EmptyState
              icon="create-outline"
              title="No tasks today"
              hint="Assign prep, a huddle, or a follow-up for this day."
              actionLabel="Assign a task"
              onAction={() => setTaskOpen(true)}
              fill={classes.length === 0 ? false : true}
            />
          ) : (
            tasks.map((item) => (
              <Card key={item.scheduleId}>
                <Caption>{eventTimeRange(item.startAt, item.endAt) || formatTime(item.startAt)}</Caption>
                <Heading>{eventTitle(item)}</Heading>
                <StatusBadge status="assigned" />
              </Card>
            ))
          )}
        </>
      ) : null}
      {child && classForStudent(store, child.studentId) ? (
        <Card>
          <Caption>Regular class</Caption>
          <Heading>{classForStudent(store, child.studentId)?.name}</Heading>
          <Body>{classForStudent(store, child.studentId)?.scheduleNotes || 'See daily times above.'}</Body>
        </Card>
      ) : null}

      <Modal visible={taskOpen} animationType="slide" transparent onRequestClose={() => setTaskOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }} onPress={() => setTaskOpen(false)}>
          <Pressable
            style={{ backgroundColor: colors.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}
            onPress={(event) => event.stopPropagation()}
          >
            <Heading>Assign a task</Heading>
            <Caption style={{ marginBottom: 12 }}>Saved to your calendar for the selected day. Parents will not see this.</Caption>
            <Field label="Task" required value={taskTitle} onChangeText={setTaskTitle} placeholder="Prep materials, parent follow-up…" />
            <AppButton label="Save task" onPress={() => void saveTask()} loading={taskBusy} disabled={taskBusy || !taskTitle.trim()} />
            <Pressable onPress={() => setTaskOpen(false)} style={{ minHeight: 44, marginTop: 8, alignItems: 'center' }}>
              <Caption style={{ color: colors.green }}>Cancel</Caption>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
