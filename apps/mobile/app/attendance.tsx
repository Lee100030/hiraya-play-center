import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  confirmStudentPresentToday,
  formatDate,
  isStudentHereToday,
  sessionLeftLabel,
  studentDayAttendance,
  studentDisplay,
} from '@hiraya/utils';
import {
  AppButton,
  Body,
  Caption,
  Card,
  EmptyState,
  ErrorState,
  Heading,
  LoadingState,
  Screen,
  StatusBadge,
  Title,
} from '../src/components/ui';
import { api, useAuth } from '../src/auth';
import { useCenter } from '../src/store';
import { attendanceCounts, attendanceForStudent, familyStudents, friendlyError } from '../src/selectors';
import { canViewAttendance, isMobileParent, isMobileTeacher } from '../src/rbac';
import { colors, space } from '../src/theme';

export default function AttendanceScreen() {
  const { user } = useAuth();
  const { store, loading, error, refresh, selected, children } = useCenter();
  const allowed = canViewAttendance(store, user);
  const teacher = isMobileTeacher(user?.role);
  const parent = isMobileParent(user?.role);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const roster = useMemo(() => (teacher ? familyStudents(store, user) : []), [store, teacher, user]);

  const history = useMemo(() => {
    if (teacher) {
      const ids = new Set(roster.map((row) => row.studentId));
      return attendanceForStudent(store).filter((item) => ids.has(item.studentId));
    }
    if (parent) {
      return attendanceForStudent(store, selected?.studentId).filter((item) =>
        children.some((student) => student.studentId === item.studentId),
      );
    }
    return attendanceForStudent(store, selected?.studentId);
  }, [children, parent, roster, selected?.studentId, store, teacher]);

  const counts = attendanceCounts(history);

  async function markHereToday(studentId: string) {
    if (!user?.userId) return;
    const student = store.students.find((item) => item.studentId === studentId);
    const name = student ? studentDisplay(student) : 'this student';
    if (isStudentHereToday(store, studentId)) {
      Alert.alert('Already marked', `${name} is already marked as here today.`);
      return;
    }
    Alert.alert(
      'Confirm attendance',
      `Mark ${name} as present today? Parents are notified and one session is used if they have a package.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark present',
          onPress: () => {
            void (async () => {
              setBusyId(studentId);
              setNotice('');
              try {
                const next = confirmStudentPresentToday(
                  store,
                  studentId,
                  user.userId,
                  undefined,
                  'Confirmed present by teacher on mobile',
                );
                await api.putStore(next, store);
                await refresh();
                setNotice(`${name} is marked present. Parents were notified and sessions updated.`);
              } catch (err) {
                Alert.alert('Could not save attendance', friendlyError(err));
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ],
    );
  }

  if (!allowed) {
    return (
      <Screen>
        <EmptyState icon="lock-closed-outline" title="Attendance is not available" hint="Your role cannot view attendance on this app." />
      </Screen>
    );
  }

  if (loading && !history.length && !roster.length) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Attendance</Title>
      <Caption style={{ marginBottom: space.sm }}>
        {teacher
          ? 'Mark assigned students present. Parents get an alert and a session is used from their package.'
          : 'Daily check-in from the center and teachers appears here.'}
      </Caption>
      {error ? <ErrorState message={error} onRetry={() => void refresh()} /> : null}
      {notice ? <Caption style={{ color: colors.success, marginBottom: space.sm }}>{notice}</Caption> : null}

      {teacher ? (
        <>
          <Heading style={{ marginBottom: 8 }}>Today&apos;s roster</Heading>
          {roster.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No assigned students"
              hint="Students appear here when Super Admin assigns them to your class."
              fill={false}
            />
          ) : (
            roster.map((student) => {
              const today = studentDayAttendance(store, student.studentId);
              const here = isStudentHereToday(store, student.studentId);
              return (
                <Card key={student.studentId}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Body>{studentDisplay(student)}</Body>
                      <Caption style={{ marginTop: 4 }}>
                        {student.program || 'Program not set'} · Sessions: {sessionLeftLabel(store, student.studentId) || '—'}
                      </Caption>
                    </View>
                    <StatusBadge status={here ? today?.status || 'present' : today?.status || 'not marked'} />
                  </View>
                  {!here ? (
                    <View style={{ marginTop: 12 }}>
                      <AppButton
                        label={busyId === student.studentId ? 'Saving…' : 'Mark here today'}
                        onPress={() => void markHereToday(student.studentId)}
                        loading={busyId === student.studentId}
                        disabled={Boolean(busyId)}
                      />
                    </View>
                  ) : (
                    <Caption style={{ marginTop: 10, color: colors.success }}>Present today · parents notified</Caption>
                  )}
                </Card>
              );
            })
          )}
        </>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Count label="Present" value={counts.present} />
          <Count label="Absent" value={counts.absent} />
          <Count label="Late" value={counts.late} />
        </View>
      </Card>

      <Heading style={{ marginBottom: 8, marginTop: 4 }}>History</Heading>
      {history.length === 0 ? (
        <EmptyState
          icon="checkmark-circle-outline"
          title="No attendance records"
          hint={teacher ? 'Mark a student present to create the first record.' : 'Daily check-in from the center will appear here.'}
          fill={false}
        />
      ) : (
        history.map((item) => (
          <Card key={item.attendanceId}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Caption>{formatDate(item.attendanceDate)}</Caption>
                <Heading>
                  {store.students.find((student) => student.studentId === item.studentId)
                    ? studentDisplay(store.students.find((student) => student.studentId === item.studentId)!)
                    : store.classes.find((cls) => cls.classId === item.classId)?.name || 'Attendance'}
                </Heading>
                <Caption>
                  {item.timeIn ? `In ${new Date(item.timeIn).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}` : 'Time in not recorded'}
                  {item.timeOut ? ` · Out ${item.timeOut}` : ''}
                </Caption>
              </View>
              <StatusBadge status={item.status} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <View>
      <Caption>{label}</Caption>
      <Heading>{value}</Heading>
    </View>
  );
}
