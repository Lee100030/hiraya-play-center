import type { HirayaDatabase, ParentStudent, Student } from '@hiraya/types';
import { newId } from '@hiraya/utils';

export { assignedStudentsForTeacher, programsForTeacher, remainingSessionsFor, studentPlacement } from '@hiraya/utils';

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ageFromBirthdate(birthdate: string) {
  if (!birthdate) return 0;
  const born = new Date(birthdate);
  if (Number.isNaN(born.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const month = now.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < born.getDate())) age -= 1;
  return Math.max(0, age);
}

export function parentOptions(store: HirayaDatabase) {
  return store.users.filter((user) => user.role === 'parent');
}

export function teacherOptions(store: HirayaDatabase) {
  return store.users.filter((user) => user.role === 'teacher');
}

export function childrenOf(store: HirayaDatabase, parentId: string) {
  const ids = new Set(
    store.parentStudents.filter((link) => link.parentId === parentId && link.isActive).map((link) => link.studentId),
  );
  return store.students.filter((student) => ids.has(student.studentId) || student.parentId === parentId);
}

export function withParentLink(
  store: HirayaDatabase,
  parentId: string,
  studentId: string,
  relationship = 'Guardian',
): ParentStudent[] {
  if (!parentId || !studentId) return store.parentStudents;
  const now = new Date().toISOString();
  const existing = store.parentStudents.find((link) => link.parentId === parentId && link.studentId === studentId);
  return [
    ...store.parentStudents.filter((link) => !(link.parentId === parentId && link.studentId === studentId)),
    {
      parentStudentId: existing?.parentStudentId || newId('ps'),
      parentId,
      studentId,
      relationship,
      isActive: true,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    },
  ];
}

export function studentRecord(partial: Partial<Student> & Pick<Student, 'firstName' | 'lastName'>): Student {
  const firstName = partial.firstName.trim();
  const middleName = (partial.middleName || '').trim();
  const lastName = partial.lastName.trim();
  return {
    studentId: partial.studentId || newId('stu'),
    firstName,
    middleName,
    lastName,
    fullname: [firstName, middleName, lastName].filter(Boolean).join(' '),
    birthdate: partial.birthdate || '',
    age: partial.age ?? ageFromBirthdate(partial.birthdate || ''),
    gender: partial.gender || '',
    address: partial.address || '',
    contactNumber: partial.contactNumber || '',
    parentId: partial.parentId || '',
    emergencyContact: partial.emergencyContact || '',
    emergencyPhone: partial.emergencyPhone || '',
    qrCode: partial.qrCode || '',
    gradeLevel: partial.gradeLevel || '',
    program: partial.program || '',
    status: partial.status || 'active',
    enrollmentDate: partial.enrollmentDate || todayIso(),
    notes: partial.notes || '',
    profileImagePath: partial.profileImagePath || '',
  };
}
