import { View } from 'react-native';
import { formatDate } from '@hiraya/utils';
import { Caption, Card, EmptyState, ErrorState, Heading, LoadingState, Screen, StatusBadge, Title } from '../src/components/ui';
import { useAuth } from '../src/auth';
import { useCenter } from '../src/store';
import { attendanceCounts, attendanceForStudent } from '../src/selectors';
import { canViewAttendance, isMobileParent, isMobileTeacher } from '../src/rbac';

export default function AttendanceScreen() {
  const { user } = useAuth();
  const { store, loading, error, refresh, selected, children } = useCenter();
  const allowed = canViewAttendance(store, user);
  const scoped = isMobileParent(user?.role) || isMobileTeacher(user?.role);
  const rows = attendanceForStudent(store, scoped ? selected?.studentId : undefined).filter((item) => {
    if (!isMobileTeacher(user?.role)) return true;
    return children.some((student) => student.studentId === item.studentId);
  });
  const counts = attendanceCounts(rows);

  if (!allowed) {
    return (
      <Screen>
        <EmptyState icon="lock-closed-outline" title="Attendance is not available" hint="Your role cannot view attendance on this app." />
      </Screen>
    );
  }

  if (loading && !rows.length) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Attendance</Title>
      {error ? <ErrorState message={error} onRetry={() => void refresh()} /> : null}
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Count label="Present" value={counts.present} />
          <Count label="Absent" value={counts.absent} />
          <Count label="Late" value={counts.late} />
        </View>
      </Card>
      {rows.length === 0 ? (
        <EmptyState icon="checkmark-circle-outline" title="No attendance records" hint="Daily check-in from the center will appear here." />
      ) : (
        rows.map((item) => (
          <Card key={item.attendanceId}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Caption>{formatDate(item.attendanceDate)}</Caption>
                <Heading>
                  {store.classes.find((cls) => cls.classId === item.classId)?.name ||
                    store.students.find((student) => student.studentId === item.studentId)?.fullname ||
                    'Attendance'}
                </Heading>
                <Caption>
                  {item.timeIn ? `In ${item.timeIn}` : 'Time in not recorded'}
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
