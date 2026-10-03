import { Alert, Pressable } from 'react-native';
import { Body, Caption, Card, EmptyState, ErrorState, Field, Heading, LoadingState, Screen, StatusBadge, Title, AppButton } from '../src/components/ui';
import { useAuth } from '../src/auth';
import { api } from '../src/auth';
import { useCenter } from '../src/store';
import { friendlyError } from '../src/selectors';
import { isMobileTeacher } from '../src/rbac';
import { useState } from 'react';
import type { StaffTask } from '@hiraya/types';

export default function TasksScreen() {
  const { user } = useAuth();
  const { store, loading, error, refresh } = useCenter();
  const [open, setOpen] = useState<StaffTask | null>(null);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = (store.staffTasks || [])
    .filter((row) =>
      (row.teacherIds || '')
        .split(',')
        .map((item) => item.trim())
        .includes(user?.userId || ''),
    )
    .slice()
    .sort((a, b) => (a.dueAt || '').localeCompare(b.dueAt || ''));

  if (!isMobileTeacher(user?.role)) {
    return (
      <Screen>
        <EmptyState icon="lock-closed-outline" title="Tasks are for teachers" hint="Parents do not receive staff tasks." />
      </Screen>
    );
  }

  async function setStatus(row: StaffTask, status: string) {
    setBusy(true);
    try {
      await api.putStore({
        ...store,
        staffTasks: (store.staffTasks || []).map((item) =>
          item.taskId === row.taskId
            ? {
                ...item,
                status,
                response: remarks.trim() || item.response,
                completedAt: status === 'completed' || status === 'submitted' ? new Date().toISOString() : item.completedAt,
                completedBy: status === 'completed' || status === 'submitted' ? user?.userId || '' : item.completedBy,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      },
      store,
    );
      setOpen(null);
      setRemarks('');
      await refresh();
    } catch (err) {
      Alert.alert('Could not update task', friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !rows.length) {
    return (
      <Screen>
        <LoadingState label="Loading tasks…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>My tasks</Title>
      <Caption>Assigned by the Super Administrator. Updates save to the center database.</Caption>
      {error ? <ErrorState message={error} onRetry={() => void refresh()} /> : null}
      {rows.length === 0 ? (
        <EmptyState icon="checkbox-outline" title="No assigned tasks" hint="When admin assigns a task on desktop, it appears here." />
      ) : (
        rows.map((row) => (
          <Pressable key={row.taskId} onPress={() => { setOpen(row); setRemarks(row.response); }}>
            <Card>
              <Caption>
                {row.priority} · due {row.dueAt || '—'}
              </Caption>
              <Heading>{row.title}</Heading>
              <StatusBadge status={row.status} />
            </Card>
          </Pressable>
        ))
      )}
      {open ? (
        <Card>
          <Heading>{open.title}</Heading>
          <Body>{open.description || 'No extra notes.'}</Body>
          <Caption>Due {open.dueAt || '—'} · {open.priority}</Caption>
          <Field label="Remarks" value={remarks} onChangeText={setRemarks} />
          <AppButton label="Mark in progress" onPress={() => void setStatus(open, 'in_progress')} loading={busy} disabled={busy} />
          <AppButton label="Mark completed" onPress={() => void setStatus(open, 'completed')} loading={busy} disabled={busy} />
          <Pressable onPress={() => setOpen(null)} style={{ minHeight: 44, alignItems: 'center', marginTop: 8 }}>
            <Caption>Close</Caption>
          </Pressable>
        </Card>
      ) : null}
    </Screen>
  );
}
