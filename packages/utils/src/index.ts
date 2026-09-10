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

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function statusTone(status?: string): 'success' | 'warn' | 'danger' | 'muted' {
  const s = (status || '').toLowerCase();
  if (['active', 'paid', 'present', 'published', 'confirmed'].includes(s)) return 'success';
  if (['pending', 'pending_review', 'late', 'partial', 'draft'].includes(s)) return 'warn';
  if (['overdue', 'absent', 'failed', 'cancelled', 'archived', 'deactivated'].includes(s)) return 'danger';
  return 'muted';
}
