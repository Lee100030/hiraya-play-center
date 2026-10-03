# Hiraya Kids Learning Center — multi-platform clients

This repository is the **React / Next.js / Expo / Electron** frontend for Hiraya Kids Learning Center. It talks to the existing **ASP.NET Core API** and **MySQL** database. The original .NET MAUI Hybrid app in `C:\Users\LEE\source\repos\Hiraya` is unchanged.

**Hosting:** GitHub stores the code. Vercel hosts the website. **Database:** Aiven MySQL is the cloud database. Everyday work on this PC still uses XAMPP through Hiraya.Api.

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
| **Mobile** | `apps/mobile` | Expo / Android. Not deployed on Vercel. |
| **Central API** | `backend/Hiraya.Api` | Local hub for this PC, desktop, and mobile. Local MySQL `hiraya_learning_center` on port 5188. |

### How GitHub, Vercel, and Aiven connect

DigitalOcean and Render are not part of this project. Do not follow `.do/app.yaml` or `render.yaml`.

1. GitHub repo `Johnleelugnasin30/hiraya-play-center` is the source Vercel builds.
2. Vercel hosts the Next.js website only. Desktop and mobile stay off Vercel.
3. On the Vercel project, set the **server** environment variable `HIRAYA_MYSQL` to the Aiven service URI. Optional: `HIRAYA_MYSQL_CA` with the Aiven CA certificate text so the certificate is verified.
4. Do not put that URI in GitHub, and do not use a name that starts with `NEXT_PUBLIC_`, `VITE_`, or `EXPO_PUBLIC_`. The browser must never receive it.
5. On Vercel there is no local API, so the website health check, public catalog, enrollment, and teacher application use Aiven directly.
6. On this PC, Hiraya.Api is still preferred. The website uses Aiven only when that API is not configured.
7. Do not import the local XAMPP database into Aiven.

### Vercel (website only)

1. Import GitHub repo `Johnleelugnasin30/hiraya-play-center`.
2. Set **Root Directory** to `apps/web`.
3. Framework preset: **Next.js**.
4. Do not choose `apps/desktop` or `apps/mobile`.
5. Set server env `HIRAYA_MYSQL` to the Aiven service URI. Do not set `HIRAYA_API_INTERNAL` unless a public Hiraya.Api address exists.

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

See `docs/ARCHITECTURE.md` and `docs/MIGRATION.md`. 
