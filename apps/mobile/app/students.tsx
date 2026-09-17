import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { Body, Caption, Card, EmptyState, Screen, StatusBadge, Title } from '../src/components/ui';
import { useAuth } from '../src/auth';
import { useCenter } from '../src/store';
import { classForStudent, familyStudents, remainingForStudent } from '../src/selectors';
import { isMobileTeacher } from '../src/rbac';
import { studentDisplay } from '@hiraya/utils';

export default function TeacherStudentsScreen() {
  const { user } = useAuth();
  const { store } = useCenter();
  const router = useRouter();
  const rows = familyStudents(store, user);

  if (!isMobileTeacher(user?.role)) {
    return (
      <Screen>
        <EmptyState icon="lock-closed-outline" title="Teachers only" hint="Assigned students are shown to the signed-in teacher." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>My students</Title>
      <Caption>Children assigned to your account from Teacher Management.</Caption>
      {rows.length === 0 ? (
        <EmptyState icon="people-outline" title="No assigned students" hint="The Super Administrator assigns students from the desktop workspace." />
      ) : (
        rows.map((row) => {
          const cls = classForStudent(store, row.studentId);
          const remaining = remainingForStudent(store, row.studentId);
          return (
            <Pressable key={row.studentId} onPress={() => router.push(`/student/${row.studentId}`)}>
              <Card>
                <Body>{studentDisplay(row)}</Body>
                <Caption>
                  {row.program || cls?.name || 'No class'} · {remaining.sessionsLabel}
                </Caption>
                <StatusBadge status={row.status} />
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}
