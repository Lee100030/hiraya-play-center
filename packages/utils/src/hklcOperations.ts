import { UserRoles } from '@hiraya/types';

const ADMINS = [UserRoles.SuperAdmin];
const OFFICE = [...ADMINS];
const CLASSROOM = [...ADMINS, UserRoles.Teacher];
const FAMILY = [UserRoles.Parent];
const EVERYONE = [...CLASSROOM, ...FAMILY];

/** Workbook tabs from Hiraya Kids Learning Center.xlsx (Google Drive). */
export const HKLC_WORKBOOK_SHEETS = [
  'HKLC Structure',
  '10 months program 2k27',
  '10 months program 2k26',
  'STUDENT MONITORING MASTER LIST',
  '1-Month Program',
  '3-Months Program',
  'PLAYGROUP SCHEDULE',
  '10-Months Program Old',
  'Teachers\' Schedule',
  'Compliance Tracker',
  'TJess ABA',
  'ABA attendance & payment',
  'ABA Metrics',
  'Tutorial Attendance',
  'HIRAYA CALENDAR',
  '26-27 SCHOOL CALENDAR',
  'Student\'s Sheet',
  'PRESCHOOL',
  'uniform',
  'Uniform Inventory & Stock Monitoring',
  'ADMIN CALENDAR',
] as const;

export type HklcNavId =
  | 'dashboard'
  | 'students'
  | 'monitoring'
  | 'parents'
  | 'teachers'
  | 'programs'
  | 'classes'
  | 'playgroup'
  | 'enrollment'
  | 'teacherApplications'
  | 'attendance'
  | 'tutorial'
  | 'aba'
  | 'progress'
  | 'grades'
  | 'payments'
  | 'finance'
  | 'calendar'
  | 'holidays'
  | 'teacherSchedule'
  | 'dayOff'
  | 'compliance'
  | 'uniforms'
  | 'evaluations'
  | 'marketing'
  | 'notifications'
  | 'modules'
  | 'programTuition'
  | 'reports'
  | 'settings'
  | 'tasks'
  | 'announcements'
  | 'sessions'
  | 'messages'
  | 'feedback'
  | 'abaSchedule';

export type HklcNavItem = {
  id: HklcNavId;
  label: string;
  sheet: string;
  roles: string[];
};

export type HklcNavGroup = { label: string; items: HklcNavItem[] };

export const HKLC_NAV_GROUPS: HklcNavGroup[] = [
  {
    label: 'Main',
    items: [{ id: 'dashboard', label: 'Dashboard', sheet: 'HKLC Structure', roles: CLASSROOM }],
  },
  {
    label: 'Management',
    items: [
      { id: 'students', label: 'Student management', sheet: "Student's Sheet", roles: CLASSROOM },
      { id: 'parents', label: 'Parent management', sheet: 'Enrollment Recoding', roles: ADMINS },
      { id: 'teachers', label: 'Teachers Management', sheet: 'HKLC Structure', roles: ADMINS },
      { id: 'modules', label: 'Module management', sheet: 'Curriculum Implementation and Monitoring', roles: CLASSROOM },
      { id: 'programTuition', label: 'Program tuition management', sheet: 'Final audited cash payments', roles: ADMINS },
      { id: 'calendar', label: 'Center calendar', sheet: 'HIRAYA CALENDAR', roles: CLASSROOM },
      { id: 'abaSchedule', label: 'ABA schedule', sheet: 'TJess ABA', roles: CLASSROOM },
      { id: 'announcements', label: 'Announcement management', sheet: 'Weekly Template for posting', roles: ADMINS },
      { id: 'feedback', label: 'Feedback', sheet: 'Weekly Template for posting', roles: ADMINS },
      { id: 'sessions', label: 'Session management', sheet: "Student's Sheet", roles: ADMINS },
    ],
  },
  {
    label: 'Enrollment',
    items: [
      { id: 'enrollment', label: 'Enrollment Recording', sheet: 'Enrollment Recoding', roles: OFFICE },
      { id: 'teacherApplications', label: 'Teacher applications', sheet: 'Enrollment Recoding', roles: OFFICE },
    ],
  },
  {
    label: 'Records',
    items: [
      { id: 'attendance', label: 'Teachers Attendance record', sheet: 'Operational Attendance Compliance', roles: CLASSROOM },
      { id: 'progress', label: 'Student progress', sheet: 'Monthly Milestone Approver', roles: CLASSROOM },
      { id: 'payments', label: 'Payments', sheet: 'Final audited cash payments', roles: [...OFFICE, UserRoles.Parent] },
      { id: 'finance', label: 'Center Cash flow', sheet: 'Financial Report', roles: ADMINS },
      { id: 'notifications', label: 'Notifications', sheet: 'Weekly Template for posting', roles: EVERYONE },
      { id: 'marketing', label: 'Marketing site', sheet: 'Weekly Template for posting', roles: ADMINS },
      { id: 'reports', label: 'Reports', sheet: 'Financial Report', roles: CLASSROOM },
      { id: 'settings', label: 'Settings', sheet: 'HKLC Structure', roles: ADMINS },
    ],
  },
];

export function hklcNavForRole(role?: string | null): HklcNavGroup[] {
  const code = role || '';
  return HKLC_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(code)),
  })).filter((group) => group.items.length > 0);
}

export function hklcTaskBoards(role?: string | null): { owner: string; items: string[] }[] {
  if (role === UserRoles.Teacher) {
    return [
      {
        owner: 'Teacher — program tasks',
        items: [
          'Deliver the assigned 1 / 3 / 10-month, playgroup, preschool, ABA, or tutorial session',
          'Plot and follow the playgroup and class schedule',
          'Take tutorial / ABA / operational attendance',
          'Update student monitoring and milestone notes',
        ],
      },
      {
        owner: 'Teacher — admin tasks',
        items: [
          'Submit teacher day-off requests',
          'Complete coaching and evaluation forms when assigned',
          'Keep ID, nametag, and uniform compliance current',
        ],
      },
    ];
  }
  if (role === UserRoles.Staff) {
    return [
      {
        owner: 'Administrative Officer',
        items: [
          'Accounting / filing, payroll, invoices, CRM, contracts',
          'Financial report',
          "Parent's evaluation form, employees evaluation form, coaching form",
          'Grades and employee certificates',
          'Weekly template for posting and compiling sheets',
          "Teacher's day-off requests",
          'ABA & tutorial schedule plotting',
          'Enrollment recording',
        ],
      },
    ];
  }
  if (role === UserRoles.Parent || role === UserRoles.Student) {
    return [
      {
        owner: 'Family',
        items: [
          'View the child student sheet and monitoring status',
          'Follow playgroup / class / HIRAYA calendar',
          'Check attendance, progress, and remaining sessions',
          'Review payments and uniform / ID requirements',
        ],
      },
    ];
  }
  return [
    {
      owner: 'Program Director',
      items: ['Oversee 1 / 3 / 10-month, playgroup, preschool, ABA, and tutorial programs'],
    },
    {
      owner: 'Administrative Director',
      items: ['Marketing', 'Finance', 'Administrative approver'],
    },
    {
      owner: 'Supervisor',
      items: [
        'Monthly milestone approver',
        'Curriculum implementation and monitoring',
        'Coaching session',
        'Employees framework onboarding',
        'Final audited cash payments',
        'Internal function — video checking',
        'Internal function — cleaning schedule',
        'Operational attendance compliance',
        'ABA monthly observation report',
        'ABA checklist improvement',
        'ABA skill acquisition checklist',
        'ABA tools checklist',
        'ABA onboarding / orientation',
      ],
    },
    {
      owner: 'Administrative Officer',
      items: [
        'Accounting / filing, payroll, invoice, CRM, contracts, financial report',
        'Parent and employee evaluation forms, coaching form',
        'Grades, certificates, weekly posting template, compiling sheets',
        "Teacher's day-off, ABA & tutorial schedule plotting, enrollment recording",
      ],
    },
  ];
}
