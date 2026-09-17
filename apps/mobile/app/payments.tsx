import { View } from 'react-native';
import { formatDate } from '@hiraya/utils';
import { Caption, Card, EmptyState, ErrorState, Heading, LoadingState, Screen, StatusBadge, Title } from '../src/components/ui';
import { useAuth } from '../src/auth';
import { useCenter } from '../src/store';
import { canViewPayments } from '../src/rbac';

export default function PaymentsScreen() {
  const { user } = useAuth();
  const { store, loading, error, refresh, selected } = useCenter();
  const family = canViewPayments(store, user);
  const rows = store.payments.filter((item) => family && (!selected || item.studentId === selected.studentId));
  const open = rows.find((item) => ['pending', 'partial', 'overdue'].includes((item.paymentStatus || '').toLowerCase()));

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
      <Card>
        <Caption>Current balance</Caption>
        <Heading>
          ₱
          {rows
            .filter((item) => (item.paymentStatus || '').toLowerCase() !== 'paid')
            .reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0) - Number(item.amountPaid || 0)), 0)
            .toLocaleString()}
        </Heading>
        <StatusBadge status={open?.paymentStatus || (rows.length ? 'paid' : 'none')} />
        <Caption>There is no in-app payment gateway. Pay at the center using the posted method.</Caption>
      </Card>
      {rows.length === 0 ? (
        <EmptyState icon="receipt-outline" title="No payment history" hint="Charges posted by the center will appear here." />
      ) : (
        rows.map((item) => (
          <Card key={item.paymentId}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Heading>₱{Number(item.amount || 0).toLocaleString()}</Heading>
                <Caption>{item.notes || item.paymentMethod || 'Tuition'}</Caption>
                <Caption>{formatDate(item.dueAt || item.paymentDate)}</Caption>
              </View>
              <StatusBadge status={item.paymentStatus} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
