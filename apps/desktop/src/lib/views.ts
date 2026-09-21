import { UserRoles } from '@hiraya/types';
import { isAdmin, isFamilyRole } from '@hiraya/utils';

export type ViewId =
  | 'dashboard'
  | 'students'
  | 'parents'
  | 'staff'
  | 'teacher-workspace'
  | 'programs'
  | 'classes'
  | 'enrollment'
  | 'pipeline'
  | 'attendance'
  | 'makeup'
  | 'certificates'
  | 'field-trips'
  | 'forms'
  | 'progress'
  | 'payments'
  | 'schedules'
  | 'calendar'
  | 'notifications'
  | 'announcements'
  | 'feedback'
  | 'chat'
  | 'modules'
  | 'reports'
  | 'settings'
  | 'profile';

export type NavItem = { id: ViewId; label: string; group: string };

export function deskNav(role?: string | null): NavItem[] {
  if (isFamilyRole(role)) {
    return [
      { id: 'dashboard', label: 'Family home', group: 'Main' },
      { id: 'students', label: 'Children', group: 'Main' },
      { id: 'schedules', label: 'Schedule', group: 'Main' },
      { id: 'attendance', label: 'Attendance', group: 'Main' },
      { id: 'progress', label: 'Progress', group: 'Main' },
      { id: 'payments', label: 'Payments', group: 'Main' },
      { id: 'notifications', label: 'Alerts', group: 'Main' },
      { id: 'profile', label: 'Profile', group: 'Account' },
    ];
  }
  if (role === UserRoles.Teacher) {
    return [
      { id: 'dashboard', label: 'Dashboard', group: 'Main' },
      { id: 'students', label: 'My students', group: 'Classroom' },
      { id: 'classes', label: 'Classes', group: 'Classroom' },
      { id: 'attendance', label: 'Attendance', group: 'Classroom' },
      { id: 'makeup', label: 'Make-up', group: 'Classroom' },
      { id: 'progress', label: 'Progress', group: 'Classroom' },
      { id: 'schedules', label: 'Schedules', group: 'Classroom' },
      { id: 'calendar', label: 'Calendar', group: 'Classroom' },
      { id: 'notifications', label: 'Inbox', group: 'Account' },
      { id: 'profile', label: 'Profile', group: 'Account' },
    ];
  }
  const admin = isAdmin(role) || role === UserRoles.Staff;
  if (!admin) return [{ id: 'dashboard', label: 'Dashboard', group: 'Main' }];
  return [
    { id: 'dashboard', label: 'Dashboard', group: 'Main' },
    { id: 'students', label: 'Students', group: 'Management' },
    { id: 'parents', label: 'Parents', group: 'Management' },
    { id: 'staff', label: 'Teachers', group: 'Management' },
    { id: 'programs', label: 'Programs', group: 'Learning' },
    { id: 'classes', label: 'Classes', group: 'Learning' },
    { id: 'enrollment', label: 'Enrollment', group: 'Learning' },
    { id: 'pipeline', label: 'Family pipeline', group: 'Learning' },
    { id: 'attendance', label: 'Attendance', group: 'Operations' },
    { id: 'makeup', label: 'Make-up requests', group: 'Operations' },
    { id: 'certificates', label: 'Certificates', group: 'Operations' },
    { id: 'field-trips', label: 'Field trips', group: 'Operations' },
    { id: 'forms', label: 'Forms', group: 'Operations' },
    { id: 'progress', label: 'Progress', group: 'Operations' },
    { id: 'schedules', label: 'Schedules', group: 'Operations' },
    { id: 'calendar', label: 'Calendar', group: 'Operations' },
    { id: 'payments', label: 'Payments', group: 'Operations' },
    { id: 'announcements', label: 'Announcements', group: 'Communications' },
    { id: 'feedback', label: 'Parent feedback', group: 'Communications' },
    { id: 'chat', label: 'Parents group chat', group: 'Communications' },
    { id: 'notifications', label: 'Notifications', group: 'Communications' },
    { id: 'modules', label: 'Learning modules', group: 'Communications' },
    { id: 'reports', label: 'Reports', group: 'System' },
    { id: 'settings', label: 'Settings', group: 'System' },
    { id: 'profile', label: 'Profile', group: 'Account' },
  ];
}
