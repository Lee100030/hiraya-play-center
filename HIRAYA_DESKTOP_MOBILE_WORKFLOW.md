# HIRAYA desktop and mobile workflow

**Roles (locked):** Super Administrator, Teacher, Parent. Children do not have accounts.

## Desktop (Electron)

Control center for the Super Administrator. Creates and edits teachers, parents, students, programs, classes, **schedules**, **tasks**, **announcements**, **session packages**, modules, enrollment, and reviews notifications.

Teachers may sign in on desktop with a scoped store (assigned classes/students/tasks only). They complete tasks on **mobile**.

## Mobile (Expo)

Teachers and parents only.

- **Teacher:** own schedule, assigned students, assigned tasks (in progress / completed + remarks), announcements, notifications.
- **Parent:** linked children only, child schedule, remaining sessions, announcements, notifications, attendance/progress/payments **view**.

## Shared path

```text
Desktop / Website  →  PUT/GET /api/store + REST  →  MySQL
Mobile             →  GET /api/store (+ PUT for own task/alert)  →  same MySQL
```

New tables: `staff_tasks`, `session_packages`, `session_history`.  
Extended: `announcements` (audience, priority, expiry), `notifications` (related record, readAt), `schedules.ProgramId`.

## Permissions

Backend `StoreSanitizer` + `WorkflowOps.NewsVisibleTo` enforce visibility. Parents cannot write center data except marking their own alerts read. Teachers may update assigned task status and assigned-student attendance/progress.
