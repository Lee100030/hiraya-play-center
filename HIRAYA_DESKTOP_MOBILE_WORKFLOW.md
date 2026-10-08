# HIRAYA desktop and mobile workflow

Current operations: **`docs/HIRAYA_SYSTEM_GUIDE.md`**.

**Roles (locked):** Super Administrator, Teacher, Parent. Children do not have accounts.

## Desktop (Electron)

Control center for the Super Administrator. Creates and edits teachers, parents, students, programs, classes, **schedules**, **ABA weekly therapy board**, **tasks**, **announcements**, **session packages**, modules, enrollment, and reviews notifications.

Setting a parent or teacher password asks for the Super Administrator password in a confirm modal after Save.

Teachers may sign in on desktop with a scoped store (assigned classes/students/tasks only). They complete tasks on **mobile**.

## Mobile (Expo)

Teachers and parents only.

- **Teacher:** own schedule, assigned students, assigned tasks (in progress / completed + remarks), announcements, notifications. Tap an announcement to read the full message in a modal.
- **Parent:** linked children only, child schedule, remaining sessions, announcements, notifications, attendance/progress/payments **view**. Tap an announcement to read the full message in a modal.
- **Client APK 1.0.1** talks to the live hub at `https://www.hirayalearningcenter.app` (Render).

## Website enrollment

A public apply writes the parent into Parent management, the child into Students, and links them. The application stays pending until class approval. Approval does not duplicate the family.

## Shared path

```text
Desktop / Website  →  /api/store/patch + REST  →  Hiraya.Api  →  Neon
Mobile             →  GET /api/store (+ limited writes)      →  same API
```

New tables: `staff_tasks`, `session_packages`, `session_history`.  
Extended: `announcements` (audience, priority, expiry), `notifications` (related record, readAt), `schedules.ProgramId`.

## Permissions

Backend `StoreSanitizer` + `WorkflowOps.NewsVisibleTo` enforce visibility. Parents cannot write center data except marking their own alerts read. Teachers may update assigned task status and assigned-student attendance/progress.
