# Migration notes

## Source of truth (unchanged)

Current product: `C:\Users\LEE\source\repos\Hiraya`

- MAUI Blazor Hybrid (`Hiraya Dekstop-Mobile.csproj`) — Windows admin + Android family
- `Hiraya.Web` / `HirayaWebsite` — Blazor public site and portals
- `Hiraya.Api` + `Hiraya.Data` + `Hiraya.Shared` — API, EF, domain
- MySQL database `hiraya_learning_center`

Older trees (`HIRAYA PLAY CENTER`, Flutter/Laravel, Next/Firebase experiments) were **not** used as the migration source.

## What was reused

- ASP.NET API contracts (`/api/store`, `/api/auth/*`, public enrollment, parent, staff, modules, website CMS)
- MySQL schema and EF mappings
- Domain model (ported to TypeScript)
- Permission catalog and navigation rules
- Brand colors (forest green + gold + cream)
- HMAC session header `X-Hiraya-Session`
- Development seed accounts

## What was rebuilt

- All Blazor/Razor UI → React / Next.js App Router
- MAUI `BlazorWebView` → Expo (mobile) and Electron (desktop)
- Session storage → `localStorage` (web/desktop) and Expo SecureStore (mobile)
- Page `@code` blocks → hooks (`AuthProvider`, `StoreProvider`)

The original MAUI solution was **not deleted**.

## API changes

Copied backend CORS origins now include:

- `http://localhost:3000` / `127.0.0.1:3000` (Next.js)
- `http://localhost:5173` / `127.0.0.1:5173` (Electron Vite)
- `http://localhost:8081` / `127.0.0.1:8081` (Expo)

No database recreate. No new auth protocol. Session secret still lives only on the API.

## Dependencies installed (JS)

See root `package.json` and each app. Tooling: TypeScript, Turborepo, ESLint, Prettier, Next.js 15, Expo 52, Electron 34, Zod, Vite.

## Feature checklist

| Feature | Web | Mobile | Desktop | Notes |
|---------|-----|--------|---------|-------|
| Authentication | [x] | [x] | [x] | Same API login |
| Authorization / roles | [x] | [partial] | [partial] | Nav filtered on web |
| Dashboard | [x] | [x] | [x] | |
| Students | [x] | [partial] | [x] | Create/edit on web |
| Teachers / staff | [x] | | [ ] | Directory on web |
| Parents | [x] | | [ ] | |
| Enrollment | [x] | | [x] | Public apply + review |
| Payments | [x] | | [x] | Ledger view |
| Attendance | [x] | | [x] | Record on web |
| Schedule / calendar | [x] | [x] | [ ] | |
| Progress | [x] | | [ ] | |
| Notifications | [x] | [x] | [ ] | |
| Reports | [x] | | [x] | Snapshot |
| Settings / profile | [x] | [x] | [ ] | Password change on web |
| User / role admin | [x] | | [ ] | Matrix view |
| Website CMS | [x] | | [ ] | Read view |
| Learning modules | [x] | | [ ] | List; file upload still API-native |
| Staff on phone | blocked by design | matches MAUI | | |

## Remaining work

- Parity forms for every MAUI editor (website CMS uploads, module file tickets, parent invite emails, ops calendars, uniform inventory).
- Split `/api/store` into resource REST endpoints over time (optional; not required to keep the DB).
- httpOnly cookie BFF for the website (stronger than `localStorage`).
- Visual regression against MAUI screenshots.
- Automated Playwright / Maestro tests.

## Known limitations

- Frontend session token is in web storage, same class of risk as the Blazor client.
- Expo Metro must resolve workspace packages; use `shamefully-hoist=true`.
- Electron `dev` needs the Vite port free (`5173`).
- React versions: web/desktop React 19, Expo SDK 52 uses React 18.3 on mobile only.
