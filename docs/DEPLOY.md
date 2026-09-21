**Hold secrets.** Never commit `HIRAYA_MYSQL`, `HIRAYA_SESSION_SECRET`, or CA files.

Website, desktop, and mobile talk only to **Hiraya.Api**. MySQL is connected **only** from the API process (`HIRAYA_MYSQL` or `DATABASE_URL`).

## Order

1. Create one MySQL database `hiraya_learning_center` (Aiven, Render MySQL, or `docker compose up mysql`).
2. Deploy **Hiraya.Api** (this repo `Dockerfile` + `render.yaml`). Set:
   - `HIRAYA_MYSQL` (URI or ADO.NET string)
   - `HIRAYA_MYSQL_CA` if the host requires a CA file (Aiven)
   - `HIRAYA_SESSION_SECRET` (long random; Production refuses the development default)
   - `HIRAYA_PUBLIC_URL` and `HIRAYA_CORS_ORIGINS`
3. Prove `GET https://YOUR-API/api/health` → `{ "status": "ok", "database": "hiraya_learning_center" }` and `POST /api/auth/login` with a bad password → **401**.
4. Vercel (`apps/web`): set **server** env `HIRAYA_API_INTERNAL=https://YOUR-API` (no trailing slash). Do not put MySQL on Vercel. Prove `https://www.hirayalearningcenter.app/api/health` matches the API. Submit one enrollment.
5. Desktop installer: `VITE_API_URL=https://YOUR-API pnpm --filter @hiraya/desktop package` → `apps/desktop/release/HIRAYA-Setup-*.zip` (Windows portable). On a Windows PC with NSIS/Wine, `package:nsis` builds Setup.exe.
6. Mobile: set `EXPO_PUBLIC_API_URL` to the same API in `apps/mobile/eas.json` (preview + production). Then:
   - Android APK: `cd apps/mobile && npx eas-cli login && npx eas-cli build --platform android --profile preview`
   - Play Store AAB: `--profile production`
   - iPhone: Apple Developer + `npx eas-cli build --platform ios --profile production` then TestFlight (`eas submit`). Bundle ids are `com.hiraya.learningcenter`.
   - GitHub: workflow `.github/workflows/eas-preview.yml` (needs `EXPO_TOKEN`).

## Local hub (this machine)

```bash
# MySQL must be up (XAMPP, MariaDB, or docker compose)
export HIRAYA_MYSQL='mysql://hiraya:hiraya_hub@127.0.0.1:3306/hiraya_learning_center'
export PATH="$HOME/.dotnet:$PATH"
npm run dev:api
```

Then `curl http://127.0.0.1:5188/api/health`.

Docker (API + MySQL together): `docker compose up --build`.

## Client installs

| Client | Artifact |
|---|---|
| Website | Vercel URL |
| Super Admin PC | Windows Setup.exe |
| Android | APK (preview) or Play Store AAB |
| iPhone | TestFlight / App Store — not an APK |
