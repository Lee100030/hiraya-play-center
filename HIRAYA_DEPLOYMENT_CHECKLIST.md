# HIRAYA Deployment Checklist

**Hold:** develop on this PC only. Do not push to GitHub, Vercel, or DigitalOcean until the owner says so.

Use **Hiraya.Api + MySQL** as the only hub. Do not add a second backend.

## Local (thesis demo on this PC)

- [ ] XAMPP MySQL running, database `hiraya_learning_center`
- [ ] `npm run dev:api` (listens on `http://0.0.0.0:5188`)
- [ ] Website: `npm start` → Next proxies `/api/*` to `:5188`
- [ ] Desktop: `VITE_API_URL=http://127.0.0.1:5188`
- [ ] Phone: same Wi‑Fi; omit `EXPO_PUBLIC_API_URL`; API must not bind only to 127.0.0.1
- [ ] Check `GET http://127.0.0.1:5188/api/health` → `status: ok`
- [ ] Check `GET http://127.0.0.1:3000/api/health` matches the API (not `unconfigured`)

## Hosted website (Vercel)

The public site **cannot** login or save enrollment until Hiraya.Api is reachable.

1. Host `backend/Hiraya.Api` (Docker / DigitalOcean app spec `.do/app.yaml`).
2. Point that API at MySQL (`HIRAYA_MYSQL` or `DATABASE_URL`).
3. Set `HIRAYA_SESSION_SECRET` to a long random value (not the development default).
4. On Vercel (`apps/web`):
   - `HIRAYA_API_INTERNAL` = API origin (no trailing slash)
   - Optional: `NEXT_PUBLIC_API_URL` = same origin if you ever call the API from the browser (the app currently uses same-origin `/api/*`)
5. Redeploy the website.
6. Confirm `https://www.hirayalearningcenter.app/api/health` returns `status: ok` and a real `database` name.
7. Confirm `POST /api/auth/login` is 401 for bad passwords (not 503).
8. Submit a test enrollment and open it in desktop/admin against the **same** database.

Until those env vars exist, `/api/health` correctly returns **503 unconfigured**. That is expected.

## Do not

- Put MySQL passwords in `NEXT_PUBLIC_*`
- Use a static session token
- Expect desktop/mobile to see Vercel-only MySQL inserts that never went through Hiraya.Api
