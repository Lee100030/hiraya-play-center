import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { api } from '../src/auth';
import { AppButton, Body, Caption, Card, EmptyState, ErrorState, Heading, LoadingState, Screen, StatusBadge, Title } from '../src/components/ui';
import { useCenter } from '../src/store';
import { friendlyError } from '../src/selectors';
import type { PublicProgram } from '@hiraya/types';

export default function ProgramsScreen() {
  const { store, loading, error, refresh } = useCenter();
  const router = useRouter();
  const [publicPrograms, setPublicPrograms] = useState<PublicProgram[]>([]);
  const [publicError, setPublicError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPublicSite()
      .then((site) => setPublicPrograms(site.programs || []))
      .catch((err) => setPublicError(friendlyError(err)));
  }, []);

  const rows = store.programs.length ? store.programs : publicPrograms.map((item) => ({ ...item, status: 'active' }));

  if (loading && !rows.length) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Programs</Title>
      <Caption>Hiraya programs offered by the center.</Caption>
      {error || publicError ? <ErrorState message={error || publicError || ''} onRetry={() => void refresh()} /> : null}
      {rows.length === 0 ? (
        <EmptyState title="No programs listed" hint="The center has not published programs yet." />
      ) : (
        rows.map((item) => (
          <Card key={item.programId}>
            <StatusBadge status={'status' in item ? item.status : 'active'} />
            <Heading>{item.name}</Heading>
            <Body>{item.description || 'Details available from the center.'}</Body>
            <AppButton label="View details" variant="ghost" onPress={() => router.push(`/program/${item.programId}`)} />
          </Card>
        ))
      )}
    </Screen>
  );
}
