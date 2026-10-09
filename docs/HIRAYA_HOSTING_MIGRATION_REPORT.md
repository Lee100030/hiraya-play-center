# Hiraya hosting migration report

Date: 10 October 2026. You approved the hosting config. **Code and Git are cut over; Render website, IONOS DNS, and Vercel disconnect still need your dashboards.** The `.app` registration was not cancelled.

Full plan: `docs/HIRAYA_HOSTING_MIGRATION_PLAN.md`.

---

## What was inspected

- Git remotes, `gh` owner, local commit author
- `render.yaml`, `Dockerfile`, `vercel.json` (root and apps)
- GitHub Actions (`ci.yml`, `keep-api-awake.yml`)
- Next.js website (`apps/web`), proxy (`lib/server/backend.ts`), `maxDuration` (Vercel-only; harmless on Render)
- Hiraya.Api (`Program.cs`): Neon/`HIRAYA_POSTGRES`, `PORT`, CORS `AllowAnyOrigin`, Brevo HTTP client, forwarded headers
- Desktop `VITE_API_URL`, Electron `PUBLIC_SITE` / `LIVE_API`
- Mobile `eas.json` `EXPO_PUBLIC_API_URL`
- Email fallbacks (`HirayaEmailLayout.cs`, `packages/utils/src/emailLayout.ts`)
- File storage on API disk (ephemeral on Render — existing)
- Render DNS docs (A `216.24.57.1` for apex without ALIAS; CNAME for subdomains; remove AAAA)
- No `.edu` sender inside the app; center contact fallback is `hirayakids.learning@gmail.com`

---

## What files were changed

| File | Change |
| --- | --- |
| `docs/HIRAYA_HOSTING_MIGRATION_PLAN.md` | Phase 1 audit and cutover plan |
| `docs/HIRAYA_HOSTING_MIGRATION_REPORT.md` | This report |
| `render.yaml` | Existing API kept; website service `hiraya-web` added; secrets `sync: false` so the session secret is not rotated |
| `.node-version` | `22` for Render Node |
| `.env.example` | Render `HIRAYA_API_INTERNAL` comment (no secrets) |
| `apps/web/package.json` | Description only: Render Node web service |

Not changed: UI, API contracts, Neon, Vercel project, IONOS DNS, email fallback URLs, `eas.json`, desktop production URL, `vercel.json`.

---

## What was preserved

- Website, desktop, and mobile UI
- Hiraya.Api routes and session model
- Neon `neondb` (live health returned that name)
- User accounts
- Brevo as the mail provider; existing From address
- Git history and `origin` (`Johnleelugnasin30/hiraya-play-center`)
- Vercel files and the old domain (rollback)

---

## Database

Unchanged. Live `GET https://hiraya-play-center.onrender.com/api/health` returned:

`status: ok`, `hub: hiraya-central`, `database: neondb` (about 56s on a cold start).

No migrations, drops, or connection-string edits.

---

## Tests

| Check | Result |
| --- | --- |
| `pnpm --filter @hiraya/web run build` | Passed (existing Autoprefixer `flex-end` warning only) |
| Live API `/api/health` | Passed (cold start) |
| Login / enrollment / RBAC in a browser against a **new** Render website | Not run — `hiraya-web` is not deployed |
| Mobile reaching API | Installed APKs still use the old website URL; Desktop **1.0.3** already uses the Render API |
| HTTPS / custom domain | Not configured — waiting for Render custom-domain hostnames and IONOS |
| Secrets in git | `render.yaml` has no URIs or keys |

Required smoke tests after you create `hiraya-web` (do not treat these as passed):

1. Open the Render onrender website URL.
2. `GET /api/health` through that website.
3. Admin login, parent enrollment, one notice email.
4. Desktop 1.0.3 login.
5. Only then add IONOS DNS.

---

## Manual: GitHub

Already true on this PC: `origin` is `Johnleelugnasin30/hiraya-play-center`; local author email is `johnleelugnasin30@gmail.com`.

You still need, while signed into that account:

1. Verify Gmail at GitHub Settings → Emails.
2. Grant Render’s GitHub App access to this private repo.
3. Keep Actions enabled.
4. Leave the `lee100030` remote alone unless you want it removed later.

Do not rewrite commits.

---

## Manual: Render

1. Confirm the existing Docker API still has `HIRAYA_POSTGRES`, `HIRAYA_SESSION_SECRET`, and `HIRAYA_BREVO_API_KEY`. Do not generate a new session secret.
2. Create **hiraya-web** (or apply the Blueprint **only if** it will not duplicate the API).
3. Set `HIRAYA_API_INTERNAL=https://hiraya-play-center.onrender.com`.
4. After that URL works, add custom domains and **copy the CNAME targets from the dashboard**. This repo cannot invent those hostnames.
5. At cutover, set API `HIRAYA_PUBLIC_URL=https://hirayakidslearningcenter.com`.

---

## Manual: IONOS

DNS only. Do not upload the app to IONOS webspace.

After Render shows the targets:

| Host | Type | Value |
| --- | --- | --- |
| `@` | A | `216.24.57.1` ([Render other-DNS](https://render.com/docs/configure-other-dns); IONOS typically has no ALIAS) |
| `www` | CNAME | **website** `*.onrender.com` from Render |
| `api` | CNAME | **API** `*.onrender.com` from Render |
| AAAA | delete | Render is IPv4 |

Disable IONOS parking / webspace A records on this domain. Canonical host: apex; `www` redirects to apex in Render.

---

## Remaining old-domain / Vercel references (intentional)

- `vercel.json` files
- `apps/desktop/.env.production`
- `apps/desktop/electron/main.cjs` `PUBLIC_SITE`
- `apps/mobile/eas.json`
- Email fallbacks in C# / TS
- `keep-api-awake.yml` website curl
- README and capstone docs

Safe to remove later: Vercel Git integration and the old domain **assignment**, after you approve. Do not cancel `.app` registration.

---

## Cutover and rollback

Cutover: `docs/HIRAYA_HOSTING_MIGRATION_PLAN.md` Phase 5 checklist.

Rollback: leave Vercel live; do not change IONOS until the Render website is proven; API on Render already serves desktop 1.0.3.

---

## Awaiting your approval

1. Create the Render **website** service (I did not create it; no Render dashboard login from here).
2. After that URL works, add IONOS DNS using Render’s copied records.
3. Change `HIRAYA_PUBLIC_URL` and the email/desktop/mobile URL constants.
4. Rebuild APK only when you ask (installed phones still use the old domain).
5. Disconnect Vercel / stop using `hirayalearningcenter.app` (keep the registration).
6. Commit/push these config files when you want GitHub to have them.

Nothing destructive was done to hosting, DNS, or the database.
