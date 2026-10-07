import type { EnrollmentApplication, HirayaDatabase } from '@hiraya/types';
import { isTeacherApplication } from './operationsStats';
import { normalizeStaffEmail, normalizeStaffName, staffDisplayName } from './staffDedupe';

function isStaffRole(role?: string | null) {
  const value = (role || '').toLowerCase();
  return value === 'teacher' || value === 'staff';
}

export function teacherApplicationOpen(status?: string | null) {
  const value = (status || '').toLowerCase();
  return value === 'pending' || value === 'pending_review' || value === 'interview';
}

export function matchingTeacherForApplication(store: HirayaDatabase, app: EnrollmentApplication) {
  const email = normalizeStaffEmail(app.parentEmail);
  const name = normalizeStaffName(app.studentFullname);
  const linked = (app.studentNumber || '').trim();
  const staff = (store.users || []).filter((user) => isStaffRole(user.role));
  if (linked) {
    const hit = staff.find((user) => user.userId === linked);
    if (hit) return hit;
  }
  if (email) {
    const hit = staff.find(
      (user) =>
        normalizeStaffEmail(user.email) === email || normalizeStaffEmail(user.personalEmail) === email,
    );
    if (hit) return hit;
  }
  if (name) {
    const hit = staff.find((user) => normalizeStaffName(staffDisplayName(user)) === name);
    if (hit) return hit;
  }
  return undefined;
}

export function unusedTeacherLogin(store: HirayaDatabase, preferred?: string | null, fullname?: string | null) {
  const taken = new Set(
    (store.users || []).map((user) => normalizeStaffEmail(user.email)).filter(Boolean),
  );
  const mail = (preferred || '').trim();
  if (mail.includes('@') && !taken.has(mail.toLowerCase())) return mail;
  const slug =
    (fullname || 'teacher')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '') || 'teacher';
  let n = 0;
  while (true) {
    const candidate = n === 0 ? `${slug}@hiraya.local` : `${slug}${n}@hiraya.local`;
    if (!taken.has(candidate)) return candidate;
    n += 1;
  }
}

export function approvedTeacherApplicationsWithoutAccount(store: HirayaDatabase): EnrollmentApplication[] {
  return (store.enrollmentApplications || []).filter(
    (row) =>
      isTeacherApplication(row) &&
      (row.status || '').toLowerCase() === 'approved' &&
      !matchingTeacherForApplication(store, row),
  );
}

export function teacherHireDraft(store: HirayaDatabase, app: EnrollmentApplication, password: string) {
  const email = unusedTeacherLogin(store, app.parentEmail, app.studentFullname);
  const personal = (app.parentEmail || '').trim();
  return {
    fullname: (app.studentFullname || '').trim(),
    email,
    personalEmail: personal.includes('@') && !personal.toLowerCase().endsWith('@hiraya.local') ? personal : '',
    phone: (app.parentPhone || '').trim(),
    role: 'teacher',
    position: (app.preferredProgram || '').trim(),
    specialty: (app.preferredProgram || '').trim(),
    status: 'active',
    notes: [`Approved from teacher application ${app.applicationId}.`, (app.notes || '').trim()].filter(Boolean).join(' '),
    password,
    confirmPassword: password,
  };
}
