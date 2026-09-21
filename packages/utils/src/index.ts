import {
  PermissionKeys,
  UserRoles,
  type HirayaDatabase,
  type HirayaUser,
  type Student,
} from '@hiraya/types';

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function displayName(user?: Pick<HirayaUser, 'fullname' | 'firstName' | 'lastName'> | null): string {
  if (!user) return '';
  if (user.fullname?.trim()) return user.fullname.trim();
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
}

export function studentDisplay(student: Student): string {
  if (student.fullname?.trim()) return student.fullname.trim();
  return [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ').trim();
}

export function roleLabel(role?: string | null): string {
  switch (role) {
    case UserRoles.SuperAdmin:
      return 'Super Administrator';
    case UserRoles.Admin:
      return 'Administrator';
    case UserRoles.Teacher:
      return 'Teacher';
    case UserRoles.Staff:
      return 'Staff';
    case UserRoles.Parent:
      return 'Parent / Guardian';
    case UserRoles.Student:
      return 'Student';
    default:
      return role || '';
  }
}

export function isAdmin(role?: string | null): boolean {
  return role === UserRoles.SuperAdmin || role === UserRoles.Admin;
}

export function isFamilyRole(role?: string | null): boolean {
  return role === UserRoles.Parent || role === UserRoles.Student;
}

export function defaultAllows(role: string, permission: string): boolean {
  if (role === UserRoles.SuperAdmin) return true;
  if (role === UserRoles.Admin) return permission !== PermissionKeys.ManageRoles;
  if (role === UserRoles.Teacher) {
    return (
      [
        PermissionKeys.ViewStudents,
        PermissionKeys.ViewTeachers,
        PermissionKeys.ManageAttendance,
        PermissionKeys.ManageProgress,
        PermissionKeys.ManageReports,
        PermissionKeys.ViewModules,
      ] as string[]
    ).includes(permission);
  }
  if (role === UserRoles.Staff) {
    return (
      [
        PermissionKeys.ViewStudents,
        PermissionKeys.ViewTeachers,
        PermissionKeys.ManageAttendance,
        PermissionKeys.ManagePayments,
        PermissionKeys.ManageReports,
      ] as string[]
    ).includes(permission);
  }
  if (role === UserRoles.Parent || role === UserRoles.Student) {
    return (
      [PermissionKeys.ViewStudents, PermissionKeys.ManageReports, PermissionKeys.ViewModules] as string[]
    ).includes(permission);
  }
  return false;
}

export function allows(db: HirayaDatabase | null, role: string | null | undefined, permission: string): boolean {
  if (!role) return false;
  if (role === UserRoles.SuperAdmin) return true;
  const override = db?.rolePermissions.find((p) => p.role === role && p.permission === permission);
  if (override) return override.allowed;
  return defaultAllows(role, permission);
}

export function emptyCell(value?: string | number | null): string {
  if (value === 0) return '0';
  const text = String(value ?? '').trim();
  return text || 'Not assigned';
}

export function remainingSessions(total?: number | null, used?: number | null): number {
  const t = Number(total || 0);
  const u = Number(used || 0);
  return Math.max(0, t - u);
}

export function formatDate(value?: string | null): string {
  if (!value) return 'Not assigned';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return emptyCell(value);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export const CENTER_PROGRAMS = [
  { id: 'playgroup', name: 'Playgroup' },
  { id: 'kinder', name: 'Kindergarten' },
  { id: 'nursery', name: 'Nursery' },
  { id: 'grade1-3', name: 'Grade 1–3' },
  { id: 'preschool', name: 'Pre-school (Kinder, Nursery, Grade 1–3)' },
  { id: 'aba', name: 'ABA Therapy' },
  { id: 'tutorial', name: 'Tutorial Session' },
] as const;

export const FULL_PIPELINE = [
  'inquiry',
  'application',
  'requirements',
  'enrollment',
  'payment',
  'confirmation',
  'schedule',
  'attendance',
  'makeup',
  'progress',
  'certificate',
] as const;

export const STANDARD_FORMS = [
  'Enrollment Form',
  'Student Information Form',
  'Medical/Health Information',
  'Emergency Contact Form',
  'Attendance Policy',
  'Payment Policy',
  'ABA Attendance Policy',
  'Parent Consent Form',
  'Photo/Video Consent',
  'Field Trip Consent',
  'Make-Up Class Request',
  'Feedback Form',
  'Withdrawal Form',
  'Clearance Form',
] as const;

export const CALENDAR_CATEGORIES = [
  { id: 'class', label: '📚 Class Days' },
  { id: 'activity', label: '🎨 Activities' },
  { id: 'field_trip', label: '🚌 Field Trips' },
  { id: 'event', label: '🎉 Events' },
  { id: 'suspension', label: '🌧️ Suspensions' },
  { id: 'makeup', label: '🔄 Make-up Classes' },
  { id: 'payment', label: '💳 Payment Due Dates' },
  { id: 'meeting', label: '📢 Parent Meetings' },
] as const;

export const MAKEUP_REASONS = ['Weather', 'Child sick', 'Family emergency', 'Other'] as const;

export const PIPELINE_STAGES = [
  'inquiry',
  'application',
  'requirements',
  'enrollment',
  'payment',
  'confirmed',
] as const;

export function normalizePipeline(status?: string | null): string {
  const s = (status || '').toLowerCase();
  if (s === 'pending' || s === 'pending_review') return 'application';
  if (s === 'approved') return 'enrollment';
  if ((PIPELINE_STAGES as readonly string[]).includes(s)) return s;
  return s || 'inquiry';
}

export const REQUIREMENT_DOCS = [
  'PSA Birth Certificate',
  'Report Card',
  'ID Picture',
  'LRN',
  'Other',
] as const;

export const NEWS_CATEGORIES = [
  { id: 'classes', label: '📚 Classes' },
  { id: 'field_trip', label: '🚌 Field Trip' },
  { id: 'payment', label: '💳 Payment' },
  { id: 'weather', label: '🌧️ Weather' },
  { id: 'event', label: '🎉 Event' },
] as const;

export function statusTone(status?: string): 'success' | 'warn' | 'danger' | 'muted' {
  const s = (status || '').toLowerCase().replace(/[_-]+/g, ' ');
  if (
    [
      'active',
      'paid',
      'present',
      'published',
      'confirmed',
      'approved',
      'ready',
      'downloaded',
      'signed',
      'yes',
    ].includes(s)
  )
    return 'success';
  if (
    [
      'pending',
      'pending review',
      'late',
      'partial',
      'partially paid',
      'draft',
      'inquiry',
      'application',
      'requirements',
      'enrollment',
      'payment',
      'processing',
      'received',
      'makeup',
      'make up',
      'outstanding',
      'open',
    ].includes(s)
  )
    return 'warn';
  if (
    [
      'overdue',
      'absent',
      'failed',
      'cancelled',
      'archived',
      'deactivated',
      'inactive',
      'rejected',
      'unpublished',
    ].includes(s)
  )
    return 'danger';
  return 'muted';
}
