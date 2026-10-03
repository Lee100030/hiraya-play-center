import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton, AppHeader, Body, Caption, Card, EmptyState, ErrorState, Field, Heading, LoadingState, Screen, SectionTitle, StatusBadge } from '../../src/components/ui';
import { useCenter } from '../../src/store';
import {
  assignedNames,
  classForStudent,
  dayCells,
  eventPlace,
  eventTimeRange,
  eventTitle,
  formatTime,
  friendlyError,
  isTeacherTask,
  schedulesForDay,
  staffTasksForTeacher,
  teacherDayBoard,
  todayKey,
} from '../../src/selectors';
import { colors, fonts } from '../../src/theme';
import { useAuth } from '../../src/auth';
import { api } from '../../src/auth';
import { isMobileParent, isMobileTeacher } from '../../src/rbac';
import { localDateKey } from '@hiraya/utils';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ScheduleTab() {
  const { user } = useAuth();
  const { store, loading, error, refresh, selected } = useCenter();
  const router = useRouter();
  const params = useLocalSearchParams<{ task?: string }>();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [picked, setPicked] = useState(todayKey());
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskBusy, setTaskBusy] = useState(false);
  const teacher = isMobileTeacher(user?.role);
  const family = isMobileParent(user?.role);
  const child = family ? selected : undefined;
  const teacherId = teacher ? user?.userId : undefined;
  const days = useMemo(() => dayCells(month), [month]);
  const today = todayKey();
  const monthLabel = month.toLocaleString('en-PH', { month: 'long', year: 'numeric' });

  const board = useMemo(() => {
    if (teacherId) return teacherDayBoard(store, teacherId, picked);
    return {
      schedules: schedulesForDay(store, picked, child),
      tasks: [] as ReturnType<typeof staffTasksForTeacher>,
      holidays: (store.centerHolidays || []).filter((item) => localDateKey(item.date) === picked),
    };
  }, [store, teacherId, picked, child]);

  const classes = board.schedules.filter((item) => !isTeacherTask(item));
  const personalTasks = board.schedules.filter((item) => isTeacherTask(item));
  const assignedTasks = board.tasks;
  const dayCount = classes.length + personalTasks.length + assignedTasks.length + board.holidays.length;

  useEffect(() => {
    if (teacher && params.task === '1') {
      setTaskOpen(true);
      router.setParams({ task: undefined });
    }
  }, [params.task, teacher, router]);

  function countsOn(day: string) {
    if (teacherId) {
      const item = teacherDayBoard(store, teacherId, day);
      return item.schedules.length + item.tasks.length + item.holidays.length;
    }
    return (
      schedulesForDay(store, day, child).length +
      (store.centerHolidays || []).filter((row) => localDateKey(row.date) === day).length
    );
  }

  async function saveTask() {
    if (!user || !taskTitle.trim()) {
      setTaskOpen(false);
      return;
    }
    setTaskBusy(true);
    try {
      const start = new Date(`${picked}T08:00:00`);
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
      }, store);
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
        title="Calendar"
        subtitle={
          teacher
            ? 'Same center calendar. Your assigned class times and tasks from Super Admin appear here.'
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
              <Caption style={{ color: colors.green }}>My task</Caption>
            </Pressable>
          ) : undefined
        }
      />
      {error ? <ErrorState message={error} onRetry={() => void refresh()} /> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 16, marginBottom: 12 }}>
        <NavChip
          label="Previous"
          onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
        />
        <NavChip
          label="Today"
          onPress={() => {
            const now = new Date();
            setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
            setPicked(todayKey(now));
          }}
        />
        <NavChip
          label="Next"
          onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
        />
        <Text style={{ fontFamily: fonts.poppinsBold, color: colors.green, fontSize: 15 }}>{monthLabel}</Text>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {WEEKDAYS.map((label) => (
          <Text key={label} style={{ flex: 1, textAlign: 'center', fontFamily: fonts.poppinsSemiBold, color: colors.muted, fontSize: 10 }}>
            {label}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: colors.line, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface }}>
        {days.map((date) => {
          const key = todayKey(date);
          const inMonth = date.getMonth() === month.getMonth();
          const on = key === picked;
          const isToday = key === today;
          const count = inMonth ? countsOn(key) : 0;
          return (
            <Pressable
              key={key + String(inMonth)}
              onPress={() => setPicked(key)}
              style={{
                width: '14.28%',
                minHeight: 64,
                padding: 4,
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: colors.line,
                backgroundColor: on ? '#fff8e6' : colors.surface,
                opacity: inMonth ? 1 : 0.45,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.poppinsBold,
                  fontSize: 12,
                  color: isToday ? colors.gold : colors.green,
                }}
              >
                {date.getDate()}
              </Text>
              {count ? (
                <Text style={{ fontFamily: fonts.poppinsSemiBold, fontSize: 9, color: colors.greenMid }} numberOfLines={2}>
                  {count} item{count === 1 ? '' : 's'}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <SectionTitle title={picked === today ? 'Today' : picked} />
      {dayCount === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title={teacher ? 'No assigned schedule this day' : 'No classes this day'}
          hint={
            teacher
              ? 'When Super Admin assigns you on the center calendar, it shows on this date.'
              : 'Nothing is scheduled for this date.'
          }
          actionLabel={teacher ? 'Add a personal task' : undefined}
          onAction={teacher ? () => setTaskOpen(true) : undefined}
        />
      ) : null}

      {board.holidays.map((row) => (
        <Card key={row.holidayId}>
          <Caption>Holiday</Caption>
          <Heading>{row.title}</Heading>
        </Card>
      ))}

      {classes.map((item) => {
        const when = eventTimeRange(item.startAt, item.endAt);
        const place = eventPlace(item.room);
        const names = assignedNames(store, item.teacherId);
        return (
          <Card key={item.scheduleId}>
            {when ? <Caption>{when}</Caption> : null}
            <Heading>{eventTitle(item)}</Heading>
            {place ? <Body>{place}</Body> : null}
            {names.map((name) => (
              <Caption key={name} style={{ fontFamily: fonts.poppinsBold, color: colors.green }}>
                {name}
              </Caption>
            ))}
            {item.notes ? <Caption>{item.notes}</Caption> : null}
            <View style={{ marginTop: 8 }}>
              <StatusBadge status={item.status || 'confirmed'} />
            </View>
          </Card>
        );
      })}

      {teacher ? (
        <>
          {assignedTasks.map((item) => (
            <Pressable key={item.taskId} onPress={() => router.push('/tasks')}>
              <Card>
                <Caption>
                  Assigned by the center · {item.priority}
                </Caption>
                <Heading>{item.title}</Heading>
                {item.description ? <Body>{item.description}</Body> : null}
                <StatusBadge status={item.status} />
              </Card>
            </Pressable>
          ))}
          {personalTasks.map((item) => (
            <Card key={item.scheduleId}>
              <Caption>My personal task · {eventTimeRange(item.startAt, item.endAt) || formatTime(item.startAt)}</Caption>
              <Heading>{eventTitle(item)}</Heading>
              <StatusBadge status="assigned" />
            </Card>
          ))}
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
            <Heading>Add a personal task</Heading>
            <Caption style={{ marginBottom: 12 }}>Saved to your calendar for {picked}. Parents will not see this.</Caption>
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

function NavChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 40,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.gold,
        justifyContent: 'center',
        backgroundColor: colors.surface,
      }}
    >
      <Caption style={{ color: colors.green }}>{label}</Caption>
    </Pressable>
  );
}
