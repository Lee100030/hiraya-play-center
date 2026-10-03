# HIRAYA Deployment Checklist

**Hosting:** GitHub and Vercel. **Database:** Aiven MySQL. Everyday data on this PC stays in local XAMPP (`hiraya_learning_center`) through Hiraya.Api. DigitalOcean and Render are not part of this project. Do not follow `.do/app.yaml` or `render.yaml`.

## Local (thesis demo on this PC)

- [ ] XAMPP MySQL running, database `hiraya_learning_center`
- [ ] `npm run dev:api` (listens on `http://0.0.0.0:5188`)
- [ ] Website: `npm start` → Next proxies `/api/*` to `:5188`
- [ ] Desktop: `VITE_API_URL=http://127.0.0.1:5188`
- [ ] Phone: same Wi‑Fi; omit `EXPO_PUBLIC_API_URL`; API must not bind only to 127.0.0.1
- [ ] Check `GET http://127.0.0.1:5188/api/health` → `status: ok`
- [ ] Check `GET http://127.0.0.1:3000/api/health` matches the API (not `unconfigured`)

## Hosted website (Vercel)

GitHub is the source. Vercel builds the website from that repo. Aiven is the database the hosted website uses.

1. In the Vercel project, set server env `HIRAYA_MYSQL` to the Aiven service URI. Optional: `HIRAYA_MYSQL_CA` with the CA certificate text.
2. Do not put that URI in GitHub. Do not name it `NEXT_PUBLIC_`, `VITE_`, or `EXPO_PUBLIC_`.
3. Do not set `HIRAYA_API_INTERNAL` on Vercel unless a public Hiraya.Api address exists. This project does not use DigitalOcean for that.
4. Redeploy the website from GitHub.
5. Confirm `https://www.hirayalearningcenter.app/api/health` returns `status: ok`, `hub: aiven`, and a database name.
6. The hosted health check, public catalog, enrollment, and teacher application read and write Aiven. Desktop, mobile, and this PC keep using Hiraya.Api and XAMPP.

Until those env vars exist, `/api/health` correctly returns **503 unconfigured**. That is expected.

## Do not

- Put MySQL passwords in `NEXT_PUBLIC_*`
- Use a static session token
- Expect desktop/mobile to see Vercel-only MySQL inserts that never went through Hiraya.Api
