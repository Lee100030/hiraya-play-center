# HIRAYA requirements blockers

**Date:** 15 September 2026  
These items are **not invented**. They are missing or unconfirmed from documentation, so later phases must not guess.

## Google Sheet

URL: `https://docs.google.com/spreadsheets/d/1SxSLY7tpJcsux826BRUuPyL8BqZWWAg9/edit?gid=740829625`

| Issue | Impact |
| --- | --- |
| Export/htmlview from this environment returned no cell grid (500 / Drive wrapper). | Cannot re-read every cell of all 21 tabs in this session. |
| `gid=740829625` sheet identity not confirmed. | Unknown whether that gid is HKLC Structure or another tab. |
| Teacher **PROGRAM TASKS / ADMIN TASKS** cells under the teacher names were not fully captured (frozen panes). | Teacher-only permissions may be incomplete. |
| Rosters on 10-month / 1-month / 3-month / PRESCHOOL tabs were not imported as authoritative student lists. | Do not overwrite MySQL with guessed names. |

**Ask:** Export the workbook as `.xlsx` into the repo (for example `docs/hklc/Hiraya Kids Learning Center.xlsx`) or confirm sharing so a full CSV dump is possible.

## Role mapping (workbook vs app) — resolved 15 Sep 2026

Product logins:

- **One Super Administrator** (center director). Username `admin` in development.
- **Teachers**
- **Parents** (they use the app for their children)

Administrator, Staff, and Student logins are **not used**. Existing extra admin/staff/student users are deactivated when the API starts.

Remaining open items: Google Sheet cell dump, delete vs archive for payments, schedule conflict rules.

## Data rules not in the sheet (do not invent)

1. Permanent **delete** vs archive for students, payments, attendance.
2. Whether a student may have multiple programs at once (ABA + tutorial).
3. Official **student number** format.
4. Whether gender is required.
5. Who may void a payment.
6. Whether parents may see payments (workbook + current nav say yes; confirm).
7. Conflict rules for teacher/student overlapping schedules (not encoded today).
8. Whether enrollment approval must always create a class seat.

## Product surfaces

**Ask:** Desktop is the thesis admin/teacher operations desk. Website admin should match it. Mobile stays teachers + parents only — confirm Super Admin never uses Expo Go.

Until these are answered, Phase 2 will use:

- Existing MySQL entities (do not drop tables).
- Programs as data (Playgroup, ABA, Tutorial, Preschool, 1/3/10-month).
- One Student Monitoring page (merge sheets/monitoring/ops columns).
- One Schedule Monitoring page (kinds/filters).
- One Attendance page with kind/program filters.
- Roles already in code; Staff kept until you say otherwise.
