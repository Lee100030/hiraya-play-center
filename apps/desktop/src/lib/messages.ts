import type { HirayaUser, SystemAlert } from '@hiraya/types';

export function isDirectAlert(item: Pick<SystemAlert, 'kind'>) {
  return (item.kind || '').toLowerCase() === 'direct';
}

export function directThreadKey(a: string, b: string) {
  const [left, right] = [a, b].sort((x, y) => x.localeCompare(y, undefined, { sensitivity: 'base' }));
  return `dm:${left}:${right}`;
}

export function threadMessages(alerts: SystemAlert[], actorId: string, otherId: string) {
  const threadId = directThreadKey(actorId, otherId);
  return [...alerts]
    .filter(
      (item) =>
        isDirectAlert(item) && item.relatedRecordId === threadId && item.recipientId === actorId,
    )
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

export function markThreadRead(alerts: SystemAlert[], actorId: string, otherId: string): SystemAlert[] {
  const threadId = directThreadKey(actorId, otherId);
  const now = new Date().toISOString();
  return alerts.map((item) =>
    isDirectAlert(item) &&
    item.relatedRecordId === threadId &&
    item.recipientId === actorId &&
    !item.read &&
    item.status !== 'sent'
      ? { ...item, read: true, status: 'read', readAt: now }
      : item,
  );
}

export function messageContacts(users: HirayaUser[]) {
  return users.filter((item) => item.role === 'teacher' || item.role === 'parent');
}
