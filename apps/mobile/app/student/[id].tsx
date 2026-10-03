import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { confirmStudentPresentToday, displayName, isStudentHereToday, studentDisplay } from '@hiraya/utils';
import { AppButton, Body, Caption, Card, EmptyState, EmptyValue, Screen, StatusBadge, Title, Heading } from '../../src/components/ui';
import { Avatar } from '../../src/components/Avatar';
import { api, useAuth } from '../../src/auth';
import { useCenter } from '../../src/store';
import { classForStudent, friendlyError, remainingForStudent, teacherName } from '../../src/selectors';
import { isMobileTeacher } from '../../src/rbac';

export default function StudentProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { store, children, refresh } = useCenter();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const student = store.students.find((item) => item.studentId === id) || children.find((item) => item.studentId === id);
  const cls = student ? classForStudent(store, student.studentId) : undefined;
  const parent = store.users.find((item) => item.userId === student?.parentId);
  const teacher = store.users.find((item) => item.userId === cls?.teacherId);
  const canMark = isMobileTeacher(user?.role) && student && children.some((item) => item.studentId === student.studentId);
  const here = student ? isStudentHereToday(store, student.studentId) : false;

  if (!student) {
    return (
      <Screen>
        <EmptyState title="Student not found" hint="This record is not available on your account." />
      </Screen>
    );
  }

  const remaining = remainingForStudent(store, student.studentId);

  function markPresent() {
    if (!user?.userId) return;
    if (here) {
      Alert.alert('Already marked', `${studentDisplay(student)} is already marked as here today.`);
      return;
    }
    Alert.alert(
      'Confirm attendance',
      `Mark ${studentDisplay(student)} as present today? Parents are notified and one session is used if they have a package.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark present',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await api.putStore(
                  confirmStudentPresentToday(store, student.studentId, user.userId, undefined, 'Confirmed present by teacher on mobile'),
                  store,
                );
                await refresh();
              } catch (err) {
                Alert.alert('Could not save attendance', friendlyError(err));
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <Avatar name={studentDisplay(student)} size="lg" accessibilityLabel={`${studentDisplay(student)} photo`} />
        <Title style={{ marginTop: 12 }}>{studentDisplay(student)}</Title>
        <StatusBadge status={student.status} />
      </View>
      <Card>
        <Heading>Student information</Heading>
        <Line label="Age" value={student.age ? String(student.age) : ''} />
        <Line label="Program" value={student.program || ''} />
        <Line label="Class" value={cls?.name || ''} />
        <View style={{ marginTop: 10 }}>
          <Caption>Teacher</Caption>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <Avatar
              user={teacher}
              name={teacherName(store, cls?.teacherId) || 'Teacher'}
              size="sm"
              accessibilityLabel={`${teacherName(store, cls?.teacherId) || 'Teacher'} profile photo`}
            />
            {teacherName(store, cls?.teacherId) ? (
              <Body>{teacherName(store, cls?.teacherId)}</Body>
            ) : (
              <EmptyValue />
            )}
          </View>
        </View>
        <Line label="Enrolled" value={student.enrollmentDate || ''} />
        <Line label="Sessions left" value={remaining.sessionsLabel} />
        <Line label="Days left" value={remaining.daysLabel} />
        <Line label="Today" value={here ? 'Present' : 'Not marked'} />
      </Card>
      <Card>
        <Heading>Parent information</Heading>
        <View style={{ marginTop: 10 }}>
          <Caption>Parent / guardian</Caption>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
            {parent ? <Avatar user={parent} size="sm" accessibilityLabel={`${displayName(parent)} profile photo`} /> : null}
            <Body>{parent ? displayName(parent) : 'On file with the center'}</Body>
          </View>
        </View>
        <Line label="Contact" value={student.contactNumber || parent?.phone || ''} />
      </Card>
      {canMark ? (
        <>
          <AppButton
            label={here ? 'Present today' : busy ? 'Saving…' : 'Mark here today'}
            onPress={markPresent}
            loading={busy}
            disabled={busy || here}
          />
          <View style={{ height: 8 }} />
        </>
      ) : null}
      <AppButton label="Attendance history" variant="ghost" onPress={() => router.push('/attendance')} />
      <View style={{ height: 8 }} />
      <AppButton label="Progress" variant="ghost" onPress={() => router.push('/(tabs)/progress')} />
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Caption>{label}</Caption>
      {value ? <Body>{value}</Body> : <EmptyValue />}
    </View>
  );
}
