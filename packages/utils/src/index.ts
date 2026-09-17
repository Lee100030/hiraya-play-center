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

export function formatDateTime(value?: string | null) {
  const raw = (value || '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  const hasTime = /T\d{2}:/.test(raw) || raw.includes(' ');
  return parsed.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: hasTime ? 'short' : undefined,
  });
}

export function formatDate(value?: string | null) {
  const raw = (value || '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);
  return parsed.toLocaleDateString('en-PH', { dateStyle: 'medium' });
}

export function displayName(user?: Pick<HirayaUser, 'fullname' | 'firstName' | 'lastName'> | null): string {
  if (!user) return '';
  const first = (user.firstName || '').trim();
  const last = (user.lastName || '').trim();
  const assembled = [first, last].filter(Boolean).join(' ').trim();
  const full = (user.fullname || '').trim();
  if (assembled.includes(' ')) return assembled;
  if (full.includes(' ')) return full;
  return assembled || full;
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
  return role === UserRoles.SuperAdmin;
}

export function isFamilyRole(role?: string | null): boolean {
  return role === UserRoles.Parent;
}

/** Demo seed passwords are accepted case-insensitively (admin123 → Admin123). */
export function resolveLoginPassword(login: string, password: string): string {
  const key = (login || '').trim().split('@')[0].toLowerCase();
  const canonical =
    key === 'admin' || key === 'ops'
      ? 'Admin123'
      : key === 'teacher'
        ? 'Teacher123'
        : key === 'staff'
          ? 'Staff123'
          : key === 'parent'
            ? 'Parent123'
            : '';
  if (canonical && password.toLowerCase() === canonical.toLowerCase()) return canonical;
  return password;
}

export function defaultAllows(role: string, permission: string): boolean {
  if (role === UserRoles.SuperAdmin) return true;
  if (role === UserRoles.Admin) return false;
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

export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function statusLabel(value?: string) {
  const raw = (value || '').trim();
  if (!raw || raw === '—') return '';
  if (raw === 'pending_review' || raw === 'pending') return 'Pending';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function statusTone(status?: string): 'success' | 'warn' | 'danger' | 'muted' {
  const s = (status || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (['active', 'paid', 'present', 'published', 'confirmed', 'approved', 'read', 'completed'].includes(s)) return 'success';
  if (['pending', 'pending_review', 'late', 'partial', 'draft', 'unread', 'assigned', 'in_progress', 'submitted', 'almost_finished', 'high'].includes(s)) return 'warn';
  if (['overdue', 'absent', 'failed', 'rejected'].includes(s)) return 'danger';
  return 'muted';
}

export { remainingSessions, remainingSessionsFor, normalizeSessionPackage, completeOneSession } from './sessionPackage';
export { studentDayAttendance, isStudentHereToday, confirmStudentPresentToday } from './studentAttendance';
export {
  defaultCoeDraft,
  downloadCertificateOfEmployment,
  buildCoeParagraphs,
  type CoeDraft,
  type CoeHonorific,
} from './certificateOfEmployment';
export { operationsStats } from './operationsStats';
export { assignedStudentsForTeacher, programsForTeacher, studentPlacement } from './assignments';

export {
  HKLC_NAV_GROUPS,
  HKLC_WORKBOOK_SHEETS,
  hklcNavForRole,
  hklcTaskBoards,
  type HklcNavGroup,
  type HklcNavId,
  type HklcNavItem,
} from './hklcOperations';

