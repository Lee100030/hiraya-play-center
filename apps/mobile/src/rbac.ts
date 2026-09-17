import { PermissionKeys, UserRoles, type HirayaDatabase, type HirayaUser } from '@hiraya/types';
import { allows } from '@hiraya/utils';

export function isMobileTeacher(role?: string | null) {
  return role === UserRoles.Teacher;
}

export function isMobileParent(role?: string | null) {
  return role === UserRoles.Parent;
}

export function canUseMobileApp(role?: string | null) {
  return isMobileTeacher(role) || isMobileParent(role);
}

export const MOBILE_LOGIN_BLOCKED =
  'This app is for teachers and parents. The Super Administrator signs in on HIRAYA Desktop or the website. Children use a parent account.';

export function can(store: HirayaDatabase | null | undefined, user: HirayaUser | null | undefined, permission: string) {
  if (!user || !canUseMobileApp(user.role)) return false;
  return allows(store ?? null, user.role, permission);
}

export function canEnrollChild(user: HirayaUser | null | undefined) {
  return isMobileParent(user?.role);
}

export function canViewPayments(store: HirayaDatabase | null | undefined, user: HirayaUser | null | undefined) {
  return isMobileParent(user?.role) && can(store, user, PermissionKeys.ViewStudents);
}

export function canViewAttendance(store: HirayaDatabase | null | undefined, user: HirayaUser | null | undefined) {
  return can(store, user, PermissionKeys.ManageAttendance) || can(store, user, PermissionKeys.ViewStudents);
}

export function canViewProgress(store: HirayaDatabase | null | undefined, user: HirayaUser | null | undefined) {
  return can(store, user, PermissionKeys.ManageProgress) || can(store, user, PermissionKeys.ManageReports);
}

export function canViewModules(store: HirayaDatabase | null | undefined, user: HirayaUser | null | undefined) {
  return can(store, user, PermissionKeys.ViewModules);
}
