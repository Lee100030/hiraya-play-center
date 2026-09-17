# HIRAYA Critical Issues Audit (Phase 0)

**Date:** 13 September 2026  
**Mode:** Inspection only — no application code changes in this phase  
**Related:** `HIRAYA_SYSTEM_TEST_REPORT.md`, `HIRAYA_IMPROVEMENT_PLAN.md`

---

## 1. Current architecture

Monorepo `Hiraya play Center React` (pnpm workspaces).

```text
Public visitors          Staff / teachers          Parents / teachers
     │                         │                         │
apps/web (Next.js)      apps/desktop (Electron)    apps/mobile (Expo)
     │  same-origin /api/*          │  VITE_API_URL           │  LAN :5188
     ▼                              ▼                         ▼
          Next proxy (apps/web/lib/server/backend.ts)
                              │
                    Hiraya.Api  :5188  (ASP.NET Core)
                              │
              MySQL  hiraya_learning_center  (EF Core)
```

| Piece | Location |
| --- | --- |
| React public + admin + `/app` workspace | `apps/web` |
| Electron main | `apps/desktop/electron/main.cjs` |
| Electron preload | `apps/desktop/electron/preload.cjs` |
| Desktop renderer | `apps/desktop/src/*` (Vite) |
| Shared TypeScript API client | `packages/api` |
| Config / session header | `packages/config` (`X-Hiraya-Session`) |
| Roles / store types | `packages/types` |
| Login password aliases | `packages/utils` `resolveLoginPassword` |
| Zod public enroll | `packages/validation` |
| Backend | `backend/Hiraya.Api`, `Hiraya.Shared`, `Hiraya.Data` |
| Vercel | Root / `apps/web/vercel.json` — website only |
| Optional hosted API | `Dockerfile`, `.do/app.yaml` |
| Tests | **None** |
| Original MAUI | Outside this repo (`C:\Users\LEE\source\repos\Hiraya`) — do not delete |

**Existing API style (do not replace with a new stack):** HMAC session + `GET/PUT /api/store` (full document) plus dedicated routes for login, public enrollment, enrollment approve/reject/cancel, staff, parents, modules, website CMS. There is **no** `GET /api/auth/me`, **no** refresh endpoint, and **no** REST `GET /api/students` collection. Phase 1 should **repair the connection to Hiraya.Api**, not invent Express/Firebase/Supabase or a parallel REST surface unless you approve that as a major architecture change.

**Split brain:** If the proxy cannot reach Hiraya.Api (typical on Vercel without `NEXT_PUBLIC_API_URL`), Next uses `apps/web/lib/server/mysql.ts` — login, partial store, public enroll only. Approve-enrollment and full CRUD require Hiraya.Api.

---

## 2. Current authentication flow

1. Client posts `{ login, password }` to `POST /api/auth/login` (web: same-origin Next route → proxy or MySQL fallback).  
2. Hiraya.Api: `PortalAuthService` verifies PBKDF2 hash **or** canonical seed password (backdoor).  
3. Issues HMAC ticket (`SessionTokens`) in JSON `{ user, token }`. Header on later calls: `X-Hiraya-Session`.  
4. Web/desktop persist token + user JSON in **`localStorage`**. Mobile uses SecureStore + in-memory token.  
5. Logout: `POST /api/auth/logout` revokes JTI **in process memory only**.  
6. Actor resolution: `ParentPortalApi.ActorAsync` — parse ticket, check revoke list, load user, password stamp.

**Not implemented:** `GET /api/auth/me`, `POST /api/auth/refresh`, HttpOnly cookies.

**Client helpers that weaken this:**

| File | Behavior |
| --- | --- |
| `packages/utils/src/index.ts` | Maps `admin123` → `Admin123` etc. |
| `apps/web/lib/enrollment.ts` | `CLOUD_SESSION_TOKEN = 'hiraya-cloud-mysql'`, `DEMO_SESSION_TOKEN`, `isDemoLogin` |
| `apps/web/lib/server/mysql.ts` | If proxy fails: `admin`/`admin123` always succeeds; token is the static cloud string |
| `apps/web/components/AuthProvider.tsx` | `resolveLoginPassword` then `api.login` |
| `apps/desktop/src/App.tsx` | Same; restores user from localStorage **without re-validating role with the API** |
| `apps/mobile/src/auth.tsx` | Remaps username `admin` → parent seed; on blocked role **falls through to demo parent** |

---

## 3. Current database / API status

| Environment | Status |
| --- | --- |
| **Production website** (hirayalearningcenter.app, 13 Sep 2026) | `GET /api/health` → `{ status: "unconfigured", database: "none" }`. Login 503. Public site uses `publicDefaults` (Kinder/Grade 1, `hello@hiraya.local`). |
| **Local Hiraya.Api** | Designed: `0.0.0.0:5188`, `HIRAYA_MYSQL` / appsettings, XAMPP. Not listening during the last probe from this workspace. |
| **EF tables** | users, parent_students, students, classes, enrollments, attendance, payments, enrollment_applications, programs, progress_records (reports), notifications, learning_modules, audit_logs, roles, etc. **No FK constraints.** |
| **Enrollment persist** | `POST /api/public/enrollment` → `EnrollmentService.SubmitPublicApplicationAsync`. Next fallback INSERTs applications only. |
| **Approve** | `POST /api/enrollment/applications/{id}/approve` — creates student/parent/class seat. **No Vercel fallback.** |

`.env.example` already documents `HIRAYA_API_URL`, `NEXT_PUBLIC_API_URL`, `VITE_API_URL`, `HIRAYA_MYSQL` (commented). Missing: `HIRAYA_SESSION_SECRET`, `HIRAYA_API_INTERNAL`, demo-mode flag.

---

## 4. Current user roles

From `packages/types` / `UserRoles`: `super_admin`, `admin`, `teacher`, `staff`, `parent`, `student`.

Seed users (local DB initialize): `admin`, `ops`, `teacher`, `staff`, `parent`, plus extra teachers — canonical passwords in `SeedData.cs`.

Backend permission catalog: `PermissionKeys` + `StoreSanitizer` (GET scoped; PUT merge by role). Staff PUT is wide.

---

## 5. Current route protection

| Surface | Protection |
| --- | --- |
| Public nav | Home, About, Programs, Contact + Enroll. **No Admin link** (`apps/web/lib/nav.ts`). |
| `/admin` | Client `AdminGate` in `apps/web/app/admin/layout.tsx`: if `user` exists → **full AdminShell**. **No `isAdmin` check. No `middleware.ts`.** |
| `/app` | `AppShell`: redirect to `/admin` if no user. Nav filtered by `appNav(role)`; **URLs still open**. |
| `/login` | Redirects to `/admin`. |
| Desktop | Login required for Shell. **Sidebar = all `NAV_GROUPS`.** Role from localStorage user object. |
| Mobile tabs | Redirect if logged out. **Stack routes (`/enroll`, `/attendance`, …) not gated.** |
| API | Session required on `/api/store` and ops routes. Public: health, hub, site, enroll, logo. |

---

## 6. Current desktop modules

| Module | File | State |
| --- | --- | --- |
| Dashboard | `DashboardPage.tsx` | Live counts from store |
| Teachers / parents / students / programs / classes / enrollment | dedicated pages | Real CRUD via API / `putStore` |
| Attendance | `WorkspacePages.tsx` | **Read-only table** |
| Progress | same | **Read-only** (`store.reports`) |
| Payments | same | **Read-only** |
| Calendar | same | Schedule table, not a calendar |
| Notifications | same | Read-only |
| Modules | same | Filename list, no upload |
| Reports | same | Count cards |
| Settings | same | Signed-in profile text |

Electron security: `contextIsolation: true`, `nodeIntegration: false`, small preload. Packaged **View → toggleDevTools**. No navigation allowlist, no CSP.

---

## 7. Current mobile behavior

- Intended: parent + teacher only (`apps/mobile/src/rbac.ts`).  
- `mobileLoginIds`: username `admin` → `parent` / `Parent123`. Login copy advertises `admin / admin123`.  
- After successful admin/staff login: logout then **demo parent** (`notes: 'mobile-preview'`), empty store, no “offline preview” banner.  
- `MOBILE_LOGIN_BLOCKED` unused.  
- Keyboard: enroll/password lack KeyboardAvoidingView; tab bar / `Screen` top-only safe area.  
- Student role: not a mobile workspace.

Public **website** (responsive): live About/Contact/Programs at phone width showed a **narrow left column**, unused cream, About **footer overlap**. Separate from Expo.

---

## 8. Current security risks

| Severity | Issue | Location |
| --- | --- | --- |
| Critical | Seed password rehashes and reactivates users | `SeedData.TryCanonicalSeedPassword`, `PortalAuthService.AuthenticateAgainstAsync` |
| Critical | Static session `hiraya-cloud-mysql` | `apps/web/lib/enrollment.ts`, `mysql.ts` `cloudSessionOk` |
| Critical | Fallback `admin`/`admin123` always works | `mysql.ts` |
| Critical | `/admin` any authenticated role | `admin/layout.tsx` |
| High | Seed aliases in client bundle | `packages/utils` `SEED_PASSWORDS` |
| High | Session + role in localStorage | `apps/web/lib/session.ts`, desktop `App.tsx` |
| High | Desktop trusts stored `user.role` | no `GET /api/auth/me` |
| High | Dev HMAC secret if not Production | `SessionTokens.DevelopmentSecret` |
| High | Electron DevTools in production menu | `main.cjs` |
| Medium | Open CORS in Development | `Program.cs` |
| Medium | Logout JTI only in-memory | `SessionGate` |
| Medium | Full-document `PUT /api/store` | overwrite / staff width |
| Low | Login default username `admin` on desktop | `App.tsx` |

No `dangerouslySetInnerHTML` in web. EF uses LINQ (not raw SQL). Next `mysql.ts` uses `?` placeholders.

---

## 9. Current incomplete features

- Hosted API/DB connection  
- Enrollment persist on production  
- `GET /api/auth/me` + refresh  
- Web/desktop attendance **write**, progress **write**, payment **create/edit**, reports  
- Print/PDF/CSV  
- Parent activation invite after approve  
- Automated tests  
- Public CMS real content (mission/vision/contact)  
- Privacy page referenced by enroll copy  
- Next middleware / server role checks  
- Dedicated REST collections in the Phase 1 prompt (students, programs, …) — **not present**; store document covers them when API is up  

`alert(` usage: desktop error `window.alert`; mobile `Alert.alert` for confirmations — not empty placeholders.

---

## 10. Recommended fix order (adapted to this repo)

Do **not** add a second backend. Prefer repairing Hiraya.Api + Next proxy.

1. **Phase 1 (connection):** Document and wire hosted/local hub. Set Vercel `HIRAYA_API_INTERNAL` / `NEXT_PUBLIC_API_URL` when an API exists; until then, a **local defense stack** (`npm run dev:api` + XAMPP). Do **not** add Express/Firebase. New REST `/api/students` etc. is a **major architecture change** — skip unless approved; use existing `/api/store` + enrollment routes first. Add `GET /api/auth/me` as a small additive endpoint. Update `.env.example` with session secret names.  
2. **Enrollment persist:** Ensure public POST always hits Hiraya.Api when configured; show reference id; keep Zod validation.  
3. **Auth hardening:** Development-only seed repair; remove static cloud token and `admin123` fallback; no production backdoors.  
4. **`/admin` + web RoleGuard:** `isAdmin` / staff only; parents → `/portal/family`; teachers → `/app`.  
5. **Desktop nav filter** from the same permission helper; block view switch.  
6. **Mobile:** stop admin remap and silent preview; show access denied.  
7. **Attendance / progress / payments / reports** as real store writes (desktop + web), then parent read on mobile.  
8. **Public CSS** (full-width, About overlap).  
9. **UI polish** with existing `@hiraya/ui`.  
10. **Vitest** on utils/RBAC/validation; later Playwright if you approve.  
11. **Security audit file** after those fixes.  
12. **Build + deployment checklist.**

---

## Search inventory (Phase 0)

| Term | Finding |
| --- | --- |
| `admin` / `login` / `password` | AdminGate, AdminLoginForm, PortalAuthService, seed users |
| `seed` | `SeedData.cs`, `TryCanonicalSeedPassword` |
| `token` / `session` / `localStorage` | HMAC + localStorage/SecureStore; static cloud token |
| `jwt` | Not used (HMAC packed string) |
| `role` / `isAdmin` | `@hiraya/utils` `isAdmin`; unused in AdminGate |
| `enrollment` | Public modal + `EnrollmentApi` + desktop `EnrollmentPage` |
| `attendance` / `progress` / `payment` / `report` | Store fields exist; desktop/web writes incomplete |
| `fetch` / `api` | `@hiraya/api`; no axios |
| `mock` / `stub` / `TODO` / `Coming soon` | No “Coming soon”; operational modules are read-only tables |
| Hardcoded credentials | Seed + mysql fallback + utils map + mobile login hint |

---

## Phase 0 decision for Phase 1

**Compatible backend already exists: ASP.NET `Hiraya.Api` + MySQL.**  
Introducing Node/Supabase/Firebase would duplicate the thesis system. Hosted-site failure is **missing env/host**, not missing technology.

**Approval needed before:** replacing `GET/PUT /api/store` with a full REST resource API as listed in the long Phase 1 prompt.
