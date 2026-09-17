import { Body, Caption, Card, EmptyState, ErrorState, Heading, LoadingState, Screen, StatusBadge, Title } from '../src/components/ui';
import { useCenter } from '../src/store';
import { studentDisplay } from '@hiraya/utils';
import { isMobileParent } from '../src/rbac';
import { useAuth } from '../src/auth';

export default function SessionsScreen() {
  const { user } = useAuth();
  const { store, loading, error, refresh, selected } = useCenter();
  const packages = (store.sessionPackages || []).filter((row) => !selected || row.studentId === selected.studentId);
  const history = (store.sessionHistory || []).filter((row) => !selected || row.studentId === selected.studentId);

  if (!isMobileParent(user?.role)) {
    return (
      <Screen>
        <EmptyState icon="hourglass-outline" title="Sessions are for parents" hint="Teachers see assigned class times on Calendar." />
      </Screen>
    );
  }

  if (loading && !packages.length) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Sessions</Title>
      <Caption>
        {selected ? studentDisplay(selected) : 'Select a child on Home.'} Remaining sessions come from the package the center saved — they cannot be edited here.
      </Caption>
      {error ? <ErrorState message={error} onRetry={() => void refresh()} /> : null}
      {packages.length === 0 ? (
        <EmptyState icon="hourglass-outline" title="No session package" hint="Ask the center to add a session package for this child." />
      ) : (
        packages.map((row) => (
          <Card key={row.packageId}>
            <StatusBadge status={row.status} />
            <Heading>
              {row.remainingSessions} remaining
            </Heading>
            <Body>
              {row.usedSessions} used of {row.totalSessions} total
            </Body>
            <Caption>
              {row.startDate || '—'} → {row.expirationDate || 'no expiry'}
            </Caption>
          </Card>
        ))
      )}
      {history.length ? (
        <>
          <Heading>History</Heading>
          {history
            .slice()
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
            .map((row) => (
              <Card key={row.historyId}>
                <Caption>{(row.createdAt || '').slice(0, 10)}</Caption>
                <Body>{row.note || row.action}</Body>
              </Card>
            ))}
        </>
      ) : null}
    </Screen>
  );
}
