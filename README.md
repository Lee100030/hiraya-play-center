# Hiraya Kids Learning Center — multi-platform clients

This repository is the **React / Next.js / Expo / Electron** clients plus **Hiraya.Api** for Hiraya Kids Learning Center. How the live center works (enrollment, parents, ABA schedule, roles) is in **`docs/HIRAYA_SYSTEM_GUIDE.md`**.

**Live hosting:** GitHub stores the code. Vercel hosts the website (`https://www.hirayalearningcenter.app`). Render runs Hiraya.Api. Neon holds the center store. Everyday work on this PC can still run Hiraya.Api locally.

## Local first

1. Start **XAMPP MySQL** (`hiraya_learning_center`).
2. `npm run dev:api` → Hiraya.Api at `http://127.0.0.1:5188` 
3. `npm start` → website at `http://127.0.0.1:3000`
4. Optional: `npm run dev:desktop` and `npm run dev:mobile` against the same API.
 
## Apps 

| App | Folder | Where it runs |
|-----|--------|----------------|
| **Website** | `apps/web` | Vercel (Next.js). Root Directory must be `apps/web`. |
| **Desktop app** | `apps/desktop` | Electron on Windows. Not deployed on Vercel. |
| **Mobile** | `apps/mobile` | Expo / Android APK **1.0.1**. Not on Vercel. The client APK uses `https://www.hirayalearningcenter.app` (Hiraya.Api on Render). Tapping an announcement opens a full-message modal. |
| **Central API** | `backend/Hiraya.Api` | Render in production. Local hub on this PC at port 5188. |

### How GitHub, Vercel, Render, and Neon connect

1. GitHub repo `Johnleelugnasin30/hiraya-play-center` is the source Vercel and Render build.
2. Vercel hosts the Next.js website only. Desktop and mobile stay off Vercel.
3. Render runs Hiraya.Api. The website proxies `/api` to that API. Packaged desktop uses `https://www.hirayalearningcenter.app`.
4. Neon is opened only by the API process. Do not put that URI in GitHub, and do not use a name that starts with `NEXT_PUBLIC_`, `VITE_`, or `EXPO_PUBLIC_`.
5. Push to `main` updates the website and the API. Operations are documented in `docs/HIRAYA_SYSTEM_GUIDE.md`.

### Vercel (website only)

1. Import GitHub repo `Johnleelugnasin30/hiraya-play-center`.
2. Set **Root Directory** to `apps/web`.
3. Framework preset: **Next.js**.
4. Do not choose `apps/desktop` or `apps/mobile`.
5. Point the website at the public Hiraya.Api (Render). Do not put a database URI in the browser.

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
