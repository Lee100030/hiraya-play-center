# HIRAYA Learning Center — multi-platform clients

This repository is the **React / Next.js / Expo / Electron** frontend for HIRAYA Learning Center. It talks to the existing **ASP.NET Core API** and **MySQL** database. The original .NET MAUI Hybrid app in `C:\Users\LEE\source\repos\Hiraya` is unchanged.

## Apps

| App | Path | Command |
|-----|------|---------|
| Website | `apps/web` | `pnpm dev:web` |
| Mobile (Expo) | `apps/mobile` | `pnpm dev:mobile` |
| Desktop (Electron) | `apps/desktop` | `pnpm dev:desktop` |
| Backend (copied) | `backend/Hiraya.Api` | `dotnet run --project backend/Hiraya.Api` |

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

See `docs/ARCHITECTURE.md` and `docs/DEPLOY.md`.
