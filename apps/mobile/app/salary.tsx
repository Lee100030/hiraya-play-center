import { View } from 'react-native';
import { formatDate, formatPeso, isTeacherPayment } from '@hiraya/utils';
import { Caption, Card, EmptyState, Heading, Screen, StatusBadge, Title } from '../src/components/ui';
import { useAuth } from '../src/auth';
import { useCenter } from '../src/store';
import { isMobileTeacher } from '../src/rbac';

export default function SalaryScreen() {
  const { user } = useAuth();
  const { store } = useCenter();
  const teacher = isMobileTeacher(user?.role);
  const rows = teacher
    ? store.payments.filter(
        (item) => isTeacherPayment(item) && (item.studentId || '').toLowerCase() === (user?.userId || '').toLowerCase(),
      )
    : [];

  if (!teacher) {
    return (
      <Screen>
        <EmptyState icon="cash-outline" title="Salary is on the teacher app" hint="Parents see tuition on Payments." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>My salary</Title>
      <Caption>Only pay records stored for your account. Other teachers' pay is not included.</Caption>
      {rows.length === 0 ? (
        <EmptyState icon="cash-outline" title="No salary records yet" hint="When the center records your pay, the period, amount, status, and date appear here." />
      ) : (
        rows.map((item) => (
          <Card key={item.paymentId}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Heading>₱{formatPeso(Number(item.amountPaid || item.amount || 0))}</Heading>
                <Caption>Pay date {formatDate(item.paidAt || item.paymentDate)}</Caption>
                {item.dueAt ? <Caption>Period due {formatDate(item.dueAt)}</Caption> : null}
                {item.notes ? <Caption>{item.notes}</Caption> : null}
              </View>
              <StatusBadge status={item.paymentStatus} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
