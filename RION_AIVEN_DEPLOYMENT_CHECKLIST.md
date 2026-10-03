# RION Aiven deployment checklist

Checked only when this local scan verified the item. Unchecked items are not done.

- [x] Database technology confirmed — MySQL 8, EF Core 9, Pomelo
- [x] Aiven-compatible database confirmed — Aiven MySQL can host this engine; PostgreSQL was not adopted
- [x] Backend database access confirmed — Hiraya.Api uses `HirayaLearningCenterDbContext`
- [x] Frontend does not directly access database — Electron, the website, and mobile call Hiraya.Api. The Next.js `mysql.ts` client was removed in this pass.
- [x] Database credentials are server-side only — the website no longer reads `HIRAYA_MYSQL` or `DATABASE_URL`. Only the API process opens MySQL.
- [x] Environment variables separated — local appsettings vs `HIRAYA_MYSQL` / `HIRAYA_SESSION_SECRET`; Production now requires a connection env var
- [x] .env excluded from Git — `.gitignore` ignores `.env`, `.env.local`, `appsettings.Local.json`, and `aiven-ca.pem`
- [x] .env.example created/updated — root, web, desktop, and mobile examples exist; root and web examples were clarified
- [x] SSL/TLS support verified in code — non-local API connections set `SslMode=Required`; `HIRAYA_MYSQL_CA` switches to `VerifyCA`. The website MySQL client that skipped certificate checks was removed.
- [x] Connection pooling verified in code — Pomelo/MySqlConnector pooling stays at driver defaults. The website no longer opens its own MySQL connection.
- [x] Migration system verified as present — EF migrations exist and startup calls `MigrateAsync`. Production does not fall back to `EnsureCreated`. Local Development still does. `20260927170000_SchemaParity` is recorded on the local database.
- [x] Seed system reviewed — demo users and known development passwords; Production skip added; not safe to rely on for Aiven
- [ ] Authentication verified end to end — hasher, session header, and 401 on empty login were confirmed; a full admin/teacher/parent login was not executed in this pass
- [ ] Authorization verified — role checks exist; `StoreSanitizer` and public profile media were not fully retested
- [x] Database relationships verified as documented — indexes exist; foreign keys are not enforced
- [ ] CRUD verified — not re-run; local rows were not modified
- [x] Error handling verified in code — database failures return a generic message and are logged
- [x] Local database tested — `GET /api/health` returned 200 and `status: ok`; `GET /api/store` returned 401 without a session; `POST /api/auth/login` with an empty body returned 401
- [x] Production configuration prepared in source — Production requires a managed connection env var and skips development seed
- [ ] Existing Aiven MySQL service confirmed by the owner. This project does not create that service. DigitalOcean and Render are not the database.
- [ ] Aiven service URI placed in the Vercel server environment as `HIRAYA_MYSQL` (not committed, not `NEXT_PUBLIC_`). Optional `HIRAYA_MYSQL_CA` verifies the certificate.
- [ ] One Production migration check against Aiven, on a separate API process. The everyday local API on port 5188 stays on XAMPP.

`.do/app.yaml` and `render.yaml` are unused. Do not follow them and do not add a DigitalOcean database.

Checked 1 October 2026. `aiven-ca.pem` is not in the API folder, `HIRAYA_MYSQL` and `HIRAYA_MYSQL_CA` are not set, and the gitignored local settings file has mail settings only. The Production migration check was not started. The API already running on port 5188 still reports database `hiraya_learning_center`.

The first production administrator is created by hand on an empty Production database. Do not import demo users or the local XAMPP database into Aiven. Take an Aiven backup before the first real write.
