# HIRAYA Operations Audit — Phase 1

**Date:** 15 September 2026  
**Mode:** Inspection only. No sidebar redesign, no module deletion, no schema rewrite in this phase.  
**Sources:** repository code, `packages/utils/src/hklcOperations.ts`, `README.md`, `HIRAYA_CRITICAL_ISSUES_AUDIT.md`, prior visual scan of *Hiraya Kids Learning Center.xlsx* (21 workbook tabs). Live Google Sheet export was not readable in this session (see `HIRAYA_REQUIREMENTS_BLOCKERS.md`).

---

## 1. Actual existing modules

### Persistence

The live school record is one MySQL-backed document `HirayaDatabase` (`backend/Hiraya.Shared/Models/HirayaModels.cs`), loaded with `GET /api/store` and saved with `PUT /api/store`. Extra REST exists for auth, staff, parents, enrollment approve/reject/cancel, learning modules, profile photos, and website CMS. There is no `GET /api/students/:id` collection API.

### Desktop (`apps/desktop`)

Unique working pages: Dashboard, Teachers, Parents, Students, Programs, Classes, Enrollment.

`WorkspacePages.tsx` then maps remaining nav IDs onto existing store lists (often **read-only** RecordTable).

### Website (`apps/web`)

| Area | Routes that exist |
| --- | --- |
| Public | `/`, `/about`, `/programs`, `/programs/[id]`, `/contact`, enrollment |
| Admin | `/admin`, students, parents, enrollments, programs, classes, schedules, staff, payments, messages, reports, website, settings, profile |
| App workspace | `/app` plus students, parents, staff, programs, classes, enrollment, schedules, calendar, attendance, progress, payments, modules, notifications, announcements, website, settings, profile, reports, users, roles, audit, children |
| Family | `/portal/family` |

Several admin pages **re-export** `/app` pages (classes, payments, schedules, parents, website).

### Mobile (`apps/mobile`)

Expo Go only. Tabs: Home, Schedule, Progress (teachers: Modules), Alerts, Profile. Extra screens: attendance (read-only), payments (parents), enroll, modules, student `[id]`, programs, announcements, password. Admins/staff are **blocked** from this app.

### Entities that exist in the store

Users (all roles), TeacherProfile, Student, StudentOpsRecord, ParentStudent, LearningProgram, LearningClass, Enrollment, EnrollmentApplication, AttendanceRecord, ProgressReport, Schedule, TeacherWorkShift, TeacherDuty, LeaveRequest, CenterHoliday, Payment, SystemAlert (notifications), LearningModule, News, AuditLog, Settings.

There is **no separate Parent table**. Parents are `HirayaUser` with `role = parent`.

---

## 2. Duplicate modules

| Labels in the UI | Same data |
| --- | --- |
| Student sheets + Student monitoring + Compliance + Uniforms | `students` (+ `studentOps`) |
| Operational attendance + Tutorial attendance + ABA desk | `attendance` (desktop filters by keyword; empty filter shows **all** rows) |
| Playgroup schedule + HIRAYA calendar + School/admin calendar + Teachers’ schedule (web) | `schedules` (and sometimes `centerHolidays` / `teacherWorkShifts` on desktop only) |
| Milestones & coaching + Grades & certificates | `reports` (progress) |
| Collections + Finance & payroll + Evaluations (desktop) | `payments` — evaluations is the **wrong** collection |
| Day-off (web nav) | `/admin/staff`, not `leaveRequests` |
| Admin vs `/app` students, staff, programs, enrollments | Two UIs for the same store |

`hklcNavForRole` plus `apps/web/lib/nav.ts` `HREF` map **collapses** many HKLC labels onto one href; the first label wins and the rest are hidden.

---

## 3. Unused modules

- `/app/users`, `/app/roles`, `/app/audit` exist as pages and are not in AdminShell.
- `/app/calendar` is separate from `/admin/schedules`.
- Learning module **REST** (`/api/modules`) is unused by desktop/web/mobile UIs (pages only list `store.learningModules`).
- Uniform inventory / compliance as **stock SKU** tracking is not implemented (only student ID/nametag/lace flags on `StudentOps`).
- Marketing/posting is `news` or the public website CMS, not a weekly posting workbook.

---

## 4. Placeholder modules

Desktop views with no Add/Edit/Delete: monitoring, attendance, tutorial, aba, progress, grades, payments, finance, evaluations, calendar, playgroup, holidays, teacherSchedule, dayOff, notifications, modules, marketing, compliance, uniforms.

If tutorial/ABA/playgroup keyword filters match nothing, those desks show the **entire** attendance or schedule list, so they look like dedicated operations and are not.

AdminShell labels (“Programs 1/3/10 mo”, “Preschool & classes”, “Playgroup & calendar”) are workbook names on generic program/class/schedule pages.

---

## 5. Modules that are only visual

- Desktop dashboard **task boards** (`hklcTaskBoards`): static HKLC Structure role text, not live task rows.
- ABA “payments” column: global payment count, not per-student ABA billing.
- Evaluations & coaching forms: no form entities; desktop shows payments.
- Settings on desktop: signed-in account fields, not center settings.

---

## 6. Modules with working database logic

Connected to MySQL through `/api/store` and dedicated APIs:

| Module | What works |
| --- | --- |
| Teachers / staff | REST create/update/archive/delete (desktop). Web staff: save + deactivate; delete weaker. |
| Students | PUT store create/update/archive/delete (desktop + admin). `/app` students: no delete. |
| Parents | REST create/update/link/unlink/active (desktop). Web parents: create + unlink mainly. |
| Programs | PUT store C/U/archive/delete (desktop + admin). |
| Classes | PUT store C/U/archive/delete (desktop). Web: C/U, no delete. |
| Enrollment applications | REST apply / approve / reject / cancel. Desktop also writes class seats. |
| Public enrollment | POST `/api/public/enrollment`. |
| Web schedules | PUT store create/update (no delete). |
| Web attendance | PUT store **create only**. |
| Web payments | PUT store **create only**. |
| Auth | Login, `GET /api/auth/me`, logout, password. |
| Store visibility | `StoreSanitizer.VisibleTo` + `MergeStoreWrite` by role. |

Dashboard counts on desktop, web admin, `/app`, and mobile home use **loaded store lengths**, not hardcoded “48 students”.

---

## 7. Modules with fake or static data

- First empty database is seeded (`SeedData` + `CenterOperationsCatalog`): demo students, Playgroup/ABA/Tutorial programs, `stu_aki` / extra teachers. After first run that **is** MySQL data, not a client fake store.
- Seed password aliases: `admin`/`Admin123`, `teacher`/`Teacher123`, etc. (`packages/utils`).
- HKLC Structure task lists on the dashboard are static copy.
- Web admin “New Enrollments” can fall back to **all** applications if this month’s count is 0 (`apps/web/app/admin/page.tsx`).

Clients after login call `getStore()`. They do not keep a parallel in-memory school.

---

## 8. Current role permissions

**Roles in code:** `super_admin`, `admin`, `teacher`, `staff`, `parent`, `student`.  
Thesis wording Super Administrator / Administrator / Teacher / Parent maps to the first four **except Staff**, which is a real fifth role.

Default allows (`packages/utils` `defaultAllows` + `PermissionCatalog.cs`):

| Role | Default |
| --- | --- |
| Super Admin | All |
| Admin | All except `roles.manage` |
| Teacher | View students/teachers, manage attendance & progress, view reports & modules |
| Staff | View students/teachers, manage attendance & payments, view reports |
| Parent / Student | View students, reports, modules |

HKLC nav (`hklcOperations.ts`): CLASSROOM = admins+staff+teacher; OFFICE = admins+staff; family only calendar, payments, notifications from that map (website family nav is a separate list).

C# `Navigation` helpers further restrict writes (e.g. payments not for teachers; student **manage** SuperAdmin/Admin).

**Gaps vs thesis:**

- Teacher is **not** limited to assigned students on `/api/store` GET (sanitizer scopes family more tightly than teachers).
- Parent child access is intended via `ParentId` + `ParentStudent`; must be verified on every parent portal route (exists on `/api/parent/*`).
- Frontend hiding is **not** enough; store PUT still allows admins to replace the document. Teachers may overlay attendance/progress/leave/shifts only.
- Users cannot change their own role in the login form; role comes from the API user record. Store PUT by admin can still change roles in the document.

Mobile: teachers and parents only.

---

## 9. Current relationships

```text
HirayaUser (parent)
  └── ParentStudent (parentId, studentId, relationship)
        └── Student (also Student.ParentId — single primary guardian)

Student
  ├── Program is a STRING name, not programId
  ├── No classId / teacherId on Student
  ├── Enrollment (studentId, classId, programId, teacherId)
  ├── Attendance (studentId, classId)
  ├── ProgressReport (studentId, teacherId, classId)
  ├── Payment (studentId, enrollmentId)
  ├── Schedule optional studentId
  └── StudentOps 1:1 (slot, package, payment flags, ID/nametag)

HirayaUser (teacher) + TeacherProfile
  ├── LearningClass.TeacherId (one teacher per class)
  ├── Enrollment.TeacherId
  ├── Schedule.TeacherId
  ├── Attendance.RecordedBy / employee records
  └── ProgressReport.TeacherId

LearningProgram
  └── LearningClass.ProgramId
        └── Enrollment.ClassId
              └── Student via Enrollment.StudentId
```

**Missing vs thesis model:** student.number, student.classId, student.teacherId, student.programId as FKs. Assignment today is **Enrollment + Class**, not fields on Student. Multiple teachers per class are not modeled (one `TeacherId` on class). EF has **no foreign-key constraints**.

Teacher → classes → students is derived: classes where `teacherId` matches, then enrollments for those classes.

---

## 10. Recommended final sidebar (after Phase 2 verification)

Workbook tabs (Playgroup, ABA, Tutorial, Preschool, 1/3/10-month) are **program and tracker sheets**, not separate products. They should be **program records** (already seeded as Playgroup, ABA Therapy, Tutorial, etc.), not extra sidebar items.

Proposed structure (to implement in Phase 3, not this phase):

### MAIN
- Operations Dashboard

### PEOPLE
- Teachers Monitoring
- Student Monitoring
- Parent Monitoring

### ENROLLMENT
- Enrollment Recording

### PROGRAMS AND CLASSES
- Programs *(Preschool, Playgroup, ABA, Tutorial, 1/3/10-month as rows)*
- Classes
- Schedule Monitoring *(one calendar: classes, playgroup, teacher shifts, holidays as filters/kinds)*

### STUDENT SERVICES
- Attendance *(filter by program/class/kind — including ABA and tutorial)*
- Progress Monitoring
- Payments

### COMMUNICATION AND DOCUMENTS
- Notifications
- Learning Modules
- Reports

### SYSTEM
- Settings
- User Management *(Super Admin only)*

**Do not delete** ABA/playgroup/tutorial **behavior**. Merge filters and kinds onto Attendance and Schedule. Keep StudentOps columns on Student Monitoring (slot, package, ID, nametag, collector). Keep day-off as part of Teachers Monitoring or Schedule, not a fake staff page.

---

## 11. CRUD snapshot (honest — not complete)

See also `HIRAYA_CRUD_IMPLEMENTATION_REPORT.md` (all rows start as Pending until tested).

| Module | Create | Read | Update | Delete/Archive | Notes |
| --- | --- | --- | --- | --- | --- |
| Teachers | Desktop/web REST | Yes | Desktop/web | Desktop delete; web weaker | Detail: list, not Teacher → class → student chain |
| Students | Store PUT | Yes | Yes | Desktop/admin | No unified student detail tabs |
| Parents | REST | Yes | Desktop stronger | Deactivate | Link/unlink on desktop |
| Programs | Store PUT | Yes | Yes | Desktop/admin | |
| Classes | Store PUT | Yes | Yes | Desktop only | No capacity enforcement in UI audit |
| Enrollment | REST + seats | Yes | Approve/reject | Cancel; desktop delete app | Approve creates/connects student |
| Schedules | Web C/U | Yes | Web | No | Desktop read-only; no conflict check found |
| Attendance | Web create | Yes | No | No | Desktop/mobile read-only |
| Progress | No UI write | Yes | No | No | Teacher permission exists, no form |
| Payments | Web create | Yes | No | No | Prefer void later, not delete |
| Notifications | Partial (mark read) | Yes | No | No | |
| Learning modules | API unused by UI | List | No UI | No UI | |
| Users | Staff/parent APIs | Yes | Partial | Partial | No Super Admin user-management page in AdminShell |

---

## 12. Google Sheet vs code

Workbook tabs recorded in `HKLC_WORKBOOK_SHEETS` match the Drive file name **Hiraya Kids Learning Center.xlsx**. HKLC Structure roles (Program Director, Administrative Director, Supervisor, Administrative Officer, named teachers) were copied into `hklcTaskBoards`. That earlier mapping **created the confusing sidebar**. Center operations should stay in **data and role tasks**, not one menu item per spreadsheet tab.

---

## Next phase

Phase 2: freeze the operations structure (people, enrollment, programs/classes, one schedule, services) against this audit and blockers. Phase 3: rename/merge nav only after that. No deletions in Phase 1.
