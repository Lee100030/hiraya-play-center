import type { ReactNode } from 'react';
import { EmptyState, Loading, PageHeader, StatusBadge, Table, emptyCell } from '@hiraya/ui';
import { displayName, formatDate, studentDisplay } from '@hiraya/utils';
import type { HirayaDatabase } from '@hiraya/types';

function nameOfStudent(store: HirayaDatabase, studentId: string) {
  const row = store.students.find((s) => s.studentId === studentId);
  return row ? studentDisplay(row) : emptyCell(studentId);
}

function ListPage({
  kicker,
  title,
  description,
  loading,
  empty,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  loading: boolean;
  empty: boolean;
  children: ReactNode;
}) {
  if (loading) return <Loading />;
  return (
    <>
      <PageHeader kicker={kicker} title={title} description={description} />
      {empty ? <EmptyState title="No records found." hint="Records appear when the hub has data." /> : children}
    </>
  );
}

export function EnrollmentPage({ store, loading }: { store: HirayaDatabase; loading: boolean }) {
  return (
    <ListPage kicker="Admissions" title="Enrollment" description="Public applications stored on the hub." loading={loading} empty={!store.enrollmentApplications.length}>
      <Table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Parent</th>
            <th>Program</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {store.enrollmentApplications.map((row) => (
            <tr key={row.applicationId}>
              <td>{emptyCell(row.studentFullname)}</td>
              <td>{emptyCell(row.parentFullname)}</td>
              <td>{emptyCell(row.preferredProgram)}</td>
              <td>
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </ListPage>
  );
}

export function AttendancePage({ store, loading }: { store: HirayaDatabase; loading: boolean }) {
  return (
    <ListPage kicker="Operations" title="Attendance" description="Daily presence from the hub." loading={loading} empty={!store.attendance.length}>
      <Table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Student</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {store.attendance.slice(0, 80).map((row) => (
            <tr key={row.attendanceId}>
              <td>{formatDate(row.attendanceDate)}</td>
              <td>{nameOfStudent(store, row.studentId)}</td>
              <td>
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </ListPage>
  );
}

export function PaymentsPage({ store, loading }: { store: HirayaDatabase; loading: boolean }) {
  return (
    <ListPage kicker="Operations" title="Payments" description="Balances and receipts from the hub." loading={loading} empty={!store.payments.length}>
      <Table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {store.payments.map((row) => (
            <tr key={row.paymentId}>
              <td>{nameOfStudent(store, row.studentId)}</td>
              <td>{row.amount}</td>
              <td>
                <StatusBadge status={row.paymentStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </ListPage>
  );
}

export function ProgramsPage({ store, loading }: { store: HirayaDatabase; loading: boolean }) {
  return (
    <ListPage kicker="Learning" title="Programs" description="Play and academic layers." loading={loading} empty={!store.programs.length}>
      <Table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {store.programs.map((row) => (
            <tr key={row.programId}>
              <td>{row.name}</td>
              <td>{emptyCell(row.description)}</td>
              <td>
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </ListPage>
  );
}

export function ClassesPage({ store, loading }: { store: HirayaDatabase; loading: boolean }) {
  return (
    <ListPage kicker="Learning" title="Classes" description="Rooms and assigned teachers." loading={loading} empty={!store.classes.length}>
      <Table>
        <thead>
          <tr>
            <th>Class</th>
            <th>Teacher</th>
            <th>Room</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {store.classes.map((row) => (
            <tr key={row.classId}>
              <td>{row.name}</td>
              <td>{emptyCell(displayName(store.users.find((u) => u.userId === row.teacherId)))}</td>
              <td>{emptyCell(row.room)}</td>
              <td>
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </ListPage>
  );
}

export function SchedulesPage({ store, loading }: { store: HirayaDatabase; loading: boolean }) {
  return (
    <ListPage kicker="Operations" title="Schedules" description="Class times from the hub." loading={loading} empty={!store.schedules.length}>
      <Table>
        <thead>
          <tr>
            <th>Title</th>
            <th>When</th>
            <th>Teacher</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {store.schedules.map((row) => (
            <tr key={row.scheduleId}>
              <td>{emptyCell(row.title)}</td>
              <td>{formatDate(row.startAt)}</td>
              <td>{emptyCell(displayName(store.users.find((u) => u.userId === row.teacherId)))}</td>
              <td>
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </ListPage>
  );
}

export function CalendarPage({ store, loading }: { store: HirayaDatabase; loading: boolean }) {
  return (
    <ListPage kicker="Operations" title="Calendar" description="Duties and holidays." loading={loading} empty={!store.teacherDuties.length && !store.centerHolidays.length}>
      <Table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Kind</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {store.centerHolidays.map((row) => (
            <tr key={row.holidayId}>
              <td>{row.date}</td>
              <td>Holiday</td>
              <td>{emptyCell(row.title)}</td>
            </tr>
          ))}
          {store.teacherDuties.map((row) => (
            <tr key={row.dutyId}>
              <td>{row.workDate}</td>
              <td>Duty</td>
              <td>{emptyCell(displayName(store.users.find((u) => u.userId === row.teacherId)))}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </ListPage>
  );
}

export function ProgressPage({ store, loading }: { store: HirayaDatabase; loading: boolean }) {
  return (
    <ListPage kicker="Operations" title="Progress" description="Published reports from the hub." loading={loading} empty={!store.reports.length}>
      <Table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Period</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {store.reports.map((row) => (
            <tr key={row.reportId}>
              <td>{nameOfStudent(store, row.studentId)}</td>
              <td>{emptyCell(row.period)}</td>
              <td>
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </ListPage>
  );
}

export function NotificationsPage({ store, loading }: { store: HirayaDatabase; loading: boolean }) {
  return (
    <ListPage kicker="Communications" title="Notifications" description="Hub alerts. No auto-popup on launch." loading={loading} empty={!store.alerts.length}>
      <Table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Message</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {store.alerts.map((row) => (
            <tr key={row.alertId}>
              <td>{emptyCell(row.title)}</td>
              <td>{emptyCell(row.message)}</td>
              <td>{formatDate(row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </ListPage>
  );
}

export function AnnouncementsPage({ store, loading }: { store: HirayaDatabase; loading: boolean }) {
  return (
    <ListPage kicker="Communications" title="Announcements" description="Center news." loading={loading} empty={!store.news.length}>
      <Table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {store.news.map((row) => (
            <tr key={row.newsId}>
              <td>{row.title}</td>
              <td>
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </ListPage>
  );
}

export function ModulesPage({ store, loading }: { store: HirayaDatabase; loading: boolean }) {
  return (
    <ListPage kicker="Communications" title="Learning modules" description="Files stored on the hub." loading={loading} empty={!store.learningModules.length}>
      <Table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {store.learningModules.map((row) => (
            <tr key={row.moduleId}>
              <td>{row.title}</td>
              <td>
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </ListPage>
  );
}

export function ReportsPage({ store, loading }: { store: HirayaDatabase; loading: boolean }) {
  if (loading) return <Loading />;
  return (
    <>
      <PageHeader kicker="System" title="Reports" description="Live snapshot — not hardcoded." />
      <p>Attendance {store.attendance.length} · Progress {store.reports.length} · Audit {store.auditLogs.length}</p>
    </>
  );
}

export function SettingsPage({ store, loading }: { store: HirayaDatabase; loading: boolean }) {
  if (loading) return <Loading />;
  const s = store.settings;
  return (
    <>
      <PageHeader kicker="System" title="Settings" description="Center profile from the hub." />
      <p>{emptyCell(s?.centerName)}</p>
      <p>{emptyCell(s?.address)}</p>
      <p>{emptyCell(s?.phone)}</p>
      <p>{emptyCell(s?.email)}</p>
    </>
  );
}
