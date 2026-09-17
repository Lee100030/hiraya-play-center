import { hklcNavForRole, statusLabel, type HklcNavId } from '@hiraya/utils';

export { statusLabel };

export type ViewId = HklcNavId;

export const NAV_GROUPS = [
  { label: 'Main', items: [{ id: 'dashboard' as ViewId, label: 'Dashboard' }] },
];

export function desktopNav(role?: string | null) {
  return hklcNavForRole(role).map((group) => ({
    label: group.label,
    items: group.items.map((item) => ({ id: item.id as ViewId, label: item.label })),
  }));
}

export const PAGE_COPY: Record<ViewId, { title: string; description: string }> = {
  dashboard: { title: 'Dashboard', description: 'Center overview. Desktop is the control system; teachers and parents use the mobile app for assigned work.' },
  students: { title: 'Student management', description: 'Create learners, link each child to a parent, and mark who is at the center today. Present records attendance and uses one session from the child’s package.' },
  teachers: { title: 'Teacher management', description: 'Manage teachers, assigned students, schedules, attendance, tasks, notes, and monthly activities.' },
  modules: { title: 'Module management', description: 'Create, publish, and archive learning modules for classes and programs.' },
  parents: { title: 'Parent management', description: 'Create parent accounts, link children, and update contact details. Parents use the app for the student.' },
  monitoring: { title: 'Student Monitoring', description: 'Learner records, parent link, program, slot, and payment status.' },
  programs: { title: 'Programs', description: 'Playgroup, preschool, ABA, tutorial, and 1 / 3 / 10-month offerings as program records.' },
  classes: { title: 'Classes', description: 'Class groups, rooms, capacity, and assigned teachers.' },
  playgroup: { title: 'Playgroup', description: 'Playgroup is a program record, not a separate app.' },
  enrollment: { title: 'Enrollment recording', description: 'Applications and class seats recorded by the Super Administrator.' },
  attendance: { title: 'Attendance', description: 'Daily attendance. Present/late marks consume a session from the child’s package.' },
  tutorial: { title: 'Tutorial', description: 'Tutorial is a program record.' },
  aba: { title: 'ABA', description: 'ABA is a program record.' },
  progress: { title: 'Progress', description: 'Milestone and progress notes for assigned students.' },
  grades: { title: 'Grades', description: 'Grade entries.' },
  payments: { title: 'Payments', description: 'Collections and open balances.' },
  finance: { title: 'Finance', description: 'Finance records.' },
  calendar: { title: 'Schedule management', description: 'Create class schedules assigned to a teacher. Teachers and linked parents see them on mobile.' },
  holidays: { title: 'Holidays', description: 'School calendar holidays.' },
  teacherSchedule: { title: "Teachers' schedule", description: 'Use Schedule management to assign teacher times.' },
  dayOff: { title: "Teacher's day off", description: 'Day-off requests.' },
  compliance: { title: 'Compliance', description: 'Operational checklist items.' },
  uniforms: { title: 'Uniforms', description: 'Uniform inventory.' },
  evaluations: { title: 'Evaluations', description: 'Evaluation forms.' },
  marketing: { title: 'Marketing site', description: 'Landing and About copy for the public website. Same records as website admin.' },
  notifications: { title: 'Notifications', description: 'Alerts generated when schedules, tasks, announcements, or sessions change.' },
  reports: { title: 'Reports', description: 'Operational counts from the current store, matching the website dashboard.' },
  settings: { title: 'Settings', description: 'Edit this Super Administrator profile, password, alerts, and center identity. Same records as website admin.' },
  tasks: { title: 'Task management', description: 'Assign tasks to teachers. Teachers complete them on mobile; status returns here.' },
  announcements: { title: 'Announcement management', description: 'Publish news to teachers, parents, or everyone. Mobile shows only matching recipients.' },
  sessions: { title: 'Session management', description: 'Session packages per child. Remaining = total − used, never below zero. Parents see this on mobile.' },
  messages: { title: 'Messages', description: 'Private threads with teachers and parents. Replies are saved for both people and stay in this inbox — they do not pop up as notifications.' },
};

export function greeting(name: string) {
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${hello}, ${name || 'Admin'}`;
}
