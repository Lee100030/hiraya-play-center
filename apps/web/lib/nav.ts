import { UserRoles } from '@hiraya/types';
import { isAdmin, isFamilyRole } from '@hiraya/utils';

export type NavItem = { href: string; label: string; roles?: string[] };

export const publicNav: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/programs', label: 'Programs' },
  { href: '/contact', label: 'Contact' },
];

const ops = [UserRoles.SuperAdmin, UserRoles.Admin, UserRoles.Staff];
const classroom = [UserRoles.SuperAdmin, UserRoles.Admin, UserRoles.Teacher, UserRoles.Staff];
const admins = [UserRoles.SuperAdmin, UserRoles.Admin];

export function appNav(role?: string | null): NavItem[] {
  if (isFamilyRole(role)) {
    return [
      { href: '/portal/family', label: 'Family home' },
      { href: '/app/children', label: 'Children' },
      { href: '/app/schedules', label: 'Schedule' },
      { href: '/app/attendance', label: 'Attendance' },
      { href: '/app/progress', label: 'Progress' },
      { href: '/app/payments', label: 'Payments' },
      { href: '/app/notifications', label: 'Alerts' },
      { href: '/app/modules', label: 'Modules' },
      { href: '/app/profile', label: 'Profile' },
    ];
  }
  if (role === UserRoles.Teacher) {
    return [
      { href: '/app', label: 'Dashboard' },
      { href: '/app/classes', label: 'Classes' },
      { href: '/app/attendance', label: 'Attendance' },
      { href: '/app/progress', label: 'Progress' },
      { href: '/app/schedules', label: 'Schedules' },
      { href: '/app/calendar', label: 'Calendar' },
      { href: '/app/modules', label: 'Modules' },
      { href: '/app/notifications', label: 'Inbox' },
      { href: '/app/profile', label: 'Profile' },
    ];
  }
  return [
    { href: '/app', label: 'Dashboard' },
    { href: '/app/students', label: 'Students', roles: classroom },
    { href: '/app/parents', label: 'Parents', roles: admins },
    { href: '/app/staff', label: 'Teachers & staff', roles: classroom },
    { href: '/app/programs', label: 'Programs', roles: classroom },
    { href: '/app/classes', label: 'Classes', roles: classroom },
    { href: '/app/enrollment', label: 'Enrollment', roles: classroom },
    { href: '/app/attendance', label: 'Attendance', roles: classroom },
    { href: '/app/progress', label: 'Progress', roles: classroom },
    { href: '/app/schedules', label: 'Schedules', roles: classroom },
    { href: '/app/calendar', label: 'Calendar', roles: classroom },
    { href: '/app/payments', label: 'Payments', roles: ops },
    { href: '/app/reports', label: 'Reports', roles: classroom },
    { href: '/app/notifications', label: 'Notifications' },
    { href: '/app/announcements', label: 'Announcements', roles: admins },
    { href: '/app/modules', label: 'Modules' },
    { href: '/app/users', label: 'Users', roles: admins },
    { href: '/app/roles', label: 'Roles', roles: [UserRoles.SuperAdmin] },
    { href: '/app/audit', label: 'Audit', roles: admins },
    { href: '/app/settings', label: 'Settings', roles: admins },
    { href: '/app/website', label: 'Website CMS', roles: admins },
    { href: '/app/profile', label: 'Profile' },
  ].filter((item) => !item.roles || (role != null && (item.roles as string[]).includes(role)));
}

export function homeHref(role?: string | null): string {
  if (isFamilyRole(role)) return '/portal/family';
  if (isAdmin(role) || role === UserRoles.Staff || role === UserRoles.Teacher) return '/app';
  return '/admin';
}
