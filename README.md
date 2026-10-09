# Hiraya Kids Learning Center — multi-platform clients

This repository is the **React / Next.js / Expo / Electron** clients plus **Hiraya.Api** for Hiraya Kids Learning Center. How the live center works (enrollment, parents, ABA schedule, roles) is in **`docs/HIRAYA_SYSTEM_GUIDE.md`**.

**Live hosting:** GitHub stores the code. Render runs Hiraya.Api (`https://hiraya-play-center.onrender.com`) and is the target host for the website (`hiraya-web`). Canonical public domain: `https://hirayakidslearningcenter.com` (IONOS DNS → Render). Neon holds the center store. Vercel / `hirayalearningcenter.app` stay only as rollback until you disconnect them. Everyday work on this PC can still run Hiraya.Api locally. See `docs/HIRAYA_HOSTING_MIGRATION_PLAN.md`.

## Local first

1. Start **XAMPP MySQL** (`hiraya_learning_center`).
2. `npm run dev:api` → Hiraya.Api at `http://127.0.0.1:5188` 
3. `npm start` → website at `http://127.0.0.1:3000`
4. Optional: `npm run dev:desktop` and `npm run dev:mobile` against the same API.
 
## Apps 

| App | Folder | Where it runs |
|-----|--------|----------------|
| **Website** | `apps/web` | Render Node web service `hiraya-web` (Next.js, build from repo root). |
| **Desktop app** | `apps/desktop` | Electron on Windows. Not hosted on Render. Packaged API URL is the Render API. |
| **Mobile** | `apps/mobile` | Expo / Android. Not hosted on Render. New EAS builds use the Render API URL. Installed APKs still use the old website until you rebuild. |
| **Central API** | `backend/Hiraya.Api` | Render Docker service. Local hub on this PC at port 5188. |

### How GitHub, Render, IONOS, and Neon connect

1. GitHub repo `Johnleelugnasin30/hiraya-play-center` is the source Render builds.
2. Render runs Hiraya.Api (Docker) and the Next.js website (Node). Desktop and mobile stay off Render hosting.
3. The website proxies `/api` to Hiraya.Api via `HIRAYA_API_INTERNAL`. New desktop/mobile builds call `https://hiraya-play-center.onrender.com` until `api.hirayakidslearningcenter.com` is live.
4. Neon is opened only by the API process. Do not put that URI in GitHub, and do not use a name that starts with `NEXT_PUBLIC_`, `VITE_`, or `EXPO_PUBLIC_`.
5. IONOS holds DNS for `hirayakidslearningcenter.com` only. Do not upload the app to IONOS webspace.
6. Push to `main` updates the API (and the website once `hiraya-web` exists). Operations: `docs/HIRAYA_SYSTEM_GUIDE.md`.

### Render (website + API)

1. Keep the existing Docker API. Do not generate a new `HIRAYA_SESSION_SECRET`.
2. Create **hiraya-web** from this repo (root directory empty), Node 22, commands in `render.yaml`.
3. Set website `HIRAYA_API_INTERNAL` to the API origin.
4. Add custom domains in Render, then paste the records Render shows into IONOS.

Local commands:

```bash
npm start
# or
pnpm build:web
pnpm build:desktop
pnpm build:mobile
```

## Prerequisites

- Node.js 22+
- pnpm 9 (`npx pnpm@9.15.4` if pnpm is not installed globally)
- .NET 10 SDK (to run the existing API)
- MySQL (`hiraya_learning_center`, typically XAMPP)

## Run in VS Code / Cursor

1. **File → Open Folder** and select this folder (`Hiraya play Center React`) — the one that contains `apps`, `packages`, and `package.json`. Do not open the empty `Nproject` folder.
2. Open the terminal (**Ctrl+`**).
3. Run:

```bash
npm start
```

4. Open [http://localhost:3000](http://localhost:3000).

You can also press **F5** and choose **Run website**, or **Terminal → Run Task → Start website (Next.js)**.

`pnpm` does not need to be installed globally. `npm start` runs the Next.js app.

Login and school data are **centralized**. Start MySQL (XAMPP), then the API in a second terminal:

```bash
npm run dev:api
```

That process is the hub:

| Client | How it reaches the hub |
|--------|-------------------------|
| Website (`:3000`) | Browser → Next `/api/*` → Hiraya.Api `:5188` |
| Desktop (`:5173`) | Electron → Hiraya.Api `:5188` |
| Mobile (Expo) | Phone LAN IP → Hiraya.Api `:5188` |

Same logins, students, enrollments, and store document. Session header: `X-Hiraya-Session`. Check `GET http://127.0.0.1:5188/api/hub`.

## First run (if packages are missing)

```bash
npx --yes pnpm@9.15.4 install
npm start
```

Seed logins from the existing backend (development):

- `admin` / `Admin123`
- `teacher` / `Teacher123`
- `staff` / `Staff123`
- `parent` / `Parent123`

Do not put database passwords or `HIRAYA_SESSION_SECRET` in any frontend env file.

See `docs/HIRAYA_SYSTEM_GUIDE.md` (current operations), `docs/ARCHITECTURE.md`, and `docs/MIGRATION.md`. 
