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
  modules: { title: 'Module management', description: 'Upload learning files, store them on each module, and open them again from this list.' },
  programTuition: {
    title: 'Program tuition management',
    description: 'Set one tuition fee for each program. A student’s remaining balance is that fee minus total paid.',
  },
  parents: { title: 'Parent management', description: 'Create parent accounts, link children, and update contact details. Parents use the app for the student.' },
  monitoring: { title: 'Student Monitoring', description: 'Learner records, parent link, program, slot, and payment status.' },
  programs: { title: 'Programs', description: 'Playgroup, preschool, ABA, tutorial, and 1 / 3 / 10-month offerings as program records.' },
  classes: { title: 'Classes', description: 'Class groups, rooms, capacity, and assigned teachers.' },
  playgroup: { title: 'Playgroup', description: 'Playgroup is a program record, not a separate app.' },
  enrollment: { title: 'Enrollment recording', description: 'Applications and class seats recorded by the Super Administrator.' },
  teacherApplications: {
    title: 'Teacher applications',
    description: 'Job applications from the public website. Approving one does not create a student.',
  },
  attendance: {
    title: 'Teachers Attendance record',
    description: 'Confirm on site, absent, or excused. When salary is paid, close the month — the next month starts fresh.',
  },
  tutorial: { title: 'Tutorial', description: 'Tutorial is a program record.' },
  aba: { title: 'ABA', description: 'ABA is a program record.' },
  progress: { title: 'Student progress', description: 'Milestone and progress notes for assigned students.' },
  grades: { title: 'Grades', description: 'Grade entries.' },
  payments: { title: 'Payments', description: 'Teacher pay records and student balances.' },
  finance: {
    title: 'Center Cash flow',
    description: 'One sheet for every income and expense line. Student payments stay income. Teacher salary stays on Teachers payment.',
  },
  calendar: { title: 'Center calendar', description: 'One calendar for the center. Assign class schedules or teacher tasks; teachers are notified on mobile.' },
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
  messages: { title: 'Messages', description: 'Private threads and group chats with teachers and parents. Teachers can message teachers; parents can message co-parents.' },
  feedback: {
    title: 'Feedback',
    description: 'Teacher feedback and parent feedback are separate lists. Parents send both from the mobile app.',
  },
};

export function greeting(name: string) {
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${hello}, ${name || 'Admin'}`;
}
