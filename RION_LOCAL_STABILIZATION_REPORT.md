# RION local stabilization report

**Deployment Status: DEPLOYMENT PAUSED — LOCAL DEVELOPMENT ONLY**

## Project Status
Local recovery in progress on branch `cursor/rion-local-recovery-d8c2`. This GitHub clone never contained the full historical desktop; a professional operations desk was rebuilt from website admin modules + Hiraya tokens.

## Desktop UI/UX
Restored: grouped sidebar, dashboard with **live** store counts, student card gallery + add/edit/archive, teacher gallery + workspace, parents table, enrollment/attendance/payments/schedules/calendar/progress/notifications/announcements/modules/reports/settings/profile. Login no longer prefills credentials.

## Website
AppShell now keeps profile/settings/logout at the bottom with avatar. Same `/api/store` hub.

## Mobile
Unchanged Expo tabs; still uses `EXPO_PUBLIC_API_URL` local example. Same API.

## API
Local Hiraya.Api. `putStore` now refreshes after 204.

## Database
Local MariaDB `hiraya_learning_center`. No reset, no destructive migration.

## Authentication
HMAC session via API. No password in React source. No production auto-login.

## Student / Teacher / Parent management
Students: CRUD-ish add/edit/archive. Teachers: view + workspace. Parents: list + linked children. Teacher route on web `/admin/teachers/:id` still missing (see decisions file).

## Schedule / Tasks / Sessions / Attendance / Progress / Payments / Announcements / Reports
Read from live store. **Tasks** have no dedicated table (decision needed). **Sessions remaining** not in schema.

## Fixed
- Lost desktop reduced to a toy login — replaced with operations shell
- Empty values show “Not assigned”
- Shared Avatar, Modal, PageHeader
- Local env examples only
- Store save after HTTP 204

## Still Broken / incomplete
- Full historical desktop from the PC folder is not in git
- Website staff page still mostly read-only
- No remaining-sessions fields
- No Task entity
- Spec markdown files not in repo
- Electron NSIS.exe not part of this recovery

## Needs Testing
Admin/teacher/parent login on desktop and website against local API; student add; teacher card open.

## Needs User Decision
See `RION_DECISIONS_NEEDED.md`.

## Deployment Status
DEPLOYMENT PAUSED — LOCAL DEVELOPMENT ONLY. Wait for the exact words **DEPLOY NOW**.
