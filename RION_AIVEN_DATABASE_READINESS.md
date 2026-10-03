# RION Aiven Database Readiness Report

Updated 1 October 2026. Hosting is GitHub and Vercel. The cloud database is the existing Aiven MySQL service. DigitalOcean and Render are not part of this project. Everyday development stays on local XAMPP (`hiraya_learning_center`) through Hiraya.Api. On Vercel, the website server uses `HIRAYA_MYSQL` to open Aiven for the health check, public catalog, enrollment, and teacher applications. That value is not committed and is not a `NEXT_PUBLIC_` variable.

The product in this repository is the Hiraya / RION learning-center system: a Next.js public site and admin dashboard, an Electron desktop app, an Expo mobile app, and an ASP.NET Core API.

## 1. Current Database

Database: MySQL 8 (Pomelo targets server version 8.0.21). A SQL Server provider also exists in code and is not the active local path.

ORM: Entity Framework Core 9 (`HirayaLearningCenterDbContext`).

Driver: Pomelo.EntityFrameworkCore.MySql 9.0.0 on the API. The website MySQL client was removed. Website, desktop, and mobile do not open MySQL.

Schema: `backend/Hiraya.Data/HirayaLearningCenterDbContext.cs`, plus startup SQL in `backend/Hiraya.Data/DatabaseInitializer.cs`.

Migration System: EF Core migrations in `backend/Hiraya.Data/Migrations`. The API calls `Database.MigrateAsync()` on every MySQL startup. If that fails in Production, the process stops. `EnsureCreatedAsync()` is not used as a Production fallback. Local Development still falls back to `EnsureCreatedAsync()`.

Seed System: `backend/Hiraya.Shared/Services/SeedData.cs`, applied by `DatabaseInitializer` only when `users` is empty. Production now skips that seed.

Connection Method: `HirayaDb.ResolveConnection` reads `HIRAYA_MYSQL`, then `DATABASE_URL`, then `ConnectionStrings:Hiraya`. Local committed settings point at `127.0.0.1:3306`, database `hiraya_learning_center`, user `root`, empty password. Non-local hosts get `SslMode=Required`. If `HIRAYA_MYSQL_CA` is set, the mode becomes `VerifyCA`.

## 2. Current ORM / Database Driver

- API: EF Core `IDbContextFactory`, Pomelo MySQL, execution-strategy retry (5 attempts, 10 seconds). Non-local hosts use `SslMode=Required`. `HIRAYA_MYSQL_CA` switches that to `VerifyCA`.
- Website, desktop, and mobile: no database driver. The website proxies to Hiraya.Api.

## 3. Current Database Architecture

Shape:

Website, Electron, and mobile call `Hiraya.Api` (`http://127.0.0.1:5188` locally). The API owns MySQL. Local work uses XAMPP. The cloud database is Aiven MySQL, reached with `HIRAYA_MYSQL` and `HIRAYA_MYSQL_CA` on the API process only.

There is no second writer. `apps/web/lib/server/mysql.ts` is gone. The website does not read `HIRAYA_MYSQL` or `DATABASE_URL`. DigitalOcean and Render are not a database path. `.do/app.yaml` and `render.yaml` are unused and must not be followed.

The API’s main write model is a full-store snapshot: `GET /api/store` and `PUT /api/store`. `EfHirayaRepository.SaveUnlockedAsync` replaces table contents inside one transaction. Specialized routes (staff, parents, enrollment actions, modules, payments, feedback, photos) also write through the API.

## 4. Database Schema

Tables mapped by the EF context (primary key in parentheses):

| Table | Primary key |
| --- | --- |
| users | UserId |
| roles | RoleId |
| role_permissions | PermissionId |
| teachers | ProfileId |
| students | StudentId |
| programs | ProgramId |
| classes | ClassId |
| rooms | RoomId |
| enrollments | EnrollmentId |
| enrollment_applications | ApplicationId |
| attendance | AttendanceId |
| progress_records | ReportId |
| schedules | ScheduleId |
| teacher_work_shifts | ShiftId |
| teacher_role_options | RoleId |
| announcements | NewsId |
| leave_requests | LeaveId |
| payments | PaymentId |
| notifications | AlertId |
| audit_logs | AuditId |
| system_settings | SettingsId |
| learning_modules | ModuleId |
| learning_module_versions | VersionId |
| parent_students | ParentStudentId |
| account_invitations | InvitationId |
| student_ops | StudentId |
| center_holidays | HolidayId |
| teacher_duties | DutyId |
| website_gallery | ItemId |
| staff_tasks | TaskId |
| session_packages | PackageId |
| session_history | HistoryId |
| teacher_comments | CommentId |
| teacher_notes | NoteId |
| student_documents | DocumentId |
| chat_groups | GroupId |

String columns default to max length 191. Money columns on payments and student ops use precision 18,2. Several narrative fields are MySQL `text`.

There are indexes on common lookup columns (email unique, parent-student pair unique, holiday date unique, duty date+teacher unique). There are no EF `HasOne` / `HasForeignKey` / `OnDelete` relationships. Links are string ids, not enforced foreign keys. Deletes do not cascade at the database.

Startup SQL in `DatabaseInitializer` creates workflow tables if missing and adds columns such as payment `ReceivedBy` outside the EF migration history. Schema can drift from the migration files.

## 5. Entity Relationships

These are application relationships. The database does not enforce them.

```
Parent (users.role = parent)
  └── parent_students (ParentId, StudentId) unique pair
        └── students
              ├── enrollments (StudentId, ClassId, TeacherId)
              ├── enrollment_applications (pre-enrollment, not a student row yet)
              ├── attendance (StudentId or EmployeeId)
              ├── progress_records (StudentId, TeacherId)
              ├── payments (StudentId, EnrollmentId)
              ├── schedules (StudentId, ClassId, TeacherId)
              ├── session_packages (StudentId)
              │     └── session_history (PackageId, StudentId)
              ├── student_ops (StudentId)
              └── student_documents (StudentId)

Teacher (users.role = teacher)
  ├── teachers (UserId)
  ├── classes (TeacherId, ProgramId)
  ├── schedules / staff_tasks / teacher_work_shifts / teacher_duties
  ├── attendance (EmployeeId)
  └── teacher_comments / teacher_notes

Program (programs)
  └── classes
        └── enrollments
        └── learning_modules (ProgramId; ClassIds stored as JSON)

Center
  ├── system_settings (single settings row)
  ├── announcements, notifications, audit_logs
  ├── center_holidays, rooms, website_gallery
  └── chat_groups (MemberIds stored as text)
```

Missing database relationships: no foreign keys, so orphan student, class, teacher, and parent ids are possible. `students.ParentId` and `parent_students` both represent the family link. Teacher ids on schedules can be packed multi-value strings rather than one foreign key. Chat members and module class lists are JSON/text, not join tables.

## 6. API Database Access

Framework: ASP.NET Core minimal APIs, .NET 10, project `backend/Hiraya.Api`.

All persistent reads and writes found in the API go through `IHirayaRepository` / EF Core / `DatabaseInitializer`. Public routes that do not require a session: `/api/health`, `/api/hub`, `/api/public/site`, `/api/public/enrollment`, `/api/public/logo`, `/api/public/gallery/{id}/image`, `/api/auth/login`, `/api/auth/activate`, and `GET /api/media/profile/{userId}` (profile image bytes, no session).

Authenticated writes include `PUT /api/store` (any signed-in user, then `StoreSanitizer.MergeStoreWrite`), staff, parent admin, modules, website CMS, enrollment approve/reject/cancel, feedback (parents only), and profile photo upload.

Desktop and mobile call Hiraya.Api only. The Vercel website server may open Aiven through `apps/web/lib/server/aiven.ts` when no API address is configured. `HIRAYA_MYSQL` belongs in the Vercel server environment, not in GitHub and not in `NEXT_PUBLIC_`, `VITE_`, or `EXPO_PUBLIC_` variables.

## 7. Frontend Database Access

No database password, host, or connection string was found in Electron or Expo source.

Committed examples:

- `.env.example` — API URL plus commented server-only `HIRAYA_MYSQL` placeholder
- `apps/web/.env.example` — public API URL only, with a warning not to put database credentials in `NEXT_PUBLIC_`
- `apps/desktop/.env.example` — `VITE_API_URL` only
- `apps/mobile/.env.example` — optional `EXPO_PUBLIC_API_URL` only

`.gitignore` ignores `.env`, `.env.local`, `appsettings.Local.json`, and `**/aiven-ca.pem`. No filled `.env` file was present in the workspace scan. `appsettings.json`, `appsettings.Development.json`, and `appsettings.Production.json` contain the local empty-password connection, not an Aiven secret.

## 8. Authentication Database Access

Accounts live in `users`. `PasswordHash` is PBKDF2-SHA256 (`pbkdf2$iterations$salt$key`, 100,000 iterations) via `PasswordHasher`.

Sessions are custom tokens in the `X-Hiraya-Session` header (`SessionTokens`), checked in `ParentPortalApi.ActorAsync` against the user id, password stamp, and an in-memory revocation gate. There is no refresh-token table. The gate is process memory, so a restart forgets revocations.

`PasswordHasher.Verify` still accepts a stored value that is not hashed by comparing it as plaintext. New passwords are hashed. Legacy rows could still match a raw password.

Non-production uses `SessionTokens.DevelopmentSecret` when `HIRAYA_SESSION_SECRET` is empty. Production startup already refuses that default.

Sign-in roles: Super Admin, teacher, and parent (`ProductAccounts.MaySignIn`). Student and staff roles are deactivated by the startup normalizer.

## 9. Authorization

Backend checks exist for parent child routes (`FamilyAccess`), staff routes, module routes, website admin routes, enrollment actions, feedback (parent only), and store writes (`StoreSanitizer.MergeStoreWrite`).

Gaps to review before production, not changed in this pass:

- `GET /api/media/profile/{userId}` returns the image with no session.
- `PUT /api/store` allows any authenticated role to submit a full snapshot; safety depends entirely on `StoreSanitizer`.
- Parent/teacher visibility must stay in that sanitizer. Hiding buttons in the desktop or mobile UI is not sufficient.
- The old Next.js direct MySQL enrollment insert is gone. Public enrollment goes through Hiraya.Api.

## 10. Environment Configuration

Local development: `appsettings.Development.json` connection string, API on port 5188, empty root password.

Production: `ASPNETCORE_ENVIRONMENT=Production` now requires `HIRAYA_MYSQL`, `DATABASE_URL`, or `HIRAYA_SQLSERVER`. It also requires `HIRAYA_SESSION_SECRET`. Development seed is not inserted into an empty production database.

Aiven-shaped variable (placeholder only, not a real credential):

```
HIRAYA_MYSQL=mysql://USER:PASSWORD@HOST:PORT/defaultdb?ssl-mode=REQUIRED
HIRAYA_MYSQL_CA=backend/Hiraya.Api/aiven-ca.pem
HIRAYA_SESSION_SECRET=generate-a-long-random-string-for-production
HIRAYA_DB_PROVIDER=mysql
```

`HirayaDb.NormalizeMysqlConnection` converts `mysql://` URLs to a Pomelo string and adds SSL for non-local hosts.

## 11. Migration System

Stored in `backend/Hiraya.Data/Migrations` and version controlled:

- `20260904105230_InitialCreate`
- `20260904151746_LearningModules`
- `20260905043000_ParentFamilyAuthorization`
- `20260905120000_CenterOperations`
- `20260906140000_WebsiteCms`
- `20260906180000_WebsiteLanding`
- `20260912120000_EnrollmentApplicationNotes`
- `20260915123000_WorkflowOperations`

Applied by API startup, not by a separate release command. Pointing the everyday local API at Aiven would migrate that database on boot, so the port 5188 process stays on XAMPP. Production does not hide a failed migration behind `EnsureCreated`. Extra `CREATE TABLE` / `TryAddColumn` SQL is not fully represented as EF migrations. Do not drop, reset, or hand-edit either database.

## 12. Seed System

`SeedData.Create()` inserts demo Super Admin, teacher, and parent users, programs, classes, students, enrollments, and related rows when `users` is empty and the environment is not Production.

Passwords are hashed, but the source contains known development passwords (`Admin123`, `Teacher123`, `Parent123`). `SeedData.TryCanonicalSeedPassword` accepts case variants. The desktop login screen tells the operator the demo password. `CenterOperationsCatalog` also hashes `Teacher123` for catalog staff.

Risk: high if an empty production database is started by an older API build that still seeds. Current source skips that seed in Production. Risk remains for local/demo use and for any deployment that is not `Production`.

Do not copy those passwords into Aiven. Create the first production administrator deliberately.

## 13. Security Findings

| Item | File | Type | Risk |
| --- | --- | --- | --- |
| Local MySQL user `root` with an empty password in committed settings | `backend/Hiraya.Api/appsettings.json`, `appsettings.Development.json`, `appsettings.Production.json` | Local connection default | High if that file is what Production used to use. Production now refuses to start unless a connection env var is set. |
| Development session secret constant | `backend/Hiraya.Shared/Security/SessionTokens.cs` | Static development secret | High in Production. Production startup already rejects it. |
| Known demo account passwords in source | `SeedData.cs`, `CenterOperationsCatalog.cs`, desktop login hint | Hardcoded development passwords | High if seeded into a shared database. |
| Plaintext password compare for unhashed rows | `PasswordHasher.Verify` | Legacy verifier | Medium |
| Website opens Aiven only on Vercel | `apps/web/lib/server/aiven.ts` | Server database credential | The URI stays in the Vercel server environment. It is not committed and not sent to the browser. |
| Website certificate skip removed with that client | same file | Weak TLS | Closed. API uses `SslMode=Required`, and `VerifyCA` when `HIRAYA_MYSQL_CA` is set. |
| Profile images are public by user id | `ProfilePhotoApi` GET | Unauthenticated media | Medium |
| `ExecuteSqlRawAsync` with interpolation | `DatabaseInitializer.cs` | EF1002 warning | Review before production; do not treat as safe dynamic SQL |
| In-memory session revocation | `SessionGate` | Lost on restart, not shared across API instances | Medium when more than one API process runs |
| No filled `.env` or Aiven CA file was found in the scan | — | — | No live secret was copied into this report |

No production Aiven password, token, or connection string was read into this document.

## 14. Data Integrity Findings

- No foreign keys, so orphan ids are possible.
- Session remaining count is clamped at zero in `packages/utils/src/sessionPackage.ts` (`remaining = max(0, total - used)`, used cannot exceed total). That rule is application code, not a database check.
- `PUT /api/store` replaces whole tables in one transaction. A partial or stale client snapshot can overwrite rows written by another client. That is the main integrity risk on a shared Aiven database.
- Family link is duplicated (`students.ParentId` and `parent_students`).
- Public enrollment is inserted by Hiraya.Api only.
- Startup `NormalizeProductAccounts` deactivates extra Super Admin, staff, and student login roles. It does not reset passwords.

## 15. Connection Management

API: one configuration-time connection string, a context factory per operation, Pomelo retry, and default connector pooling (pooling is on unless the connection string disables it). The store save holds one transaction across every table replace.

The website no longer opens its own MySQL connection.

API database errors are logged. Clients receive “The learning center database is not available…” or “Something went wrong. Please try again.” Raw driver text is not returned by the global handler. Some `InvalidOperationException` messages are returned as 400 text; those should stay free of connection details.

## 16. Local Database Test Results

Tested against the already running local API. No rows were created, updated, or deleted.

| Check | Result |
| --- | --- |
| API process responds | Yes, `GET /api/health` HTTP 200 |
| Database connects | Yes, body `status: ok`, database name `hiraya_learning_center` |
| Unauthenticated store read | `GET /api/store` HTTP 401 |
| Login with an empty body | `POST /api/auth/login` HTTP 401 |
| Enrollment, student, teacher, parent, schedule, attendance, progress, payment, notification CRUD | Not re-executed in this pass. Existing local data was left unchanged. |
| Aiven | Not contacted |

The production connection guard and production seed skip compile (`dotnet build` of `Hiraya.Api` succeeded). The currently running API process was not restarted, so those two guards are in source only until the next local API start.

## 17. Aiven Compatibility

Compatible. Aiven MySQL is the cloud database for this project. The engine is already MySQL 8 via Pomelo. No engine migration is required. DigitalOcean and Render are not the database and are not a setup step.

What the Aiven connection needs, on the API process only:

- `HIRAYA_MYSQL` as the Aiven MySQL service URI or ADO.NET string
- `HIRAYA_MYSQL_CA` pointing at Aiven’s CA file so the connection uses `SslMode=VerifyCA`
- `HIRAYA_SESSION_SECRET`
- `ASPNETCORE_ENVIRONMENT=Production` so demo seed and the local empty password cannot be used
- Migrations applied once, on a separate Production process, not by pointing the everyday port 5188 API at Aiven

On Vercel, set `HIRAYA_MYSQL` as a server environment variable so the hosted website can reach Aiven. Do not commit it, and do not expose it to the browser, Electron, or Expo.

PostgreSQL was not selected. Do not switch Aiven to PostgreSQL.

## 18. Changes Required Before Aiven

Already done in source:

1. The Next.js direct MySQL client is removed. Only Hiraya.Api opens the database.
2. Website TLS is no longer a second client. The API verifies the server when `HIRAYA_MYSQL_CA` is set.
3. Production does not fall back to `EnsureCreated` when migration fails, and Production does not insert the development seed.

Still required before the first real Aiven write:

1. The owner confirms the existing Aiven MySQL service. This repository does not create it.
2. The owner places the service URI and CA in gitignored files. They are not committed and not copied into this report.
3. One Production migration check runs against Aiven on a separate API process. The local API on port 5188 stays on XAMPP.
4. The first production administrator is created by hand. Demo users are not copied from XAMPP.
5. Take an Aiven backup before the first real write.

Not part of this database setup: hosting an API on DigitalOcean or Render, or importing the local database. The Vercel server variable `HIRAYA_MYSQL` is how the hosted website reaches Aiven.

## 19. Changes That Should NOT Be Made

- Do not create a new Aiven service from this repository. The owner already uses Aiven.
- Do not put a real connection string in git, Vercel, Electron, or Expo.
- Do not point the everyday local API at Aiven.
- Do not run the Aiven migration until the owner has placed the gitignored URI and CA.
- Do not drop, reset, or reseed the local database.
- Do not import the local XAMPP database into Aiven.
- Do not delete demo seed code. Local development still uses it. Production skips it.
- Do not redesign the UI or rewrite tuition and session rules.
- Do not switch MySQL to PostgreSQL.
- Do not follow `.do/app.yaml` or `render.yaml`.

## 20. Deployment Preparation Checklist

See `RION_AIVEN_DEPLOYMENT_CHECKLIST.md`. Items are checked only when a local scan verified them.

### Already in source

- `backend/Hiraya.Api/Program.cs` — Production startup requires `HIRAYA_MYSQL`, `DATABASE_URL`, or `HIRAYA_SQLSERVER`.
- `backend/Hiraya.Data/DatabaseInitializer.cs` — Production does not insert development seed into an empty database, and a failed Production migration is not replaced by `EnsureCreated`.
- `backend/Hiraya.Data/HirayaDb.cs` — an Aiven `mysql://` URI becomes a Pomelo connection with TLS. `HIRAYA_MYSQL_CA` selects `VerifyCA`.
- `.env.example` and `apps/web/.env.example` — placeholders and warnings only. No real credentials.
- `apps/web/lib/server/mysql.ts` — removed. The website proxies to Hiraya.Api.
