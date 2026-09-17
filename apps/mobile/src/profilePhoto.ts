import { useMemo } from 'react';
import type { HirayaUser } from '@hiraya/types';
import { resolveMobileApiUrl } from './apiUrl';
import { useAuth } from './auth';
import { useCenter } from './store';

export function profilePhotoUri(
  user?: Pick<HirayaUser, 'userId' | 'profileImagePath' | 'updatedAt'> | null,
) {
  const path = (user?.profileImagePath || '').trim();
  if (!path || !user?.userId) return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('file:')) return path;
  const stamp = encodeURIComponent(user.updatedAt || path);
  return `${resolveMobileApiUrl().replace(/\/$/, '')}/api/media/profile/${encodeURIComponent(user.userId)}?v=${stamp}`;
}

export function useSessionProfile() {
  const { user } = useAuth();
  const { store } = useCenter();
  return useMemo(() => {
    if (!user) return null;
    const live = store.users.find((item) => item.userId === user.userId);
    if (!live) return user;
    return {
      ...user,
      ...live,
      profileImagePath: live.profileImagePath || user.profileImagePath,
      updatedAt: live.updatedAt || user.updatedAt,
    };
  }, [store.users, user]);
}
