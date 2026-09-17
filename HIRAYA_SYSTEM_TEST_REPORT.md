# HIRAYA Learning Center — System Test Report

**Date:** 13 September 2026  
**Scope:** Public website, admin/workspace web app, Expo mobile app, Electron desktop app, ASP.NET API, MySQL store, authentication and roles  
**Code changes:** None (inspect-only, as requested)

---

## 1. Executive Summary

HIRAYA is a real multi-client thesis system: one ASP.NET hub (`Hiraya.Api`) over MySQL (`hiraya_learning_center`), a Next.js public site plus staff/family workspace, an Electron operations client, and an Expo parent/teacher app. Branding (green/gold, crest, “Growing Minds. Building Futures.”) is consistent and the public site is already live.

The architecture is **thesis-viable**, but it is **not yet defense-ready as an end-to-end product**. The hosted website is **not connected to a database or the ASP.NET API**. Enrollment, login, and live CMS content therefore cannot succeed on production. Locally, the intended hub is `http://0.0.0.0:5188`, but that process was **not reachable** during this audit session, so local CRUD persistence was verified from code and prior sessions, not from a fresh live loop.

Core people and enrollment flows exist on desktop and (partially) on web. Attendance, progress, payments, calendar, reports, modules, and notifications are **thin or read-only** on several clients. Role checks are incomplete: any logged-in user can open `/admin`; desktop shows every nav item; mobile remaps `admin` to a parent preview. Seed passwords and a static cloud session token are high-risk for a public demo.

**Overall Thesis Readiness: 54 / 100**

---

## 2. Project Architecture

```text
Parents / public
    ↓
Next.js public site (apps/web)  ──same-origin /api/*──►  (proxy)
    ↓                                                    │
Expo mobile (apps/mobile)  ─────────────────────────────┤
    ↓                                                    ▼
Electron desktop (apps/desktop)  ──────────────►  Hiraya.Api :5188
                                                     ↓
                                              MySQL hiraya_learning_center
```

| Layer | Technology |
| --- | --- |
| Public website + admin/workspace | Next.js (App Router), React |
| Mobile | Expo SDK 57, Expo Router, React Native |
| Desktop | Electron 34 + Vite + React |
| Shared clients | `@hiraya/api`, `@hiraya/types`, `@hiraya/config`, `@hiraya/utils`, `@hiraya/ui`, `@hiraya/validation` |
| Backend | ASP.NET Core Minimal APIs (`backend/Hiraya.Api`) |
| Data | EF Core + MySQL; document-style `GET/PUT /api/store` |
| Auth | HMAC session in `X-Hiraya-Session` (not JWT) |
| State | Per-app providers (`AuthProvider` / `StoreProvider` / mobile `store.tsx`) |
| Routing | Next App Router; Expo file routes; desktop in-app `ViewId` |
| Tests | **None** (no Jest/Vitest/Playwright/xUnit projects) |
| Docs | `README.md`, `backend/README.md`, `MAUI_TO_REACT_MIGRATION.md` |

**Do mobile and desktop share the backend?** Yes, by design: both call `@hiraya/api` against Hiraya.Api and the same MySQL database. The **hosted website** currently does **not**: `GET /api/health` on production returns `{ "status": "unconfigured", "database": "none" }`. When Vercel has no `NEXT_PUBLIC_API_URL` / `HIRAYA_MYSQL`, Next.js uses a thinner MySQL fallback that is **not** the full enrollment-approve pipeline.

Original MAUI at `C:\Users\LEE\source\repos\Hiraya` is out of this React repo and was not modified.

---

## 3. Tested Applications

| Application | How tested | Result |
| --- | --- | --- |
| Public website (live) | Browser: home, about, programs, contact, enroll modal, `/admin` login chrome; HTTP health/site | Pages load; data is **placeholder**; API unconfigured |
| Public website (local) | Connection to `:3000` | **BLOCKED** — nothing listening from this environment |
| Admin dashboard | Code + live `/admin` form | Login UI exists; live login **503** without DB |
| Mobile app | Code + prior Expo session (login failures) | Screens exist; RBAC/preview bugs; Metro not re-tested this session |
| Desktop app | Code + Electron `main.cjs` | Dedicated ops UI; several modules are read-only stubs |
| Backend/API | Code inventory; live `/api/health`; local `:5188` | Production unconfigured; local **BLOCKED** this session |
| Database | EF models + `mysql.ts` fallback | No FK constraints; split-brain risk |

**Safe test data:** No `TEST STUDENT` records were written. Live POST to enrollment was not executed (production write).

---

## 4. Functional Testing Results

Statuses: PASS / FAIL / BLOCKED / NEEDS IMPROVEMENT / NOT IMPLEMENTED

| Test ID | Module | Test Scenario | Expected Result | Actual Result | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| T-PUB-01 | Public home | Open live home | Branded home, nav, enroll CTA | Loads; crest, hero, programs, contact; “Website under Development” | PASS | — |
| T-PUB-02 | Public nav | Admin not in public nav | No Admin link | Home / About / Programs / Contact + Enroll only | PASS | — |
| T-PUB-03 | About | Open `/about` | Mission/vision/content | Page 200; mission/vision empty; placeholder copy | NEEDS IMPROVEMENT | HIGH |
| T-PUB-04 | Programs | Open `/programs` | Real programs from DB | Static Kinder / Grade 1 defaults (`publicDefaults`) | FAIL | HIGH |
| T-PUB-05 | Contact | Real address/phone | Center contact | `Local development center`, `09170000000`, `hello@hiraya.local` | FAIL | HIGH |
| T-PUB-06 | Contact form | Submit inquiry | Form or clear CTA | Display-only cards; no form | NOT IMPLEMENTED | MEDIUM |
| T-PUB-07 | Enroll modal | Open Enroll now | Wizard with program then form | Modal opens; Kinder/Grade 1; labeled fields | PASS | — |
| T-PUB-08 | Enroll persist | Submit to database | 200 + admin sees application | Production health unconfigured; no hosted Hiraya.Api | FAIL | CRITICAL |
| T-PUB-09 | Privacy notice | Linked policy | Page exists | Copy mentions “admissions privacy notice”; no page | NOT IMPLEMENTED | MEDIUM |
| T-PUB-10 | Gallery | `/gallery` | In nav or unused | Route 200 but **not in public nav** | NEEDS IMPROVEMENT | LOW |
| T-ADM-01 | `/admin` | Unauthenticated | Login, not dashboard | “Admin sign in” form | PASS | — |
| T-ADM-02 | `/admin` | Login on production | Session + dashboard | `POST /api/auth/login` → 503 “Cloud database is not configured.” | FAIL | CRITICAL |
| T-ADM-03 | Admin gate | Parent cannot use `/admin` | Role redirect | `AdminGate` only checks `user` exists | FAIL | CRITICAL |
| T-ADM-04 | Middleware | Direct `/app` URL | Server redirect if anonymous | **No `middleware.ts`** | FAIL | HIGH |
| T-ADM-05 | Dashboard KPIs | Counts from DB | Match store | Web dashboards use `useStore()`, not hardcoded numbers | PASS | — |
| T-ADM-06 | Students | CRUD | Create/update/delete persist | Create/update; **no delete**; PUT store fallback incomplete | NEEDS IMPROVEMENT | HIGH |
| T-ADM-07 | Parents | CRUD | Edit/deactivate | Create + unlink; edit/deactivate unused | NEEDS IMPROVEMENT | HIGH |
| T-ADM-08 | Enrollment review | Approve creates student | Student + parent + class | Implemented in `EnrollmentService` on Hiraya.Api only | BLOCKED | CRITICAL |
| T-ADM-09 | Progress | Teachers add notes | Create/edit | Web progress is **read-only table** | FAIL | HIGH |
| T-ADM-10 | Attendance | Mark attendance | Save + list | Partial create on `/app/attendance`; missing from admin nav | NEEDS IMPROVEMENT | HIGH |
| T-ADM-11 | Payments | Record + ledger | Edit/void | Add charge only | NEEDS IMPROVEMENT | HIGH |
| T-ADM-12 | Reports | Exportable reports | Charts/PDF | Six/four count cards | FAIL | HIGH |
| T-ADM-13 | Calendar | Month calendar | Grid + events | List stub | FAIL | MEDIUM |
| T-ADM-14 | Notifications | Send / mark read | Staff compose | Read-only | FAIL | MEDIUM |
| T-ADM-15 | Modules | Upload/open files | API exists | Web list read-only; desktop lists filename only | FAIL | HIGH |
| T-MOB-01 | Login parent/teacher | API session | Real store | Seed parent/teacher historically 401; preview user with empty store | FAIL | CRITICAL |
| T-MOB-02 | Admin on mobile | Blocked with message | `MOBILE_LOGIN_BLOCKED` | `admin` remapped to parent; blocked roles fall through to demo parent | FAIL | HIGH |
| T-MOB-03 | Deep links | Auth required | Redirect to login | Stack routes not gated | FAIL | HIGH |
| T-MOB-04 | Student role | Own profile | Student workspace | Not on allowlist; can become demo parent | NOT IMPLEMENTED | MEDIUM |
| T-MOB-05 | Teacher attendance write | Mark attendance | API write | History is read-only | NOT IMPLEMENTED | HIGH |
| T-DES-01 | People CRUD | Teachers/students/parents | Persist via API | Real CRUD in desktop pages when API is up | PASS (code) | — |
| T-DES-02 | Enrollment | Approve/reject/cancel | Same as API | Wired to enrollment endpoints | PASS (code) | — |
| T-DES-03 | Attendance/progress/payments | Operational write | Forms | **Read-only tables** | FAIL | HIGH |
| T-DES-04 | RBAC | Hide admin nav from teacher | Filtered nav | All views listed for any login | FAIL | HIGH |
| T-API-01 | Health (live) | `ok` + database | Connected | `unconfigured` / `none` | FAIL | CRITICAL |
| T-API-02 | Store unauth | 401 | Unauthorized | Designed; local probe BLOCKED | BLOCKED | — |
| T-API-03 | Seed password backdoor | Password change holds | Canonical seed still logs in and rehashes | `TryCanonicalSeedPassword` | FAIL | CRITICAL |
| T-DB-01 | FKs | Referential integrity | FK constraints | String IDs, no EF relationships | FAIL | HIGH |
| T-SEC-01 | Cloud session | HMAC | Forgable static token | `hiraya-cloud-mysql` | FAIL | CRITICAL |
| T-TEST-01 | Automated tests | Login/enroll/RBAC | Suite exists | **Zero** test files | FAIL | HIGH |

---

## 5. UI/UX Testing Results

**Strengths**

- Consistent HIRAYA green/gold/cream, crest, and public header/footer.
- Enrollment modal is a real admissions wizard (program → learner → parent → schedule).
- Desktop Shell is a workspace (sidebar, search, notifications), not an iframe of the website.
- Shared empty/loading components exist on many web and mobile screens.

**Problems**

- Live banner **“Website under Development”** undermines a thesis demo.
- Placeholder contact and empty mission/vision look unfinished.
- Public inner pages at phone width: content sits in a **narrow left column** with unused cream space; About footer overlapped the content in the captured layout.
- Enrollment privacy sentence has no destination.
- Duplicate Enroll CTAs in the header (nav + end).
- Web `/app` vs `/admin` is confusing (two shells, overlapping pages).
- Desktop operations pages that are stubs still look like finished modules (false completeness).

---

## 6. Mobile Responsiveness Results

| Viewport | Evidence | Status |
| --- | --- | --- |
| Live desktop home | Full hero, crest, nav capsule | PASS |
| ~iPhone width About/Contact/Programs | Hamburger; cards; **large empty right gutter**; hours card clipped on About | FAIL |
| Tablet | Not separately captured | BLOCKED |
| Expo Go device | Prior session: LAN/API and login issues | FAIL / BLOCKED |
| Keyboard covering enroll/password | No `KeyboardAvoidingView` on those screens | FAIL |
| Tab bar vs home indicator | Fixed height 64, `Screen` `edges={['top']}` only | FAIL |
| Landscape Expo | Not tested | BLOCKED |

---

## 7. Desktop Application Results

| Check | Result |
| --- | --- |
| Dedicated React workspace (not public site in a window) | PASS |
| `contextIsolation: true`, `nodeIntegration: false`, preload | PASS |
| Window size 1440×900, min 900×680 | PASS |
| Production `toggleDevTools` in View menu | FAIL |
| No `will-navigate` / `setWindowOpenHandler` allowlist | FAIL |
| No CSP in `index.html` | FAIL |
| Help → public site hardcoded `http://127.0.0.1:3000` | FAIL (wrong for packaged/demo PC) |
| Print / PDF / file upload | NOT IMPLEMENTED |
| Attendance / progress / payments / calendar / modules / reports / settings | Read-only or profile-only stubs |
| Packaged path `dist/index.html` | Present in `main.cjs`; packaged build not run this session |

---

## 8. Authentication Testing

| Scenario | Result |
| --- | --- |
| Valid seed login against Hiraya.Api | Designed: HMAC 12h ticket, lockout 8/5 min | BLOCKED locally |
| Live website login | 503, database none | FAIL |
| Empty / invalid credentials | Login form required fields; API 401 when hub is up | PARTIAL |
| Logout | Web/desktop/mobile call `/api/auth/logout` + clear storage | PASS (code) |
| Refresh persistence | `localStorage` / SecureStore; **no refresh/expiry UI** | NEEDS IMPROVEMENT |
| `/admin` without login | Login form | PASS |
| Session in localStorage | XSS-readable `hiraya.session` + user JSON | FAIL |
| Password visibility toggle | Not verified on all clients | NEEDS IMPROVEMENT |
| Password reset / forgot | Activate flow exists; no self-service forgot-password | NOT IMPLEMENTED |
| Mobile preview login | Offline demo parent/teacher with empty store | FAIL (misleading) |

---

## 9. Role and Permission Testing

| Role | Intended | Actual |
| --- | --- | --- |
| Super admin / admin | Full ops | Web `/admin` does **not** require admin role. Desktop shows **all** nav. |
| Staff | Ops without some admin tools | `StoreSanitizer` allows wide PUT of payments/attendance. |
| Teacher | Assigned classes, attendance, progress | Web nav filtered; progress page cannot write. Desktop not filtered. Mobile: no attendance write; child picker missing. |
| Parent | Own children only | Backend `FamilyAccess` + sanitizer. Mobile student URL not scoped to children. |
| Student | Own data | Types exist. **No student mobile app.** Family web portal is thin count cards. |
| Cross-parent isolation | Must not see other children | API sanitizer intended; not live-proven this session. |

---

## 10. API Testing

Hiraya.Api exposes health, hub, store GET/PUT, auth, public site/enrollment, parent portal, admin parents, enrollment actions, staff, modules (incl. files), website CMS.

**Client handling**

- `@hiraya/api` maps error JSON `error`/`message` to `ApiError`.
- Web store errors surface via `StoreStatus`.
- Public `usePublicSite` **swallows** API errors and shows defaults (hides outage).
- Production login error is user-visible 503 (good) but the product cannot sign in.

**Status coverage**

| Code | Handling |
| --- | --- |
| 200/204 | Used |
| 401 | Unauthorized on store |
| 423 | Login lockout |
| 400 | Enrollment/password messages |
| 503 | DB down / unconfigured |
| 404/409/422 | Inconsistent; many routes return 400 instead |
| Network failure | Web proxy now returns null and may fall back to MySQL; mobile may enter **preview** |

Most classroom CRUD is **not REST**. Clients PUT the entire store document — high conflict and overwrite risk.

---

## 11. Database Testing

- Tables exist for users, students, parent_students, classes, enrollments, attendance, payments, applications, modules, etc.
- **No foreign keys.** Orphan attendance/payments/enrollments are possible.
- Dual parent link: `students.ParentId` and `parent_students`.
- Full-document save (`EfHirayaRepository`) + process lock: multi-instance last-write-wins.
- Approve path creates student + parent (`pending_activation`) **without invitation** → parent may be unable to activate.
- Vercel fallback GET store is applications+programs only; a later PUT to Hiraya.Api could wipe data if a partial store is saved.
- Production: **no database configured**.

---

## 12. Security Testing

Destructive scanning of external systems was not performed.

| Issue | Severity |
| --- | --- |
| Seed password still authenticates and **rewrites the hash** after a password change | CRITICAL |
| Vercel fallback token `hiraya-cloud-mysql` | CRITICAL |
| Fallback `admin` / `admin123` always succeeds when MySQL login path is used | CRITICAL |
| Known seed users in repo (`Admin123`, `Teacher123`, …) | HIGH (OK only on local demo if disclosed) |
| No Next middleware; client-only route gates | HIGH |
| Session in localStorage | HIGH |
| Open CORS in Development | MEDIUM (expected locally) |
| Dev session secret default outside Production | HIGH if a host is not set to Production |
| Electron DevTools in packaged menu; no navigation lock; no CSP | HIGH |
| `PasswordHasher.Verify` may accept plaintext if prefix missing | MEDIUM |
| Spoofable `X-Forwarded-For` vs public throttles | MEDIUM |
| Full-store PUT from privileged clients | HIGH |
| No `dangerouslySetInnerHTML` in web | PASS |
| EF parameterized LINQ (no raw SQL) | PASS |

---

## 13. Performance Testing

Local timing was **BLOCKED** (API/web not listening). From design:

- Every dashboard loads the **entire** `HirayaDatabase`.
- Saves rewrite the document.
- Public site may hide a failed API and look “fast” with stale defaults.
- Crest PNG is used; live `hasLogo: false`.
- No evidence of request loops in the reviewed providers.
- Electron unpackaged loads Vite `:5173`.

**Score is conservative** because runtime metrics were not collected.

---

## 14. Accessibility Testing

| Check | Result |
| --- | --- |
| `html lang="en"` | PASS |
| Public menu `aria-expanded` / `aria-current` | PASS |
| Enrollment dialog `role="dialog"` | PASS |
| Form labels on enroll/login | PASS |
| Search boxes without accessible names | FAIL |
| Focus trap in modals | FAIL |
| Home path missing `<main>` | NEEDS IMPROVEMENT |
| Gold/cream contrast (eyebrows, hero over animation) | FAIL (likely WCAG AA) |
| Color-only status | Status badges exist (good) but contrast not measured with a meter |

---

## 15. Bugs and Errors

1. Production API/database **unconfigured** — login, enrollment persist, CMS all fail or show defaults.  
2. Public contact/programs are **demo placeholders**, not center data.  
3. `AdminGate` allows any authenticated role into admin chrome.  
4. Mobile `admin` → parent remap; blocked-role success becomes demo parent; `MOBILE_LOGIN_BLOCKED` unused.  
5. Mobile preview empty store looks like a real empty school.  
6. Desktop/web operational modules stubbed while nav implies they work.  
7. Seed password backdoor.  
8. Static cloud session token.  
9. About page mobile layout overlap / clipping.  
10. Inner public pages not full-width on small screens.  
11. No automated tests.  
12. Electron production DevTools + open navigation.  
13. Approve-created parents may lack activation invite.  
14. Web MySQL `PUT /api/store` only updates enrollment statuses.  
15. Deep-link mobile routes skip login.

---

## 16. Missing Features

**Required or strongly expected for this thesis (center ops)**

- Hosted or reliably running central API + MySQL for the live site  
- Enrollment submit → admin review → student record → parent/teacher mobile visibility  
- Teacher attendance **write** and progress **write**  
- Payment recording that matches dashboard totals  
- Reports that can be shown in defense (even a printable summary)  
- Role-restricted navigation on every client  
- Real center contact, mission, vision, hours  

**Partial**

- Notifications, calendar, modules, website gallery/CMS, password activate  

**Not required unless in your chapter 1 objectives**

- Student-role mobile app  
- Online payment gateway  
- Push notifications  
- Contact form  
- PDF export  
- Privacy policy page (nice-to-have; currently referenced)

---

## 17. Recommended Improvements

See `HIRAYA_IMPROVEMENT_PLAN.md`. Do not rewrite the stack. Keep Hiraya.Api as the single hub and finish the operational loops.

---

## 18. Thesis Readiness Score

```text
Overall Thesis Readiness: 54/100

Functionality: 16/30
UI/UX: 13/20
Mobile Usability: 8/15
Desktop Usability: 6/10
Security: 4/10
Performance: 3/5
Data Consistency: 2/5
Documentation and Testing: 2/5
```

**Functionality (16/30)** — Public pages, enroll UI, desktop people/enrollment, and a real API exist. Live persist, teacher write-paths, reports, and production login do not.

**UI/UX (13/20)** — Professional branding and enroll modal. Development banner, placeholders, stub screens that look finished, and mobile layout defects.

**Mobile usability (8/15)** — Real tab app and empty states, but login/RBAC/preview, keyboard, and tab inset issues. No live device pass this session.

**Desktop usability (6/10)** — Feels like software for staff CRUD. Operations after enrollment are tables without actions.

**Security (4/10)** — HMAC and sanitizer are real, then undermined by seed backdoors, static tokens, and client-only gates.

**Performance (3/5)** — Full-store pattern is simple but heavy; not measured live.

**Data consistency (2/5)** — Split Vercel vs API; no FKs; production has no DB.

**Documentation/testing (2/5)** — README/runbooks exist; **zero** automated tests before this report.

---

## 19. Priority Action Plan

1. **CRITICAL:** Point the live website at one Hiraya.Api + MySQL (or document clearly that defense uses **local** only) so enrollment and login work.  
2. **CRITICAL:** Restrict `/admin` and desktop nav by role; stop mobile admin remap / silent preview.  
3. **CRITICAL:** Disable seed-password rehash and static cloud token before any public defense network.  
4. **HIGH:** Finish teacher attendance + progress write; show the same rows on parent mobile.  
5. **HIGH:** Replace placeholder public CMS content; remove or justify the development banner.  
6. **HIGH:** One printable/report view; fix public mobile layout.  
7. **MEDIUM:** Activation invite on approve; Electron CSP/DevTools; automated login+enroll tests.

---

## 20. Final Recommendation

**Do not rewrite.** Treat Hiraya.Api as the system of record. The public site is visually close to demo quality; the **data plane is not**. For oral defense, a panel will try Enroll, Admin approve, and Parent mobile — that path is currently broken on production and only partially true in code on desktop.

**Ask before implementation:** which CRITICAL/HIGH items to fix first (hosted API vs local-demo script vs RBAC vs teacher writes). No major code changes were made in this audit.
