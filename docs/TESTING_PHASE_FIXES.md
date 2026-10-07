# Testing-phase fixes

Date: 7 October 2026  
Workspace: Hiraya Kids Learning Center (website, desktop, mobile, Hiraya.Api, Neon JSON store)

This document covers tester-reported bugs and the security/hardening work from the testing-phase brief. Do not treat items marked BLOCKED as verified-fixed.

## Architecture (actual)

| Surface | Technology |
| --- | --- |
| Website | Next.js in `apps/web`, Vercel, public site + `/admin` |
| Desktop | Electron + Vite in `apps/desktop` |
| Mobile | Expo in `apps/mobile` (teacher/parent) |
| API | ASP.NET Core `Hiraya.Api` on Render |
| Database | Neon PostgreSQL via `EfHirayaRepository` (JSON store, not Postgres RLS) |
| Auth | `X-Hiraya-Session` HMAC sessions, `PortalAuthService`, hashed passwords |
| Email | SMTP / Brevo via `SmtpEmailSender` when `HIRAYA_SMTP_*` is configured |
| Notifications | `alerts` in the store + SMTP for some events |
| CI | `.github/workflows/ci.yml` (plus keep-api-awake) |

Roles in code: `super_admin`, `admin`, `teacher`, `staff`, `parent`, `student`. Portal sign-in is SuperAdmin, Teacher, and Parent. Children do not sign in.

---

## BUG 01 — Delayed approval

**ISSUE:** Approval appeared delayed after Admin accepted an enrollment.

**REPRODUCTION:** Approve a pending enrollment and wait for the UI to return.

**ROOT CAUSE:** After the database write, `ApproveApplicationAsync` awaited `NotifyEnrollmentAcceptedAsync`, which sends SMTP in-request.

**FIX:** Queue the parent email/notice on a background task after the store commit, matching application-received receipts.

**TEST:** Code path reviewed; live SMTP send not re-fired in this pass.

**REGRESSION:** Application-received receipts still use `QueueReceipt`.

**STATUS:** FIXED (email still depends on SMTP; delivery BLOCKED without a live inbox check)

---

## BUG 02 — Positive notification color

**ISSUE:** Success notices showed red.

**REPRODUCTION:** Save a teacher payment or tuition fee and watch the banner.

**ROOT CAUSE:** Success copy was classified as error unless it contained keywords like `notif` / `payslip`.

**FIX:** `noticeClass()` treats failure language as error; everything else uses `.form-ok` (green). Alert kinds now include `success`, `info`, `warn`, `danger`.

**TEST:** Static review of desktop `RecordsPages` and web `payments` banners.

**REGRESSION:** Error strings containing “could not” still use red.

**STATUS:** FIXED

---

## BUG 03 — Job application approval modal

**ISSUE:** Applicants could think they were already hired.

**REPRODUCTION:** Submit Apply for a teacher on the public site.

**ROOT CAUSE:** Success copy said the application was received, not that admin approval and email follow-up are required.

**FIX:** Success modal now uses the required wording and a Done button.

**TEST:** Copy updated in `apps/web/components/public/enrollment.tsx`.

**REGRESSION:** Student enrollment success copy unchanged.

**STATUS:** FIXED

---

## BUG 04 — Password change security

**ISSUE:** Admin must not change another user’s password from the client alone.

**REPRODUCTION:** Parent/Teacher edit form can set a new password.

**ROOT CAUSE:** `SetPasswordAsync` / staff save hashed a new password with only an admin session, no re-entry of the admin password. Actor from the API does include the hash, so verification is possible on the server.

**FIX:** `PasswordHasher.RequireAdminConfirmation` on parent password reset and teacher password change. UI shows `••••••••`, empty new-password fields, and an Admin password field. `/api/auth/password` for another user requires `adminPassword` and uses `ReplacePasswordAsync`.

**TEST:** Code review of ParentPortalApi, StaffService, UserAdminService.

**REGRESSION:** Creating a new parent/teacher still requires the new account password only.

**STATUS:** FIXED

---

## BUG 05 / 06 — Admin password change + email verification

**ISSUE:** Admin password change must use current password + email code.

**FIX:** `POST /api/auth/password/request-code` emails a 6-digit code (10 minute life, issue/check limits). `POST /api/auth/password` for SuperAdmin self-change consumes the code, then verifies the current password and hashes the new one. Settings UI on website and desktop.

**TEST:** Endpoints added; live Brevo send BLOCKED (no extra test email sent).

**REGRESSION:** Parent/teacher self-change still uses current password only.

**STATUS:** FIXED in code; email delivery NEEDS REVIEW on live SMTP

---

## BUG 07 — Password eye inverted

**ISSUE:** Visibility control felt reversed.

**FIX:** Desktop login keeps hidden=`password` / visible=`text`, open-eye when hidden, and a Show/Hide label. Mobile labels already matched; Field wrapper no longer uses Pressable (see BUG 10).

**TEST:** Code review of LoginScreen, AdminLoginForm, mobile login.

**STATUS:** FIXED

---

## BUG 08 — Desktop/mobile OS warnings

**ISSUE:** SmartScreen / unknown-publisher after install.

**ROOT CAUSE:** Windows installer is unsigned (`signAndEditExecutable: false`). Preview APK is Expo-signed, not Play-store production signing.

**FIX:** Documented publisher name on the NSIS config. No security bypass.

**STATUS:** BLOCKED — production Authenticode and Play App Signing certificates are required

---

## BUG 09 — Mobile notification side

**ISSUE:** Notifications hard to find.

**FIX:** Existing Alerts tab kept. Home hero now has a top-right bell with unread badge.

**STATUS:** FIXED (device tap NEEDS REVIEW)

---

## BUG 10 — Mobile text box sometimes not working

**ISSUE:** Inputs sometimes ignored taps.

**ROOT CAUSE:** `Field` wrapped `TextInput` in `Pressable`, which fights Android focus.

**FIX:** Wrapper is a `View`. Screen `keyboardShouldPersistTaps="always"`.

**STATUS:** FIXED in code; emulator not restarted (BLOCKED per standing rule)

---

## BUG 11 — Mobile message not clickable

**ISSUE:** Inbox rows sometimes did not open.

**FIX:** Larger hitSlop, immediate press, ripple, z-index on rows; alert rows also got hitSlop.

**STATUS:** FIXED in code; device tap NEEDS REVIEW

---

## BUG 12 — Parent management Edit

**ISSUE:** Admin needed Edit.

**ROOT CAUSE:** Edit already existed on desktop profile and web table; testers may have missed it. Password section was the confusing part.

**FIX:** Edit retained; password reset UX clarified (BUG 13/04).

**STATUS:** FIXED (already present; UX clarified)

---

## BUG 13 — Password display in parent edit

**ISSUE:** Must not show plaintext password.

**ROOT CAUSE:** API already clones users with `Password = null`. Empty password inputs could still look like “the password is blank”.

**FIX:** Placeholder `••••••••`, copy that the hash cannot be shown, Set new password + admin confirmation.

**STATUS:** FIXED

---

## BUG 14 — Remove payment details from email

**ISSUE:** Emails included “View payment details”.

**FIX:** Removed `ActionLabel` / `actionLabel` from student balance and teacher payslip mail in `PaymentApi.cs` and `teacherPayments.ts`.

**STATUS:** FIXED

---

## BUG 15 — Balance confusion

**ISSUE:** Remaining balance looked editable.

**FIX:** Total paid and remaining balance are read-only money readouts, not inputs.

**STATUS:** FIXED

---

## BUG 16 / 23 — Payment CRUD + security

**ISSUE:** Record payment needs C/R/U/D and parent must not rewrite history.

**FIX:** Existing admin payment create/edit/delete/void paths kept. Teacher payments already post to cash flow. Parents still receive sanitized store (`StoreSanitizer`). No parent write APIs for payments.

**STATUS:** FIXED (existing admin CRUD retained; isolation via sanitizer, not RLS)

---

## BUG 17 / 18 — Email after enrollment approval / parent notices

**ISSUE:** Parents should get approval mail after DB status is approved.

**FIX:** Status is committed first; mail is queued after. Existing parent events: enrollment accepted, invitations, payment/balance notices, session notices.

**STATUS:** FIXED in flow; live inbox BLOCKED

---

## Rate limiting

Login IP/login-key throttle (429), existing lockout (423 after 8 failures / 5 minutes), public enrollment/inquiry/teacher apply/activate throttles, password code/change throttles, message send throttle.

**STATUS:** FIXED (in-memory; resets on API restart; not shared across instances)

---

## RLS

Postgres RLS is not used. Isolation is `StoreSanitizer` + FamilyAccess + API role checks.

**STATUS:** N/A as RLS; API sanitizer is the control. Full parent-A vs parent-B live probe BLOCKED (no destructive live tests)

---

## Installation / CI / error tracking / recovery

CI workflow added. Client error reports go to console via `createErrorReport` (no Sentry). Database backup restore not executed in this pass.

**STATUS:** CI added; external APM BLOCKED; backup restore BLOCKED
