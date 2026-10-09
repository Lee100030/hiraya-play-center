# Hiraya hosting and domain migration plan

Phase 1 audit only. This document does not claim that production has moved. Do not delete Vercel, drop DNS for `hirayalearningcenter.app`, or change Neon until you approve cutover.

Sources: [Render custom domains](https://render.com/docs/custom-domains), [Render DNS for other providers](https://render.com/docs/configure-other-dns), [Deploy Next.js on Render](https://render.com/docs/deploy-nextjs-app).

---

## Current architecture

| Piece | What it is | Where it runs today |
| --- | --- | --- |
| Website | Next.js 15 (`apps/web`), public site + `/admin`, `/api/*` proxy | Vercel project `hiraya-play-center-web`, domain `https://www.hirayalearningcenter.app` |
| API | ASP.NET Core `Hiraya.Api` (Docker, `Dockerfile`) | Render `https://hiraya-play-center.onrender.com` |
| Database | Neon PostgreSQL center store (`HIRAYA_POSTGRES` / `Hiraya:Neon`) | Unchanged. Clients never open the database. |
| Desktop | Electron (`apps/desktop`) | Local installer. `VITE_API_URL` in `.env.production` still names the old website. Packaged **1.0.3** on this PC was built to the Render API URL. |
| Mobile | Expo (`apps/mobile`) | EAS `preview` / `production` bake `EXPO_PUBLIC_API_URL=https://www.hirayalearningcenter.app` |
| Auth | `POST /api/auth/login`, HMAC session, header `X-Hiraya-Session` | No OAuth redirect URIs. No Vercel Auth. |
| Email | Brevo HTTPS (`HIRAYA_BREVO_API_KEY`) on Render; SMTP locally | Sender stays the existing configured From address. Not the school `.edu` mailbox. |
| Files | Profile photos, gallery, module files on the API disk under the data directory | Render disk is ephemeral. Existing limitation. Do not add object storage in this migration. |

Git remotes on this PC:

- `origin` → `https://github.com/Johnleelugnasin30/hiraya-play-center.git` (private, `main`)
- `lee100030` → `https://github.com/Lee100030/hiraya-play-center.git` (old remote; leave it)

Local `git config user.email` is already `johnleelugnasin30@gmail.com`. Latest `main` commit author is that Gmail. `gh` is signed in as `Johnleelugnasin30`.

---

## Current deployment flow

1. Push to GitHub `Johnleelugnasin30/hiraya-play-center` `main`.
2. Vercel rebuilds Next.js (`apps/web` / root `vercel.json`).
3. Render rebuilds Hiraya.Api from `Dockerfile`.
4. Website proxies `/api` to Hiraya.Api using `HIRAYA_API_INTERNAL` (or related server env). On Vercel production, an empty API URL currently becomes “unconfigured” instead of localhost (`apps/web/lib/server/backend.ts`).
5. GitHub Action `keep-api-awake.yml` curls Render `/api/health` and `https://www.hirayalearningcenter.app/api/health`.
6. GitHub Action `ci.yml` typechecks, builds the API, and builds the website.

Proposed flow after cutover (not done yet):

1. Same GitHub `main`.
2. Render **hiraya-web** (Node) serves Next.js.
3. Render **hiraya-play-center** (existing Docker API) stays the backend.
4. IONOS DNS for `hirayakidslearningcenter.com` points at the **website** Render service, not IONOS webspace.
5. Optional `api.hirayakidslearningcenter.com` CNAME on the **API** Render service.
6. Vercel is disconnected only after you approve.

---

## Database provider and connection

- Production: Neon via `HIRAYA_POSTGRES` (also accepted: `DATABASE_URL`, `Hiraya:Neon`).
- Local: `backend/Hiraya.Api/appsettings.Local.json` (gitignored).
- `HIRAYA_MYSQL` remains a leftover name in `render.yaml` and older docs. Live API uses Postgres/Neon. Do not create a new database. Do not migrate or reset Neon.

---

## References to Vercel and the old domain

### Must update before or at cutover (production behavior)

| Location | Why |
| --- | --- |
| `render.yaml` `HIRAYA_PUBLIC_URL` | Email and public links |
| `backend/Hiraya.Shared/Services/HirayaEmailLayout.cs` fallback URL | Used when site URL is missing or localhost |
| `packages/utils/src/emailLayout.ts` fallback URL | Same for TS email layout |
| `apps/desktop/.env.production` | New desktop builds |
| `apps/desktop/electron/main.cjs` `PUBLIC_SITE` | “Open public website” and CORS rewrite |
| `apps/mobile/eas.json` | New APK / AAB builds |
| `.github/workflows/keep-api-awake.yml` | Second curl is the old website |
| `.github/workflows/ci.yml` | Build-time `NEXT_PUBLIC_API_URL` can stay on Render or move to the new API host |
| `.do/app.yaml` | DigitalOcean leftover with old CORS list |

### Keep until you approve deletion (do not remove yet)

| Location | Why |
| --- | --- |
| Root `vercel.json`, `apps/web/vercel.json` | Current Vercel website |
| `apps/desktop/vercel.json`, `apps/mobile/vercel.json` | Ignore-commands so Vercel does not try to host Electron/Expo |
| Live Vercel project, env vars, GitHub integration | Rollback path |
| Domain `hirayalearningcenter.app` registration | You asked only to stop using it, not to cancel it |

### Docs / marketing only (not required for the first Render website)

README, `docs/ARCHITECTURE.md`, capstone chapters, brag skill, `_livefix/**` (archive tree). Update README after the new site is live.

### `.edu` email

No application login, password-reset, or Brevo sender in this repo is wired to `student.pnm.edu.ph`. The school mailbox only blocked GitHub/Gmail verification. Keep Brevo and the existing From address. Do not set `Johnleelugnasin30@gmail.com` as the public sender.

---

## Services that depend on the old domain

- Installed **mobile APKs** that were built with `EXPO_PUBLIC_API_URL=https://www.hirayalearningcenter.app`.
- Desktop installers built from `.env.production` (1.0.2). Desktop **1.0.3** on this PC already calls `https://hiraya-play-center.onrender.com` and will keep working if the old domain is paused.
- Email action links that fall back to `https://www.hirayalearningcenter.app`.
- Keep-alive workflow for the website proxy.

---

## Proposed Render structure

Two web services. One existing database. No new Redis, no new Postgres on Render, no IONOS app hosting.

| Service | Type | Runtime | Role |
| --- | --- | --- | --- |
| `hiraya-play-center` (already live) | Web | Docker | Hiraya.Api. Health: `/api/health`. Port: `PORT` / 8080. |
| `hiraya-web` (new) | Web | Node 22 | Next.js. Root of the monorepo so `pnpm` workspaces work. Not a static export (API routes + SSR proxy). |

Canonical public URL after DNS: `https://hirayakidslearningcenter.com`. `https://www.hirayakidslearningcenter.com` should redirect to the apex (add both hostnames on the **website** service in Render, then set the apex as primary).

API hostname after DNS: `https://api.hirayakidslearningcenter.com` → existing API service. Until that certificate is issued, the website should keep `HIRAYA_API_INTERNAL=https://hiraya-play-center.onrender.com`.

Do **not** apply a Blueprint that creates a second Docker API. If the dashboard service name is not `hiraya-play-center`, create **only** the Node website in the Render UI and copy env vars from this plan.

---

## Environment variables (names only)

### Existing API (Render dashboard — already required)

- `ASPNETCORE_ENVIRONMENT`
- `PORT` (set by Render)
- `HIRAYA_POSTGRES`
- `HIRAYA_SESSION_SECRET` (do not regenerate; regenerating logs everyone out)
- `HIRAYA_PUBLIC_URL` (change to the new site at cutover)
- `HIRAYA_BREVO_API_KEY`
- `HIRAYA_SMTP_ENABLED` / `HIRAYA_SMTP_HOST` / `HIRAYA_SMTP_PORT` / `HIRAYA_SMTP_USER` / `HIRAYA_SMTP_PASSWORD` / `HIRAYA_SMTP_FROM` (keep current sender)
- Optional: `HIRAYA_POSTGRES_CA`, `HIRAYA_MYSQL` (unused leftover), `HIRAYA_CORS_ORIGINS` (not read by current `Program.cs`; CORS is `AllowAnyOrigin` because sessions are header-based)

### New website (Render)

- `NODE_ENV`
- `NODE_VERSION` (22)
- `PORT` (set by Render)
- `HIRAYA_API_INTERNAL` (Render API URL, later `https://api.hirayakidslearningcenter.com`)
- Do **not** set `NEXT_PUBLIC_*` secrets. Optional `NEXT_PUBLIC_API_URL` should stay empty so the browser uses same-origin `/api`.

### Never in git / never in `NEXT_PUBLIC_` / `VITE_` / `EXPO_PUBLIC_`

Neon URI, session secret, Brevo key, SMTP password.

---

## Risks and rollback

| Risk | Mitigation |
| --- | --- |
| Blueprint creates a duplicate API | Create the website service by hand if names do not match. Keep `HIRAYA_SESSION_SECRET` as `sync: false`. |
| Website health check hits `/api/health` while API is cold | Use `/` as the Render health path for the website. Smoke-test `/api/health` after boot. |
| IONOS parking / webspace A records steal the domain | In IONOS DNS only; disable the default IONOS website for this domain. |
| IONOS has no ALIAS at the apex | Use Render’s documented A record `216.24.57.1` for `@`. Use CNAME for `www` and `api`. Remove AAAA. Source: [configure-other-dns](https://render.com/docs/configure-other-dns). **Still copy the CNAME target from the Render dashboard after you add the custom domain — that target is the service’s `*.onrender.com` hostname, which this repo cannot see until the service exists.** |
| Installed APKs still call the old domain | Keep Render API on `onrender.com`. Rebuild APK only after you approve. Desktop 1.0.3 already uses Render. |
| File uploads lost on API restart | Existing Render ephemeral disk. Out of scope. |
| School `.edu` still locked | GitHub already owned by `Johnleelugnasin30`. Re-auth Render/GitHub while signed into that account with Gmail verified. |

Rollback: leave Vercel and `hirayalearningcenter.app` untouched until you say otherwise. Point IONOS records back, or simply do not switch DNS. Existing API on Render stays.

---

## Files that will need changes

Phase 2 (safe, this pass): `render.yaml`, `.env.example`, `.node-version`, this plan, the report.

Phase 5 (only after you approve cutover): email fallback URLs, desktop `PUBLIC_SITE` / `.env.production`, `eas.json`, keep-alive workflow, README/architecture docs. Do not delete `vercel.json` until then.

Unavoidable application-code edits (small, URL constants only — not UI): email fallbacks in `HirayaEmailLayout.cs` and `emailLayout.ts`. Reason: those strings are the public site used in mail when `HIRAYA_PUBLIC_URL` is empty. They wait for your cutover approval.

---

## Manual steps (you must be signed in)

### GitHub (`Johnleelugnasin30@gmail.com`)

1. Confirm Gmail is verified on https://github.com/settings/emails (school `.edu` can stay unverified).
2. Confirm you can open https://github.com/Johnleelugnasin30/hiraya-play-center.
3. Settings → Actions: keep Actions enabled (CI + keep-awake).
4. If Render cannot see the repo: Render → Account Settings → GitHub → grant `hiraya-play-center`.
5. Do not rewrite git history. Do not transfer ownership unless you want a different login. This PC already pushes to `origin`.

### Render

1. Keep the existing Docker API. Confirm `HIRAYA_POSTGRES` and `HIRAYA_SESSION_SECRET` are still set. Do not click “generate new secret”.
2. Create Web Service **hiraya-web**, runtime Node, repo `Johnleelugnasin30/hiraya-play-center`, branch `main`, root directory empty (repo root).
3. Build: `corepack enable && corepack prepare pnpm@9.15.4 --activate && pnpm install --frozen-lockfile && pnpm --filter @hiraya/web run build`
4. Start: `corepack enable && pnpm --filter @hiraya/web exec next start --hostname 0.0.0.0 --port $PORT`
5. Env: `HIRAYA_API_INTERNAL=https://hiraya-play-center.onrender.com`, `NODE_VERSION=22`.
6. After the onrender URL works, **Dashboard → Custom Domains** for **hiraya-web**: add `hirayakidslearningcenter.com` and `www.hirayakidslearningcenter.com`. Copy the exact CNAME target Render shows (it will look like `<service>.onrender.com`).
7. On the **API** service, add custom domain `api.hirayakidslearningcenter.com` and copy that CNAME target (likely `hiraya-play-center.onrender.com`).
8. Do not delete the Vercel project from here.

### IONOS (DNS only — not webspace)

Path you named: https://my.ionos.com/webhosting/ecd71e56-8ae9-4f9c-a903-3c9374bde749/hosting-usage-selection — use **Domains → DNS**, not “upload website files”.

Do not type DNS until Render shows the hostname. Expected pattern from Render’s docs:

| Host | Type | Value | Notes |
| --- | --- | --- | --- |
| `@` | A | `216.24.57.1` | Apex, because IONOS consumer DNS typically has no ALIAS. Confirm IP on Render’s DNS page if they list another. |
| `www` | CNAME | **website** `*.onrender.com` from Render | Canonical redirect: add www in Render and redirect to apex. |
| `api` | CNAME | **API** `*.onrender.com` from Render | Separate service. |
| AAAA | — | delete | Render is IPv4 only. |

Turn off IONOS destination / parking that points `@` at their webspace.

---

## Cutover checklist (approval required)

1. Connect GitHub → Render website.
2. Set website env vars. Confirm API still has Neon + session secret + Brevo.
3. Open the Render onrender website URL. Test login, enrollment, `/api/health`.
4. Add custom domains in Render. Paste DNS in IONOS. Wait for HTTPS.
5. Test website, then desktop 1.0.3, then a phone build only if you ask for a new APK.
6. Set API `HIRAYA_PUBLIC_URL` to `https://hirayakidslearningcenter.com`. Confirm a test notice email.
7. You approve: stop Vercel Git integration, remove old domain from Vercel **assignment** (keep the `.app` registration), then update remaining URL constants.

No production cutover in this pass.
