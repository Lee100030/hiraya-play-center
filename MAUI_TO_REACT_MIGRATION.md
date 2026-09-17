# MAUI → React desktop/admin migration

Source of truth for **operations** is the MAUI Blazor Hybrid app at `C:\Users\LEE\source\repos\Hiraya` (`Hiraya Dekstop-Mobile.csproj`). It is not a XAML ViewModel app. Almost all screens are `.razor` pages over shared C# services and a document store (`HirayaDatabase`) persisted through `IHirayaRepository` (MySQL via EF in `Hiraya.Api`, optional Firebase / local JSON in the hybrid client).

This React repo already has three clients that talk to a **copied** `backend/Hiraya.Api`:

| Surface | Folder | Role |
|---|---|---|
| Public website | `apps/web` (`/`, `/about`, `/programs`, `/contact`, enroll modal) | Landing. Public nav has **no** Admin/Login link. |
| Website admin | `apps/web` `/admin` | Thin CMS-style admin (login, dashboard, enrollments). Matches `Hiraya.Web` more than the desktop. |
| Operations desk | `apps/web` `/app/*` | Partial MAUI module clone (CRUD via `GET/PUT /api/store`). |
| Electron desktop | `apps/desktop` | **Dedicated desktop folder.** Login + 6 stub views. Uses `@hiraya/api`. |
| Mobile | `apps/mobile` | Expo. Out of this migration. |

**This pass:** inventory + proposed structure only. No MAUI screens were rewritten. Desktop work stays **local** (Electron + local API). Do not deploy Electron to Vercel.

---

## Architecture discovered (do not replace blindly)

- **Database:** MySQL (`hiraya_learning_center` / Aiven `defaultdb`). EF Core Pomelo. Not SQLite as the primary store.
- **API:** ASP.NET Core Minimal APIs. Session header `X-Hiraya-Session`. Staff CRUD is mostly **`GET /api/store` + `PUT /api/store`** (full document), plus dedicated auth, staff, parent, modules, website CMS, public enrollment.
- **Auth:** `PortalAuthService` + PBKDF2 hashes (`pbkdf2$…`). Seed desktop logins include `admin` / `Admin123`. React demo fallback `admin` / `admin123` is **not** production auth.
- **Firebase:** optional in MAUI `HirayaRepository`. Reports page can label “Firebase” vs local JSON. React path should keep **MySQL + Hiraya.Api**.
- **QR attendance:** exists (`AttendanceService` scan check-in / second scan check-out).
- **Reports:** on-screen date-range snapshot (`CenterReports.razor`). No PDF/Excel export of center reports (file types appear only on learning-module uploads).
- **Enrollment approval:** not a status flag only. `EnrollmentService.ApproveApplicationAsync` creates student, QR code, parent/guardian user + family link, enrollment row, class seat check, notifications, audit.

---

## MAUI pages (desktop / hybrid)

| Route | MAUI source | What it does |
|---|---|---|
| `/` landing (hybrid) | `Landing.razor`, `Home.razor` | Entry / role-specific home |
| `/dashboard` | `Home.razor` + `AdminDashboardService` / teacher / mobile dashboards | Admin stats, teacher workspace, family mobile home |
| `teachers` | `Staff.razor` + `StaffService` | Employee directory; add/edit/archive/restore/delete; specialties |
| `students` | `Students.razor` | Student CRUD, parent link, QR, program, search |
| `parents` | `Parents.razor` + `ParentAccountService` | Parents, children links, invitations |
| `progress` | `Progress.razor` | Progress records (area, rating, notes) |
| `attendance` | `Attendance.razor` + `AttendanceService` | Class roster, present/absent/late/excused, employee attendance, **QR scan** |
| `programs` | `LearningPrograms.razor` | Program list/status |
| `classes` | `Classes.razor` | Classes, capacity, teacher, program |
| `modules` | `LearningModules.razor`, `LearningModuleDetail.razor` | Modules, versions, file upload, status |
| `enrollment` | `Enrollments.razor` + `EnrollmentService` | Applications + enrollments; approve/reject/cancel |
| `schedules` | `Schedules.razor` | Class schedules, cancel, conflicts |
| `calendar` | `CenterCalendar.razor` | Calendar of schedules/events |
| `operations` | `OperationsDesk.razor` | Operations desk |
| `teacher-plan` | `TeacherDayPlan.razor` | Teachers’ day plan |
| `teacher-duty` | `TeacherDutyCalendar.razor` | Duty calendar |
| `playgroup` | `PlaygroupSchedule.razor` | Playgroup |
| `school-calendar` | `SchoolYearCalendar.razor` | School year / holidays |
| `uniform-inventory` | `UniformInventory.razor` | Uniform stock |
| `payments` | `Payments.razor` + `PaymentService` | Charges, paid/overdue views, no payment gateway |
| `reports` | `CenterReports.razor` | Attendance/enrollment/payment/progress snapshot |
| `notifications` | `Notifications.razor` | Inbox, read/unread |
| `announcements` | `Announcements.razor` | Published news |
| `admin/users` | `AdminUsers.razor` | User admin |
| `admin/roles` | `RolesPermissions.razor` | Role permissions |
| `audit` | `AuditLog.razor` | Audit trail |
| `settings/profile` | `MyProfile.razor` | Profile |
| `settings/account` | `AccountSettings.razor` | Password / account |
| `settings/system` | `SystemSettingsPage.razor` | Center settings |
| `website` | `WebsiteManagement.razor` | Public CMS (landing, about, logo, gallery) |
| Teacher extras | `TeacherHomeDashboard`, `TeacherRoster`, `TeacherTasks`, `TeacherNavMenu` | Teacher-scoped UI |
| Family extras | `MobileChildrenPage`, family portal in `Hiraya.Web` | Parent mobile/web |

**Hiraya.Web (browser admin, not the desktop):** `/admin` login, `/admin/dashboard`, `/admin/enrollments`, `/admin/website`. Public site Home/About/Programs/Contact + enroll modal.

---

## React mapping (current vs target)

| MAUI feature | Current React | Target (desktop app) | Status |
|---|---|---|---|
| Public landing | `apps/web` public pages + `PublicChrome` | **Keep as-is** | Done (do not redesign) |
| Public enrollment | `components/public/enrollment.tsx` → `POST /api/public/enrollment` | Same source of truth | In progress (cloud needs `HIRAYA_MYSQL`) |
| Website admin login | `/admin` + `AdminLoginForm` | Stay on web `/admin`; **not** in public nav | Partial |
| Website admin dashboard | `/admin` | Keep thin (pending/approved apps) | Partial |
| Website enrollments | `/admin/enrollments` | Approve must call **same** MAUI approve workflow (not status-only) | **Incomplete** (status toggle / local demo) |
| Desktop shell | `apps/desktop/src/App.tsx` (6 views) | Full module tree below | Stub |
| Ops dashboard | `/app` + `AdminDashboardService` stats missing | `apps/desktop/src/pages/Dashboard.tsx` | Partial on `/app` |
| Students | `/app/students`, `/admin/students` re-export | Desktop `pages/Students.tsx` | Partial (store PUT, not all MAUI rules) |
| Teachers/staff | `/app/staff` + `/api/staff*` | Desktop `pages/Teachers.tsx` | Partial |
| Parents | `/app/parents` + `/api/admin/parents*` | Desktop `pages/Parents.tsx` | Partial |
| Programs | `/app/programs` | Desktop `pages/Programs.tsx` (shared with public programs) | Partial |
| Classes | `/app/classes` | Desktop `pages/Classes.tsx` | Partial |
| Enrollment | `/app/enrollment` | Desktop `pages/Enrollment.tsx` + approve service | Partial |
| Attendance + QR | `/app/attendance` | Desktop `pages/Attendance.tsx` | QR **not** fully ported |
| Progress | `/app/progress` | Desktop `pages/Progress.tsx` | Partial |
| Payments | `/app/payments` | Desktop `pages/Payments.tsx` | Partial |
| Calendar | `/app/calendar` | Desktop `pages/Calendar.tsx` | Partial |
| Notifications | `/app/notifications` | Desktop `pages/Notifications.tsx` | Partial |
| Learning modules | `/app/modules` + `/api/modules*` | Desktop `pages/LearningModules.tsx` | Partial |
| Reports | `/app/reports` | Desktop `pages/Reports.tsx` (date snapshot, no PDF) | Partial |
| Settings | `/app/settings`, profile | Desktop `pages/Settings.tsx` | Partial |
| Extra MAUI (duty, playgroup, uniforms, audit, roles, website CMS, operations desk) | some under `/app/*` | Phase after core 15 nav items | Mostly missing on Electron |
| Auth | API login + demo fallback | Desktop: **API only** locally (`NEXT`/`VITE_API_URL` → `http://127.0.0.1:5188`) | Demo on web only |

Models already live in `packages/types` (aligned with `Hiraya.Shared/Models/HirayaModels.cs`). Do not invent a second Student/Enrollment type.

---

## Proposed file structure (use existing monorepo; do not add `src/admin` under the public Next app)

Public website stays in `apps/web`. Desktop/admin **application** grows in `apps/desktop`:

```
apps/desktop/src/
  App.tsx                          # auth gate + router
  layouts/
    AdminLayout.tsx
    AdminSidebar.tsx
    AdminHeader.tsx
    AdminMobileMenu.tsx
  pages/
    Dashboard.tsx
    Teachers.tsx
    Parents.tsx
    Students.tsx
    Programs.tsx
    Classes.tsx
    Enrollment.tsx
    Attendance.tsx
    Progress.tsx
    Payments.tsx
    Calendar.tsx
    Notifications.tsx
    LearningModules.tsx
    Reports.tsx
    Settings.tsx
  components/                      # per-module UI
  hooks/
    useHirayaStore.ts              # GET/PUT /api/store
  services/                        # wrappers around @hiraya/api + approve/attendance helpers
```

Shared (already exists; reuse, do not duplicate):

- `packages/api` — HTTP client (all apps)
- `packages/types` — MAUI models
- `packages/validation` — forms
- `packages/ui` — Table, Field, StatusBadge, EmptyState, Loading
- `backend/Hiraya.Api` — real business rules (approve, QR, staff)

Web `/admin` stays the **hidden** website-admin entry (`/admin`, `/admin/login` behavior today is login-on-`/admin`). Full MAUI nav belongs in **Electron**, not in the public landing layout.

Optional later: extract desktop pages into `packages/ops-ui` so `/app` and Electron share one implementation.

---

## API connection (all apps)

Local (this phase):

```
Hiraya.Api     http://127.0.0.1:5188
Website        http://127.0.0.1:3000     NEXT_PUBLIC_API_URL=http://127.0.0.1:5188
Desktop        Electron → Vite 5173      VITE_API_URL=http://127.0.0.1:5188
Mobile         Expo                      EXPO_PUBLIC_API_URL=http://127.0.0.1:5188
```

Production website can keep Vercel + `HIRAYA_MYSQL` for public enrollment; **desktop stays local** until an API host exists.

---

## Features needing backend (not UI-only)

| Feature | Why |
|---|---|
| Approve enrollment | Must run `EnrollmentService.ApproveApplicationAsync` (student + QR + parent + class capacity). A React `status: approved` PUT is **incorrect**. Prefer an API route wrapping that method. |
| QR attendance | `AttendanceService` scan/checkout. |
| Staff archive/restore | `/api/staff*` already exists. |
| Learning module files | `/api/modules*` + file tickets. |
| Website CMS media | `/api/admin/website*` |

## Can run locally now

API + MySQL (XAMPP) + Electron stub + Next public site. Demo `admin`/`admin123` on web if API is down; desktop should use API `Admin123`.

## Cannot migrate yet / out of scope this phase

- Payment gateways (MAUI has none)
- PDF/Excel report export (MAUI reports are on-screen)
- Replacing the public landing
- Vercel deploy of Electron
- Inventing `src/` at repo root (this is a pnpm monorepo)

---

## Agreed implementation order (when you say go)

1. Desktop layout + API login (no demo) + dashboard stats from `AdminDashboardService`
2. Students → Teachers → Parents → Programs → Classes
3. Enrollment **with real approve**
4. Attendance including QR
5. Progress, payments, calendar, notifications, modules, reports, settings
6. Extra MAUI: duty/playgroup/uniforms/audit/roles/website CMS
7. Responsive polish on the Electron window

Public site files stay untouched unless enrollment must share a service.
