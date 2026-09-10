# HIRAYA Learning Center — multi-platform clients

This repository is the **React / Next.js / Expo / Electron** frontend for HIRAYA Learning Center. It talks to the existing **ASP.NET Core API** and **MySQL** database. The original .NET MAUI Hybrid app in `C:\Users\LEE\source\repos\Hiraya` is unchanged.

## Apps

| App | Folder | Where it runs |
|-----|--------|----------------|
| **Website** | `apps/web` | Vercel (Next.js). Root Directory must be `apps/web`. |
| **Desktop app** | `apps/desktop` | Electron on Windows. Not deployed on Vercel. |
| **Mobile** | `apps/mobile` | Expo / Android. Not deployed on Vercel. |
| Backend | `backend/Hiraya.Api` | ASP.NET API + MySQL |

### Vercel (website only)

1. Import GitHub repo `Johnleelugnasin30/hiraya-play-center`.
2. Set **Root Directory** to `apps/web`.
3. Framework preset: **Next.js**.
4. Do not choose `apps/desktop` or `apps/mobile`.

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

Login data needs MySQL (XAMPP) plus the API in a second terminal:

```bash
dotnet run --project backend/Hiraya.Api/Hiraya.Api.csproj --urls http://127.0.0.1:5188
```

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
