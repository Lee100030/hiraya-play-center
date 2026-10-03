# RION complete user-flow test report

Local only. Nothing was deployed, no production database was used, and no existing student, payment, teacher, or parent rows were deleted. The public website visual design was not changed.

Statuses: PASS / FAIL / PARTIAL / NOT IMPLEMENTED / BLOCKED / NOT TESTED.
Severity: CRITICAL / HIGH / MEDIUM / LOW.

## 1. Executive Summary

The shared local API and MySQL database are the system of record for the website, desktop, and mobile apps. Tuition remaining balance and session remaining are calculated in one place and covered by passing unit tests. Parent and teacher store views are filtered on the server.

The broken step in enrollment acceptance was that a new parent was created as `pending_activation` with a random password that was never shared and never replaced by a setup link. That path now issues a one-time activation invitation and sends an acceptance email only when outbound mail is on and the public site address is not a local address. The email does not contain a password and does not say tuition is paid.

Mail is off in local settings, and the public site address is still `http://127.0.0.1:5288`. Those emails will not leave the machine until mail and a real public address are configured. **MOBILE APP LINK NOT YET PRODUCTION READY.**

Inquiry storage, resume upload, and an interview stage are not implemented. Resume upload and a new inquiry success state would change the frozen public website, so they were left in place and described below.

## 2. Public Website (functional/data issues only — no UI changes made)

**PARTIAL.** Homepage HTML from `http://127.0.0.1:3000/` returned 200 and includes the approved hero line “Growing minds.” and the Facebook profile URL. No colors, layout, type, or copy were edited.

Public catalog data is loaded from `GET /api/public/site` (center name, description, programs, address, phone, email, hours). It is not a separate hardcoded catalog.

Not fully click-tested in a phone browser. Layout was not redesigned.

## 3. Hiraya Information

**PASS** for source. **PARTIAL** for naming consistency.

`GET /api/public/site` returned:

- Center name: HIRAYA Learning Center
- Hours: Monday–Friday, 8:00–17:00
- Address, phone, and email present
- Programs: 10-Months Program, 3-Months Program, ABA Therapy, Bright Buds, Grade 1, Kinder, Playgroup, Pre-school, Rising Stars, Tiny Tots, Tutorial Session

The frozen hero title “Growing minds. Building futures.” is the approved page headline. The center name shown under the crest comes from the database. Email templates use “Hiraya Kids Learning Center” when settings do not override it. That naming difference is data, not a visual change. It needs a decision if one legal name should be stored in center settings.

## 4. Inquiry

**PARTIAL.**

The contact form validates name, email, phone, and message length, then opens the device mail app to the center address. It does not save an inquiry in the database and does not notify admin inside the app. Empty and invalid fields are rejected in the browser before that handoff.

A stored inquiry would need a success message that the current form does not have (“your message is ready… if email did not open”). That is a visual/copy change on the frozen site, so it was not built.

## 5. Enrollment

**PARTIAL.**

Public submit `POST /api/public/enrollment` rejects an empty child name with 400 and the message “Please enter the child’s full name.” A valid application is stored as `applicationKind = student` and `pending_review`. It does not create a student and does not send an “enrolled” email.

Admin approval creates the student, an active enrollment, and a parent link. A new parent stays `pending_activation` until they set a password. An existing active parent is reused and is not given a new password.

A full approve-and-delete cycle was not run against the live database, because approval creates a real student row. The code path was reviewed and the API was rebuilt with it.

## 6. Email Confirmation

**PARTIAL.**

On student submit, the system can send “we received your enrollment application.” The text says it is waiting for review and is not an acceptance.

On admin approval, the parent email includes parent name, student name, program, status “accepted, payment still due at the center,” and the next step. A new parent gets a one-time password-setup link. An existing parent is told to sign in with the account they already have. No plaintext password is included.

Local SMTP `Enabled` is false, and `PublicBaseUrl` is `http://127.0.0.1:5288`. Links to that address are not emailed. Admin is notified in the app that mail was not sent. Approval still succeeds if mail fails.

Mailtrap was not configured, so no message was captured.

## 7. Parent Account

**PARTIAL.**

New parents from an accepted enrollment cannot sign in until they activate. Login already rejects accounts that are not active. Activation is `POST /api/auth/activate` with the one-time token. The token is stored only as a hash.

Because local mail and the public URL are not ready, the parent does not receive the link yet. The invitation is still created. An administrator notification explains that portal access is waiting and that no password was emailed.

Isolation of “only my children” is enforced in `StoreSanitizer.ForFamily` and `GET /api/parent/children/{studentId}` (`FamilyAccess.CanViewStudent`, otherwise 403). A live login as two different parents was not performed.

## 8. Payment

**PASS** for the calculation. **PARTIAL** for a live parent-mobile payment walkthrough.

Rule in force: remaining balance = tuition fee − total approved payments. Cancelled, void, failed, refunded, rejected, waived, and pending payments are not counted. Overpayment is rejected. A program tuition fee wins even when it is 0.

`packages/utils` payment-logic tests: 11 passed, including down payment counted once, later payments added, full payment, overpayment rejected, and a cancelled payment returning the account to unpaid.

Parent mobile Payments uses `studentPaymentBalance` from that same helper. The parent home screen now shows that remaining balance for the selected child instead of omitting it. The payments list is limited to linked children.

There is no in-app payment gateway. Payment is recorded at the center.

## 9. Teacher Application

**PARTIAL.**

`POST /api/public/teacher-application` with invented applicant Anna Cruz (`verify.flow.teacher@example.com`, Playgroup) returned 200 and an application id. An incomplete body returned 400 “Please enter your full name.” The row was stored as `applicationKind = teacher` and was then removed. It did not create a student.

Approving a teacher application sets status approved and does not create a student or a teacher account. That approval is an admin decision, not an automatic hire email.

The receipt email, when mail is enabled, says the application was received and is not an acceptance, and that no interview has been scheduled.

## 10. Resume Upload

**NOT IMPLEMENTED.**

The public teacher form collects name, email, phone, role, and a note. It has no PDF/DOC upload, size limit, or file-type check. Adding a file field would change the frozen public form, so it was not added.

## 11. Interview Email

**NOT IMPLEMENTED.**

There is no interview status, date, time, location, or interview email. Teacher approval does not send an interview message. This needs a decision before an interview stage is added.

## 12. Parent Mobile

**PARTIAL.**

Dashboard name comes from the signed-in profile. Linked children come from family links on the shared store. Outstanding balance on the home card and the Payments screen is `studentPaymentBalance` from the store, not a fixed number. No child shows “No child linked.”

Sessions left uses the shared session account: total − used, never below 0. Unit tests passed for 20−7 style remaining and for the overshoot case (cannot go negative). Empty package label is “No package.”

Activities: the parent store copy now uses `LearningModuleService.Visible`, so a parent receives published modules for their children’s classes or program, plus center-wide modules. They no longer receive every published module in the database.

Settings: profile phone and address can be saved, password change exists, logout exists. Notification flags are stored on the account, but the app tells the parent to ask the center to change them. Parents cannot edit those flags themselves.

A signed-in parent session on a phone was not exercised in this pass.

## 13. Teacher Mobile

**PARTIAL.**

Teacher store data is limited to assigned students, assigned classes, their own attendance rows, their own tasks, and schedules assigned to them. Payments, center cash, and other teachers’ salary rows are removed from the teacher store.

Calendar and schedule screens read that shared store. A live admin-edit then teacher-refresh on a device was not repeated in this pass. The API path is the same store both apps use.

## 14. Calendar

**PARTIAL.**

Teacher and parent calendars read `schedules` from the sanitized store. Cancelled items are excluded by the mobile selectors. Monthly, weekly, and daily views were not click-tested on a device in this pass.

## 15. Schedule

**PARTIAL.**

An admin schedule save goes through the store patch into MySQL. The next teacher store load is `StoreSanitizer.ForTeacher`, which keeps schedules assigned to that teacher or their classes. There is no second schedule database.

Live confirmation of one edited class on a phone was not done in this pass.

## 16. Attendance

**PARTIAL.**

Teacher time-in and time-out are employee attendance rows. The server only overlays employee rows for that teacher, and student attendance only for assigned students. A teacher cannot replace another teacher’s time record through the store merge.

The same overlay still replaces that teacher’s own employee rows with whatever list the client sends, so a crafted request could drop or rewrite their own history. Ordinary screens send the list they were given. Tightening “corrections only” needs a decision so normal time-out still works.

## 17. Student Attendance Confirmation

**PARTIAL.**

Confirming a student present uses one session, once per day, and only when a package exists. Session tests passed: one confirmation uses one session, a second day uses another, two packages are not added together, and a child with no package can still be marked present without a negative balance.

The teacher merge ignores student attendance for students who are not assigned. Parent and admin views read the same attendance table. A live teacher-mark then parent-and-admin check was not repeated on devices in this pass.

## 18. Salary

**NOT IMPLEMENTED** on teacher mobile. **PASS** for isolation of the payment book.

Teacher salary is a payment row marked as a teacher payment. It is an expense, not student tuition. The teacher store sets `Payments` to an empty list, so Teacher A cannot read Teacher B’s pay from `/api/store`. There is no teacher salary screen (pay period, amount, status, date, history) in the mobile app. Admin cash flow still lists those salary rows.

## 19. Messaging

**PARTIAL.**

Messages are alerts. A parent or teacher store copy only includes groups they belong to, and alerts addressed to them (parents also see recipient `everyone`). A family save can update only alerts whose recipient is that parent. They cannot write an alert onto another person’s id through the family merge.

Unread state is derived from `read` on those alerts. A two-account send/receive test was not run.

## 20. Security

**PARTIAL.**

Live checks:

- `GET /api/store` with no session: **401**
- `GET /api/parent/children/not-my-child` with no session: **401**
- Same route with a fake session header: **401**

Code enforcement:

- Parent child, attendance, progress, schedule, and payment routes require the parent role and `CanViewStudent`, otherwise 403.
- Family and teacher store copies drop other families’ students, payments, and sessions.
- Teacher payments are cleared.
- Parent learning modules are now limited to modules visible to that family.
- Staff can still replace payments and attendance for the center. That matches the office role, not a parent or teacher.

A signed-in Parent A requesting Parent B’s student id was not executed, because that needs two live parent passwords. The route returns 403 when `CanViewStudent` is false.

## 21. API

**PASS** for the local hub. **PARTIAL** for mail delivery.

Hiraya.Api is listening on `http://127.0.0.1:5188` after this rebuild. Public enrollment and teacher application validate and persist. Store reads require a session. Approval mail is skipped cleanly when SMTP is off.

Startup logs still print `fail` for `ALTER TABLE` on columns that already exist. Those lines are the initializer noticing the column is already there. They are not a crash.

## 22. Database

**PASS** for the local MySQL database `hiraya_learning_center`. No tables were dropped, no production connection was opened, and the invented teacher application was removed after the submit check (0 matching rows afterward).

Tuition and session rows already in the database were not rewritten.

## 23. Responsive UI/UX (mobile apps only)

**NOT TESTED** on 390px and 375px devices in this pass.

The parent home balance uses the existing horizontal stat row. No new website layout was made. Phone overflow, modal fit, and teacher screen overlap were not measured on a device.

## 24. Cross-platform Data Flow

**PARTIAL**, with the calculations themselves **PASS**.

| Chain | Result |
| --- | --- |
| Tuition ₱5,000 − ₱1,000 approved = ₱4,000 | PASS in unit tests and in `studentRemainingBalance` / `StudentTuition` |
| Sessions 20 − 7 = 13, 20 − 20 = 0, 20 − 25 stays 0 | PASS in unit tests |
| Admin schedule → same store → teacher mobile | PARTIAL. Same API and filter. Not rechecked on a phone this pass |
| Teacher marks present → same attendance table → admin and parent | PARTIAL. Same table and assignment filter. Not rechecked on a phone this pass |
| Website enrollment → admin review → acceptance email → parent activation → mobile balance | PARTIAL. Submit and validation were live. Acceptance email waits on SMTP and a non-local public URL. Parent balance reads the shared ledger |

## 25. Bugs Found

1. Accepting a student enrollment created a parent who could not sign in and was never sent a setup link. **HIGH.** Fixed in this pass.
2. Application submit did not tell the applicant the request was only received. **MEDIUM.** Fixed in code. Mail still does not send locally.
3. Parent home did not show the shared remaining balance. **MEDIUM.** Fixed.
4. Parent payments with no child selected listed every payment row in the store copy. **MEDIUM.** Fixed to linked children only.
5. Parent store copy included every published learning module. **HIGH.** Fixed to the family-visible module list.
6. Contact inquiries are not stored for admin. **MEDIUM.** Not fixed. Frozen website copy.
7. No resume upload. **MEDIUM.** Not fixed. Frozen public form.
8. No interview stage or interview email. **MEDIUM.** Not implemented.
9. Activation and receipt email cannot be delivered: SMTP off, public URL is localhost. **HIGH** for the live chain. Configuration, not a code crash.
10. No teacher salary screen. **MEDIUM.** Isolation of the payment book is already in place.
11. Teacher can replace their own attendance history if the client omits rows. **LOW.** Not changed, so time-out keeps working.
12. Parents cannot edit notification flags in the app. **LOW.**

## 26. Severity

| Item | Severity | Status |
| --- | --- | --- |
| Parent could not activate after acceptance | HIGH | Fixed |
| Parent could see every published module | HIGH | Fixed |
| Mail and public URL not ready, so no real email or app link | HIGH | Needs your configuration |
| Inquiry not stored | MEDIUM | Needs decision (frozen site) |
| Resume upload missing | MEDIUM | Needs decision (frozen site) |
| Interview email missing | MEDIUM | Needs decision |
| Teacher salary screen missing | MEDIUM | Needs decision |
| Parent balance hidden on home | MEDIUM | Fixed |
| Payment list not limited to linked children | MEDIUM | Fixed |
| Teacher self-edit of old attendance | LOW | Open |
| Notification flags not editable by parent | LOW | Open |

No CRITICAL bug was left open in the tuition formula, session formula, or unauthenticated store access. Those checks passed.

## 27. Fixes Applied

- After a student enrollment is accepted, a new pending parent gets a one-time activation invitation. The acceptance email includes student, parent, program, accepted status, and “payment still due at the center.” It never includes a password. If mail is off or the public URL is localhost, the link is not emailed and admin is told in the app. Approval still succeeds.
- Student and teacher application submit can send a receipt that says the request was received and is not an acceptance.
- Parent home shows remaining balance from the shared tuition ledger.
- Parent payment history is limited to linked children.
- Parent store copies only include learning modules that family is allowed to see.
- Local API was rebuilt and is listening on port 5188.
- Invented teacher application `tch_20260930105656_e46c5a` was submitted and removed.

## 28. Fixes Still Needed / Needs Decision

1. Turn on SMTP and set `HIRAYA_PUBLIC_URL` to the real site before any activation or receipt email can be sent. Do not point that URL at localhost.
2. **MOBILE APP LINK NOT YET PRODUCTION READY.** No store or production app URL was invented.
3. Inquiry storage needs a public success state. That would change frozen website copy, so it was not designed.
4. Resume upload needs a public file field. That would change the frozen teacher form.
5. Interview date, time, place, and email need an admin status that does not exist yet.
6. Teacher salary on mobile needs a screen that shows only that teacher’s pay. The data is already hidden from other teachers.
7. Whether a teacher may correct an old time-in, or only fill a missing time-out.
8. Whether parents should toggle notification flags themselves.
9. One center name in settings if “HIRAYA Learning Center” and “Hiraya Kids Learning Center” should match.

## 29. Testing Results

| Area | Result |
| --- | --- |
| Public homepage HTML 200, hero line, Facebook URL | PASS |
| Facebook URL redirects to Hiraya Kids Learning Center Montalban Rizal | PASS |
| Public site catalog from the API | PASS |
| Inquiry stored for admin | FAIL (mailto only) |
| Enrollment validation 400 on empty child name | PASS |
| Teacher application 200 then removed | PASS |
| Teacher application validation 400 | PASS |
| Unauthenticated store and child routes 401 | PASS |
| Payment logic tests (11) | PASS |
| Session remaining and attendance tests (9) | PASS |
| Acceptance email captured in Mailtrap | NOT TESTED (SMTP off) |
| Parent activation in a browser | NOT TESTED (no public URL) |
| Parent A cannot open Parent B’s child while signed in | NOT TESTED live; 403 is in the route |
| Phone layouts 375 and 390 | NOT TESTED |
| Resume upload | NOT IMPLEMENTED |
| Interview email | NOT IMPLEMENTED |
| Teacher salary screen | NOT IMPLEMENTED |

## 30. Thesis Readiness

**PARTIAL.**

The local center can show one tuition balance and one session balance across desktop, website admin, and the mobile apps, because they read the same API. Enrollment no longer pretends a parent can sign in before they set a password, and it no longer emails a password.

It is not ready to demonstrate a real email, a production mobile link, a stored website inquiry, a resume, or an interview email until the decisions in section 28 are made. Do not deploy this pass.
