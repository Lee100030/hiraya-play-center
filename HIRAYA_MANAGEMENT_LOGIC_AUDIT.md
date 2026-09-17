# HIRAYA management logic audit

**Date:** 15 September 2026  
**Scope:** Phase 1 inspection only. No management UI rewrite in this pass.  
**Locked roles:** Super Administrator, Teacher, Parent. Children do not have accounts. Staff and Student logins are deactivated on API start.

Desktop (Electron) is the administration control center. Mobile (Expo) is for teachers and parents using the same MySQL-backed store. The website admin (`apps/web/app/admin`) mirrors most desktop lists.

---

## Architecture (do not replace)

| Layer | How records actually move |
| --- | --- |
| Primary API | `GET /api/store` and `PUT /api/store` — one document (`HirayaDatabase`) |
| Persistence | MySQL `hiraya_learning_center` via `EfHirayaRepository` (full-table replace per entity set) |
| Auth | `POST /api/auth/login`, header `X-Hiraya-Session` |
| Scoping | `StoreSanitizer.VisibleTo` / `MergeStoreWrite` |
| Teacher students | `FamilyAccess.AssignedStudentIdsForTeacher` (active enrollments where enrollment or class `teacherId` matches) |
| Parent children | `parent_students` + `Student.ParentId` (`FamilyAccess.EnsureLegacyLinks`) |

**Do not invent disconnected REST if the store already holds the entity.** Dedicated REST exists only where it already does (staff, parents, enrollment actions, modules, photos, website). There is **no** `GET/PUT /api/students/:id`. Student create/edit today is `PUT /api/store` with the same `studentId`. Keep that pattern unless a later phase adds thin REST wrappers around the same tables.

---

## Existing reusable components

| Component | Location | What it already does | Gap vs Phase 2 standard |
| --- | --- | --- | --- |
| `RecordTable` | `apps/desktop/src/components/RecordTable.tsx` | Search, status filter, pagination, header actions (right) | No checkboxes, no select-all, no selected count, no top-left CRUD bar |
| `EditorModal` | `apps/desktop/src/components/EditorModal.tsx` | Title, form, cancel, save, busy, error | No built-in success toast; duplicate-submit guarded by `busy` |
| `PageHeader` / `Toolbar` | `apps/desktop/src/components/PageHeader.tsx` | Title + right-side actions; search | CRUD buttons are not upper-left |
| `crud.ts` | `apps/desktop/src/lib/crud.ts` | `studentRecord`, `withParentLink`, parent/teacher options | No session remaining helper on desktop list |
| `AdminTable` / `AdminModal` | `apps/web/components/admin/` | Same list+modal idea as desktop | Same checkbox gap |
| Mobile store | `apps/mobile/src/store.tsx` | `api.getStore()` / `putStore` | Heuristic remaining sessions if no package |

---

## Desktop routes (view state, not URLs)

Electron has **no React Router**. `App.tsx` holds `view: ViewId`. `WorkspacePages.tsx` switches pages.

Management nav (`packages/utils/src/hklcOperations.ts` → `HKLC_NAV_GROUPS`): Student, Parent, Teachers, Modules, Schedule, Tasks, Announcements, Sessions. Enrollment is a separate group. Programs and Classes sit under Programs.

| View | Page | CRUD today | Persistence |
| --- | --- | --- | --- |
| `students` | `StudentsPage.tsx` | Add / row Edit / Archive / Delete | PUT store |
| `parents` | `ParentsPage.tsx` | Add / row Edit / Link child / Deactivate | REST `/api/admin/parents…` |
| `teachers` | `TeachersPage.tsx` | Add / row Edit / Deactivate / Delete | REST `/api/staff` |
| `modules` | `ModulesPage.tsx` | Add / Edit / Archive (super admin) | PUT store |
| `calendar` | `SchedulesManagePage` | Add / Edit (status cancel) | PUT store `schedules` |
| `tasks` | `TasksManagePage` | Add / Edit | PUT store `staffTasks` |
| `announcements` | `AnnouncementsManagePage` | Add / Edit | PUT store `news` |
| `sessions` | `SessionsManagePage` | Add package / Edit / Complete session | PUT store packages + history |
| `enrollment` | `EnrollmentPage.tsx` | Approve / reject / cancel / seats | REST + PUT store |
| `attendance`, `progress`, `payments`, `notifications` | Read-only tables | View | GET store |
| `reports`, `settings` | Panels | Limited | Mixed |

**Broken / dead:** After students remap, a later `view === 'monitoring'` table in `WorkspacePages.tsx` never runs.

**Missing routes vs spec:** no student details page, no `/admin/teachers/:teacherId` Teacher Workspace (desktop is view-state; website has no `[teacherId]` either).

---

## API inventory

### Document store

- `GET /api/store` — sanitized copy for the actor
- `PUT /api/store` — `MergeStoreWrite` then save

### Dedicated REST (keep)

- Auth: `/api/auth/login`, `/logout`, `/password`, `/me`, `/activate`
- Staff: `PUT /api/staff`, archive/restore/active/delete/specialties
- Parents: `POST /api/admin/parents`, `PUT …/{parentId}`, `POST …/active`, `POST/DELETE …/children`
- Parent portal reads: `/api/parent/profile`, `/children`, attendance/progress/schedule/payments — **parent POST/DELETE children is Forbidden**
- Enrollment: approve / reject / cancel
- Modules, photos, website CMS, public site/enrollment, health, hub

### Spec endpoints that do **not** exist

`/api/students`, `/api/students/:id`, `/api/students/:id/sessions`, `/api/teachers/:id/*`, `/api/tasks/:id`, `/api/comments`, `/api/attendance/:id` as standalone resources.

**Recommendation:** implement Phase 3–17 against `PUT /api/store` (and existing parent/staff REST). Add resource URLs only if a client cannot send the document safely.

---

## Database relationships

| Need | Status |
| --- | --- |
| Student ↔ parent | `students.parent_id` + `parent_students` (required on admin save) |
| Student ↔ class/teacher | `enrollments` (`studentId`, `classId`, `programId`, `teacherId`, `status`) |
| Class ↔ teacher | `classes.teacherId` |
| Session remaining | `session_packages` (`total`, `used`, `remaining`); history in `session_history` |
| Tasks | `staff_tasks` (`teacherIds` comma list, student/class optional) |
| Announcements | `announcements` with audience fields |
| Notifications | `notifications` (`relatedRecordId`, `readAt`) |
| Schedules | `schedules` including `ProgramId` |
| Teacher comments | **No table / model** |
| Admin notes (teacher workspace) | **No table / model** (only `LeaveRequest.AdminNote`, `Student.Notes`) |
| Dedicated to-do list | **No** — overlap with `staffTasks` + `schedules.kind = teacherTask` |
| Teacher (employee) attendance | `attendance` with `AttendanceKinds.Employee` — no dedicated CRUD UI |

Workflow schema is applied by `DatabaseInitializer.EnsureWorkflowSchemaAsync` and migration `20260915123000_WorkflowOperations`.

---

## Permissions (API is source of truth)

| Actor | Write | Read |
| --- | --- | --- |
| Super Admin | Full store after conflict + parent-required checks; `WorkflowOps.AfterAdminSave` notifies | Full public copy |
| Teacher | Assigned-student attendance/progress; own alerts; own teacher-task schedules; assigned staff tasks; session consume on new present/late | Assigned students/classes/schedules/tasks/packages/news |
| Parent | Own alerts mark-read only | Linked children, schedules, packages, published progress, payments, matching news |
| Parent wipe students | PUT may return 200; sanitizer keeps current students | — |

Frontend role labels must not grant extra rights. `ProductAccounts.MaySignIn` is SuperAdmin / Teacher / Parent only.

---

## Module-by-module: existing vs missing

### Student Management

**Existing**

- Create / edit modal (`EditorModal`), search, status filter, persist via PUT store
- Required parent on create
- Archive toggles `status`; delete confirms and strips enrollments + parent links
- Enrollment approve can create student + parent link
- Round-trip tests proved store persistence (not hardcoded lists)

**Missing / incomplete**

- Top-left `[+ Add Student] [Edit] [Archive] [Delete] [Refresh]`
- Row checkboxes, select-all, selected counter, indeterminate, bulk archive
- Columns: student number (no field; id is `studentId`), program, class, assigned teacher, sessions remaining, enrollment status (table shows Name, Parent, Slot, Status, Age)
- Student details page with tabs (Overview, Parents, Program/Class, Teacher, Sessions, Schedule, Attendance, Progress, Payments, Enrollment History, Notes)
- Assign Parent / Teacher / Program / Class toolbar actions
- Archive has **no confirmation**
- Edit form `onSubmit` reads address, contact, notes but the modal **does not render those fields**
- Program stored as **name string** on `Student.Program`, not `programId`
- Class/teacher assignment is enrollment-based, not edited on the student form
- Delete is hard-delete (spec prefers archive unless safe)

### Student sessions

**Existing**

- Global Sessions management: packages, remaining = total − used (`WorkflowOps.RecalculatePackage`), complete-one, history
- Parent mobile `/sessions` shows packages
- Teacher attendance can consume sessions
- Unit test: remaining cannot go negative

**Missing**

- Sessions inside student details
- `[Edit Sessions]` on a single student
- Admin notes on package (no field)
- Desktop student table remaining column
- Fallback `remainingForStudent` on mobile can still **guess** from package text if no `sessionPackages` row

### Parent Management

**Existing**

- REST CRUD, row Edit, Link child modal, unlink in edit, activate/deactivate with confirm
- Parent mobile only sees linked children (API sanitizer + selectors)
- Malicious parent PUT cannot wipe students

**Missing / incomplete**

- Spec wants **fewer** top toolbar buttons — already mostly row-based; still has “Add parent” in header
- No row Delete/Archive (deactivate only)
- No table checkboxes / bulk archive
- Link Child exists; needs bulk-select UX polish only after checkboxes

### Teacher Management

**Existing**

- REST save/deactivate/delete, edit modal (`StaffForm`)
- Assigned students derived from enrollments/classes
- Center-wide Task / Schedule / Announcement pages (not per-teacher workspace)

**Missing (large)**

- Teacher Workspace page (all Phase 9–17 tabs)
- Row actions: View Workspace, Assign Task, Assign Student, Assign Schedule
- Teacher comments entity + visibility
- Admin notes entity (hidden from mobile unless marked visible)
- Monthly calendar UI (desktop schedule list is not a month grid; mobile is a 7-day strip)
- Unified to-do (tasks + reminders)
- Teacher attendance CRUD in a workspace (employee attendance model exists)

### Attendance / Progress / Notes / Calendar / Announcements / Notifications

| Area | Desktop | Mobile | API |
| --- | --- | --- | --- |
| Student attendance | Mostly **view** table | Parent/teacher **view** list | Store + teacher merge on PUT |
| Progress | View | Parent published reports; teacher modules tab | Store `reports` |
| Calendar | Schedule **CRUD** list (admin) | 7-day view; teacher can add personal `teacherTask` | Store `schedules` |
| Announcements | CRUD | List by audience | Store `news` |
| Notifications | View | Alerts; mark-read PUT | Store `alerts` |
| Comments | Missing | Missing | Missing |
| Admin notes | Missing as product | Missing | Missing |

### Website admin

Parallel pages under `apps/web/app/admin/*` (students, parents, staff, tasks, sessions, …). Same store PUT. Student “details” is a **view modal**, not a tabbed page. No teacher workspace route. No row checkboxes.

---

## Fake or static data (keep design; fix later if it misleads)

| Location | Issue |
| --- | --- |
| Desktop login | Default username `admin` |
| Dashboard | `hklcTaskBoards` static workbook checklists |
| Sessions new package | Default total **10** |
| Teachers form | Email placeholder `cady@hiraya.local` |
| Mobile `remainingForStudent` | Heuristic if no package |
| Mobile `modules.tsx` | Progress % from keywords |
| Mobile preview | `notes === 'mobile-preview'` empty store |
| Workspace playgroup/ABA filters | Empty filter falls back to **all** schedules |

Management lists themselves bind to live API data, not mock arrays.

---

## Duplicate modules

- Programs vs ABA/Playgroup/Tutorial **desks**: extra desks were removed from Management nav; leftover filter views may still exist in `WorkspacePages`.
- Tasks vs teacher calendar `teacherTask` vs future To-Do: three concepts, one needed product (admin `staffTasks` + optional personal reminders).
- Desktop `RecordTable` vs web `AdminTable`: same job, two implementations — extend both or extract shared selection later.
- Student `program` name vs `enrollments.programId` vs session `programId`.

---

## Round-trip already proven (do not regress)

`packages/utils/workflow-roundtrip.test.mjs` (25/25) against live API:

- Admin schedule + task + announcement + session package persist
- Teacher sees assigned schedule/task/news/student; completes task with remarks
- Admin sees completion + notification
- Remaining sessions 8 (not hardcoded 10) on parent GET
- Parent cannot wipe students

---

## Recommended implementation order (after this audit)

Reuse existing modals/tables/API. Do not add `/api/students/:id` unless required.

1. **Phase 2** — Extend `RecordTable` (desktop) and `AdminTable` (web): top-left CRUD toolbar, checkboxes, select-all, counter, indeterminate, edit-one-only message, confirm archive/delete, refresh callback.
2. **Phase 3–5** — Student table columns + details view (in-app panel or modal tabs first; dedicated route if needed) + session edit using existing `sessionPackages`.
3. **Phase 6** — Parent/teacher/program/class assignment via enrollments + `parentStudents` (already in DB).
4. **Phase 7** — Parent row Delete/Archive + checkboxes; keep Link Child REST.
5. **Phase 8–17** — Teacher Workspace as a desktop `view` (e.g. `teachers` + selected `teacherId`), not a fake second API. Add comment/note models only when that workspace lands.
6. **Phase 18** — Wire teacher assigned-student list and month calendar on mobile; keep PUT store for task complete.
7. **Phase 19–22** — Only add REST that wraps existing tables; update reports and tests.

---

## Phase 1 decision

Inspection is complete. Existing design, authentication, MySQL store, and workflow tables should stay. The gap is **management UX and missing teacher-workspace domain** (comments/notes/month grid), not a greenfield API.

Next code change, when authorized: Phase 2 global CRUD pattern on desktop `RecordTable`, starting with Student Management so later pages share one selection component.
