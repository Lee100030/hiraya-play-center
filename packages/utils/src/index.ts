import {
  PermissionKeys,
  UserRoles,
  type HirayaDatabase,
  type HirayaUser,
  type Student,
} from '@hiraya/types';
import { specialtyLaneId } from './managementLanes';

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

export function localDateKey(value?: string | Date | null) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const raw = (value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw) && !raw.includes('T')) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
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

export function compareStudentNames(a: Student, b: Student) {
  return studentDisplay(a).localeCompare(studentDisplay(b), undefined, { sensitivity: 'base' });
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Administrator',
  admin: 'Administrator',
  teacher: 'Teacher',
  staff: 'Staff',
  parent: 'Parent / Guardian',
  student: 'Student',
  aba: 'ABA Therapist',
  aba_therapist: 'ABA Therapist',
  therapist: 'ABA Therapist',
  ava: 'ABA Therapist',
};

export function roleLabel(role?: string | null): string {
  const key = (role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!key) return 'Role not set';
  return ROLE_LABELS[key] || 'Role not set';
}

/** Teacher cards: known role only. Never render raw specialty junk like "ava". */
export function staffDisplayRole(role?: string | null, specialty?: string | null): string {
  const labeled = roleLabel(role);
  const spec = (specialty || '').trim().toLowerCase();
  const aba =
    specialtyLaneId(specialty) === 'aba' || /\baba\b/.test(spec) || spec === 'ava' || spec.includes('therapist');
  if (aba && (labeled === 'Teacher' || labeled === 'Role not set' || labeled === 'ABA Therapist')) {
    return 'ABA Therapist';
  }
  return labeled;
}

export const STUDENT_FILE_KINDS = [
  { id: 'birth_certificate', label: 'Birth certificate' },
  { id: 'medical_record', label: 'Medical record' },
  { id: 'immunization', label: 'Immunization record' },
  { id: 'assessment', label: 'Assessment / evaluation' },
  { id: 'id', label: 'ID / photo ID' },
  { id: 'other', label: 'Other' },
] as const;

export type StudentFileKindId = (typeof STUDENT_FILE_KINDS)[number]['id'];

export function studentFileKindLabel(kind?: string | null): string {
  const id = (kind || '').trim().toLowerCase();
  return STUDENT_FILE_KINDS.find((item) => item.id === id)?.label || 'Other';
}

export function isAdmin(role?: string | null): boolean {
  return role === UserRoles.SuperAdmin;
}

export function isFamilyRole(role?: string | null): boolean {
  return role === UserRoles.Parent;
}

/** Returns the password the person typed. Demo passwords are not rewritten. */
export function resolveLoginPassword(_login: string, password: string): string {
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
  if (['active', 'paid', 'present', 'published', 'confirmed', 'approved', 'read', 'completed', 'success', 'ok', 'settled'].includes(s)) return 'success';
  if (['pending', 'pending_review', 'late', 'partial', 'draft', 'unread', 'assigned', 'in_progress', 'submitted', 'almost_finished', 'high', 'info'].includes(s)) return 'warn';
  if (['overdue', 'absent', 'failed', 'rejected', 'error', 'danger'].includes(s)) return 'danger';
  return 'muted';
}

export { remainingSessions, remainingSessionsFor, normalizeSessionPackage, completeOneSession, upsertStudentSessions, studentSessionPackage, studentSessionAccount, placeStudentSessionPackage, useOneSession } from './sessionPackage';
export {
  EXPENSE_CATEGORIES,
  INCOME_BUCKETS,
  bookIncomeForMonth,
  cashFlowLines,
  cashFlowTeacherNames,
  cashIncomeForMonth,
  currentMonthKey,
  centerExpenseTotal,
  expenseCategoryLabel,
  expenseTotalForMonth,
  financeMonth,
  financeSeries,
  incomeBucketFor,
  incomeBucketLabel,
  invoiceForMonth,
  isBookIncome,
  monthLabel,
  openingBalanceFor,
  remittanceForDay,
  removeCenterExpense,
  teacherSalaryForMonth,
  upsertCenterExpense,
  upsertOpeningBalance,
  type CashFlowLine,
} from './finance';
export { studentDayAttendance, isStudentHereToday, confirmStudentPresentToday } from './studentAttendance';
export {
  isTeacherAttendanceRow,
  isTeacherOnSite,
  isTeacherSalaryMonthPaid,
  markTeacherAttendance,
  markTeacherSalaryMonthPaid,
  nextAttendanceMonth,
  setTeacherMonthAttendanceCounts,
  staffTeachers,
  teacherAttendanceInMonth,
  teacherAttendanceSummaries,
  teacherAttendanceSummary,
  teacherDayAttendance,
  teacherSalaryMonthRef,
  upsertTeacherAttendanceDay,
  type TeacherAttendanceSummary,
} from './teacherAttendance';
export {
  findDuplicateStaffGroups,
  mergeDuplicateStaffUsers,
  normalizeStaffEmail,
  normalizeStaffName,
  staffDisplayName,
  staffIdentityKey,
  uniqueStaffTeachers,
} from './staffDedupe';
export {
  sessionLeftFor,
  sessionLeftLabel,
  studentPaymentBalance,
  paymentBalanceLabel,
  upsertStudentBalance,
  recordStudentAmountReceived,
  updateStudentPayment,
  cancelStudentPayment,
  studentTuitionFee,
  studentTotalPaid,
  studentRemainingBalance,
  studentPaymentStanding,
  studentPaymentTypeLabel,
  centerTuitionTotals,
  paymentCountsTowardPaid,
  studentPayments,
  studentBalanceDueAt,
  studentBalanceReceivedBy,
  parentsForStudent,
  notifyStudentBalance,
} from './studentBilling';
export {
  TEACHER_PAYMENT_MARK,
  isTeacherPayment,
  parsePaymentLane,
  paymentLaneLabel,
  type PaymentLaneId,
  PAYMENT_LANES,
  isPaymentLane,
} from './paymentLanes';
export {
  FEEDBACK_LANES,
  feedbackLaneLabel,
  isFeedbackLane,
  parseFeedbackLane,
  type FeedbackLaneId,
} from './feedbackLanes';
export { normalizePersonalEmail, ownedPersonalEmail, personalEmailError, personalEmailOwnerError } from './personalEmail';
export { scrubLeftoverPaymentData } from './paymentCleanup';
export { downloadStudentRecord } from './studentRecordSheet';
export { applyStorePatch, diffStore, STORE_ROW_IDS, type StorePatchBody } from './storePatch';
export {
  teacherPaymentRows,
  findTeacherPayment,
  buildTeacherPayslip,
  notifyTeacherPayment,
  openTeacherPayslipMailto,
  applyTeacherPayment,
  teacherPayCashAmount,
} from './teacherPayments';
export { addLearningProgram, assignLaneSessionPackage, moduleTuitionLanes, programForLane, programForStudent, removeLearningProgram, saveProgramTuition } from './programs';
export {
  defaultCoeDraft,
  downloadCertificateOfEmployment,
  buildCoeParagraphs,
  formatPeso,
  type CoeDraft,
  type CoeHonorific,
} from './certificateOfEmployment';
export { isTeacherApplication, operationsStats } from './operationsStats';
export {
  approvedTeacherApplicationsWithoutAccount,
  matchingTeacherForApplication,
  teacherApplicationOpen,
  teacherHireDraft,
  unusedTeacherLogin,
} from './teacherApplications';
export {
  assignedStudentsForTeacher,
  teachersForStudents,
  openTaskCountForTeacher,
  packedTeacherIds,
  programsForTeacher,
  scheduleAssignedTo,
  studentPlacement,
  classForStudent,
  teacherForStudent,
  teacherIdForStudent,
} from './assignments';
export {
  areCoParents,
  canDirectMessage,
  directThreadKey,
  groupMemberNames,
  groupThreadKey,
  isDirectAlert,
  markThreadRead,
  messageContacts,
  myChatGroups,
  packedMemberIds,
  threadMessages,
} from './messaging';
export {
  MANAGEMENT_LANES,
  MANAGEMENT_LANE_VIEWS,
  PEOPLE_LANE_VIEWS,
  childrenOfParent,
  isBuiltinManagementLane,
  isManagementLaneView,
  laneLabel,
  managementLanesFor,
  moduleInLane,
  parentInLane,
  parsePeopleLane,
  programLane,
  resolveStudentProgramValue,
  sessionPackageInLane,
  specialtyLaneId,
  specialtyLaneLabel,
  studentInLane,
  teacherInLane,
  type ManagementLane,
  type ManagementLaneId,
  type ManagementLaneViewId,
} from './managementLanes';

export {
  HKLC_NAV_GROUPS,
  HKLC_WORKBOOK_SHEETS,
  hklcNavForRole,
  hklcTaskBoards,
  type HklcNavGroup,
  type HklcNavId,
  type HklcNavItem,
} from './hklcOperations';
export { createErrorReport, reportClientError, sanitizeErrorMessage, type HirayaErrorReport } from './errorReport';

