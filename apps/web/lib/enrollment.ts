import type { EnrollmentApplication, EnrollmentApplyInput, HirayaDatabase } from '@hiraya/types';
import { emptyStore } from '@hiraya/types';
import { newId } from '@hiraya/utils';

export const LOCAL_ENROLLMENTS_KEY = 'hiraya.local.enrollments';
export const LOCAL_STORE_KEY = 'hiraya.local.store';

export function ageFromBirthdate(value: string) {
  if (!value) return '';
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const month = now.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) age -= 1;
  return String(Math.max(0, age));
}

export function enrollmentStatusLabel(status?: string) {
  const value = (status || '').toLowerCase();
  if (value === 'pending_review' || value === 'pending') return 'Pending';
  if (value === 'interview') return 'Interview';
  if (value === 'approved') return 'Approved';
  if (value === 'rejected') return 'Rejected';
  if (value === 'cancelled' || value === 'canceled') return 'Cancelled';
  return status || 'Pending';
}

export function formatEnrollmentNotes(input: EnrollmentApplyInput) {
  return [
    input.studentAddress ? `Address: ${input.studentAddress}` : '',
    input.studentPhone ? `Student contact: ${input.studentPhone}` : '',
    input.studentEmail ? `Student email: ${input.studentEmail}` : '',
    input.guardianRelationship ? `Relationship: ${input.guardianRelationship}` : '',
    input.preferredSchedule ? `Preferred schedule: ${input.preferredSchedule}` : '',
    input.enrollmentType ? `Enrollment type: ${input.enrollmentType}` : '',
    input.notes?.trim() || '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function applicationFromInput(input: EnrollmentApplyInput): EnrollmentApplication {
  return {
    applicationId: newId('app'),
    studentFullname: input.studentFullname,
    studentBirthdate: input.studentBirthdate,
    studentAge: input.studentAge ?? 0,
    studentGender: input.studentGender,
    parentFullname: input.parentFullname,
    parentEmail: input.parentEmail,
    parentPhone: input.parentPhone,
    preferredProgram: input.preferredProgram,
    submittedAt: new Date().toISOString(),
    status: 'pending_review',
    notes: formatEnrollmentNotes(input),
  };
}

export function readLocalEnrollments(): EnrollmentApplication[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_ENROLLMENTS_KEY);
    return raw ? (JSON.parse(raw) as EnrollmentApplication[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalEnrollment(row: EnrollmentApplication) {
  const next = [row, ...readLocalEnrollments().filter((item) => item.applicationId !== row.applicationId)];
  localStorage.setItem(LOCAL_ENROLLMENTS_KEY, JSON.stringify(next));
}

export function readLocalStore(): HirayaDatabase {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const raw = localStorage.getItem(LOCAL_STORE_KEY);
    const parsed = raw ? (JSON.parse(raw) as HirayaDatabase) : emptyStore();
    return {
      ...emptyStore(),
      ...parsed,
      enrollmentApplications: parsed.enrollmentApplications?.length
        ? parsed.enrollmentApplications
        : readLocalEnrollments(),
    };
  } catch {
    return { ...emptyStore(), enrollmentApplications: readLocalEnrollments() };
  }
}

export function writeLocalStore(store: HirayaDatabase) {
  localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(store));
  localStorage.setItem(LOCAL_ENROLLMENTS_KEY, JSON.stringify(store.enrollmentApplications || []));
}
