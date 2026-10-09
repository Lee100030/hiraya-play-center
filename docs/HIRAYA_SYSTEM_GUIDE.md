# Hiraya Kids Learning Center — system guide

Updated 8 October 2026. This is how the live center system works for staff, parents, and teachers.

## What the system is

Hiraya is one center record shared by three clients:

| Client | Who uses it | What it is for |
|--------|-------------|----------------|
| **Website** | Public families, Super Admin | Marketing, enrollment, inquiries, operations console |
| **Desktop** | Super Admin (teachers may sign in with a limited desk) | Day-to-day management: people, money, calendar, ABA board |
| **Phone app** | Teachers and parents only | Assigned work, linked children, messages. Children do not sign in |

All three talk to **Hiraya.Api**. The API holds the center document (students, parents, schedules, payments, sessions). Clients never open the database.

## Live hosting

| Piece | Where it runs |
|-------|----------------|
| Source | GitHub `Johnleelugnasin30/hiraya-play-center` |
| Website | Render `hiraya-web` at https://hirayakidslearningcenter.com (IONOS DNS). Until that service exists, the old Vercel site remains rollback only. |
| API | Render `https://hiraya-play-center.onrender.com` |
| Data | Neon (JSON center store through Hiraya.Api) |

Push to `main` updates GitHub and Render. Disconnect Vercel only after the Render website is verified.

Do not put database URIs or mail secrets in `NEXT_PUBLIC_`, `VITE_`, or `EXPO_PUBLIC_` variables. New desktop/mobile builds use `https://hiraya-play-center.onrender.com`.

The first API call after idle can be slow while Render wakes. That is expected on the current plan.

## Roles

| Role | Sign-in | Notes |
|------|---------|--------|
| Super Administrator | Website + desktop | Full operations |
| Teacher | Desktop (limited) + phone | Assigned students, schedule, tasks |
| Parent | Phone (and parent portal after activation) | Linked children only |
| Child | None | No student login |

A parent account that is still **pending activation** appears in Parent management but cannot sign in on the phone until a password is set.

## Enrollment (website apply)

When a parent submits the public enrollment form, the API writes **three** things in one save:

1. **Enrollment application** — stays `pending_review` until staff approve class placement.
2. **Parent record** — goes to **Parent management** (name, email, phone, address). Status is pending activation.
3. **Student record** — goes to **Students** (the son or daughter named on the form). Status is `pending` until approval.

The applying parent is **linked to that child automatically**. Staff do not need **Link Child** for a new website apply.

Approving the application does **not** create a second parent or a second child. Approval places the existing student in a class and marks the student **active**.

The same parent applying a second child reuses the parent account and adds another student, then links them.

## Student number

**Student number** is the printable center number staff type and change. It is **editable** on Add student and Edit student (desktop and website).

How to change it:

1. Open **Student management**.
2. Open the learner → **Edit**.
3. Type or change **Student number**.
4. **Save**.

Rules:

- Leave the field blank on a **new** student and the system assigns a number on save (for example `STU-YYYYMMDD-XXXX`).
- On an **existing** student, leave the field as-is to keep the current number.
- Two learners cannot share the same student number.
- The list, profile, and student record PDF show this number.

Website apply already stores a number on the child (`HIRAYA-STU-…`). Staff can still edit that later. The internal database id (`stu_…`) is **not** the student number and must not be renamed; class, parent, payment, and session links use that id.

## Parent password and activation

Current password hashes cannot be shown.

On **Edit parent** (desktop or website):

- Leave password fields blank to keep the existing password.
- To set or reset a password, fill **Set new password** and **Confirm password**, then **Save**.
- A **Confirm with admin password** modal opens. Enter the Super Administrator password there, then **Confirm and save**.

The admin password field is not on the parent form itself.

After a pending parent has a password, they can sign in on the phone with the Hiraya email (for example `name@hiraya` or `name@hiraya.local` — matching is not case-sensitive and treats those as the same mailbox).

## ABA schedule

Sidebar: **Management → ABA schedule** (desktop and website).

This is the weekly therapist board (same idea as the T. Carol ABA sheet):

- Pick the therapist and the week (Monday–Sunday).
- Columns: 8:00–10:00, 10:30–12:30, 1:00–3:00, 3:00–5:00 (2-hour ABA).
- 10:00–10:30 and 12:30–1:00 are locked **BREAK / LUNCH (30 mins)**.
- Click a working slot: student session, **ABA PREP**, **OFF**, or **makeup**.
- Makeup stays **for approval** until an admin clicks **Approve**.
- **Mark OFF** fills that day the way Monday/Sunday often appear on the paper sheet.

Rules the system enforces:

- ABA-tagged therapists and students are listed first; if none are tagged, the full teacher/student lists are used.
- The same therapist cannot be double-booked at that time.
- The same child cannot sit in two overlapping sessions.
- Plotting a slot does **not** subtract a session package. Remaining sessions change when attendance uses a session.

## Sessions and tuition

- **Session remaining** = package total − used, never below 0.
- **Tuition remaining** = program fee − amount paid.
- Deleting a student or a session package must drop leftover income lines that belonged to that record.

## Desktop installer

| File | Contents |
|------|----------|
| `HIRAYA Desktop Setup 1.0.2.exe` | Password-save admin modal. Does **not** include ABA schedule or editable student number. |
| Source after 8 Oct 2026 | ABA schedule, editable student number, later enrollment/parent behavior |

To give the client ABA schedule on Windows, package a new installer from `apps/desktop` (`pnpm --filter @hiraya/desktop run package`) after this source is on the machine.

## Phone app

Teachers and parents only. Super Admin does not use the phone app as a daily console.

Parents see only children linked to their account (the automatic link from website apply, or a manual **Link Child**).

Teachers see assigned students, their schedule (including ABA slots assigned to them), tasks, and messages.

## Ordinary saves

Staff edits on desktop/website that are not a special REST action save with `POST /api/store/patch` (the center document). Enrollment apply and approve go through the public/admin enrollment API.

## Local development (this PC)

1. Start Hiraya.Api: `npm run dev:api` (`http://127.0.0.1:5188`).
2. Website: `npm start` (`http://127.0.0.1:3000`) — the site proxies `/api` to the API.
3. Desktop: `npm run dev:desktop`.
4. Mobile: `npm run dev:mobile` on the same LAN.

Development seed logins (local API only, not live client accounts): `admin` / `Admin123`, `teacher` / `Teacher123`, `parent` / `Parent123`.
