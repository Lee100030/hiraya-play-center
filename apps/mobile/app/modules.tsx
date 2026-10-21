import { useState } from 'react';
import { View } from 'react-native';
import { Body, AppButton, Caption, Card, EmptyState, ErrorState, Heading, LoadingState, ProgressBar, Screen, StatusBadge, Title } from '../src/components/ui';
import { useAuth } from '../src/auth';
import { openLearningModule } from '../src/openModule';
import { useCenter } from '../src/store';
import { canViewModules, isMobileTeacher } from '../src/rbac';
import { teacherModules } from '../src/selectors';

function moduleProgress(status?: string) {
  const key = (status || '').toLowerCase();
  if (key.includes('complete') || key.includes('published')) return 70;
  if (key.includes('draft')) return 20;
  if (key.includes('archive')) return 100;
  return 40;
}

export default function ModulesScreen() {
  const { user } = useAuth();
  const { store, loading, error, refresh } = useCenter();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const rows = isMobileTeacher(user?.role)
    ? teacherModules(store, user?.userId)
    : canViewModules(store, user)
      ? store.learningModules
      : [];

  async function viewFile(moduleId: string) {
    setOpeningId(moduleId);
    setFileError(null);
    try {
      await openLearningModule(moduleId);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Could not open that file.');
    } finally {
      setOpeningId(null);
    }
  }

  if (!canViewModules(store, user)) {
    return (
      <Screen>
        <EmptyState icon="lock-closed-outline" title="Modules are not available" hint="Learning modules follow your teacher or parent permissions." />
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
      <Title>Learning modules</Title>
      <Caption>Published lesson files from the center. Completion tracking is shown from module status; a lesson-by-lesson tracker is not in the API yet.</Caption>
      {error ? <ErrorState message={error} onRetry={() => void refresh()} /> : null}
      {fileError ? <ErrorState message={fileError} /> : null}
      {rows.length === 0 ? (
        <EmptyState icon="book-outline" title="No modules yet" hint="When teachers publish materials, they appear here." />
      ) : (
        rows.map((item) => (
          <Card key={item.moduleId}>
            <StatusBadge status={item.status} />
            <Heading>{item.title}</Heading>
            <Body>{item.subject || item.description || 'Learning material'}</Body>
            <View style={{ marginTop: 8 }}>
              <ProgressBar value={moduleProgress(item.status)} />
            </View>
            <Caption>{item.fileName || 'File attached at the center'}</Caption>
            <AppButton
              label={openingId === item.moduleId ? 'Opening…' : 'View file'}
              onPress={() => void viewFile(item.moduleId)}
              loading={openingId === item.moduleId}
              disabled={openingId !== null && openingId !== item.moduleId}
              style={{ marginTop: 12 }}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}
