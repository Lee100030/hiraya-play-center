# HIRAYA Website Admin and Electron Desktop — Function Audit

**Status:** Step 1–2 complete. No unification rewrite has started.  
**Scanned:** 15 September 2026  
**Scope:** Public website, `/admin` + `/app` web shells, Electron desktop, Expo mobile, Hiraya.Api, MySQL/EF, authentication, roles.

This document is the gate for later phases. The website admin and desktop already share one API and one database. They do **not** yet share the same modules, CRUD depth, or client business logic.

---

## 1. Architecture as it exists today

```
Public website (Next.js :3000)
Website /admin  ──┐
Website /app     ──┤── Next /api/* proxy ──┐
Electron desktop ──┤                       ├── Hiraya.Api :5188
Mobile (Expo)    ──┘  (direct to API)      │
                                           └── MySQL hiraya_learning_center
```

- **Source of truth:** MySQL via `EfHirayaRepository` (`backend/Hiraya.Data`).
- **Primary data plane:** `GET/PUT /api/store` — a full `HirayaDatabase` document. Dedicated REST exists for auth, staff, parents, enrollment actions, modules, website CMS, photos, and DMs.
- **Shared client:** `packages/api` (`HirayaApi`). Each app constructs its own instance (`apps/web/lib/api.ts`, `apps/desktop/src/lib/api.ts`, `apps/mobile/src/auth.tsx`).
- **Not the source of truth:** localStorage (session cache only), unused `hiraya.local.*` keys in `apps/web/lib/enrollment.ts`, unused Next `mysql.ts` loaders for admin CRUD, unused `@hiraya/shared` barrel, unused `PermissionCatalog.Allows` at runtime.

Product sign-in roles in practice: **Super Admin**, **Teacher**, **Parent**. Children have no accounts. Desktop is intended as the admin client; mobile blocks Super Admin.

---

## 2. Authentication (same API, not yet the same product rules)

| Item | Website `/admin` | Electron desktop | API |
|------|------------------|------------------|-----|
| Login screen | `AdminLoginForm` | `LoginScreen` | `POST /api/auth/login` |
| Token | `X-Hiraya-Session` in localStorage / sessionStorage | localStorage | HMAC session, 12 hours |
| Refresh of user | `api.me()` | `api.me()` | `GET /api/auth/me` |
| Logout | `api.logout()` | `api.logout()` | `POST /api/auth/logout` (in-memory JTI) |
| Password change | Settings / profile | **Not implemented** | `POST /api/auth/password` |
| Role gate on login UI | Any signed-in user can open `/admin` | Nav filtered by `hklcNavForRole` | Store sanitizer scopes data |

**Seed-password backdoor (must fix in Step 3):**  
`PortalAuthService` + `SeedData.TryCanonicalSeedPassword` accept `Admin123` / `Teacher123` / `Parent123` / `Staff123` and **rewrite the live password hash** back to the seed if those credentials are presented. Client helper `resolveLoginPassword` in `packages/utils` also normalizes seed casing before the request.

**Other auth notes**

- Not JWT. Not httpOnly cookies.
- Session revoke list is process-local (lost on API restart; not shared across instances).
- Dev session secret is hardcoded when not in production.
- `/api/media/profile/{userId}` serves photos without a session.
- Password change on website does **not** automatically update a desktop session until the next `me()` / re-login; the session stamp is bound to the password hash, so a password change should invalidate old tokens (verify in Step 3).

---

## 3. Permissions

| Layer | What it actually does |
|-------|------------------------|
| Hiraya.Api `Navigation` + services | Real checks on dedicated endpoints (staff, parents, enrollment, website, modules). |
| `StoreSanitizer` | Real scoping on `GET/PUT /api/store` (Super Admin full; teacher assigned students; parent linked children; teachers do not receive payments). |
| `PermissionCatalog` / `role_permissions` | Seeded in DB, **never called** at runtime. |
| Website `/admin` layout | **No role check** — any authenticated user (including parent/teacher) gets `AdminShell`. |
| Website `/app` | Nav from `hklcNavForRole`; still not a security boundary. |
| Desktop | Sidebar filtered by role; still relies on API sanitizer. |
| Mobile `rbac.ts` | Super Admin blocked; teacher/parent only. |

Frontend hiding of links is **not** authorization. Super Admin is the only true admin role (`isAdmin` ≡ Super Admin). There is no separate “Admin” product role in the live directory.

---

## 4. Feature matrix

Legend: **Full** = create + read + update + delete/archive against the live store/API. **Partial** = some of those. **Read** = list/detail only. **Missing** = no screen. **Store PUT** = client mutates the whole database blob.

| Module | Website `/admin` | Desktop | Mobile | Shared API | Database | Same CRUD behavior? |
|--------|------------------|---------|--------|------------|----------|---------------------|
| Dashboard | Read KPIs from store | Read KPIs from store | Home stats (scoped) | Store only | Derived | Counts share store; widgets differ |
| Students | Full via Store PUT | Full via Store PUT | View assigned/linked | Store only (no `/api/students`) | `students` | Close, but **two different UIs and client helpers** |
| Parents | Create + unlink child; **no edit/delete** | Full via `/api/admin/parents*` | View self + children | Yes (admin + portal) | `users`, `parent_students` | **No — desktop is ahead** |
| Teachers / staff | Create/update/deactivate | Full + **Teacher Workspace** | View assigned | `/api/staff*` | `users`, `teachers` | **No — web has no workspace** |
| Programs | Full Store PUT | Full Store PUT | Catalog view | Store | `programs` | Close |
| Classes | Create/update; **no delete** | Create/update/archive/delete | View via schedule | Store | `classes` | **No** |
| Enrollment | Approve/reject | Approve/reject/cancel + seat CRUD | Parent apply | Dedicated actions + store | `enrollment_applications`, `enrollments` | Close on review; desktop has more seating tools |
| Attendance | Not in `/admin` nav; **create on `/app/attendance`** | Read-only table | Parent/teacher view | Store | `attendance` | **No** |
| Progress | Not in `/admin`; **read-only `/app/progress`** | Read-only (`store.reports`) | Parent view / teacher modules tab | Store + parent GET | `progress_records` | **No write on either admin client** |
| Sessions | Create packages only | Create/edit/`completeOne` | Parent view remaining | Store | `session_packages`, `session_history` | **No — desktop can adjust used sessions; web cannot** |
| Payments | Create charge (`/app` re-export) | Read-only | Parent view | Store + parent GET | `payments` | **No** |
| Calendar / schedules | Create/update; no delete | Create/update (admin-gated) | Day view; teacher can add task row | Store | `schedules` | Partial |
| Tasks | Create only | Create/edit status | Teacher update status | Store (`staff_tasks`) | `staff_tasks` | **No** |
| Comments | Missing | Teacher workspace only | Missing | Store | `teacher_comments` | Desktop-only |
| Admin notes | Missing | Teacher workspace only | Teacher notes read | Store | `teacher_notes` | Desktop-only |
| Learning modules | Super Admin write | Admin write | Teacher view | Dedicated module API **and** store | `learning_modules` | Partial; file upload is filename-only on web |
| Announcements | Create only | Create/edit/archive status | View | Store | `announcements` | **No** |
| Notifications | Bell + `/app/notifications` | Read list; mark-read **not persisted** | Mark read via putStore | Store + DMs | `notifications` | **No** |
| Direct messages | `/admin/messages` (not in sidebar) | Header/modal messenger | Messages screen | `POST /api/messages` | `notifications` kind `direct` | Close |
| Reports | Charts + CSV from store | Count cards | None | None dedicated | Derived | **No** |
| Settings | Profile, users blob, password, center settings | Profile **display only** | Profile + password | Mixed | `users`, `system_settings` | **No** |
| Website CMS | Landing/about save | **Missing** | N/A | `/api/admin/website/*` | `system_settings`, `website_gallery` | Desktop unused |
| Teacher workspace | **Missing** (`/admin/teachers/:id` does not exist) | Full tabs | Partial teacher home/tasks | Mixed | Mixed | **No** |

---

## 5. Website surfaces

### 5.1 `/admin` (intended operations UI)

Gate: `apps/web/app/admin/layout.tsx` — signed-in only, **no Super Admin check**.

Present: dashboard, students, parents, staff (teachers), modules, schedules, tasks, announcements, sessions, enrollments, programs, classes, payments, reports, website, settings, profile, messages.

### 5.2 `/app` (legacy parallel shell)

Still live. Overlaps `/admin` with older or extra pages: attendance **create**, progress **read**, calendar **read**, children, users, roles, audit. Dashboard announcement CTA still points at `/app/announcements`.

### 5.3 Public site

Marketing + public enrollment. Uses `GET /api/public/site` and `POST /api/public/enrollment`. Contact/CMS placeholders are separate from admin unification.

---

## 6. Desktop surfaces

View-state shell (no URL routes). Nav from `HKLC_NAV_GROUPS` in `packages/utils/src/hklcOperations.ts`.

**Ahead of website:** parent edit/delete/link, teacher workspace (overview, info, assigned students, classes, calendar, tasks, attendance, to-do, comments, notes, activity), session `completeOne`, announcement edit/archive, enrollment seating.

**Behind website:** website CMS, password/settings writes, payment create, `/app` attendance create, reports CSV.

**Dead branches** in `WorkspacePages.tsx` for workbook IDs not in nav (`playgroup`, `tutorial`, `aba`, `uniforms`, etc.).

---

## 7. Mobile (permitted view only)

Teacher + parent. Super Admin cannot use it. Reads scoped `getStore()`. Writes: task status, some schedule rows, alert read, enrollment apply, DMs, photo/password. Does **not** call `parentProfile` / `parentChildren` helpers even though they exist on the API client.

---

## 8. Mock data, localStorage, hardcoded IDs

| Finding | Where | Verdict |
|---------|--------|---------|
| Session token/user cache | Web + desktop localStorage | Expected; not domain SoT |
| Unused local store keys | `apps/web/lib/enrollment.ts` | Dead code |
| Empty store on API failure | All clients | Honest empty, not fake rows |
| Seed users/passwords | `SeedData` + client `resolveLoginPassword` | Live backdoor, not UI mock |
| Client-generated IDs | `newId('stu'|'prg'|…)` | Real creates, not hardcoded demo IDs |
| `recipientId === 'everyone'` | Announcements | Sentinel, not a fake person |
| Desktop login default `admin` | `App.tsx` | UX default only |
| Next `mysql.ts` | Not used by admin routes | Dead dual path |
| JSON/Firebase repositories | Shared library | Not wired as API repo |

No separate website-vs-desktop fake databases were found. Divergence is **UI + client mutation logic**, not two MySQL catalogs.

---

## 9. Missing or incomplete API / data relationships

**Missing dedicated REST (today everything is store PUT):** students, programs, classes, attendance, progress, sessions, payments, schedules, tasks, announcements, dashboard stats.

**Relationships exist as string IDs, not EF foreign keys:** `parent_students`, `Student.ParentId`, `Enrollment.TeacherId` / `ClassId`, `Class.TeacherId`, session packages → student, payments → student.

**Client gaps vs backend:** module file/status APIs, website gallery/logo, staff archive/restore, `GET /api/parents/{id}/children` — backend exists; `@hiraya/api` is incomplete.

**Student sessions:** remaining is computed in desktop `remainingSessionsFor` as total − used. Website sessions page does not expose used/remaining editors. No dedicated session validation endpoint.

**Schedule conflicts:** `ScheduleService` + Super Admin store merge can check conflicts; clients do not share one `createSchedule()` validator.

---

## 10. Behavior differences (highest impact)

1. **Teacher Workspace exists only on desktop.** Website has a staff list, not `/admin/teachers/:teacherId`.
2. **Parent CRUD is incomplete on website** vs dedicated parent APIs already used by desktop.
3. **Sessions:** changing remaining/used on desktop will not be possible on website until that editor exists; both persist through the same store once written.
4. **Attendance / progress / payments:** not first-class admin modules on both sides.
5. **Whole-document `putStore`:** two admins saving at once can clobber collections (`MergeStoreWrite` helps but clients still send large blobs).
6. **Validation:** `@hiraya/validation` is used on web public enrollment; desktop student forms and mobile enroll do not share one schema.
7. **`/admin` vs `/app` duplication** on the website itself — two UIs for the same store before desktop is even compared.
8. **Website `/admin` is not Super-Admin-only** in the layout.

---

## 11. Shared layer that already exists (do not invent a parallel tree)

The prompt’s `src/shared/api/*.js` layout is **not** this repo. Equivalent:

| Prompt idea | Actual location |
|-------------|-----------------|
| Shared API client | `packages/api/src/index.ts` |
| Types | `packages/types` |
| Validation | `packages/validation` (underused) |
| Permissions / nav | `packages/utils` (`allows`, `hklcNavForRole`, `isAdmin`) |
| Domain services | `backend/Hiraya.Shared/Services/*` |
| UI kit | `packages/ui` (web + desktop DOM); mobile has RN UI |

Phase 2 should **extend these packages**, not add a fourth copy under `src/shared/`.

---

## 12. Implementation order after this audit (do not skip)

1. **Done:** Scan + this audit + function matrix.  
2. **Next (Step 3):** Remove seed-password hash rewrite; gate `/admin` to Super Admin; keep desktop/mobile role rules.  
3. Shared API client completeness (resource methods instead of only `putStore` where race-prone).  
4. Unify auth/permissions (one matrix, API as authority).  
5. Unify students → parents → teacher workspace → sessions → calendar → tasks → attendance/progress → payments → announcements → dashboard.  
6. Loading/empty/error states; cross-client tests; security pass; production builds; remaining docs.

---

## 13. Success condition (not met yet)

Website Admin create/edit/delete/assign → same API → same MySQL → Desktop shows the same record → Mobile shows the permitted subset.

Today that is **true for the store blob when both clients refresh**, and **false for module coverage, CRUD completeness, teacher workspace, session editors, and website CMS**.

---

## Appendix — key files

- Web admin: `apps/web/app/admin/*`, `apps/web/components/admin/*`, `apps/web/lib/api.ts`
- Legacy web ops: `apps/web/app/app/*`
- Desktop: `apps/desktop/src/App.tsx`, `apps/desktop/src/pages/*`, `apps/desktop/src/lib/crud.ts`
- Mobile: `apps/mobile/src/store.tsx`, `apps/mobile/src/rbac.ts`
- API: `backend/Hiraya.Api/Program.cs`, `packages/api/src/index.ts`
- AuthZ: `backend/Hiraya.Shared/Services/StoreSanitizer.cs`, `PortalAuthService.cs`, `SeedData.cs`
- DB: `backend/Hiraya.Data/HirayaLearningCenterDbContext.cs`
