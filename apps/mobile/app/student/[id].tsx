import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { displayName, studentDisplay } from '@hiraya/utils';
import { AppButton, Body, Caption, Card, EmptyState, EmptyValue, Screen, StatusBadge, Title, Heading } from '../../src/components/ui';
import { Avatar } from '../../src/components/Avatar';
import { useCenter } from '../../src/store';
import { classForStudent, remainingForStudent, teacherName } from '../../src/selectors';

export default function StudentProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { store, children } = useCenter();
  const router = useRouter();
  const student = store.students.find((item) => item.studentId === id) || children.find((item) => item.studentId === id);
  const cls = student ? classForStudent(store, student.studentId) : undefined;
  const parent = store.users.find((item) => item.userId === student?.parentId);
  const teacher = store.users.find((item) => item.userId === cls?.teacherId);

  if (!student) {
    return (
      <Screen>
        <EmptyState title="Student not found" hint="This record is not available on your account." />
      </Screen>
    );
  }

  const remaining = remainingForStudent(store, student.studentId);

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
      <AppButton label="Attendance" variant="ghost" onPress={() => router.push('/attendance')} />
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
