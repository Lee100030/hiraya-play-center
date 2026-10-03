import type { ChatGroup, HirayaDatabase, HirayaUser, SystemAlert } from '@hiraya/types';

function personLabel(user?: HirayaUser | null) {
  if (!user) return '';
  const assembled = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return assembled || user.fullname || user.email || user.username || user.userId || '';
}

export function isDirectAlert(item: Pick<SystemAlert, 'kind'>) {
  return (item.kind || '').toLowerCase() === 'direct';
}

export function packedMemberIds(value?: string | null) {
  return (value || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export function directThreadKey(a: string, b: string) {
  const [left, right] = [a, b].sort((x, y) => x.localeCompare(y, undefined, { sensitivity: 'base' }));
  return `dm:${left}:${right}`;
}

export function groupThreadKey(groupId: string) {
  return `group:${(groupId || '').trim()}`;
}

export function studentIdsForParent(store: HirayaDatabase, parentId: string) {
  const ids = new Set(
    store.parentStudents
      .filter((link) => link.isActive && link.parentId === parentId)
      .map((link) => link.studentId),
  );
  for (const student of store.students) {
    if (student.parentId === parentId) ids.add(student.studentId);
  }
  return ids;
}

export function areCoParents(store: HirayaDatabase, parentA: string, parentB: string) {
  if (!parentA || !parentB || parentA === parentB) return false;
  const kidsA = studentIdsForParent(store, parentA);
  if (!kidsA.size) return false;
  for (const id of studentIdsForParent(store, parentB)) {
    if (kidsA.has(id)) return true;
  }
  return false;
}

export function canDirectMessage(store: HirayaDatabase, actor: HirayaUser, target: HirayaUser) {
  if (!actor?.userId || !target?.userId || actor.userId === target.userId) return false;
  const status = (target.status || '').toLowerCase();
  if (status && status !== 'active' && status !== 'pending') return false;

  if (actor.role === 'super_admin' || actor.role === 'admin') {
    return target.role === 'teacher' || target.role === 'parent' || target.role === 'super_admin' || target.role === 'admin';
  }
  if (actor.role === 'teacher') {
    return target.role === 'teacher' || target.role === 'super_admin' || target.role === 'admin';
  }
  if (actor.role === 'parent') {
    return (
      target.role === 'super_admin' ||
      target.role === 'admin' ||
      (target.role === 'parent' && areCoParents(store, actor.userId, target.userId))
    );
  }
  return false;
}

export function messageContacts(store: HirayaDatabase, actor: HirayaUser) {
  return store.users
    .filter((item) => canDirectMessage(store, actor, item))
      .sort((a, b) => personLabel(a).localeCompare(personLabel(b), undefined, { sensitivity: 'base' }));
}

export function myChatGroups(store: HirayaDatabase, actorId: string) {
  return (store.chatGroups || []).filter(
    (group) =>
      (group.status || 'active').toLowerCase() !== 'archived' &&
      packedMemberIds(group.memberIds).includes(actorId),
  );
}

export function threadMessages(alerts: SystemAlert[], actorId: string, threadId: string) {
  return [...alerts]
    .filter(
      (item) =>
        isDirectAlert(item) && item.relatedRecordId === threadId && item.recipientId === actorId,
    )
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

export function markThreadRead(alerts: SystemAlert[], actorId: string, threadId: string): SystemAlert[] {
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

export function groupMemberNames(store: HirayaDatabase, group: ChatGroup) {
  return packedMemberIds(group.memberIds)
    .map((id) => personLabel(store.users.find((item) => item.userId === id)))
    .filter(Boolean)
    .join(', ');
}
