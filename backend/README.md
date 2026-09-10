# Copied Hiraya backend

This folder is a **copy** of `Hiraya.Api`, `Hiraya.Data`, and `Hiraya.Shared` from the current source of truth:

`C:\Users\LEE\source\repos\Hiraya\Hiraya`

The original MAUI / Blazor projects were not deleted. Database schema and data stay on MySQL.

## Run

```bash
dotnet run --project Hiraya.Api
```

Default URL: `http://127.0.0.1:5188`

Connection string is in `Hiraya.Api/appsettings.json`. Override the password with `HIRAYA_MYSQL_PASSWORD`.

CORS includes the new Next.js (`3000`), Vite/Electron (`5173`), and Expo (`8081`) origins.
