import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDate, studentDisplay } from '@hiraya/utils';
import { AppHeader, Body, AppButton, Caption, Card, EmptyState, ErrorState, Heading, LoadingState, ProgressBar, Screen, SectionTitle, StatusBadge } from '../../src/components/ui';
import { useAuth } from '../../src/auth';
import { openLearningModule } from '../../src/openModule';
import { useCenter } from '../../src/store';
import { overallProgress, ratingScore, remainingForStudent, reportsForStudent, teacherModules } from '../../src/selectors';
import { canViewProgress, isMobileParent, isMobileTeacher } from '../../src/rbac';

export default function ProgressTab() {
  const { user } = useAuth();
  const { store, loading, error, refresh, selected, children } = useCenter();
  const router = useRouter();
  const family = isMobileParent(user?.role);
  const teacher = isMobileTeacher(user?.role);

  const [openingId, setOpeningId] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

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

  if (teacher) {
    const rows = teacherModules(store, user?.userId);
    if (loading && !rows.length) {
      return (
        <Screen>
          <LoadingState label="Loading modules…" />
        </Screen>
      );
    }
    return (
      <Screen>
        <AppHeader title="Learning modules" subtitle="Lesson files assigned to your classes, published by the center." />
        {error ? <ErrorState message={error} onRetry={() => void refresh()} /> : null}
        {fileError ? <ErrorState message={fileError} /> : null}
        {rows.length === 0 ? (
          <EmptyState
            icon="book-outline"
            title="No modules yet"
            hint="When admin publishes materials for your class, they appear here."
            actionLabel="Message the admin"
            onAction={() => router.push('/(tabs)/profile')}
          />
        ) : (
          rows.map((item) => (
            <Card key={item.moduleId}>
              <StatusBadge status={item.status} />
              <Heading>{item.title}</Heading>
              <Body>{item.subject || item.description || 'Learning material'}</Body>
              <Caption>{item.fileName || 'File on file at the center'}</Caption>
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

  const studentId = selected?.studentId;
  const reports = canViewProgress(store, user) ? reportsForStudent(store, studentId) : [];
  const overall = overallProgress(reports);
  const remaining = remainingForStudent(store, studentId);

  if (!canViewProgress(store, user)) {
    return (
      <Screen>
        <AppHeader title="Progress" />
        <EmptyState
          icon="lock-closed-outline"
          title="Progress is not available"
          hint="Your role cannot view progress notes on this app."
        />
      </Screen>
    );
  }

  if (loading && !reports.length) {
    return (
      <Screen>
        <LoadingState label="Loading progress…" />
      </Screen>
    );
  }

  return (
      <Screen>
        <AppHeader
          title="Your kids"
          subtitle={
            selected
              ? `Progress, attendance notes, and remaining sessions for ${studentDisplay(selected)}.`
              : 'Link a child to see development notes.'
          }
        />
      {error ? <ErrorState message={error} onRetry={() => void refresh()} /> : null}

      {family && children.length > 0 ? (
        <Card>
          <Caption>Kids assigned</Caption>
          <Heading>{children.length}</Heading>
          <Body>{children.map((item) => studentDisplay(item)).join(' · ')}</Body>
        </Card>
      ) : null}

      <Card>
        <Caption>Sessions remaining</Caption>
        <Heading>{remaining.sessionsLabel}</Heading>
        <Body>{remaining.daysLabel} on the class calendar</Body>
        {remaining.total ? (
          <View style={{ marginTop: 8 }}>
            <ProgressBar value={remaining.total ? Math.round((remaining.used / remaining.total) * 100) : 0} />
          </View>
        ) : null}
        <Caption>
          {remaining.used} attended · {remaining.total || remaining.sessionsLeft} planned
        </Caption>
      </Card>

      <Card>
        <Caption>Overall progress</Caption>
        <Heading>{overall}%</Heading>
        <View style={{ marginTop: 8 }}>
          <ProgressBar value={overall} />
        </View>
      </Card>

      <SectionTitle title="Development notes" />
      {reports.length === 0 ? (
        <EmptyState
          icon="leaf-outline"
          title="No progress records yet"
          hint="Teachers publish notes here after class observations."
          actionLabel="Contact the center"
          onAction={() => router.push('/(tabs)/profile')}
        />
      ) : (
        reports.map((item) => (
          <Card key={item.reportId}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Heading>{item.area || 'Development'}</Heading>
              <StatusBadge status={item.rating || item.status} />
            </View>
            <View style={{ marginTop: 8 }}>
              <ProgressBar value={ratingScore(item.rating)} />
            </View>
            {item.evaluation || item.remarks ? <Body>{item.evaluation || item.remarks}</Body> : null}
            <Caption>{formatDate(item.updatedAt || item.createdAt)}</Caption>
          </Card>
        ))
      )}
    </Screen>
  );
}
