# RION local project audit

**Date:** 2026-09-21  
**Workspace:** `/workspace` (GitHub `lee100030/hiraya-play-center`)  
**Deployment:** PAUSED — local development only. Do not deploy until the owner types `DEPLOY NOW`.

## What this clone is

This Cloud Agent workspace is **not** the full local product folder `C:\Users\LEE\Desktop\Hiraya play Center React`. GitHub `main` is a **starter** monorepo (first commit `d5778e3`, 2026-09-10). The professional Super Admin desktop (green sidebar groups, crest, teacher workspace, hiring, group chat) **never existed in this git history**. Restoring it here means **rebuilding from website admin + shared packages + brand tokens**, not `git checkout` of a lost desktop.

Specs named `hiraya-all-fix-prompts-combined.md` and `hiraya-fullstack-system-audit-prompt.md` are **not in this repo**. Recovery uses Hiraya brand tokens (`packages/ui/src/tokens.css`) and the recovery prompt’s component rules (avatars, “Not assigned”, card/table toolbars, no overlapping widgets).

## Project structure

| Area | Path | Notes |
|---|---|---|
| Website (public + admin) | `apps/web` | Next.js 15. Public site + `/app` operations shell + `/admin` login |
| Electron desktop | `apps/desktop` | Vite + Electron. **Broken/partial:** one `App.tsx` with 6 views |
| Mobile | `apps/mobile` | Expo Router tabs (home, children, schedule, alerts, more) |
| API | `backend/Hiraya.Api` | ASP.NET Core, session HMAC `X-Hiraya-Session` |
| Data | `backend/Hiraya.Data` | EF Core → MySQL `hiraya_learning_center` |
| Shared domain | `backend/Hiraya.Shared` | Store sanitizer, auth, seed |
| Shared TS | `packages/{types,api,ui,utils,config,validation,shared}` | Clients must use these |

## Applications — status

| App | Status | Evidence |
|---|---|---|
| Public website | Partially working | Hero/programs/contact exist; no Careers/hiring in this clone |
| Website admin (`/app`) | Partially working | AppShell + many pages; staff is read-only; students have add/edit |
| Electron desktop | Broken / lost UI | Login card + thin sidebar; no teacher/parent CRUD, no workspace |
| Mobile | Partially working | Auth + tabs; family-first; not a full teacher workspace |
| Hiraya.Api | Working locally | Health `ok`, login 401 on bad password, enrollment POST |
| Database | Working locally | MariaDB `hiraya_learning_center` on this VM |

## Git / recovery check (do not reset)

| Ref | Desktop UI |
|---|---|
| `d5778e3` | Creates `apps/desktop/src/App.tsx` (simple login + 6 views) |
| All later commits | Vite/GPU, deploy files — **no** richer desktop |
| Other remotes | `main`, `cursor/hiraya-full-deploy-d8c2` only |

**Conclusion:** There is no git version in *this* repository that contains the lost professional desktop. Do not `git reset --hard`. Rebuild desktop to match website admin modules and Hiraya brand.

## Auth & API

- Login: `POST /api/auth/login` (not frontend-only).
- Store: `GET/PUT /api/store`; passwords stripped in `StoreSanitizer`.
- Teacher/parent store slices enforced in API (`VisibleTo`).
- Desktop `VITE_API_URL` defaults to `http://127.0.0.1:5188` when unset.
- Deploy branch added Vercel proxy + `eas.json` pointing at `hiraya-api.onrender.com` for **future** production builds only. Local Electron still uses Vite env / localhost.

## Known gaps vs recovery spec

- No remaining-sessions fields on `Student` / `StudentOps` in this schema.
- No dedicated Tasks table; closest: leave requests, news, alerts, teacher duties.
- Staff page on web has no Add/Edit.
- No teacher `/:id` route on web.
- Desktop login prefills username `admin` (no password in source).
- `putStore` treats HTTP 204 as empty parse — save can break clients.

## Fake / seed data

- API `DatabaseInitializer` seeds development users when the DB is empty (`admin` / hashed `Admin123` in C# seed, not in React).
- Public site `publicDefaults` are fallback copy if `/api/public/site` fails — not fake students.

## Next recovery step

Restore Electron shell + management pages sharing `@hiraya/ui` + `GET/PUT /api/store`, keep website admin in the same pattern, local API only.
