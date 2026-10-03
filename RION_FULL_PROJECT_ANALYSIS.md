# RION Full Project Analysis

**Product name in this repository:** HIRAYA Learning Center (folder `Hiraya play Center React`). The name **RION** does not appear in source. This audit treats RION as the user’s name for this HIRAYA system.

**Mode:** Analyze only. No code, database, hosting, or Git mutations except this report file.

**Scan date:** 21 September 2026  
**HEAD:** `3747bcc` on `main`  
**Evidence standard:** File paths and live local probes. Uncertainties are marked.

---

## 1. Executive Summary

This is a **pnpm + Turbo monorepo** of React clients talking to a copied **ASP.NET Core Minimal API** (`Hiraya.Api`) over **EF Core → MySQL** (`hiraya_learning_center`). There is **no Express/Next-as-primary-backend**. Next.js `/api/*` is a **proxy** (plus a **Vercel MySQL fallback** for public enrollment and public site).

**Intended shape is partially true locally:** public website, admin web, Electron, and Expo all *aim* at one API and one MySQL database. **It is not fully true in production:** Vercel can insert enrollment rows **directly** with `mysql2` when Hiraya.Api is unreachable. Admin CRUD still requires Hiraya.Api.

**Roles in practice (locked product rule in source):** one **Super Administrator**, **Teacher**, **Parent**. `admin` / `staff` / `student` logins are deactivated on API initialize. Frontend `isAdmin` means Super Admin only.

**Local probe (this machine, 21 Sep 2026):**

| Probe | Result |
| --- | --- |
| `GET http://127.0.0.1:5188/api/health` | `status=ok`, `database=hiraya_learning_center` |
| `GET http://127.0.0.1:3000/api/health` | Same payload (Next proxy works) |
| `GET http://127.0.0.1:3000/` | HTTP 200 |
| `GET http://127.0.0.1:3000/api/public/site` | Live CMS-ish payload; **10 programs**; center name HIRAYA |
| `POST /api/auth/login` as `admin` | HTTP 200, `role=super_admin`, token issued (value not recorded) |
| `GET http://127.0.0.1:5188/api` and `/api/hub` | **HTTP 404** — running API process does **not** match current `Program.cs` hub maps |
| `GET http://127.0.0.1:5173` | HTTP 200 (Vite desktop renderer) |
| Expo Metro | Not probed |

**Highest-priority issues:** seed-password backdoor that can rewrite hashes; HMAC session in `localStorage`; Vercel direct-DB path; `/app` parallel shell with no Next middleware; git **stash** holding a large unpublished desktop/admin UI delta; running API missing `/api/hub`.

---

## 2. Current Technology Stack

Verified from `package.json`, `.csproj`, and source (not assumed):

| Layer | Technology | Evidence |
| --- | --- | --- |
| Monorepo | pnpm 9.15.4, Turbo 2.3.3, TypeScript 5.7 | Root `package.json` |
| Public + admin web | **Next.js 15.1.6**, React 19.0.0 | `apps/web/package.json` |
| Desktop | **Electron 34**, **Vite 6**, React 19 | `apps/desktop/package.json`, `electron/main.cjs` |
| Mobile | **Expo ~57**, **expo-router**, React Native 0.86.3, React 19.2.3 | `apps/mobile/package.json` |
| Backend | **ASP.NET Core** (`net10.0`), Minimal APIs | `backend/Hiraya.Api/Hiraya.Api.csproj`, `Program.cs` |
| ORM | **EF Core 9** + Pomelo **MySQL**; optional SQL Server | `HirayaDb.cs`, migrations |
| Database | **MySQL 8** database name `hiraya_learning_center` | `appsettings.json`, health payload |
| Auth | Custom **HMAC session** (`X-Hiraya-Session`), **not JWT** | `SessionTokens.cs` |
| Passwords | PBKDF2 via `PasswordHasher` | `PortalAuthService.cs` |
| HTTP client (TS) | `@hiraya/api` fetch wrapper | `packages/api/src/index.ts` |
| Validation | Zod 3 | `packages/validation` |
| UI primitives | Custom CSS (not Tailwind). `@hiraya/ui` + `desktop.css` + `globals.css` | tokens in `packages/ui/src/tokens.css` |
| Public visuals | `ogl` (WebGL), custom CSS | `apps/web/package.json`, `AntigravityField.tsx` |
| Hosting docs | Vercel (website), optional DigitalOcean Dockerfile | `vercel.json`, `.do/app.yaml` |
| Firebase | **Namespace leftover**; `EfHirayaRepository.UsingFirebase => false` | `Hiraya.Shared/Services/Firebase/HirayaRepository.cs` |
| MongoDB / Express | **Not present** as runtime | — |
| Original MAUI | **Outside this repo** (`C:\Users\LEE\source\repos\Hiraya` per README) | `README.md`, `backend/README.md` |

---

## 3. Project Structure

```
Hiraya play Center React
├── apps/web          Next.js public site + /admin + /app + /portal + /api proxy
├── apps/desktop      Electron main/preload + Vite React renderer
├── apps/mobile       Expo Router app
├── backend/
│   ├── Hiraya.Api    HTTP surface
│   ├── Hiraya.Data   EF context, migrations, EfHirayaRepository
│   └── Hiraya.Shared Models, services, security, seed
├── packages/
│   ├── api, config, types, utils, validation, ui, shared
├── docs/             Architecture, migration, defense PDF, archify images
├── scripts/          defense-seed.mjs (writes demo data if run — not run this scan)
├── tmp-capstone/     Contains node_modules only (purpose unclear)
├── HIRAYA_*.md       Prior audits (some outdated vs current source)
├── .env.example      Documented env keys
├── .env.local        gitignored; Vercel OIDC token present locally
└── vercel.json       Root Vercel build copies apps/web/.next
```

**Tests:** `packages/utils/session-remaining.test.mjs`, `packages/utils/workflow-roundtrip.test.mjs` only. App/API have no automated suite.

**Lint scripts** in apps: `echo ok` (placeholder).

---

## 4. Architecture Diagram

**As implemented (local, when Hiraya.Api is up):**

```text
Public visitors                 Super Admin                    Teacher / Parent
     │                               │                               │
apps/web (Next :3000)         /admin + Electron              Expo + /app + /portal
     │  same-origin /api/*           │  :5188 or Vite proxy          │  LAN :5188
     ▼                               ▼                               ▼
          Next proxy (apps/web/lib/server/backend.ts)
                              │
                    Hiraya.Api  :5188
                              │
              MySQL  hiraya_learning_center  (EF Core, no FK constraints)
```

**Vercel split path (when API URL is empty):**

```text
Public enrollment / public site
        │
        ▼
Next route handlers
        │
        ├── proxyToHirayaApi  (if HIRAYA_API_INTERNAL / NEXT_PUBLIC_API_URL set)
        └── mysql2  apps/web/lib/server/mysql.ts  (HIRAYA_MYSQL / DATABASE_URL)
                    INSERT enrollment_applications only
                    (approve/CRUD still need Hiraya.Api)
```

**Does not match the “single hub” diagram:** Next `mysql.ts` is **direct database access from the website process**. Desktop and mobile never use that path.

---

## 5. Website Analysis

**Location:** `apps/web`  
**Entry:** `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`  
**Framework:** Next.js App Router  
**API:** Browser → same-origin `/api/*` (`apps/web/lib/api.ts` uses empty base URL) → `proxyToHirayaApi`  
**Auth:** `AuthProvider` + `localStorage`/`sessionStorage`  
**Status:** Public site **renders locally** (HTTP 200). CMS data **connected** (`/api/public/site` returned 10 programs).

| Page | File | Status |
| --- | --- | --- |
| Home | `app/page.tsx` → `PublicChrome` | Implemented; Hero/About/Programs/Contact/Enroll |
| About | `app/about/page.tsx` | Implemented |
| Programs | `app/programs/page.tsx`, `programs/[id]` | Implemented |
| Contact | `app/contact/page.tsx` | Implemented |
| Gallery | `app/gallery/page.tsx` | Implemented |
| Enroll | `app/enroll/page.tsx` + modal `components/public/enrollment.tsx` | Implemented |
| Login | `app/login/page.tsx` | Redirects to `/admin` |
| Activate | `app/activate/page.tsx` | Invitation activation UI |
| Admin | `/admin/*` | See §6 |
| Legacy ops | `/app/*` | Duplicate shell — see §17 |
| Portals | `/portal/family`, `/portal/teacher`, `/portal/staff` | Thin pages; teacher portal is KPI cards only |

**Navigation:** `apps/web/lib/nav.ts` `publicNav` = Home, About, Programs, Contact. **No Admin link** in `SiteHeader.tsx`. Enroll CTA is prominent.

**Responsive:** `SiteHeader` has a hamburger. Prior audit (`HIRAYA_CRITICAL_ISSUES_AUDIT.md`) reported About footer overlap on phone; **not re-verified in a browser this scan**.

**Enrollment behavior (source + routes, not a live POST this scan — POST would write DB):**

| Question | Finding |
| --- | --- |
| Saves to database? | **Yes, if** Hiraya.Api succeeds **or** Vercel `HIRAYA_MYSQL` fallback (`submitEnrollment` INSERT). |
| Sends to API? | `api.applyEnrollment` → `POST /api/public/enrollment` (`packages/api`). |
| Appears in Admin? | Admin reads `store.enrollmentApplications` from `GET /api/store`. Fallback MySQL insert **will not** populate admin unless API/store also sees that table. |
| Validation? | Client Zod `enrollPublicSchema`; API `EnrollmentService` + Next fallback phone digit check. |
| Success/error? | Modal sets `ok` + `applicationId`; catch shows API error. |
| Duplicate protection? | Pending apps with same parent email + student name (`DomainServices.cs` / `mysql.ts`). |

**File:** `apps/web/components/public/enrollment.tsx`  
**Function:** `onSubmit`  
**Status:** Wired  
**Related:** `packages/validation/src/index.ts`, `apps/web/app/api/public/enrollment/route.ts`, `EnrollmentService.SubmitPublicApplicationAsync`  
**Problem:** Two persist paths (API vs mysql2) can diverge.  
**Recommendation:** Later, make website enrollment API-only once a hosted Hiraya.Api exists.

**LocalStorage leftovers:** `LOCAL_ENROLLMENTS_KEY` / `LOCAL_STORE_KEY` in `apps/web/lib/enrollment.ts` — written/read helpers exist; public submit uses API, not these keys. **Dead client cache path.**

---

## 6. Admin Dashboard Analysis

**Location:** `apps/web/app/admin/*`  
**Gate:** `apps/web/app/admin/layout.tsx` `AdminGate` — requires signed-in user **and** `isAdmin(role)` (Super Admin). Teachers/parents are blocked with a message. **This is newer than 13–15 Sep audits that said there was no role check.**

**No** `middleware.ts` — protection is **client layout only**. Direct fetch of `/admin/students` HTML still ships; data still needs a session for `/api/store`.

**Shell:** `components/admin/AdminShell.tsx` — sidebar groups Main / Management / Enrollment / Records.

| Module | Route | Classification | Why |
| --- | --- | --- | --- |
| Dashboard | `/admin` | **CONNECTED TO API** (PARTIAL UI) | KPIs from `operationsStats(store)` + enrollment table. Not a separate dashboard API. |
| Teachers | `/admin/staff`, `/admin/staff/[id]` | **CONNECTED TO API** | `api.saveStaff`; workspace at `[id]` via `TeacherWorkspace`. |
| Parents | `/admin/parents` → re-export `/app/parents` | **CONNECTED TO API** | create/update/delete/link via `/api/admin/parents*`. |
| Students | `/admin/students` | **CONNECTED TO DATABASE** via store PUT | Full form + delete + “here today” attendance. |
| Programs | `/admin/programs` | **CONNECTED** via store PUT | Create/update/delete. |
| Classes | `/admin/classes` → `/app/classes` | **PARTIAL** | Shared `/app` page; historically create/update stronger than delete — confirm on that page before calling complete. |
| Enrollment | `/admin/enrollments` | **CONNECTED TO API** | approve/reject/cancel dedicated endpoints. |
| Attendance | `/admin/attendance` | **CONNECTED** via store PUT | Create + status update (not read-only). |
| Progress | `/admin/progress` | **PARTIAL** | Create notes via store `reports`. Limited edit/delete UI. |
| Payments | `/admin/payments` | **PARTIAL** | Create charges via store; not a full finance system. |
| Calendar | `/admin/schedules` | **PARTIAL** | Schedule table, not a month calendar. |
| Notifications / Messages | `/admin/messages` | **PARTIAL** | DMs via `POST /api/messages`; alerts mixed in. |
| Learning modules | `/admin/modules` | **PARTIAL / CONNECTED** | `ModulesManager` + module API. |
| Reports | `/admin/reports` | **UI ONLY / derived** | Client-side counts/charts from store. No `/api/reports`. |
| Settings | `/admin/settings` | **CONNECTED** | Profile, password, center settings via API + store. |
| Admin profile | `/admin/profile` | **PARTIAL** | Exists as a page (also settings). |
| Website CMS | `/admin/website` | **CONNECTED TO API** | Landing/about (re-export `/app/website`). |
| Tasks / announcements / sessions | `/admin/tasks`, `announcements`, `sessions` | **CONNECTED** via store PUT | Create/status; depth varies vs desktop. |
| Logout | AdminShell `signOut` | **CONNECTED** | `POST /api/auth/logout` + client clear. |
| `/app/users`, `/app/roles`, `/app/audit` | under `/app` | **UI ONLY / leftover** | Users table read-only; not in AdminShell nav. |

**Duplicate:** Several `/admin/*` pages are one-line re-exports of `/app/*` (`parents`, `classes`, `schedules`, `website`).

---

## 7. Electron Desktop Analysis

**Location:** `apps/desktop`  
**Main process:** `electron/main.cjs` — 1440×900 window, `contextIsolation: true`, `nodeIntegration: false`, preload `electron/preload.cjs`, View menu includes **toggleDevTools**. No CSP / navigation allowlist.  
**Renderer entry:** `src/main.tsx` → `src/App.tsx`  
**Styling:** `src/desktop.css` (~2300+ lines). **Not Tailwind.** Brand: cream/green/gold, Poppins/Outfit.  
**API:** `src/lib/api.ts` → `127.0.0.1:5188` (or `VITE_API_URL`); Vite also proxies `/api` to 5188.

**What UI currently exists:** A full “operations desk”: collapsible sidebar (`Shell.tsx`), top search, calendar shortcut, messages modal, notification inbox, profile chip, login stage with crest watermark (`LoginScreen.tsx`), dashboard KPI cards, RecordTable + EditorModal CRUD pattern, Teacher workspace, AssistantDock (keyword assistant, not LLM).

**Pages (from `WorkspacePages.tsx` + `views.ts`):**

| View id | Implementation | Completeness |
| --- | --- | --- |
| dashboard | `DashboardPage.tsx` | Live counts from store |
| students / monitoring | `StudentsPage.tsx` | Dedicated CRUD |
| teachers | `TeachersPage.tsx` + `TeacherWorkspacePage.tsx` | Dedicated + workspace |
| parents | `ParentsPage.tsx` | Dedicated REST CRUD |
| programs / classes | dedicated pages | Store PUT |
| modules | `ModulesPage.tsx` | Dedicated |
| enrollment | `EnrollmentPage.tsx` | Approve/reject/cancel + seats |
| calendar | `WorkflowPages` schedules | Table, not calendar grid |
| tasks / announcements / sessions | `WorkflowPages.tsx` | Management UIs |
| attendance / progress / payments | `RecordsPages.tsx` | **Create forms exist** (older audits said read-only — **outdated**) |
| notifications | RecordTable of alerts | List; mark-read from shell |
| messages | `MessagesPage.tsx` | Inbox |
| settings / marketing | `RecordsPages.tsx` | Profile, password, CMS tabs |
| reports | later in `WorkspacePages` | Count cards |
| playgroup, tutorial, aba, grades, finance, holidays, uniforms, etc. | Filtered `RecordTable` branches | **Dead if not in `HKLC_NAV_GROUPS`** |

**Nav source:** `packages/utils/src/hklcOperations.ts` `hklcNavForRole` — Super Admin vs Teacher vs Parent. **Not** a hard security boundary.

**Duplicate desktop implementations:** One Electron app. **Plus** website `/admin` implementing the same modules with different components. **Plus** git **stash@{0}** with large extra CSS/pages (see §16).

**Lost previous design?**

1. **This Git `main` history does not contain a deleted older desktop UI.** First commits (10 Sep 2026) are Vercel wiring; desktop files appear as part of the React conversion, not a long UI history.  
2. **stash@{0}** (21 Sep 2026, “moved local changes to cloud agent”) includes `desktop.css` **+710 lines**, large diffs in `Shell`, `StudentsPage`, `ModulesPage`, `MessagesPage`, `WorkflowPages`, etc. That is the strongest in-repo candidate for “UI that existed locally and is not on HEAD.” **Not restored this scan.**  
3. Original MAUI Blazor UI lives **outside** this repository (README).  
4. No `backup/` folders of a previous desktop skin.

**Responsive:** `minWidth: 900` — desktop-oriented. Collapse sidebar for narrower windows.

**Default login field:** `App.tsx` initializes `login` to `'admin'`. Login copy advertises seed credentials (`LoginScreen.tsx`).

---

## 8. Mobile Application Analysis

**Location:** `apps/mobile`  
**Framework:** Expo Router (`expo-router/entry`)  
**Auth:** `src/auth.tsx` — SecureStore + memory token; `api.me()` on restore; **blocks** non teacher/parent (`rbac.ts`). **Sept 13 finding that admin remaps to parent is outdated** — `mobileLoginIds` now passes login through.  
**API:** `resolveMobileApiUrl()` / `EXPO_PUBLIC_API_URL`; same `@hiraya/api`.  
**Theme:** `src/theme.ts` same green/gold/cream as web/desktop.

**Tabs:** Home, Schedule/Calendar, Progress/Modules, Alerts/News, Profile (`app/(tabs)/_layout.tsx`). Floating messages button.

**Stack screens:** login, enroll, attendance, payments, sessions, tasks, notes, modules, students, student/[id], program/[id], announcements, messages, password.

**Roles:** Teacher + Parent only. Super Admin is told to use Desktop/website (`MOBILE_LOGIN_BLOCKED`).

**Admin on mobile:** Not a product surface.

**Duplicated business logic:** Attendance/session rules in `@hiraya/utils` (`confirmStudentPresentToday`, `completeOneSession`) vs C# services — clients often **PUT the whole store** instead of dedicated REST. Mobile generally **consumes** store + a few writes (tasks, enroll, DMs, photo, password).

**Same backend?** **Yes, by design.** Same session header and store document. Not verified on a physical device this scan.

---

## 9. Backend/API Analysis

**Entry:** `backend/Hiraya.Api/Program.cs`  
**Listen:** `0.0.0.0:5188` in Development; `PORT` env in hosted setups.

### Documented routes (current source)

| Method | Endpoint | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api`, `/api/hub` | Public | `CentralHub.Info()` — **404 on the process currently listening** |
| GET | `/api/health` | Public | MySQL `CanConnect` |
| GET/PUT | `/api/store` | Session | Full `HirayaDatabase` JSON; sanitizer + merge |
| POST | `/api/auth/login` | Public | HMAC token |
| GET | `/api/auth/me` | Session | Present in source (older audit said missing) |
| POST | `/api/auth/logout` | Session | In-memory JTI revoke |
| POST | `/api/auth/password` | Session | |
| PUT/POST | `/api/auth/profile`, `/api/parent/profile` | Session | |
| GET | `/api/public/site` | Public | |
| POST | `/api/public/enrollment` | Public + throttle | |
| POST | `/api/messages`, `/api/direct-messages` | Session | Duplicate paths |
| PUT | `/api/staff` + archive/restore/active/delete/specialties | Session | `StaffApi.cs` |
| POST | `/api/enrollment/applications/{id}/approve\|reject\|cancel` | Session | |
| CRUD-ish | `/api/admin/parents*` | Session | `ParentPortalApi.cs` |
| GET | `/api/parent/children*` | Parent session | Family portal |
| POST | `/api/auth/activate` | Public + throttle | |
| modules | `/api/modules*` | Session | `LearningModuleApi.cs` |
| website CMS | `/api/admin/website/*`, `/api/public/logo`, gallery images | Mixed | `WebsiteApi.cs` |
| photos | `/api/users/{id}/photo`, `/api/media/profile/{userId}` | Upload gated; **GET media may be public** | `ProfilePhotoApi.cs` |

**Missing REST (by design of MAUI store):** no `GET /api/students` collection. Frontends invent IDs with `newId()` then PUT store.

**Duplicate endpoints:** `/api` vs `/api/hub`; `/api/messages` vs `/api/direct-messages`; profile PUT/POST aliases; staff photo vs users photo.

**Frontend → nonexistent:** `@hiraya/api` retries 404s (parent update `/update`, messages alias, photo alias). If hub 404s, `api.hub()` fails even when health is ok.

**CORS:** Development **AllowAnyOrigin**. Production allowlist includes hiraya domains + Vercel. `HIRAYA_ALLOW_OPEN_CORS` can open CORS in production.

**Error format:** `{ error: string }` JSON. DB down → 503.

**Controllers:** Minimal API static classes, not MVC controllers. Services in `Hiraya.Shared/Services`. Persistence: `EfHirayaRepository` implements `IHirayaRepository` (Firebase-named interface).

---

## 10. Database Analysis

**Technology:** MySQL (`HirayaDb.ResolveProvider` defaults to mysql). SQL Server is coded but not the local default.

**Connection:** `ConnectionStrings:Hiraya` in `backend/Hiraya.Api/appsettings.json` → `Server=127.0.0.1;Port=3306;Database=hiraya_learning_center;User=root;Password=` (empty local password). Overrides: `HIRAYA_MYSQL`, `DATABASE_URL`, `HIRAYA_MYSQL_PASSWORD`.

**Context:** `HirayaLearningCenterDbContext` tables (actual names):

| Table | Entity |
| --- | --- |
| users | HirayaUser (`Password` column `PasswordHash`) |
| roles, role_permissions | AppRole, RolePermission |
| teachers | TeacherProfile |
| students | Student |
| programs | LearningProgram |
| classes | LearningClass |
| rooms | CenterRoom |
| enrollments | Enrollment |
| enrollment_applications | EnrollmentApplication |
| attendance | AttendanceRecord |
| progress_records | ProgressReport |
| schedules | Schedule |
| teacher_work_shifts | TeacherWorkShift |
| teacher_role_options | TeacherRoleOption |
| announcements | NewsItem |
| leave_requests | LeaveRequest |
| payments | Payment |
| notifications | SystemAlert |
| audit_logs | AuditLogEntry |
| system_settings | CenterSettings |
| learning_modules, learning_module_versions | modules |
| parent_students | ParentStudent |
| account_invitations | AccountInvitation |
| student_ops | StudentOpsRecord |
| (holidays, duties, gallery, staff_tasks, session_packages, session_history, teacher_comments, teacher_notes) | workflow / CMS |

**Relationships:** Indexes on parent/class/teacher IDs. **No `HasOne` / `HasForeignKey` in the model.** Integrity is application-level. **RISK: orphaned students/payments possible.**

**Migrations:** `backend/Hiraya.Data/Migrations/*` (InitialCreate through WorkflowOperations, WebsiteCms, EnrollmentApplicationNotes).

**Seed:** `SeedData.Create()` — admin/teacher/parent users, sample student, etc. `DatabaseInitializer` + `ProductAccounts.NormalizeDirectory`.

**Mock vs live:** Seed is **real DB rows**, not UI mock. Public site can fall back to `publicDefaults` if API and MySQL both fail (`apps/web/lib/publicSite.ts`).

**Next mysql fallback schema:** Creates `enrollment_applications` if missing; reads `programs` / `system_settings` — **partial**, not full store.

---

## 11. Authentication Analysis

**Login:** `POST /api/auth/login` → `PortalAuthService.AuthenticateAsync` → `SessionTokens.Issue` (12h HMAC, password stamp).

**Storage:**

| Client | Token | User JSON |
| --- | --- | --- |
| Web | localStorage or sessionStorage `hiraya.session` | `hiraya.user` |
| Desktop | localStorage | `hiraya.user` |
| Mobile | expo-secure-store | same keys |

**Not cookies / not JWT / not httpOnly.**

**Web restore:** `AuthProvider` calls `api.me()` and **clears session** if me fails. Desktop `App.tsx` same pattern.

**Logout:** Revoke JTI in **process memory** (`SessionGate`). Restarting the API **un-revokes** tokens until expiry. Multiple API instances **do not share** revoke lists.

**Password handling:** Hashed. Seed backdoor: `SeedData.TryCanonicalSeedPassword` + `PortalAuthService` **re-hashes user to canonical seed** if seed password is typed and hash does not match. Client `resolveLoginPassword` maps `admin123` → `Admin123`.

**Electron/mobile:** Same login API. Mobile rejects Super Admin after successful API login.

**Hardcoded:**

| Item | Location | Type |
| --- | --- | --- |
| `SessionTokens.DevelopmentSecret` | `SessionTokens.cs` | Static HMAC secret if env unset (blocked in Production) |
| Seed passwords Admin123 / Teacher123 / Parent123 / Staff123 | `SeedData.cs`, README, LoginScreen, `resolveLoginPassword` | Demo credentials |
| Empty MySQL root password | `appsettings.json` | Local default |
| Desktop default username `admin` | `App.tsx` | UX default |

**Removed vs older audits:** `CLOUD_SESSION_TOKEN = 'hiraya-cloud-mysql'` and Next fallback `admin`/`admin123` always-succeed login — **not in current `mysql.ts` / `enrollment.ts`**. Login route is proxy-only (`apps/web/app/api/auth/login/route.ts`).

---

## 12. Authorization & Roles

**Product logins:** Super Admin, Teacher, Parent (`ProductAccounts.MaySignIn`). Role `admin` is normalized to Super Admin only for the seed director; other `admin` users deactivated. Staff/student deactivated on initialize.

| Role | Login | UI pages | API | Data visibility |
| --- | --- | --- | --- | --- |
| Super Admin | website `/admin`, Electron | Full HKLC nav | Store unsanitized (after PublicCopy strips passwords); staff/parents/enrollment/CMS | All operational data |
| Teacher | `/app`, Electron (filtered nav), Expo | Assigned classroom modules | Store `ForTeacher`; no payments | Assigned students |
| Parent | `/portal/family`, Expo, optional desktop | Family sheets | Store `ForFamily`; parent GET children | Linked children only |
| Staff / Student / extra Admin | Blocked from sign-in | — | — | — |

**Enforcement:**

| Layer | Exists? |
| --- | --- |
| Frontend hide links | Yes (`hklcNavForRole`, AdminGate, mobile rbac) |
| Next middleware | **No** |
| API session | Yes on store and ops |
| API role on dedicated routes | Yes (`Navigation.*`, services throw 403) |
| Store PUT merge | Yes `StoreSanitizer.MergeStoreWrite` |
| `role_permissions` table | Seeded (`PermissionCatalog.EnsureRows`) — **`Allows` not called at runtime** (grep found no `PermissionCatalog.Allows`) |
| Database GRANT roles | **No** — one app connection |

**Ideal “UI + API”:** Partially. Super Admin UI gate exists now. Teachers can still hit `/app/...` URLs. Parents must not receive applications (`ForFamily` clears `EnrollmentApplications`).

**File:** `apps/web/app/admin/layout.tsx`  
**Function:** `AdminGate`  
**Status:** Super Admin only  
**Related:** `packages/utils` `isAdmin`  
**Problem:** Client-only; no middleware.  
**Recommendation:** Add server session check later; do not treat layout as sufficient.

---

## 13. CRUD Analysis

Status is **from source wiring**, not a full UI click-through. Live `PUT /api/store` was not exercised this scan.

### Students
- CREATE = Working (store PUT, `newId`)
- READ = Working (`GET /api/store`)
- UPDATE = Working
- DELETE = Working (filter out of array then PUT)  
**API:** store only. **UI:** `apps/web/app/admin/students/page.tsx`, `apps/desktop/src/pages/StudentsPage.tsx`. **Validation:** mixed form fields; Zod `studentSchema` not clearly the only gate. **Error:** `StoreProvider.save` sets error.

### Teachers
- CREATE/READ/UPDATE/DELETE = Working via `/api/staff*`  
**UI:** `admin/staff`, desktop `TeachersPage`. **API:** `StaffApi` + `StaffService`.

### Parents
- CREATE/READ/UPDATE/DELETE = Working via `/api/admin/parents*`  
**UI:** `app/app/parents/page.tsx` (also `/admin/parents`). **Fallback:** `updateParentInStore` if REST 404.

### Programs
- CREATE/READ/UPDATE/DELETE = Working (store PUT)  
**UI:** `admin/programs`, desktop `ProgramsPage`.

### Classes
- CREATE/READ/UPDATE = Partial  
- DELETE = Partial (desktop archive/delete historically stronger)  
**API:** store. **UI:** `/app/classes` re-export.

### Enrollments
- CREATE (public) = Working  
- READ = Working  
- UPDATE (approve/reject/cancel) = Working  
- DELETE = Missing as generic delete (cancel instead)  
**API:** public POST + action POSTs. **DB:** `enrollment_applications`, approve creates student/parent/seat (`EnrollmentService`).

### Attendance
- CREATE = Working (admin/desktop/student “here today”)  
- READ = Working  
- UPDATE = Partial (status)  
- DELETE = Missing / unused  
**API:** store. **Utils:** `confirmStudentPresentToday` may consume session package.

### Progress
- CREATE = Partial (add note)  
- READ = Working  
- UPDATE/DELETE = Partial/Missing  
**API:** store `reports` → table `progress_records`.

### Payments
- CREATE = Partial (admin/desktop forms)  
- READ = Working (parents sanitized)  
- UPDATE/DELETE = Partial/Missing  
**API:** store.

### Calendar/Schedule
- CREATE/READ/UPDATE = Partial  
- DELETE = Partial (cancel status)  
**API:** store `schedules`.

### Notifications
- CREATE = Generated on workflow / DM  
- READ = Working  
- UPDATE = Mark read via store  
- DELETE = Missing  
**API:** store + `POST /api/messages`.

### Learning modules
- CREATE/READ/UPDATE/DELETE(archive) = Partial  
**API:** `/api/modules*` **and** store. Dual path.

### Reports
- CREATE = Missing (derived only)  
- READ = Partial (client aggregation)  
- UPDATE/DELETE = Missing  
**API:** none dedicated. `ReportService.cs` exists in Shared — **usage on HTTP map not found in `Program.cs`**.

### Admin settings
- CREATE N/A  
- READ/UPDATE = Working (profile, password, `system_settings`)  
- DELETE = N/A  

---

## 14. Data Flow Analysis

### Website enrollment → Admin
**Intended:** modal → `POST /api/public/enrollment` → MySQL → `GET /api/store` → `/admin/enrollments`.  
**Works locally** when Hiraya.Api is the proxy target (health+login succeeded).  
**Breaks** if Vercel uses mysql2 insert while admin still needs Hiraya.Api (approve has **no** mysql fallback).

### Admin creates teacher schedule → Teacher mobile
**Intended:** desktop/web PUT store `schedules` → MySQL → mobile `getStore` / schedule tab.  
**Plausible** if both hit the same API. **Not device-tested.** Teacher store is sanitized.

### Teacher updates task → Admin desktop → Parent
**Intended:** mobile PUT `staffTasks` status → store merge → admin list; announcements to parents via `news`/`alerts`.  
**Partial:** depends on `StoreSanitizer.MergeStoreWrite` allowing teacher writes. Parents do **not** get `StaffTasks` (`ForFamily` clears them).

### Direct DB access
- Hiraya.Api EF: **yes** (correct place).  
- Next `mysql.ts`: **yes** (enrollment/public site fallback) — **architecture violation**.  
- Electron/Expo: **no**.

### Frontend-only business logic
- `newId`, session remaining, “here today”, assistant keyword routing, HKLC nav, `resolveLoginPassword`.  
- Reports charts.

### Sync problems
- Store is a **document snapshot**; concurrent PUT last-writer-wins (`SemaphoreSlim` on API).  
- Logout revoke not shared across API instances.  
- Stash vs HEAD: unpublished UI sitting beside running apps.

---

## 15. UI/UX Analysis

**Shared brand tokens:** green `#0b1f14` / gold `#c9a227` / cream `#f4f1e9` in `packages/ui/src/tokens.css`, `desktop.css`, `apps/mobile/src/theme.ts`.

**Not one shell:**

| Surface | Look |
| --- | --- |
| Public web | Marketing: serif headings, magnetic CTAs, OGL/antigravity, sticky enroll |
| `/admin` | Operations sidebar, `AdminTable`, emoji nav icons |
| `/app` | Older `app-shell` / `sidebar` — visibly different |
| Electron | `desk-shell`, SVG icons, denser tables |
| Mobile | Native tabs, Ionicons |

**Loading:** `Loading` / `hlc-loading` / `DeskSkeleton`.  
**Empty:** `EmptyState` on many admin tables.  
**Errors:** `Alert`, `loadError` modal on desktop.  
**Confirm:** `window.confirm` on several admin destructive actions.  
**Calendar:** schedule lists, not a date-grid UX.  
**Public vs admin:** same colors, different typography (Playfair vs Poppins-only on admin/desktop).

They look like **one brand, three products**, plus a leftover fourth (`/app`).

---

## 16. Git History Findings

**Safe commands used:** `status`, `branch`, `log`, `stash show --stat`. No reset/checkout.

**Branches:** `main` (current), `cursor/cloud-agent-1789959491146-ocw8f`, remotes `origin/main`, `lee100030/main`.

**Commit theme (10–17 Sep 2026):** Vercel/Next deployment, enrollment to Aiven, README, defense publish. **Not** a long desktop UX history.

| Commit | Date | Relevance |
| --- | --- | --- |
| `d5778e3` | 2026-09-10 | Adds Next site + Vercel |
| `2556307` | 2026-09-12 | Live enrollment via Aiven from Vercel |
| `3747bcc` | 2026-09-17 | Publish defense clients |
| `16e35c6` / stash@{0} | 2026-09-21 | **Uncommitted UI/ops diffs** (desktop.css +710, many pages) |

**Deleted desktop components in git:** none found (`git log --diff-filter=D` on `apps/desktop` empty).

**Older working MAUI UI:** not in this Git repo.

**Do not apply stash** until the owner confirms it is the desired desktop restoration.

---

## 17. Duplicate Code

| FILE/FOLDER | PURPOSE | DUPLICATE OF | USED? | POSSIBLE ACTION |
| --- | --- | --- | --- | --- |
| `apps/web/app/admin/*` vs `apps/desktop/src/pages/*` | Same modules, two UIs | Each other | Yes | MERGE later or pick one ops client |
| `apps/web/app/app/*` | Legacy authenticated shell | `/admin` | Partially (re-exports + extra pages) | ARCHIVE `/app` extras |
| `apps/web/app/admin/parents/page.tsx` | Re-export | `app/app/parents/page.tsx` | Yes | KEEP re-export or flatten |
| Same for classes, schedules, website | Re-export | `/app/...` | Yes | KEEP/MERGE |
| `packages/shared` | Re-exports types/config/utils/validation/api | Those packages | Low | INVESTIGATE |
| `POST /api/messages` vs `/api/direct-messages` | DMs | Each other | Yes (client fallback) | MERGE later |
| `Hiraya.Shared/Services/Firebase/HirayaRepository.cs` | Old Firestore repo | `EfHirayaRepository` | `UsingFirebase` false | ARCHIVE |
| `apps/web/lib/server/mysql.ts` | Vercel DB | Hiraya.Api EF | Enrollment/public fallback | KEEP until hosted API; then REMOVE LATER |
| `apps/web/lib/enrollment.ts` local store keys | Offline apps | MySQL applications | Helpers exist | REMOVE LATER |
| Prior `HIRAYA_*.md` audits | Docs | This report | Yes, some stale | KEEP as history |
| `tmp-capstone/` | Unknown | — | node_modules only | INVESTIGATE |
| git stash@{0} | Newer/other UI | HEAD desktop | Not in working tree | INVESTIGATE before restore |

---

## 18. Dead/Unused Code

Do not delete now.

- `HKLC_NAV` view ids not in `HKLC_NAV_GROUPS` but handled in `WorkspacePages` (playgroup, tutorial, aba, uniforms, …).  
- `/app/users`, `/app/roles`, `/app/audit` — primitive tables.  
- `/portal/teacher` — three cards.  
- `PermissionCatalog` runtime Allows.  
- `ReportService.cs` not mapped in `Program.cs` (verify before calling unused).  
- `packages/shared` barrel.  
- `readLocalStore` / `writeLocalStore`.  
- `mysql.ts` `loadStore` / `saveEnrollmentStatuses` — **not** used by current `app/api/store/route.ts` (proxy only).  
- App `lint` scripts (`echo ok`).  
- Firebase credential provider / `HttpHirayaRepository` if unused by DI (API registers `EfHirayaRepository` only).  
- `NAV_GROUPS` constant in `apps/desktop/src/lib/views.ts` (dashboard-only leftover; real nav is `desktopNav`).

Unused npm packages were **not** proven with depcheck (would be noisy). Suspicious: public `ogl` is used. Mobile `whatwg-fetch` polyfill — verify need later.

---

## 19. Security Findings

| Priority | Finding | Location | Type | Risk |
| --- | --- | --- | --- | --- |
| CRITICAL | Seed password accepted case-insensitively and **rewrites hash** | `PortalAuthService.AuthenticateAgainstAsync`, `SeedData.TryCanonicalSeedPassword` | Auth backdoor | Anyone who knows demo passwords can reset live hashes for those usernames |
| CRITICAL | Client maps `admin123` → `Admin123` | `packages/utils/src/index.ts` `resolveLoginPassword` | Client helper | Weakens password matching |
| CRITICAL | Session in web/desktop storage, XSS-stealable | `apps/web/lib/session.ts`, desktop `lib/api.ts` | Token storage | Account takeover |
| HIGH | Logout revoke is in-memory only | `Program.cs` `SessionGate` | Session | Token reuse after “logout” / other instances |
| HIGH | Dev HMAC secret hardcoded if unset | `SessionTokens.DevelopmentSecret` | Secret | Forgery if used in a deployed non-Production env |
| HIGH | Next `mysql.ts` SSL `rejectUnauthorized: false` | `apps/web/lib/server/mysql.ts` | TLS | MITM to Aiven if that path is used |
| HIGH | Profile media GET may be unauthenticated | `ProfilePhotoApi.cs` `/api/media/profile/{userId}` | IDOR-ish | Photo leakage if IDs guessed |
| HIGH | Open CORS in Development; optional open CORS env | `Program.cs` | CORS | Fine locally; dangerous if flag set in prod |
| HIGH | No Next middleware on `/admin` | missing `middleware.ts` | Authz | Relies on client + API |
| MEDIUM | Seed credentials in README, LoginScreen, `defense-seed.mjs` | docs/scripts/UI | Credentials | Expected for demo; must not ship as production passwords |
| MEDIUM | Electron toggleDevTools in packaged menu | `electron/main.cjs` | Desktop | Users can inspect renderer |
| MEDIUM | Empty local MySQL password in `appsettings.json` | API config | Credential default | Local-only if not copied |
| LOW | `VERCEL_OIDC_TOKEN` in gitignored `.env.local` | `.env.local` | SECRET FOUND | Local Vercel token; **not committed** (`gitignore: .env.local`) |
| — | No committed `.env` production DB URI | `git ls-files` only `.env.example` | — | Good |

**SECRET FOUND**  
**LOCATION:** `.env.local` (ignored)  
**TYPE:** Vercel OIDC token key present  
**RISK:** Local credential; keep uncommitted.

No production connection string was printed. `appsettings.json` contains an empty-password local URI (not a cloud secret).

---

## 20. Performance Findings

| Priority | Finding |
| --- | --- |
| HIGH | `GET/PUT /api/store` loads/saves a **full center document** — will slow as records grow |
| MEDIUM | Public site magnetic pointer handler queries **all** `[data-magnetic]` on every move (`PublicChrome.tsx`) |
| MEDIUM | Admin dashboard derives charts in the browser from full store |
| LOW | Google Fonts loaded from CSS `@import` (desktop + web) — extra latency |
| LOW | Module upload limit 100MB (`Program.cs` Kestrel/FormOptions) |

Not load-tested.

---

## 21. Broken Features

| Priority | Item | Evidence |
| --- | --- | --- |
| HIGH | `/api/hub` and `/api` **404** on the **running** API while source maps them | Live GET 404 vs `Program.cs` MapGet. Likely **old API process** vs current tree |
| HIGH | Hosted website without Hiraya.Api: admin login 503; enrollment may still insert via mysql2 | `backend.ts` empty base on Vercel production; health unconfigured path |
| MEDIUM | Teacher portal `/portal/teacher` is a stub | File contents |
| MEDIUM | Calendar is not a calendar | Schedules table |
| MEDIUM | `ReportService` not exposed on HTTP | No Map in `Program.cs` |
| UNCLEAR | Stash UI vs HEAD — operators may be running mixed versions | stash@{0} vs clean HEAD |

---

## 22. Missing Features

Relative to the user’s module list and HKLC workbook (`hklcOperations.ts` sheet names):

- True month **calendar** / holidays UI  
- Dedicated REST for students/classes/payments  
- Runtime **role_permissions** engine  
- HttpOnly cookie sessions / refresh  
- Student mobile accounts (intentionally blocked)  
- Separate **Administrator** role (intentionally deactivated)  
- Automated E2E tests  
- Next middleware  
- Foreign keys  
- Shared revoke store  
- Hosted Hiraya.Api as default production (optional in README)

Workbook sheets (uniforms, compliance, ABA metrics, etc.) are **labels/nav leftovers**, not full apps.

---

## 23. Suspicious / Unclear Features

| Item | Classification | Why |
| --- | --- | --- |
| Name **RION** vs **HIRAYA** | UNCLEAR | Repo never uses RION |
| `ogl` / AntigravityField | KEEP | Public marketing visual |
| Desktop `AssistantDock` keyword bot | KEEP | In-app navigation helper, not a second product |
| HKLC Excel sheet names in code | KEEP | Thesis/ops mapping; not junk |
| `tmp-capstone/` | INVESTIGATE | Only `node_modules` listed |
| Firebase folders | ARCHIVE later | Naming + unused repo class |
| `defense-seed.mjs` | KEEP | Demo seeder; **do not run** unless asked (writes data) |
| Cloud agent stash | INVESTIGATE | May be the “lost” desktop polish |
| `/app` shell | MERGE/ARCHIVE | Duplicate operations UI |
| Open CORS / seed passwords | FIX later | Security, not “nonsense” |

---

## 24. Recommended Cleanup Order

1. **Inventory stash@{0}** (diff only; do not apply blindly).  
2. Align **running Hiraya.Api** with current source (hub 404).  
3. Decide **one operations client** (Electron vs `/admin`) as source of UX truth.  
4. Fold or retire `/app` extras.  
5. Isolate or remove Next **mysql2** once API is hosted.  
6. Archive Firebase/MAUI leftovers **after** confirming unused.  
7. Deduplicate message/profile/photo aliases.  
8. Do **not** delete “unused” store fields until workbook mapping is confirmed.

---

## 25. Recommended Fix Order

1. **CRITICAL** — Stop seed-password hash rewrite; rotate demo passwords for any non-local DB.  
2. **CRITICAL** — Confirm production never uses Development session secret.  
3. **HIGH** — Restart/rebuild API so `/api/hub` matches source; document process.  
4. **HIGH** — Hosted architecture: Vercel website **only** proxies Hiraya.Api **or** document mysql fallback as temporary.  
5. **HIGH** — Session: httpOnly or at least server-side revoke store.  
6. **HIGH** — Next middleware for `/admin`.  
7. **MEDIUM** — Unify enrollment persist path.  
8. **MEDIUM** — Desktop UX: compare HEAD vs stash; restore only with owner approval.  
9. **MEDIUM** — CRUD gaps (progress/payments delete, real calendar).  
10. **LOW** — Tests, lint, FKs, dead code.

---

## 26. Thesis Requirements Impact

Evidence from `HIRAYA_REQUIREMENTS_BLOCKERS.md`, `HIRAYA_ROLE_PERMISSION_MATRIX.md`, `docs/ARCHITECTURE.md`, `docs/HIRAYA_Capstone_Manuscript.docx` (present, not fully parsed).

| Thesis need | Current impact |
| --- | --- |
| Multi-platform (web, desktop, mobile) | Present |
| Central API + MySQL | Present locally; production split-brain risk |
| Super Admin / Teacher / Parent | Encoded in `ProductAccounts` |
| Enrollment from website into center records | Implemented with dual persist |
| HKLC workbook parity | Nav labels exist; many sheets are **not** apps |
| Security story | Weakened by seed backdoor + localStorage tokens |
| Original MAUI | Copied API in `backend/`; MAUI client **out of repo** |

Do not claim workbook-complete operations until a cell dump exists (blockers doc).

---

## 27. Local Development Status

**How to start (README / `package.json`):**

1. XAMPP MySQL `hiraya_learning_center`  
2. `npm run dev:api` → `:5188`  
3. `npm start` → Next `:3000`  
4. `npm run dev:desktop` → Vite `:5173` + Electron  
5. `npm run dev:mobile` → Expo  

**This scan (already running, not started by the auditor):**

- API health **ok** (payload **lacks** `clients` array from current `Program.cs` — another sign of version skew)  
- Website health **ok**, homepage **200**, public site **10 programs**  
- Admin login **200** `super_admin`  
- Hub **404**  
- Desktop Vite **200**  
- Expo **not verified**  
- `node_modules` present at repo root and `apps/web`  
- No packages were installed; no builds were run  

**Seed logins (documented, not secrets of a cloud account):** `admin`/`Admin123`, `teacher`/`Teacher123`, `parent`/`Parent123`.

---

## 28. Deployment Readiness

**Not production-ready** as a unified system.

| Target | Status |
| --- | --- |
| Vercel website | Configured (`vercel.json` copies `apps/web/.next`). Enrollment can hit Aiven **without** full API. Admin CRUD needs `HIRAYA_API_INTERNAL`. |
| Electron | Local packaging scripts exist; not a Vercel app (`apps/desktop/vercel.json` exists to keep it off website deploy). |
| Expo | Not a Vercel app. Needs LAN API URL. |
| DigitalOcean | `Dockerfile`, `.do/app.yaml` documented; not verified live. |
| Secrets | Production API refuses default session secret. Demo passwords must be changed. |

README still says “Current mode: local only” in one section and also documents Vercel/DO — mixed operational policy.

---

## 29. Architecture Recommendation

**Keep** the hub:

```text
PUBLIC WEBSITE ─┐
ADMIN WEB ──────┼──► Hiraya.Api ──► MySQL
ELECTRON ───────┤
MOBILE ─────────┘
```

**Later (not now):**

- Remove Next mysql2 **after** API is always reachable.  
- Pick **Electron or `/admin`** as the Super Admin UX; keep the other as a thin wrapper or drop it.  
- Replace full-document `PUT /api/store` gradually with the REST that already exists (staff, parents, enrollment, modules) **without** inventing Express.  
- Restore desktop visuals only from **stash/MAUI screenshots/owner**, not a redesign.

**Do not** replace ASP.NET + MySQL with Firebase/Mongo/Next-only.

---

## 30. Final Findings

### What follows the intended architecture
- Shared `@hiraya/api` + `X-Hiraya-Session`.  
- Electron and Expo call Hiraya.Api (not MySQL).  
- Website proxies to Hiraya.Api when configured.  
- EF maps a real learning-center schema.  
- Role sanitizer on store GET/PUT.

### What does not
- Vercel **direct MySQL** enrollment/public site.  
- Two full admin UIs (`/admin` + Electron) plus `/app`.  
- Store-as-database on the wire.  
- Running API **out of date** vs `Program.cs` (hub 404).  
- Permission table unused at runtime.  
- Frontend-only AdminGate.

### Desktop UI/UX
- A complete desk UI **exists on HEAD** (sidebar, dashboard, CRUD pages, cream/green CSS).  
- It is **not** “empty.”  
- A **larger unpublished CSS/page delta** sits in **stash@{0}**. That is the primary “lost/changed UI” lead **inside Git**.  
- MAUI UI is the other lead **outside Git**.

### Critical problems
1. Seed-password backdoor + hash rewrite.  
2. Bearer session in `localStorage`.  
3. Production split-brain (proxy vs mysql2).  
4. API process vs source mismatch.  
5. Unpublished stash vs running clients.

---

*End of analysis. No application files were modified except this report.*
