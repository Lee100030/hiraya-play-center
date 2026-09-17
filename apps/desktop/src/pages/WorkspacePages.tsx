import type { HirayaDatabase, HirayaUser } from '@hiraya/types';
import { displayName, formatDate, operationsStats, studentDisplay } from '@hiraya/utils';
import { Button } from '@hiraya/ui';
import { RecordTable, StatusCell } from '../components/RecordTable';
import { PageHeader } from '../components/PageHeader';
import { PAGE_COPY } from '../lib/views';
import { TeachersPage } from './TeachersPage';
import { ParentsPage } from './ParentsPage';
import { StudentsPage } from './StudentsPage';
import { ProgramsPage } from './ProgramsPage';
import { ClassesPage } from './ClassesPage';
import { EnrollmentPage } from './EnrollmentPage';
import { ModulesPage } from './ModulesPage';
import { SchedulesManagePage, TasksManagePage, AnnouncementsManagePage, SessionsManagePage } from './WorkflowPages';
import { AttendanceManagePage, PaymentsManagePage, ProgressManagePage, SettingsPage, WebsiteCmsPage } from './RecordsPages';
import { MessagesPage } from './MessagesPage';

function nameOf(store: HirayaDatabase, userId?: string) {
  const user = store.users.find((item) => item.userId === userId);
  return user ? displayName(user) : userId || '—';
}

function studentName(store: HirayaDatabase, studentId?: string) {
  const student = store.students.find((item) => item.studentId === studentId);
  return student ? studentDisplay(student) : studentId || '—';
}

function mentions(value: string | undefined, ...needles: string[]) {
  const hay = (value || '').toLowerCase();
  return needles.some((n) => hay.includes(n.toLowerCase()));
}

function opsFor(store: HirayaDatabase, studentId: string) {
  return (store.studentOps || []).find((row) => row.studentId === studentId);
}

export function WorkspacePages({
  view,
  store,
  user,
  onStore,
  saveStore,
  onRefresh,
  onUser,
}: {
  view: string;
  store: HirayaDatabase;
  user: HirayaUser;
  onStore: (next: HirayaDatabase) => void;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
  onUser?: (next: HirayaUser) => void;
}) {
  if (view === 'teachers') {
    return (
      <TeachersPage store={store} onStore={onStore} saveStore={saveStore} onRefresh={onRefresh} actor={user} />
    );
  }
  if (view === 'parents') return <ParentsPage store={store} onStore={onStore} onRefresh={onRefresh} actor={user} />;
  if (view === 'students' || view === 'monitoring') {
    return <StudentsPage store={store} saveStore={saveStore} onRefresh={onRefresh} actor={user} />;
  }
  if (view === 'programs') return <ProgramsPage store={store} saveStore={saveStore} />;
  if (view === 'classes') return <ClassesPage store={store} saveStore={saveStore} />;
  if (view === 'modules') return <ModulesPage store={store} user={user} saveStore={saveStore} onRefresh={onRefresh} />;
  if (view === 'calendar') return <SchedulesManagePage store={store} user={user} saveStore={saveStore} onRefresh={onRefresh} />;
  if (view === 'tasks') return <TasksManagePage store={store} user={user} saveStore={saveStore} onRefresh={onRefresh} />;
  if (view === 'announcements') return <AnnouncementsManagePage store={store} user={user} saveStore={saveStore} onRefresh={onRefresh} />;
  if (view === 'sessions') return <SessionsManagePage store={store} saveStore={saveStore} onRefresh={onRefresh} />;
  if (view === 'enrollment') {
    return <EnrollmentPage store={store} user={user} saveStore={saveStore} onStore={onStore} />;
  }
  if (view === 'messages') {
    return <MessagesPage store={store} user={user} onStore={onStore} saveStore={saveStore} />;
  }

  if (view === 'attendance') {
    return <AttendanceManagePage store={store} user={user} saveStore={saveStore} onRefresh={onRefresh} />;
  }

  if (view === 'progress') {
    return <ProgressManagePage store={store} user={user} saveStore={saveStore} onRefresh={onRefresh} />;
  }

  if (view === 'payments') {
    return <PaymentsManagePage store={store} user={user} saveStore={saveStore} onRefresh={onRefresh} />;
  }

  if (view === 'notifications') {
    return (
      <RecordTable
        title={PAGE_COPY.notifications.title}
        description={PAGE_COPY.notifications.description}
        rows={store.alerts.filter((row) => (row.kind || '').toLowerCase() !== 'direct')}
        search={(row, q) => `${row.title} ${row.message} ${row.kind}`.toLowerCase().includes(q)}
        searchPlaceholder="Search notifications"
        emptyTitle="No notifications"
        emptyHint="Alerts for this workspace will appear here."
        statusOf={(row) => (row.read ? 'read' : 'unread')}
        columns={[
          { key: 'title', header: 'Title', render: (row) => row.title || row.kind },
          { key: 'msg', header: 'Message', render: (row) => row.message || '—' },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.read ? 'read' : 'unread'} /> },
          { key: 'date', header: 'Date', render: (row) => formatDate(row.createdAt) },
        ]}
      />
    );
  }

  if (view === 'monitoring') {
    return (
      <RecordTable
        title={PAGE_COPY.monitoring.title}
        description={PAGE_COPY.monitoring.description}
        rows={store.students}
        rowKey={(row) => row.studentId}
        search={(row, q) => `${studentDisplay(row)} ${row.program} ${opsFor(store, row.studentId)?.currentSlot || ''}`.toLowerCase().includes(q)}
        searchPlaceholder="Search monitoring list"
        emptyTitle="No students on the master list"
        emptyHint="Student sheets appear here with payment, ID, and slot fields from operations."
        statusOf={(row) => row.status}
        columns={[
          { key: 'name', header: 'Student', render: (row) => studentDisplay(row) },
          { key: 'program', header: 'Program', render: (row) => row.program || '—' },
          { key: 'slot', header: 'Slot', render: (row) => opsFor(store, row.studentId)?.currentSlot || '—' },
          { key: 'package', header: 'Package', render: (row) => opsFor(store, row.studentId)?.package || '—' },
          { key: 'pay', header: 'Payment', render: (row) => opsFor(store, row.studentId)?.paymentStatus || '—' },
          { key: 'collector', header: 'Collector', render: (row) => opsFor(store, row.studentId)?.collector || '—' },
          { key: 'id', header: 'ID card', render: (row) => (opsFor(store, row.studentId)?.hasIdCard ? 'Yes' : 'No') },
          { key: 'fetch', header: 'Fetcher ID', render: (row) => (opsFor(store, row.studentId)?.hasFetcherId ? 'Yes' : 'No') },
          { key: 'tag', header: 'Nametag', render: (row) => (opsFor(store, row.studentId)?.hasNametag ? 'Yes' : 'No') },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
        ]}
      />
    );
  }

  if (view === 'playgroup') {
    const rows = store.schedules.filter((row) => mentions(row.title, 'playgroup') || mentions(row.kind, 'playgroup') || mentions(row.room, 'playgroup'));
    return (
      <RecordTable
        title={PAGE_COPY.playgroup.title}
        description={PAGE_COPY.playgroup.description}
        rows={rows.length ? rows : store.schedules}
        search={(row, q) => `${row.title} ${row.room} ${row.kind}`.toLowerCase().includes(q)}
        searchPlaceholder="Search playgroup"
        emptyTitle="No playgroup sessions"
        emptyHint="Plot playgroup sessions on the calendar to fill this desk."
        statusOf={(row) => row.status}
        columns={[
          { key: 'title', header: 'Session', render: (row) => row.title || 'Playgroup' },
          { key: 'start', header: 'Starts', render: (row) => formatDate(row.startAt) },
          { key: 'room', header: 'Room', render: (row) => row.room || '—' },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
        ]}
      />
    );
  }

  if (view === 'aba') {
    const abaPay = store.payments.filter((row) => mentions(row.notes, 'aba') || mentions(row.referenceNumber, 'aba'));
    const abaAtt = store.attendance.filter((row) => mentions(row.notes, 'aba') || mentions(row.kind, 'aba'));
    return (
      <RecordTable
        title={PAGE_COPY.aba.title}
        description={PAGE_COPY.aba.description}
        rows={abaAtt.length ? abaAtt : store.attendance}
        search={(row, q) => `${row.studentId} ${row.status} ${row.attendanceDate}`.toLowerCase().includes(q)}
        searchPlaceholder="Search ABA attendance"
        emptyTitle="No ABA attendance yet"
        emptyHint="TJess ABA attendance and payment rows from the workbook appear here."
        statusOf={(row) => row.status}
        columns={[
          { key: 'date', header: 'Date', render: (row) => formatDate(row.attendanceDate) },
          { key: 'who', header: 'Learner', render: (row) => studentName(store, row.studentId) },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
          { key: 'pay', header: 'Open ABA payments', render: () => String(abaPay.length || store.payments.length) },
        ]}
      />
    );
  }

  if (view === 'tutorial') {
    const rows = store.attendance.filter((row) => mentions(row.notes, 'tutorial') || mentions(row.kind, 'tutorial'));
    return (
      <RecordTable
        title={PAGE_COPY.tutorial.title}
        description={PAGE_COPY.tutorial.description}
        rows={rows.length ? rows : store.attendance}
        search={(row, q) => `${row.studentId} ${row.status}`.toLowerCase().includes(q)}
        searchPlaceholder="Search tutorial attendance"
        emptyTitle="No tutorial attendance"
        emptyHint="Tutorial attendance from the workbook will list here."
        statusOf={(row) => row.status}
        columns={[
          { key: 'date', header: 'Date', render: (row) => formatDate(row.attendanceDate) },
          { key: 'who', header: 'Learner', render: (row) => studentName(store, row.studentId) },
          { key: 'in', header: 'Time in', render: (row) => row.timeIn || '—' },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
        ]}
      />
    );
  }

  if (view === 'teacherSchedule') {
    return (
      <RecordTable
        title={PAGE_COPY.teacherSchedule.title}
        description={PAGE_COPY.teacherSchedule.description}
        rows={store.teacherWorkShifts || []}
        search={(row, q) => `${nameOf(store, row.teacherId)} ${row.workDate} ${row.title} ${row.notes}`.toLowerCase().includes(q)}
        searchPlaceholder="Search teacher schedule"
        emptyTitle="No teacher shifts plotted"
        emptyHint="ABA and tutorial schedule plotting is recorded as teacher work shifts."
        statusOf={(row) => row.status}
        columns={[
          { key: 'who', header: 'Teacher', render: (row) => nameOf(store, row.teacherId) },
          { key: 'date', header: 'Date', render: (row) => formatDate(row.workDate) },
          { key: 'time', header: 'Time', render: (row) => `${row.startTime || '—'}–${row.endTime || '—'}` },
          { key: 'note', header: 'Shift', render: (row) => row.title || row.notes || '—' },
        ]}
      />
    );
  }

  if (view === 'dayOff') {
    return (
      <RecordTable
        title={PAGE_COPY.dayOff.title}
        description={PAGE_COPY.dayOff.description}
        rows={store.leaveRequests || []}
        search={(row, q) => `${row.teacherName} ${row.reason} ${row.status}`.toLowerCase().includes(q)}
        searchPlaceholder="Search day-off requests"
        emptyTitle="No day-off requests"
        emptyHint="Teachers submit day-off requests for the administrative officer to review."
        statusOf={(row) => row.status}
        columns={[
          { key: 'who', header: 'Teacher', render: (row) => row.teacherName || nameOf(store, row.teacherId) },
          { key: 'start', header: 'From', render: (row) => formatDate(row.startDate) },
          { key: 'end', header: 'To', render: (row) => formatDate(row.endDate) },
          { key: 'reason', header: 'Reason', render: (row) => row.reason || '—' },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
        ]}
      />
    );
  }

  if (view === 'holidays') {
    return (
      <RecordTable
        title={PAGE_COPY.holidays.title}
        description={PAGE_COPY.holidays.description}
        rows={store.centerHolidays || []}
        search={(row, q) => `${row.title} ${row.kind} ${row.date}`.toLowerCase().includes(q)}
        searchPlaceholder="Search calendar"
        emptyTitle="No calendar items"
        emptyHint="School-year and admin calendar dates from the workbook appear here."
        columns={[
          { key: 'date', header: 'Date', render: (row) => formatDate(row.date) },
          { key: 'title', header: 'Event', render: (row) => row.title },
          { key: 'kind', header: 'Kind', render: (row) => row.kind || '—' },
        ]}
      />
    );
  }

  if (view === 'compliance' || view === 'uniforms') {
    return (
      <RecordTable
        title={view === 'uniforms' ? PAGE_COPY.uniforms.title : PAGE_COPY.compliance.title}
        description={view === 'uniforms' ? PAGE_COPY.uniforms.description : PAGE_COPY.compliance.description}
        rows={store.students}
        rowKey={(row) => row.studentId}
        search={(row, q) => studentDisplay(row).toLowerCase().includes(q)}
        searchPlaceholder="Search learners"
        emptyTitle="No inventory rows"
        emptyHint="ID, nametag, fetcher ID, and uniform/lace amounts from student operations."
        statusOf={(row) => row.status}
        columns={[
          { key: 'name', header: 'Student', render: (row) => studentDisplay(row) },
          { key: 'id', header: 'ID card', render: (row) => (opsFor(store, row.studentId)?.hasIdCard ? 'Yes' : 'No') },
          { key: 'fetch', header: 'Fetcher ID', render: (row) => (opsFor(store, row.studentId)?.hasFetcherId ? 'Yes' : 'No') },
          { key: 'tag', header: 'Nametag', render: (row) => (opsFor(store, row.studentId)?.hasNametag ? 'Yes' : 'No') },
          { key: 'fee', header: 'Fee', render: (row) => `₱${Number(opsFor(store, row.studentId)?.feeAmount || 0).toLocaleString()}` },
          { key: 'lace', header: 'Lace / uniform', render: (row) => `₱${Number(opsFor(store, row.studentId)?.laceAmount || 0).toLocaleString()}` },
        ]}
      />
    );
  }

  if (view === 'marketing') {
    return <WebsiteCmsPage store={store} onRefresh={onRefresh} />;
  }

  if (view === 'grades') {
    return (
      <RecordTable
        title={PAGE_COPY.grades.title}
        description={PAGE_COPY.grades.description}
        rows={store.reports}
        search={(row, q) => JSON.stringify(row).toLowerCase().includes(q)}
        searchPlaceholder="Search grades"
        emptyTitle="No grades yet"
        emptyHint="Progress records with ratings appear here."
        columns={[
          { key: 'student', header: 'Student', render: (row) => studentName(store, row.studentId) },
          { key: 'area', header: 'Area', render: (row) => row.area || '—' },
          { key: 'rating', header: 'Grade', render: (row) => row.rating || '—' },
        ]}
      />
    );
  }

  if (view === 'finance' || view === 'evaluations') {
    const copy = PAGE_COPY[view];
    return (
      <RecordTable
        title={copy.title}
        description={copy.description}
        rows={store.payments}
        search={(row, q) => JSON.stringify(row).toLowerCase().includes(q)}
        searchPlaceholder={`Search ${copy.title.toLowerCase()}`}
        emptyTitle={`No ${copy.title.toLowerCase()} yet`}
        emptyHint="Rows from the HKLC workbook operation will appear as they are recorded."
        columns={[
          { key: 'student', header: 'Student', render: (row) => studentName(store, row.studentId) },
          { key: 'amount', header: 'Amount', render: (row) => `₱${Number(row.amount || 0).toLocaleString()}` },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.paymentStatus} /> },
        ]}
      />
    );
  }

  if (view === 'reports') {
    const stats = operationsStats(store);
    const revenue = store.payments.reduce((sum, row) => sum + (Number(row.amountPaid) || 0), 0);
    function exportCsv() {
      const lines = [
        'Report,Value',
        `Active students,${stats.totalStudents}`,
        `Teachers,${stats.activeTeachers}`,
        `Parents,${stats.parents}`,
        `Pending applications,${stats.pendingEnrollments}`,
        `Sessions today,${stats.todayClasses}`,
        `Open tasks,${stats.pendingTasks}`,
        `Total revenue,${revenue}`,
        `Attendance records,${store.attendance.length}`,
        `Progress notes,${store.reports.length}`,
      ];
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hiraya-report-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
    return (
      <>
        <PageHeader
          title={PAGE_COPY.reports.title}
          description="The same operational counts used on the website dashboard."
          actions={
            <Button type="button" onClick={exportCsv}>
              Export CSV
            </Button>
          }
        />
        <section className="stat-row">
          <article className="stat-card"><div><p>Active students</p><strong>{stats.totalStudents}</strong></div></article>
          <article className="stat-card"><div><p>Pending applications</p><strong>{stats.pendingEnrollments}</strong></div></article>
          <article className="stat-card"><div><p>Sessions today</p><strong>{stats.todayClasses}</strong></div></article>
          <article className="stat-card"><div><p>Open tasks</p><strong>{stats.pendingTasks}</strong></div></article>
          <article className="stat-card"><div><p>Attendance records</p><strong>{store.attendance.length}</strong></div></article>
          <article className="stat-card"><div><p>Progress notes</p><strong>{store.reports.length}</strong></div></article>
          <article className="stat-card"><div><p>Payments</p><strong>{store.payments.length}</strong></div></article>
          <article className="stat-card"><div><p>Audit entries</p><strong>{store.auditLogs.length}</strong></div></article>
        </section>
      </>
    );
  }

  if (view === 'settings') {
    return <SettingsPage store={store} user={user} saveStore={saveStore} onRefresh={onRefresh} onUser={onUser} />;
  }

  return null;
}
