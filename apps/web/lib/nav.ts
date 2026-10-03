import { UserRoles } from '@hiraya/types';
import { hklcNavForRole, isAdmin, isFamilyRole, type HklcNavId } from '@hiraya/utils';

export type NavItem = { href: string; label: string; roles?: string[] };

export const publicNav: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/programs', label: 'Programs' },
  { href: '/contact', label: 'Contact' },
];

const HREF: Record<HklcNavId, string> = {
  dashboard: '/admin',
  students: '/admin/students',
  monitoring: '/admin/students',
  parents: '/admin/parents',
  teachers: '/admin/staff',
  programs: '/admin/programs',
  classes: '/admin/classes',
  playgroup: '/admin/schedules',
  enrollment: '/admin/enrollments',
  teacherApplications: '/admin/teacher-applications',
  attendance: '/admin/attendance',
  tutorial: '/admin/attendance',
  aba: '/admin/attendance',
  progress: '/admin/progress',
  grades: '/admin/progress',
  payments: '/admin/payments',
  finance: '/admin/payments',
  calendar: '/admin/schedules',
  holidays: '/admin/schedules',
  teacherSchedule: '/admin/schedules',
  dayOff: '/admin/staff',
  compliance: '/admin/students',
  uniforms: '/admin/students',
  evaluations: '/admin/reports',
  marketing: '/admin/website',
  notifications: '/admin/messages',
  modules: '/admin/modules',
  programTuition: '/admin/program-tuition',
  reports: '/admin/reports',
  settings: '/admin/settings',
  tasks: '/admin/tasks',
  announcements: '/admin/announcements',
  feedback: '/admin/messages',
  sessions: '/admin/sessions',
  messages: '/admin/messages',
};

export function appNav(role?: string | null): NavItem[] {
  if (isFamilyRole(role)) {
    return [
      { href: '/portal/family', label: 'Family home' },
      { href: '/app/children', label: 'Student sheet' },
      { href: '/app/schedules', label: 'Playgroup & calendar' },
      { href: '/app/attendance', label: 'Attendance' },
      { href: '/app/progress', label: 'Milestones' },
      { href: '/app/payments', label: 'Payments' },
      { href: '/app/notifications', label: 'Alerts' },
      { href: '/app/modules', label: 'Modules' },
      { href: '/app/profile', label: 'Profile' },
    ];
  }
  const seen = new Set<string>();
  const items: NavItem[] = [];
  for (const group of hklcNavForRole(role)) {
    for (const item of group.items) {
      const href = role === UserRoles.Teacher && item.id === 'dashboard' ? '/app' : HREF[item.id];
      if (!href || seen.has(href)) continue;
      seen.add(href);
      items.push({ href, label: item.label });
    }
  }
  items.push({ href: '/app/profile', label: 'Profile' });
  return items;
}

export function homeHref(role?: string | null): string {
  if (isFamilyRole(role)) return '/portal/family';
  if (isAdmin(role) || role === UserRoles.Staff) return '/admin';
  if (role === UserRoles.Teacher) return '/app';
  return '/admin';
}
