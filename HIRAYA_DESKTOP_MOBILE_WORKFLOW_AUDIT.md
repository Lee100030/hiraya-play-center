# HIRAYA desktop–mobile workflow audit

**Phase:** 1 — Inspect the current project and documentation  
**Date:** 15 September 2026  
**Scope:** Electron desktop (`apps/desktop`), Next.js website (`apps/web`), Expo mobile (`apps/mobile`), ASP.NET API (`backend/Hiraya.Api`), MySQL (`hiraya_learning_center`), shared types/utils/api packages.  
**Rule:** This document is an inspection. No product rewrite was done in this phase.

---

## 1. What already exists (shared backbone)

Desktop, website, and mobile **already share one API and one database** when they are configured correctly.

```text
Desktop (Electron + Vite :5173)
Website (Next.js :3000)
Mobile (Expo :8081)
        ↓  X-Hiraya-Session
Hiraya.Api (:5188)
        ↓
MySQL  hiraya_learning_center
```

| Layer | Evidence |
| --- | --- |
| Auth | `POST /api/auth/login` issues a session token. All three clients send `X-Hiraya-Session`. |
| Document store | `GET /api/store` / `PUT /api/store` load and save the full `HirayaDatabase` JSON-shaped document, then EF writes MySQL tables. |
| Scoped reads | `StoreSanitizer.VisibleTo` strips records for teacher and parent on `GET /api/store`. |
| Dedicated REST | Staff (`/api/staff*`), parents (`/api/admin/parents*`), parent portal (`/api/parent/*`), enrollment actions, learning modules, website CMS, profile photos. |
| Sign-in roles (locked 15 Sep 2026) | Super Admin, Teacher, Parent. Extra admin/staff/student accounts are deactivated on API start (`ProductAccounts`). Children do not have accounts. |

Seed logins (development): `admin` / `Admin123`, `teacher` / `Teacher123`, `parent` / `Parent123`.

**There is no separate mobile database.** Mobile `StoreProvider` calls `api.getStore()`. A leftover `user.notes === 'mobile-preview'` path returns an empty store (old demo parent). That is not live center data.

---

## 2. Application map

### Electron desktop (`apps/desktop`)

Intended control center. Super Admin sees the full store. Teachers can sign in; parents technically can, but the product rule is parents use website/Expo.

**Management group (current nav):** Student, Parent, Teacher, Module.

**Also still in the sidebar** (workbook-shaped, not the Phase 3 target): Enrollment, Programs (1/3/10 mo), Preschool & classes, Playgroup, ABA desk, Tutorial attendance, attendance, teacher schedule, day off, calendar, holidays, compliance, progress, grades, evaluations, payments, finance, uniforms, marketing, reports, notifications, settings.

**Write paths that already persist via API + MySQL:**

| Screen | Mechanism |
| --- | --- |
| Teachers | REST `PUT /api/staff`, activate, delete |
| Parents | REST `/api/admin/parents` + child link/unlink |
| Students | `PUT /api/store` (parent required) |
| Programs, classes, modules, enrollment seats | `PUT /api/store` |
| Enrollment approve/reject/cancel | REST `/api/enrollment/applications/{id}/…` |

**Read-only (or display-only) on desktop today:** attendance, progress, payments, calendar/schedules, notifications, playgroup, ABA, tutorial, teacher schedule, day off, holidays, monitoring extras. `WorkspacePages.tsx` renders `RecordTable` with no create/edit for those views.

### Website (`apps/web`)

Third client on the same store. Super Admin uses `/admin/*`. Teachers/parents use `/app/*`. Public site uses `/api/public/*`.

Admin Management nav: Student, Parent, Teacher, Module. Messages page writes `alerts` with `recipientId: 'everyone'` (not a real announcement/task model).

### Mobile (`apps/mobile`)

Expo Router. **Teachers and parents only** (`canUseMobileApp`). Super Admin is blocked at login.

| Tab / screen | Who | Behavior |
| --- | --- | --- |
| Home | Both | Dashboard from scoped store: schedule snippet, announcements, remaining-session *heuristic*, alerts |
| Schedule / Calendar | Both | Day strip (7 days). Teacher can **create personal** `schedules` rows with `kind: teacherTask` via `PUT /api/store`. Parents view child’s class times. |
| Progress / Modules | Parent / Teacher | Parent: progress reports. Teacher: learning modules list |
| Alerts / News | Both | Notifications + published `news` |
| Attendance, payments, student/[id], announcements, enroll | Stack routes | Mostly **view**. Attendance screen does not record attendance. Parent enroll is a public application flow. |

Mobile does **not** hardcode a teacher ID at login. It uses the authenticated user. Filtering is `user.userId` plus sanitized store.

---

## 3. Database tables (EF)

Source: `HirayaLearningCenterDbContext`.

| Table | Entity | Maps to workflow need |
| --- | --- | --- |
| `users` | HirayaUser | Accounts + roles |
| `roles`, `role_permissions` | AppRole, RolePermission | Permission catalog (partially used) |
| `teachers` | TeacherProfile | Specialty, employee code — not assignment lists |
| `students` | Student | Includes `ParentId` |
| `parent_students` | ParentStudent | Official parent↔child links |
| `programs`, `classes`, `rooms` | Program / Class / Room | Class has **one** `TeacherId` |
| `enrollments` | Enrollment | Student + class + optional `TeacherId` |
| `enrollment_applications` | EnrollmentApplication | Public apply / office review |
| `schedules` | Schedule | Class sessions **and** teacher tasks (`kind = teacherTask`) |
| `teacher_work_shifts`, `teacher_duties` | Shifts / duties | Workbook calendar, not full assignment UI |
| `announcements` | NewsItem | Center news (no audience, priority, expiry) |
| `notifications` | SystemAlert | Inbox (`alertId`, `recipientId`, `read`) |
| `attendance`, `progress_records`, `payments` | Domain rows | Exist; session decrement **not** wired |
| `student_ops` | StudentOpsRecord | Slot, **package as free text**, payment flags |
| `learning_modules` (+ versions) | LearningModule | Curriculum files/status |
| `leave_requests`, `account_invitations`, `audit_logs`, `system_settings`, `website_gallery` | Supporting | |

**Missing tables vs Phase 8–10 spec:**

- No `session_packages` / `session_history`
- No `tasks` table (tasks are schedule rows)
- No announcement audience / expiration columns
- No `relatedRecordId` / `readAt` on notifications
- Schedule has a single `studentId`, not a student list

---

## 4. API surface

### Used by desktop + mobile today

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/store` | Role-sanitized document |
| PUT | `/api/store` | Super Admin can replace most collections. Teachers may overlay attendance, progress, own alerts, own teacherTask schedules. Parents **cannot** PUT. |
| POST | `/api/auth/login`, logout, password, me | Shared |
| PUT/POST | `/api/staff*` | Teacher accounts |
| POST/PUT/DELETE | `/api/admin/parents*` | Parent CRUD + child links (admin only). Parent POST/DELETE children is **forbidden**. |
| GET | `/api/parent/*` | Family portal reads (used more by website than Expo; Expo uses store) |
| POST | `/api/enrollment/applications/{id}/approve\|reject\|cancel` | Office |
| GET/POST | `/api/modules*` | Module REST exists; desktop/web currently save modules through the store |
| GET | `/api/health`, `/api/hub` | Ops |

### Domain services that exist in C# but have **no HTTP maps**

These are registered in DI and used internally or leftover from the MAUI era:

- `ScheduleService` (save, cancel, **conflict detection**, `SaveTeacherTaskAsync`)
- `AttendanceService`, `ProgressService`, `PaymentService`, `ProgramService`, `ClassService`
- `NotificationService` (Push, published news, send-to-audience) — not exposed as `/api/notifications` or `/api/announcements`

Desktop schedule CRUD cannot call `ScheduleService` until routes exist **or** store writes are given a real editor that still goes through conflict checks.

---

## 5. Role and privacy (code vs this workflow spec)

**Locked product rule (do not silently revert):** one Super Administrator; everyone else is Teacher or Parent; no Staff/Admin/Student logins; children use a parent account.

The workflow brief still mentions Administrator, authorized staff, and optional student mobile. That **conflicts** with the lock in `HIRAYA_ROLE_PERMISSION_MATRIX.md` and `ProductAccounts`. Phase 2 must keep the lock unless the owner changes it.

| Rule in this brief | Current code |
| --- | --- |
| Backend verifies permissions | Partially. `PUT /api/store` for Super Admin is a full document replace (after parent-link checks). Teacher merge is scoped. Parent cannot write the store. Staff merge still exists in sanitizer though staff cannot sign in. |
| Teacher sees only assigned students | `FamilyAccess.AssignedStudentIdsForTeacher`: students on enrollments where `Enrollment.TeacherId` or `Class.TeacherId` matches. |
| Parent sees only linked children | `parent_students` + `Student.ParentId` backfill. |
| Teacher cannot see all parents | Teacher store: users list is **only the teacher**. Payments and studentOps stripped. |
| Parent cannot edit schedules/progress | `MergeStoreWrite` throws for family roles. |
| Teacher schedule isolation | **Gap:** `ForTeacher` keeps schedules where `classId` is in the teacher’s classes **or** `studentId` is assigned. It does **not** keep `teacherId == actor` for empty class/student (typical `teacherTask`). Personal tasks may vanish on refresh. Class sessions without `classId`/`studentId` also drop. |
| Announcement audience | **Gap:** `NewsItem` has no audience. Mobile shows all published `news`. |
| Parent alerts | **Gap:** `ForFamily` does not filter `alerts` or `news`. Parents may receive a full news list and unscoped alerts if those rows exist in the copy. |

Frontend RBAC (`apps/mobile/src/rbac.ts`, `PermissionCatalog`) hides buttons; store sanitizer is the real gate for GET.

---

## 6. Workflow feature gap matrix

Legend: **Live** = UI + API + MySQL; **Partial** = some of those; **Missing** = required for this brief.

| Workflow | Desktop admin | Mobile teacher | Mobile parent | Shared persistence |
| --- | --- | --- | --- | --- |
| Teacher CRUD | Live (REST) | Profile only | No | Yes |
| Assign teacher → class | Live (`classes.teacherId`) | View class name if in store | Child’s class if enrolled | Yes |
| Assign teacher → many students | Partial (via enrollment/class, no multi-select on Teachers page) | Sees assigned students from sanitizer | N/A | Yes if enrollment exists |
| Assign teacher → program | Partial (program is on class, not teacher profile) | View | View child’s program string | Indirect |
| Schedule CRUD + conflicts | Service exists; **desktop calendar is read-only**; conflicts not used by UI | Week list; teacher self-tasks via store PUT | Child day list | Schedules table yes; admin create **no UI** |
| Task assignment (admin → teacher) | **Missing** (no Task Management; tasks are teacher-created calendar notes) | Create own task; cannot complete Assigned/In Progress/Submitted | Must not see tasks | `schedules.kind=teacherTask` only; no completion, remarks, due date, priority |
| Task complete → notify admin | **Missing** | No status workflow | N/A | — |
| Parent CRUD + link children | Live | No | Cannot self-link (API forbidden) | Yes |
| Announcements CRUD + audience | **Missing** on desktop (notifications table is alerts). Website messages ≠ news. Seed/CMS news may appear on mobile | View published news | View published news | `announcements` table exists; no publish UI in desktop Management |
| Notifications | Desktop list read-only | Alerts tab; mark-read unclear / swipe hide | Same | Alerts table; no related record; admin→user push not wired from desktop assign actions |
| Remaining sessions | Monitoring shows `studentOps.package` **text** | Heuristic `remainingForStudent` parses digits from package/slot or counts upcoming schedules | Same heuristic | **No package totals/used columns**; attendance does not increment used sessions |
| Attendance record | Read-only table | View list, no submit UI | View | Table exists; `AttendanceService` unused by HTTP |
| Progress submit | Read-only | Parent view; teacher modules tab is not progress write | View published (sanitizer) | Table exists; teacher merge **would** allow progress PUT if UI existed |
| Payments | Read-only | Hidden | View if in store | Table exists |
| Enrollment updates | Live approve/reject | No | Apply + see child status if in store | Yes |

---

## 7. Hardcoded / duplicated / leftover

| Item | Where | Risk |
| --- | --- | --- |
| Workbook desks (ABA, playgroup, tutorial) | `hklcOperations.ts` + desktop `WorkspacePages` filters by title keywords | Duplicate nav, not separate apps, but **not** program records only |
| Teacher tasks as schedules | Mobile `schedule.tsx`, `ScheduleKinds.TeacherTask` | Collides with admin-assigned task model in this brief |
| Remaining sessions regex | `remainingForStudent` | Can display invented counts (e.g. parse “10” from package text) — **do not treat as real remaining sessions** |
| `mobile-preview` empty store | Mobile `store.tsx` | Fake empty dataset if that user note is set |
| `CenterOperationsCatalog` seed schedules | Backend seed | Demo ABA/task rows, not live admin assignments |
| Website vs desktop vs mobile UIs | Three clients | Same store, different CRUD completeness |
| Domain services vs store PUT | Backend | Two ways to mutate; UIs mostly use the document PUT |

---

## 8. Existing documentation (do not duplicate blindly)

| File | Status vs this audit |
| --- | --- |
| `HIRAYA_ROLE_PERMISSION_MATRIX.md` | Locked roles; still uses older “Monitoring” names |
| `HIRAYA_CRUD_IMPLEMENTATION_REPORT.md` | All **Pending** (not end-to-end tested) |
| `HIRAYA_REQUIREMENTS_BLOCKERS.md` | Google Sheet incomplete; delete-vs-archive unresolved |
| `HIRAYA_OPERATIONS_AUDIT.md` / system / critical issues | Older snapshots; some items already coded |

Phase 16 files (`HIRAYA_DESKTOP_MOBILE_WORKFLOW.md`, teacher/parent/task/schedule/session/announcement workflow docs, test report) **do not exist yet**. They should be written after implementation, not before inspection.

---

## 9. Tests

No Vitest, Jest, Playwright, or API test projects were found in the repo (`*.test.*` / `*.spec.*` / package.json test scripts absent). Phase 15 is greenfield.

Manual path from this brief (admin schedule → teacher mobile) **cannot pass today** because desktop has no schedule create UI and teacher GET may drop teacher-only rows.

---

## 10. Recommended names vs current names (verify before Phase 3)

Owner already asked for Management = Student, Parent, Teacher, Module. This brief adds Schedule, Task, Announcement, Session.

| Proposed (this brief) | Current | Notes |
| --- | --- | --- |
| Student Management | Student management | Keep |
| Parent Management | Parent management | Keep |
| Teacher Management | Teachers Management | Keep; extend assignments |
| Module Management | Module management | Curriculum modules — **not** session packages |
| Schedule Management | HIRAYA calendar / playgroup / teacher schedule (read-only) | New write UI; collapse extra desks |
| Task Management | Teacher self-tasks on mobile only | New entity or first-class schedule kind + statuses |
| Announcement Management | `news` table; website messages mix alerts | New desktop module; do not confuse with inbox alerts |
| Session Management | `studentOps.package` string + heuristic | New package model |

ABA / Playgroup / Preschool / Tutorial should stay as **program (and class) records**, not sidebar apps — matches this brief and the owner’s earlier instruction.

---

## 11. What is safe to reuse in later phases

1. One store + MySQL + session auth.
2. Teacher/parent sanitizer and `FamilyAccess` student IDs.
3. Teacher and parent REST CRUD.
4. Class `teacherId` + enrollment as the assignment spine (extend, don’t invent a parallel roster unless needed).
5. `ScheduleService.DetectConflicts` and `SaveAsync` — **expose over HTTP** or call from store merge for Super Admin.
6. `NotificationService.Push` — call from assign/publish/complete actions.
7. `NewsItem` — extend columns (audience, priority, expiry) rather than a second news table if possible.
8. Mobile tabs Home / Schedule / Alerts — extend; add Tasks and Sessions screens rather than a second app.

---

## 12. Phase 1 conclusions (do not claim sync)

Desktop and mobile **can** share records through `/api/store` and MySQL. They are **not** a complete synchronized workflow yet:

- Admin cannot assign schedules or tasks from desktop Management.
- Teacher cannot complete an admin-assigned task with status history.
- Parent remaining sessions are **not** a real package ledger.
- Announcements lack targeting; desktop has no announcement CRUD.
- Several C# services are unused by HTTP.
- No automated tests prove round-trip.

**Do not claim desktop/mobile synchronization until Phase 14 tests pass against a running API + MySQL.**

---

## Phase report

```text
Phase: 1 — Inspect the current project and documentation
Status: Complete (inspection only; no design rewrite)
Files changed: HIRAYA_DESKTOP_MOBILE_WORKFLOW_AUDIT.md (this file)
Database changes: None
API changes: None
Desktop changes: None
Mobile changes: None
Role/permission changes: None (documented conflict: brief vs locked Super Admin / Teacher / Parent)
CRUD operations completed: None (inventory only)
Tests performed: Static code and documentation search (no live assign→mobile round-trip)
Test result: Shared API/DB confirmed in code; required workflows incomplete (see gap matrix)
Remaining issues: See sections 5–9
Next phase: 2 — Define application responsibilities in docs, then 3 — Management nav (Schedule, Task, Announcement, Session) without extra ABA/playgroup desks, keeping locked roles
```
