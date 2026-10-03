import { View } from 'react-native';
import { formatDate, formatPeso, studentPaymentBalance, studentPayments, studentPaymentTypeLabel } from '@hiraya/utils';
import { familyStudents } from '../src/selectors';
import { Caption, Card, EmptyState, ErrorState, Heading, LoadingState, Screen, StatusBadge, Title } from '../src/components/ui';
import { useAuth } from '../src/auth';
import { useCenter } from '../src/store';
import { canViewPayments } from '../src/rbac';

export default function PaymentsScreen() {
  const { user } = useAuth();
  const { store, loading, error, refresh, selected } = useCenter();
  const family = canViewPayments(store, user);
  const rows = selected
    ? studentPayments(store, selected.studentId)
    : familyStudents(store, user).flatMap((child) => studentPayments(store, child.studentId));
  const bill = selected ? studentPaymentBalance(store, selected.studentId) : null;

  if (!family) {
    return (
      <Screen>
        <EmptyState
          icon="card-outline"
          title="Payments are not on the teacher app"
          hint="Families see tuition on this screen. Teachers use Progress, Attendance, and Schedule."
        />
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
      <Title>Payments</Title>
      {error ? <ErrorState message={error} onRetry={() => void refresh()} /> : null}
      {bill ? (
        <Card>
          <Caption>Tuition fee</Caption>
          <Heading>₱{formatPeso(bill.tuitionFee)}</Heading>
          <Caption>Total paid ₱{formatPeso(bill.totalPaid)}</Caption>
          <Caption>Remaining balance ₱{formatPeso(bill.due)}</Caption>
          <StatusBadge status={bill.status} />
          <Caption>There is no in-app payment gateway. Pay at the center using the posted method.</Caption>
        </Card>
      ) : (
        <Card>
          <Caption>Choose a child to see tuition, total paid, and the remaining balance.</Caption>
        </Card>
      )}
      {rows.length === 0 ? (
        <EmptyState icon="receipt-outline" title="No payment history" hint="Payments recorded by the center will appear here." />
      ) : (
        rows.map((item) => (
          <Card key={item.paymentId}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Heading>₱{formatPeso(Number(item.amountPaid || item.amount || 0))}</Heading>
                <Caption>{studentPaymentTypeLabel(store, item)}</Caption>
                <Caption>{formatDate(item.paidAt || item.paymentDate)}</Caption>
              </View>
              <StatusBadge status={item.paymentStatus} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
