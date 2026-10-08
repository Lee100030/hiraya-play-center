# HIRAYA Deployment Checklist

**Live:** GitHub → Vercel (website) + Render (Hiraya.Api) + Neon (center store). Staff operations: `docs/HIRAYA_SYSTEM_GUIDE.md`.

Do not put database URIs in `NEXT_PUBLIC_`, `VITE_`, or `EXPO_PUBLIC_` variables.

## Local (thesis demo on this PC)

- [ ] XAMPP MySQL running, database `hiraya_learning_center`
- [ ] `npm run dev:api` (listens on `http://0.0.0.0:5188`)
- [ ] Website: `npm start` → Next proxies `/api/*` to `:5188`
- [ ] Desktop: `VITE_API_URL=http://127.0.0.1:5188`
- [ ] Phone: same Wi‑Fi; omit `EXPO_PUBLIC_API_URL`; API must not bind only to 127.0.0.1
- [ ] Check `GET http://127.0.0.1:5188/api/health` → `status: ok`
- [ ] Check `GET http://127.0.0.1:3000/api/health` matches the API (not `unconfigured`)

## Hosted (GitHub push)

1. Push `main` to `Johnleelugnasin30/hiraya-play-center`.
2. Wait for Vercel (website) and Render (API) to finish deploying.
3. Confirm `https://www.hirayalearningcenter.app/api/health` returns `status: ok`.
4. Public enrollment, desktop, and mobile must all go through Hiraya.Api so they share the same center store.
5. Client Android APK **1.0.1** (`HIRAYA 1.0.1.apk`) uses that same hosted URL. Announcements open in a readable modal on the phone.

## Do not

- Put database passwords in `NEXT_PUBLIC_*`, `VITE_*`, or `EXPO_PUBLIC_*`
- Use a static session token
- Expect a website-only write that never reached Hiraya.Api to show up on desktop or mobile
