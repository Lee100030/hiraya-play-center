import { UserRoles } from '@hiraya/types';
import { isAdmin, isFamilyRole } from '@hiraya/utils';

export type NavItem = { href: string; label: string; group?: string; roles?: string[] };

export const publicNav: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/programs', label: 'Programs' },
  { href: '/#hiring', label: 'Careers' },
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
      { href: '/app/makeup', label: 'Make-up' },
      { href: '/app/progress', label: 'Progress' },
      { href: '/app/schedules', label: 'Schedules' },
      { href: '/app/calendar', label: 'Calendar' },
      { href: '/app/modules', label: 'Modules' },
      { href: '/app/notifications', label: 'Inbox' },
      { href: '/app/profile', label: 'Profile' },
    ];
  }
  return [
    { href: '/app', label: 'Dashboard', group: 'Main' },
    { href: '/app/students', label: 'Students', group: 'Management', roles: classroom },
    { href: '/app/parents', label: 'Parents', group: 'Management', roles: admins },
    { href: '/app/staff', label: 'Teachers & staff', group: 'Management', roles: classroom },
    { href: '/app/programs', label: 'Programs', group: 'Learning', roles: classroom },
    { href: '/app/classes', label: 'Classes', group: 'Learning', roles: classroom },
    { href: '/app/enrollment', label: 'Enrollment', group: 'Learning', roles: classroom },
    { href: '/app/pipeline', label: 'Family pipeline', group: 'Learning', roles: admins },
    { href: '/app/attendance', label: 'Attendance', group: 'Operations', roles: classroom },
    { href: '/app/makeup', label: 'Make-up requests', group: 'Operations', roles: classroom },
    { href: '/app/certificates', label: 'Certificates', group: 'Operations', roles: admins },
    { href: '/app/field-trips', label: 'Field trips', group: 'Operations', roles: classroom },
    { href: '/app/forms', label: 'Forms', group: 'Operations', roles: admins },
    { href: '/app/progress', label: 'Progress', group: 'Operations', roles: classroom },
    { href: '/app/schedules', label: 'Schedules', group: 'Operations', roles: classroom },
    { href: '/app/calendar', label: 'Calendar', group: 'Operations', roles: classroom },
    { href: '/app/payments', label: 'Payments', group: 'Operations', roles: ops },
    { href: '/app/reports', label: 'Reports', group: 'System', roles: classroom },
    { href: '/app/notifications', label: 'Notifications', group: 'Communications' },
    { href: '/app/announcements', label: 'Announcements', group: 'Communications', roles: admins },
    { href: '/app/modules', label: 'Modules', group: 'Communications' },
    { href: '/app/users', label: 'Users', group: 'System', roles: admins },
    { href: '/app/roles', label: 'Roles', group: 'System', roles: [UserRoles.SuperAdmin] },
    { href: '/app/audit', label: 'Audit', group: 'System', roles: admins },
    { href: '/app/settings', label: 'Settings', group: 'System', roles: admins },
    { href: '/app/website', label: 'Website CMS', group: 'System', roles: admins },
    { href: '/app/profile', label: 'Profile', group: 'Account' },
  ].filter((item) => !item.roles || (role != null && (item.roles as string[]).includes(role)));
}

export function navGroupForPath(pathname: string, role?: string | null): string {
  const match = appNav(role)
    .filter((item) => item.href !== '/app')
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  if (match?.group) return match.group;
  if (pathname === '/app' || pathname === '/app/') return 'Dashboard';
  return 'HKLC operations';
}

export function homeHref(role?: string | null): string {
  if (isFamilyRole(role)) return '/portal/family';
  if (isAdmin(role) || role === UserRoles.Staff || role === UserRoles.Teacher) return '/app';
  return '/admin';
}
