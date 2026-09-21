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

export const MANAGEMENT_LANES = [
  {
    id: 'playgroup',
    label: 'Playgroup',
    aliases: ['playgroup', 'play group', 'play-group'],
  },
  {
    id: 'preschool',
    label: 'Pre-school (Kinder, Nursery, Grade 1–3)',
    aliases: ['pre-school', 'preschool', 'kinder', 'kindergarten', 'nursery', 'grade 1', 'grade1', 'grade 1–3', 'grade 1-3'],
  },
  {
    id: 'aba',
    label: 'ABA Therapy',
    aliases: ['aba'],
  },
  {
    id: 'tutorial',
    label: 'Tutorial Session',
    aliases: ['tutorial'],
  },
] as const;

export type ManagementLaneId = (typeof MANAGEMENT_LANES)[number]['id'];

export function programLane(value?: string | null): ManagementLaneId | null {
  const text = (value || '').toLowerCase();
  if (!text.trim()) return null;
  for (const lane of MANAGEMENT_LANES) {
    if (lane.aliases.some((alias) => text.includes(alias))) return lane.id;
  }
  return null;
}

export function laneLabel(id?: string | null): string {
  return MANAGEMENT_LANES.find((lane) => lane.id === id)?.label || '';
}

export function parsePeopleLane(value?: string | null): ManagementLaneId | null {
  return MANAGEMENT_LANES.some((lane) => lane.id === value) ? (value as ManagementLaneId) : null;
}

export function studentInLane(student: Student, lane?: ManagementLaneId | null): boolean {
  if (!lane) return true;
  return programLane(student.program) === lane || programLane(student.gradeLevel) === lane;
}

export function childrenOfParent(store: HirayaDatabase, parentId: string): Student[] {
  const ids = new Set(
    store.parentStudents.filter((link) => link.parentId === parentId && link.isActive).map((link) => link.studentId),
  );
  if (ids.size === 0) {
    return store.students.filter((student) => student.parentId === parentId);
  }
  return store.students.filter((student) => ids.has(student.studentId) || student.parentId === parentId);
}

export function parentInLane(store: HirayaDatabase, parentId: string, lane?: ManagementLaneId | null): boolean {
  if (!lane) return true;
  return childrenOfParent(store, parentId).some((student) => studentInLane(student, lane));
}

export function teacherInLane(store: HirayaDatabase, userId: string, lane?: ManagementLaneId | null): boolean {
  if (!lane) return true;
  const profile = store.teacherProfiles.find((row) => row.userId === userId);
  const user = store.users.find((row) => row.userId === userId);
  if (programLane(profile?.specialty) === lane || programLane(user?.position) === lane) return true;
  const taught = store.classes.filter((row) => row.teacherId === userId);
  const classIds = new Set(taught.map((row) => row.classId));
  for (const row of taught) {
    if (programLane(row.name) === lane) return true;
    const program = store.programs.find((item) => item.programId === row.programId);
    if (programLane(program?.name) === lane) return true;
  }
  return store.enrollments.some((enrollment) => {
    if (enrollment.teacherId !== userId && !classIds.has(enrollment.classId)) return false;
    const program = store.programs.find((item) => item.programId === enrollment.programId);
    if (programLane(program?.name) === lane) return true;
    const student = store.students.find((item) => item.studentId === enrollment.studentId);
    return student ? studentInLane(student, lane) : false;
  });
}

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

export function dayGreeting(now = new Date(), timeZone = 'Asia/Manila'): string {
  const hourPart = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hourCycle: 'h23',
    timeZone,
  })
    .formatToParts(now)
    .find((part) => part.type === 'hour');
  const hour = Number(hourPart?.value ?? now.getHours());
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const ADMIN_ROLE_PLAYBOOK = [
  {
    id: 'program-director',
    title: 'Program Director',
    mark: 'PD',
    items: [
      'Own Playgroup, Pre-school, ABA, and Tutorial quality',
      'Set class groupings and teacher assignments',
      'Review session notes before they reach families',
    ],
  },
  {
    id: 'admin-director',
    title: 'Administrative Director',
    mark: 'AD',
    items: [
      'Keep center policy, staffing, and reports current',
      'Escalate overdue payments and enrollment bottlenecks',
      'Sign off on certificates and official letters',
    ],
  },
  {
    id: 'supervisor',
    title: 'Supervisor',
    mark: 'SV',
    items: [
      'Walk rooms and confirm today’s class list',
      'Mark attendance and queue make-up sessions',
      'Log field-trip headcount and duty coverage',
      'Spot-check ABA and tutorial session records',
      'Flag parent concerns from the floor',
    ],
  },
  {
    id: 'admin-officer',
    title: 'Administrative Officer',
    mark: 'AO',
    items: [
      'Intake enrollment applications and requirements',
      'Post invoices, proofs, and payment status',
      'File forms and document acknowledgments',
      'Publish announcements to the parent group',
      'Track certificate requests to ready-for-release',
    ],
  },
] as const;

export function adminHomeStats(store: HirayaDatabase, today = todayIsoDate()) {
  const pendingApps = store.enrollmentApplications.filter((row) =>
    ['pending', 'pending_review', 'inquiry', 'application', 'requirements'].includes((row.status || '').toLowerCase()),
  );
  const openPay = store.payments.filter((p) => ['pending', 'partial', 'overdue'].includes(p.paymentStatus));
  const tasksDue = (store.staffTasks || []).filter(
    (t) => t.status !== 'done' && t.status !== 'complete' && (!t.dueDate || t.dueDate <= today),
  );
  return {
    activeStudents: store.students.filter((s) => s.status === 'active').length,
    pendingEnrollments: pendingApps.length,
    sessionsToday: store.schedules.filter((row) => (row.startAt || '').slice(0, 10) === today).length,
    tasksDue: tasksDue.length,
    unreadAnnouncements: store.alerts.filter((a) => !a.read).length,
    openPayments: openPay.length,
  };
}
