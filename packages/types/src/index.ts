export const UserRoles = {
  SuperAdmin: 'super_admin',
  Admin: 'admin',
  Teacher: 'teacher',
  Staff: 'staff',
  Parent: 'parent',
  Student: 'student',
} as const;

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];

export const PermissionKeys = {
  ViewStudents: 'students.view',
  CreateStudents: 'students.create',
  EditStudents: 'students.edit',
  ArchiveStudents: 'students.archive',
  ViewTeachers: 'teachers.view',
  ManageTeachers: 'teachers.manage',
  ManageClasses: 'classes.manage',
  ManageEnrollment: 'enrollment.manage',
  ManageAttendance: 'attendance.manage',
  ManageProgress: 'progress.manage',
  ManagePayments: 'payments.manage',
  ManageReports: 'reports.view',
  ManageUsers: 'users.manage',
  ManageSettings: 'settings.manage',
  ViewAudit: 'audit.view',
  ManageRoles: 'roles.manage',
  ManageModules: 'modules.manage',
  ViewModules: 'modules.view',
} as const;

export const PERMISSION_LABELS: { key: string; label: string }[] = [
  { key: PermissionKeys.ViewStudents, label: 'View students' },
  { key: PermissionKeys.CreateStudents, label: 'Create students' },
  { key: PermissionKeys.EditStudents, label: 'Edit students' },
  { key: PermissionKeys.ArchiveStudents, label: 'Archive students' },
  { key: PermissionKeys.ViewTeachers, label: 'View teachers / staff' },
  { key: PermissionKeys.ManageTeachers, label: 'Manage teachers / staff' },
  { key: PermissionKeys.ManageClasses, label: 'Manage classes' },
  { key: PermissionKeys.ManageEnrollment, label: 'Manage enrollment' },
  { key: PermissionKeys.ManageAttendance, label: 'Manage attendance' },
  { key: PermissionKeys.ManageProgress, label: 'Manage progress' },
  { key: PermissionKeys.ManagePayments, label: 'Manage payments' },
  { key: PermissionKeys.ManageReports, label: 'View reports' },
  { key: PermissionKeys.ManageUsers, label: 'Manage users' },
  { key: PermissionKeys.ManageSettings, label: 'Manage system settings' },
  { key: PermissionKeys.ViewAudit, label: 'View audit logs' },
  { key: PermissionKeys.ManageRoles, label: 'Manage roles and permissions' },
  { key: PermissionKeys.ManageModules, label: 'Manage learning modules' },
  { key: PermissionKeys.ViewModules, label: 'View learning modules' },
];

export interface HirayaUser {
  userId: string;
  username: string;
  firstName: string;
  middleName: string;
  lastName: string;
  fullname: string;
  email: string;
  role: string;
  status: string;
  phone?: string | null;
  address: string;
  position: string;
  profileImagePath: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  notifyAttendance: boolean;
  notifyPayments: boolean;
  notifySchedule: boolean;
  notifyProgress: boolean;
  dateFormat: string;
  timeFormat: string;
  theme: string;
  notes: string;
  password?: string | null;
}

export interface TeacherProfile {
  profileId: string;
  userId: string;
  employeeCode: string;
  position: string;
  specialty: string;
  phone: string;
  bio: string;
  hireDate: string;
  status: string;
}

export interface Student {
  studentId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  fullname: string;
  birthdate: string;
  age: number;
  gender: string;
  address: string;
  contactNumber: string;
  parentId: string;
  emergencyContact: string;
  emergencyPhone: string;
  qrCode: string;
  gradeLevel: string;
  program: string;
  status: string;
  enrollmentDate: string;
  notes: string;
}

export interface StudentOpsRecord {
  studentId: string;
  paymentStatus: string;
  collector: string;
  hasIdCard: boolean;
  hasFetcherId: boolean;
  hasNametag: boolean;
  feeAmount: number;
  laceAmount: number;
  currentSlot: string;
  package: string;
}

export interface CenterHoliday {
  holidayId: string;
  date: string;
  title: string;
  kind: string;
}

export interface TeacherDuty {
  dutyId: string;
  workDate: string;
  teacherId: string;
  marker: string;
  note: string;
}

export interface ParentStudent {
  parentStudentId: string;
  parentId: string;
  studentId: string;
  relationship: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountInvitation {
  invitationId: string;
  userId: string;
  tokenHash: string;
  kind: string;
  expiresAt: string;
  usedAt: string;
  createdAt: string;
}

export interface LearningProgram {
  programId: string;
  name: string;
  description: string;
  status: string;
}

export interface LearningClass {
  classId: string;
  name: string;
  programId: string;
  teacherId: string;
  room: string;
  capacity: number;
  scheduleNotes: string;
  status: string;
}

export interface Enrollment {
  enrollmentId: string;
  studentId: string;
  classId: string;
  programId: string;
  teacherId: string;
  period: string;
  status: string;
  enrollmentDate: string;
  approvedBy: string;
}

export interface EnrollmentApplication {
  applicationId: string;
  studentFullname: string;
  studentBirthdate: string;
  studentAge: number;
  studentGender: string;
  parentFullname: string;
  parentEmail: string;
  parentPhone: string;
  preferredProgram: string;
  submittedAt: string;
  status: string;
  studentNumber?: string | null;
  notes?: string | null;
}

export interface AttendanceRecord {
  attendanceId: string;
  kind: string;
  studentId: string;
  employeeId: string;
  classId: string;
  qrCode: string;
  timeIn: string;
  timeOut?: string | null;
  attendanceDate: string;
  status: string;
  notes: string;
  recordedBy: string;
}

export interface ProgressHistoryEntry {
  entryId: string;
  changedBy: string;
  changedAt: string;
  action: string;
  summary: string;
}

export interface ProgressReport {
  reportId: string;
  studentId: string;
  teacherId: string;
  classId: string;
  period: string;
  area: string;
  rating: string;
  evaluation: string;
  behaviorReport: string;
  developmentalReport: string;
  remarks: string;
  uploadedMedia: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  history: ProgressHistoryEntry[];
}

export interface Schedule {
  scheduleId: string;
  title: string;
  kind: string;
  classId: string;
  studentId: string;
  teacherId: string;
  scheduleType: string;
  startAt: string;
  endAt: string;
  room: string;
  notes: string;
  status: string;
}

export interface TeacherWorkShift {
  shiftId: string;
  teacherId: string;
  title: string;
  workDate: string;
  startTime: string;
  endTime: string;
  room: string;
  notes: string;
  status: string;
}

export interface PaymentHistoryEntry {
  entryId: string;
  changedBy: string;
  changedAt: string;
  action: string;
  summary: string;
}

export interface Payment {
  paymentId: string;
  enrollmentId: string;
  studentId: string;
  amount: number;
  amountPaid: number;
  paymentMethod: string;
  paymentStatus: string;
  referenceNumber: string;
  paymentDate: string;
  dueAt: string;
  paidAt: string;
  recordedBy: string;
  notes: string;
  history: PaymentHistoryEntry[];
}

export interface SystemAlert {
  alertId: string;
  kind: string;
  title: string;
  message: string;
  recipientId: string;
  href: string;
  status: string;
  createdAt: string;
  read: boolean;
}

export interface NewsItem {
  newsId: string;
  title: string;
  body: string;
  publishedAt: string;
  isPublished: boolean;
  status: string;
  createdBy: string;
}

export interface TeacherRoleOption {
  roleId: string;
  name: string;
}

export interface LeaveRequest {
  leaveId: string;
  teacherId: string;
  teacherName: string;
  email: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  submittedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  adminNote?: string | null;
}

export interface AppRole {
  roleId: string;
  code: string;
  name: string;
}

export interface CenterRoom {
  roomId: string;
  roomName: string;
  roomNumber: string;
  capacity: number;
  description: string;
  status: string;
}

export interface RolePermission {
  permissionId: string;
  role: string;
  permission: string;
  allowed: boolean;
}

export interface CenterSettings {
  settingsId: string;
  centerName: string;
  logoPath: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  description: string;
  aboutTitle: string;
  welcomeTitle: string;
  welcomeMessage: string;
  mission: string;
  vision: string;
  values: string;
  timeZone: string;
  defaultPeriod: string;
  businessHours: string;
  defaultAttendanceStatus: string;
  defaultPaymentMethod: string;
  notificationsEnabled: boolean;
  notifyAttendance: boolean;
  notifyPayments: boolean;
  notifySchedule: boolean;
  notifyProgress: boolean;
  moduleAllowedExtensions: string;
  moduleMaxFileMb: number;
  updatedAt: string;
}

export interface WebsiteGalleryItem {
  itemId: string;
  title: string;
  caption: string;
  filePath: string;
  status: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  auditId: string;
  actorId: string;
  actorName: string;
  module: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
}

export interface LearningModule {
  moduleId: string;
  title: string;
  description: string;
  programId: string;
  subject: string;
  gradeLevel: string;
  moduleType: string;
  classIds: string[];
  currentVersionId: string;
  version: string;
  status: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  uploadedByUserId: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  archivedAt: string;
}

export interface LearningModuleVersion {
  versionId: string;
  moduleId: string;
  version: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  changeDescription: string;
  uploadedByUserId: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface HirayaDatabase {
  users: HirayaUser[];
  teacherProfiles: TeacherProfile[];
  students: Student[];
  programs: LearningProgram[];
  classes: LearningClass[];
  enrollments: Enrollment[];
  enrollmentApplications: EnrollmentApplication[];
  attendance: AttendanceRecord[];
  reports: ProgressReport[];
  schedules: Schedule[];
  teacherWorkShifts: TeacherWorkShift[];
  teacherRoleOptions: TeacherRoleOption[];
  news: NewsItem[];
  leaveRequests: LeaveRequest[];
  payments: Payment[];
  alerts: SystemAlert[];
  auditLogs: AuditLogEntry[];
  rolePermissions: RolePermission[];
  roles: AppRole[];
  rooms: CenterRoom[];
  learningModules: LearningModule[];
  learningModuleVersions: LearningModuleVersion[];
  parentStudents: ParentStudent[];
  accountInvitations: AccountInvitation[];
  studentOps: StudentOpsRecord[];
  centerHolidays: CenterHoliday[];
  teacherDuties: TeacherDuty[];
  websiteGallery: WebsiteGalleryItem[];
  settings: CenterSettings;
}

export interface AuthSession {
  user: HirayaUser;
  token: string;
}

export interface PublicProgram {
  programId: string;
  name: string;
  description: string;
}

export interface PublicSite {
  centerName: string;
  description: string;
  aboutTitle: string;
  welcomeTitle: string;
  welcomeMessage: string;
  mission: string;
  vision: string;
  values: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  businessHours: string;
  hasLogo: boolean;
  contentUpdatedAt: string;
  programs: PublicProgram[];
  gallery?: { itemId: string; title: string; caption: string }[];
}

export interface EnrollmentApplyInput {
  studentFullname: string;
  studentBirthdate: string;
  studentAge: number;
  studentGender: string;
  parentFullname: string;
  parentEmail: string;
  parentPhone: string;
  preferredProgram: string;
  studentAddress?: string;
  studentPhone?: string;
  studentEmail?: string;
  guardianRelationship?: string;
  preferredSchedule?: string;
  enrollmentType?: string;
  notes?: string;
}

export const emptyStore = (): HirayaDatabase => ({
  users: [],
  teacherProfiles: [],
  students: [],
  programs: [],
  classes: [],
  enrollments: [],
  enrollmentApplications: [],
  attendance: [],
  reports: [],
  schedules: [],
  teacherWorkShifts: [],
  teacherRoleOptions: [],
  news: [],
  leaveRequests: [],
  payments: [],
  alerts: [],
  auditLogs: [],
  rolePermissions: [],
  roles: [],
  rooms: [],
  learningModules: [],
  learningModuleVersions: [],
  parentStudents: [],
  accountInvitations: [],
  studentOps: [],
  centerHolidays: [],
  teacherDuties: [],
  websiteGallery: [],
  settings: {
    settingsId: 'center',
    centerName: 'HIRAYA Learning Center',
    logoPath: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    description: '',
    aboutTitle: 'About HIRAYA',
    welcomeTitle: 'Welcome to HIRAYA Learning Center',
    welcomeMessage: '',
    mission: '',
    vision: '',
    values: '',
    timeZone: 'Asia/Manila',
    defaultPeriod: '',
    businessHours: 'Monday–Friday, 8:00–17:00',
    defaultAttendanceStatus: 'present',
    defaultPaymentMethod: 'cash',
    notificationsEnabled: true,
    notifyAttendance: true,
    notifyPayments: true,
    notifySchedule: true,
    notifyProgress: true,
    moduleAllowedExtensions: '',
    moduleMaxFileMb: 0,
    updatedAt: '',
  },
});
