import { randomBytes } from 'crypto';
import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';
import { emptyStore, type EnrollmentApplication, type HirayaDatabase } from '@hiraya/types';
import { enrollPublicSchema } from '@hiraya/validation';
import { ageFromBirthdate, formatEnrollmentNotes } from '@/lib/enrollment';

export const maxMysqlDuration = 30;

function parseMysqlConfig() {
  const raw = process.env.HIRAYA_MYSQL || process.env.DATABASE_URL || '';
  if (!raw.trim()) return null;

  if (/^mysqls?:\/\//i.test(raw)) {
    const url = new URL(raw.replace(/^mysqls:/i, 'mysql:'));
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.replace(/^\//, '').split('/')[0] || 'defaultdb'),
      ssl: { rejectUnauthorized: false },
      connectTimeout: 15000,
    } satisfies mysql.ConnectionOptions;
  }

  const parts = Object.fromEntries(
    raw.split(';').map((piece) => {
      const idx = piece.indexOf('=');
      if (idx < 0) return [piece.trim().toLowerCase(), ''];
      return [piece.slice(0, idx).trim().toLowerCase(), piece.slice(idx + 1).trim()];
    }),
  );

    const host = parts.server || parts.host || parts['data source'];
  if (!host) return null;
  return {
    host,
    port: Number(parts.port || 3306),
    user: parts.user || parts.uid || 'root',
    password: parts.password || parts.pwd || '',
    database: parts.database || parts['initial catalog'] || 'hiraya_learning_center',
    ssl: host.includes('aivencloud.com') ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 15000,
  } satisfies mysql.ConnectionOptions;
}

export function mysqlConfigured() {
  return Boolean(parseMysqlConfig());
}

export async function withMysql<T>(run: (conn: Connection) => Promise<T>): Promise<T> {
  const config = parseMysqlConfig();
  if (!config) throw new Error('Cloud database is not configured.');
  const conn = await mysql.createConnection(config);
  try {
    await conn.execute(`CREATE TABLE IF NOT EXISTS enrollment_applications (
      ApplicationId varchar(191) NOT NULL,
      StudentFullname varchar(191) NOT NULL,
      StudentBirthdate varchar(191) NOT NULL,
      StudentAge int NOT NULL,
      StudentGender varchar(191) NOT NULL,
      ParentFullname varchar(191) NOT NULL,
      ParentEmail varchar(191) NOT NULL,
      ParentPhone varchar(191) NOT NULL,
      PreferredProgram varchar(191) NOT NULL,
      SubmittedAt varchar(191) NOT NULL,
      Status varchar(191) NOT NULL,
      StudentNumber varchar(191) NULL,
      Notes text NOT NULL,
      PRIMARY KEY (ApplicationId)
    )`);
    return await run(conn);
  } finally {
    await conn.end();
  }
}

function applicationId() {
  return `app_${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}_${randomBytes(3).toString('hex')}`;
}

function mapApplication(row: RowDataPacket): EnrollmentApplication {
  return {
    applicationId: String(row.ApplicationId || row.applicationId || ''),
    studentFullname: String(row.StudentFullname || row.studentFullname || ''),
    studentBirthdate: String(row.StudentBirthdate || row.studentBirthdate || ''),
    studentAge: Number(row.StudentAge || row.studentAge || 0),
    studentGender: String(row.StudentGender || row.studentGender || ''),
    parentFullname: String(row.ParentFullname || row.parentFullname || ''),
    parentEmail: String(row.ParentEmail || row.parentEmail || ''),
    parentPhone: String(row.ParentPhone || row.parentPhone || ''),
    preferredProgram: String(row.PreferredProgram || row.preferredProgram || ''),
    submittedAt: String(row.SubmittedAt || row.submittedAt || ''),
    status: String(row.Status || row.status || 'pending_review'),
    studentNumber: (row.StudentNumber || row.studentNumber || null) as string | null,
    notes: String(row.Notes || row.notes || ''),
  };
}

export async function loadPublicSite() {
  return withMysql(async (conn) => {
    const [programRows] = await conn.query<RowDataPacket[]>(
      'SELECT ProgramId, Name, Description FROM programs WHERE Status = ? ORDER BY Name',
      ['active'],
    ).catch(() => [[]] as [RowDataPacket[]]);
    const [settingRows] = await conn.query<RowDataPacket[]>('SELECT * FROM system_settings LIMIT 1').catch(
      () => [[]] as [RowDataPacket[]],
    );
    const settings = settingRows[0] || {};
    const description =
      String(settings.Description || '').trim() ||
      'Hiraya Learning Center supports early learning, guided play, and family partnership in a safe, welcoming environment.';
    return {
      centerName: String(settings.CenterName || 'HIRAYA Learning Center'),
      description,
      aboutTitle: String(settings.AboutTitle || 'About HIRAYA'),
      welcomeTitle: String(settings.WelcomeTitle || 'Welcome to HIRAYA Learning Center'),
      welcomeMessage: String(settings.WelcomeMessage || description),
      mission: String(settings.Mission || ''),
      vision: String(settings.Vision || ''),
      values: String(settings.Values || ''),
      address: String(settings.Address || ''),
      phone: String(settings.Phone || ''),
      email: String(settings.Email || ''),
      website: String(settings.Website || ''),
      businessHours: String(settings.BusinessHours || 'Monday–Friday, 8:00–17:00'),
      hasLogo: Boolean(String(settings.LogoPath || '').trim()),
      contentUpdatedAt: String(settings.UpdatedAt || ''),
      programs: programRows.map((row) => ({
        programId: String(row.ProgramId),
        name: String(row.Name),
        description: String(row.Description || 'Ask the center for details about this program.'),
      })),
      announcements: [],
      gallery: [],
    };
  });
}

export async function submitEnrollment(body: unknown) {
  const parsed = enrollPublicSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || 'Please complete the enrollment form.');
  }
  const input = parsed.data;
  const digits = (input.parentPhone.match(/\d/g) || []).length;
  if (digits < 7) throw new Error('Please enter a valid contact number.');

  const id = applicationId();
  const age = Number(input.studentAge || ageFromBirthdate(input.studentBirthdate) || 0);
  const notes = formatEnrollmentNotes({ ...input, studentAge: age });
  const submittedAt = new Date().toISOString();

  await withMysql(async (conn) => {
    const [dupes] = await conn.query<RowDataPacket[]>(
      `SELECT ApplicationId FROM enrollment_applications
       WHERE Status = 'pending_review' AND LOWER(ParentEmail) = LOWER(?) AND LOWER(StudentFullname) = LOWER(?)
       LIMIT 1`,
      [input.parentEmail.trim(), input.studentFullname.trim()],
    );
    if (dupes.length) throw new Error('An application for this child is already waiting for review.');

    const values = [
      id,
      input.studentFullname.trim(),
      input.studentBirthdate,
      age,
      input.studentGender,
      input.parentFullname.trim(),
      input.parentEmail.trim(),
      input.parentPhone.trim(),
      input.preferredProgram.trim(),
      submittedAt,
      'pending_review',
      notes,
    ];

    try {
      await conn.execute(
        `INSERT INTO enrollment_applications
          (ApplicationId, StudentFullname, StudentBirthdate, StudentAge, StudentGender, ParentFullname, ParentEmail, ParentPhone, PreferredProgram, SubmittedAt, Status, Notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (!/Unknown column 'Notes'/i.test(message)) throw err;
      await conn.execute(
        `INSERT INTO enrollment_applications
          (ApplicationId, StudentFullname, StudentBirthdate, StudentAge, StudentGender, ParentFullname, ParentEmail, ParentPhone, PreferredProgram, SubmittedAt, Status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values.slice(0, -1),
      );
    }
  });

  return { submitted: true, applicationId: id };
}

export async function loadStore(): Promise<HirayaDatabase> {
  return withMysql(async (conn) => {
    const store = emptyStore();
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT * FROM enrollment_applications ORDER BY SubmittedAt DESC',
    );
    const [programRows] = await conn
      .query<RowDataPacket[]>('SELECT ProgramId, Name, Description, Status FROM programs')
      .catch(() => [[]] as [RowDataPacket[]]);
    store.enrollmentApplications = rows.map(mapApplication);
    store.programs = programRows.map((row) => ({
      programId: String(row.ProgramId),
      name: String(row.Name),
      description: String(row.Description || ''),
      status: String(row.Status || 'active'),
    }));
    return store;
  });
}

export async function saveEnrollmentStatuses(incoming: HirayaDatabase) {
  await withMysql(async (conn) => {
    for (const row of incoming.enrollmentApplications || []) {
      if (!row.applicationId || !row.status) continue;
      await conn.execute('UPDATE enrollment_applications SET Status = ? WHERE ApplicationId = ?', [
        row.status,
        row.applicationId,
      ]);
    }
  });
  return loadStore();
}
