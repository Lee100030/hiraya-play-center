# HIRAYA Learning Center — Improvement Plan

**Date:** 13 September 2026  
**Companion:** `HIRAYA_SYSTEM_TEST_REPORT.md`  
**Rule:** No major code changes until you approve an item. Work one module at a time. Do not replace the API with fake data.

---

## Must Fix Before Thesis Defense

### 1. Connect one real hub for website, desktop, and mobile

| | |
| --- | --- |
| **Problem** | Live site `GET /api/health` is `unconfigured` / `database: none`. Login returns 503. Public programs/contact are hardcoded defaults. |
| **Why it matters** | A panel cannot enroll, sign in, or see real center data. |
| **Affected** | Website (critical), admin, enrollment; desktop/mobile if they are shown as “online.” |
| **Recommended solution** | Run `npm run dev:api` + XAMPP for a **local defense**, **or** host Hiraya.Api and set Vercel `HIRAYA_API_INTERNAL` / `NEXT_PUBLIC_API_URL` plus `HIRAYA_MYSQL` on the API only. Stop treating the Next MySQL fallback as a second product. |
| **Priority** | CRITICAL |
| **Difficulty** | Medium (ops) / Low if defense is local-only and scripted |
| **Risk** | Misconfigured env can point production at the wrong database |
| **Database / API / mobile / desktop** | Yes / Yes / Yes (same URL) / Yes |

### 2. Close the enrollment loop on the same database

| | |
| --- | --- |
| **Problem** | Public enroll UI works; persist and approve only work through Hiraya.Api. Fallback PUT can mark status without creating a student. |
| **Why it matters** | Chapter-style “online enrollment + admin approval + parent view” is the flagship workflow. |
| **Affected** | Website, API, desktop enrollment, parent mobile |
| **Recommended solution** | Always proxy enroll/approve to Hiraya.Api. Demo script: submit → appear in desktop/admin → approve → parent sees child. Do not POST test data to production until the hub is ready. |
| **Priority** | CRITICAL |
| **Difficulty** | Medium |
| **Risk** | Duplicate applications if both fallback and API write |
| **Database / API / mobile / desktop** | Yes / Yes / Yes / Yes |

### 3. Enforce roles on every client

| | |
| --- | --- |
| **Problem** | `/admin` accepts any logged-in user. Desktop lists every module. Mobile maps `admin` to parent and turns blocked roles into a demo parent. |
| **Why it matters** | RBAC is a standard thesis criterion. |
| **Affected** | Web admin, desktop, mobile |
| **Recommended solution** | AdminGate: `isAdmin` or staff as you define. Desktop nav from `allows()`. Mobile: show `MOBILE_LOGIN_BLOCKED`; never remap admin; never preview after a successful non-parent/teacher login. |
| **Priority** | CRITICAL |
| **Difficulty** | Low–medium |
| **Risk** | Locking a panel out of a demo account if roles are wrong |
| **Database / API / mobile / desktop** | No (unless you add checks server-side) / Should add / Yes / Yes |

### 4. Remove authentication backdoors before a public demo

| | |
| --- | --- |
| **Problem** | Canonical seed passwords rehash live users. Vercel `hiraya-cloud-mysql`. Fallback `admin`/`admin123`. |
| **Why it matters** | Trivial takeover of a hosted site. |
| **Affected** | API, Next `mysql.ts`, `packages/utils` |
| **Recommended solution** | Gate seed repair behind `ASPNETCORE_ENVIRONMENT=Development` only. Delete static cloud token; use HMAC only. Document local seed accounts in the manuscript, not in the production bundle. |
| **Priority** | CRITICAL |
| **Difficulty** | Low |
| **Risk** | Local first-run login breaks if seed repair is removed without a seeded hash |
| **Database / API / mobile / desktop** | Password hashes / Yes / Login helpers / Login helpers |

---

## Should Fix Before Final Demonstration

### 5. Teacher write path: attendance and progress

| | |
| --- | --- |
| **Problem** | Teachers cannot record attendance/progress on desktop (read-only). Web progress is read-only. Mobile attendance is history only. |
| **Why it matters** | “Teacher module” is empty in a live demo. |
| **Affected** | Desktop `WorkspacePages`, web `progress`/`attendance`, mobile |
| **Recommended solution** | Reuse existing store fields and `StoreSanitizer` teacher PUT rules. One mark-attendance form + one add-progress form. Parent mobile already reads those lists. |
| **Priority** | HIGH |
| **Difficulty** | Medium |
| **Risk** | Full-store PUT conflicts; keep merges server-side |
| **Database / API / mobile / desktop** | Same tables / existing PUT or small POST later / display / write UI |

### 6. Replace public placeholder content

| | |
| --- | --- |
| **Problem** | `hello@hiraya.local`, fake phone, empty mission/vision, development banner. |
| **Why it matters** | Looks unfinished on a projector. |
| **Affected** | Public website CMS / `publicDefaults` |
| **Recommended solution** | Save real copy in Website CMS against the API. Remove or schedule the “under development” banner. |
| **Priority** | HIGH |
| **Difficulty** | Low |
| **Risk** | None if CMS save works |
| **Database / API / mobile / desktop** | Settings/CMS / website endpoints / programs list / no |

### 7. Public site mobile layout

| | |
| --- | --- |
| **Problem** | Inner pages: narrow left column, unused cream, About footer overlap, clipped hours. |
| **Why it matters** | “Responsive website” is easy for a panel to fail. |
| **Affected** | `apps/web` public CSS |
| **Recommended solution** | Full-width `.public-page` below 768px; footer stacking; no overlap. |
| **Priority** | HIGH |
| **Difficulty** | Low |
| **Risk** | Visual only |
| **Database / API / mobile / desktop** | No / No / Browser mobile / No |

### 8. Honest empty/error states (no silent demo data)

| | |
| --- | --- |
| **Problem** | Public site swallows API errors. Mobile preview looks like a real empty school. |
| **Why it matters** | Panels think the database is empty or the app is broken. |
| **Affected** | `usePublicSite`, mobile `auth.tsx` / `store.tsx` |
| **Recommended solution** | Banner: “Could not reach HIRAYA API” vs “Preview mode — not live data.” |
| **Priority** | HIGH |
| **Difficulty** | Low |
| **Risk** | None |
| **Database / API / mobile / desktop** | No / No / Yes / optional |

### 9. One defense-ready report

| | |
| --- | --- |
| **Problem** | Reports are count cards. No print/PDF. |
| **Why it matters** | Many rubrics list “reports.” |
| **Affected** | Web/desktop reports |
| **Recommended solution** | One page: students, pending applications, open balances, today’s attendance — from store, plus `window.print()` CSS. Skip a heavy chart library. |
| **Priority** | HIGH |
| **Difficulty** | Low–medium |
| **Risk** | None |
| **Database / API / mobile / desktop** | Read / existing GET / no / yes |

### 10. Parent activation after approve

| | |
| --- | --- |
| **Problem** | Approve creates `pending_activation` without invitation. |
| **Why it matters** | New parents cannot log in after a successful demo approve. |
| **Affected** | `EnrollmentService` |
| **Recommended solution** | Create `AccountInvitation` or set a known demo password **only in Development**. |
| **Priority** | HIGH |
| **Difficulty** | Medium |
| **Risk** | Email/SMTP if you send real invites |
| **Database / API / mobile / desktop** | Yes / Yes / login / no |

---

## Recommended Improvements

| ID | Problem | Why | Apps | Solution | Priority | Difficulty | Risk | DB | API | Mobile | Desktop |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Almost no Delete on web | Incomplete CRUD | Web | Wire existing `deleteStaff` / archive students | MEDIUM | Low | Accidental deletes — confirm dialogs | Yes | Yes | No | Already has some |
| R2 | Payments append-only | Totals won’t match story | Web/desktop | Edit/void + parent balance | MEDIUM | Medium | Money integrity | Yes | Yes | Read | Write |
| R3 | Calendar not a calendar | Misleading nav | Web/desktop | Month grid **or** rename to “Events” | MEDIUM | Medium | Scope creep | No | No | No | Yes |
| R4 | Modules no file open | API file ticket unused | All | Open via `/api/modules/{id}/file` | MEDIUM | Medium | Auth on files | Files | Yes | Yes | Yes |
| R5 | Search unlabeled | A11y | Web | `aria-label` | LOW | Low | None | No | No | No | Maybe |
| R6 | Contrast gold on cream | WCAG | Public CSS | Darker gold | LOW | Low | Brand tweak | No | No | Browser | No |
| R7 | Electron DevTools + no CSP | Packaged risk | Desktop | Hide DevTools when packaged; CSP; navigation allowlist | MEDIUM | Low | Harder local debug | No | No | No | Yes |
| R8 | Help opens `127.0.0.1:3000` | Broken off that PC | Desktop | Use `HIRAYA_PUBLIC_URL` | LOW | Low | None | No | No | No | Yes |
| R9 | Keyboard / tab inset | Forms and iPhone home indicator | Mobile | KAV + bottom safe area | MEDIUM | Low | Layout | No | No | Yes | No |
| R10 | Deep links skip login | Security | Mobile | Auth gate on stack | MEDIUM | Low | None | No | No | Yes | No |
| R11 | Contact form | Nice-to-have | Public | Mailto or simple POST | LOW | Low | Spam | Maybe | Maybe | No | No |
| R12 | Privacy page | Copy already mentions it | Public | One static page | LOW | Low | Legal wording | No | No | No | No |

---

## Future Development

Out of current thesis scope unless already promised in Chapter 1:

- Student-role mobile app  
- Payment gateway (GCash/PayMaya)  
- Push notifications  
- QR time-in hardware  
- Multi-branch / multi-instance API without full-document PUT  
- EF foreign keys + true REST instead of store document (large migration)  
- Playwright + xUnit suites beyond smoke tests  

---

## Recommended implementation order

1. Decide **defense mode**: local hub **or** hosted API (item 1).  
2. Role gates + mobile login honesty (item 3).  
3. Enrollment loop rehearsal on that hub (item 2).  
4. Seed/token lockdown for anything on the public internet (item 4).  
5. Teacher attendance + progress (item 5).  
6. Public copy + mobile CSS + reports (items 6–9).  
7. Parent activate (item 10).  
8. Electron hardening and a11y (R5–R8).  
9. Optional CRUD polish (R1–R4).

---

## Approval

Reply with which numbered items to implement (for example: “Do 1 local-only, 3, 5, 7”). I will change only those modules, keep existing branding and API behavior, and re-test after each change.
