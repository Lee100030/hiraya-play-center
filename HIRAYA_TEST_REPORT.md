# HIRAYA Test Report (living)

Updated after Phase 1 (API hub connection). Hosted production is **not** fixed until Vercel points at a running Hiraya.Api.

| Issue | Severity | Status | Files Changed | Test Result |
| --- | --- | --- | --- | --- |
| Hosted site has no API/database | Critical | Partially Complete | Next proxy routes, `.env.example`, `HIRAYA_DEPLOYMENT_CHECKLIST.md` | Live site still 503 until env/host exists. Local path: website now requires Hiraya.Api (no fake cloud login). |
| Enrollment does not persist | Critical | Partially Complete | `Program.cs` returns `applicationId`; public/mobile show reference; enroll route proxies only | BLOCKED on hosted (no API). Local: persist via existing `POST /api/public/enrollment` when API+MySQL run. |
| Admin login failure | Critical | Partially Complete | Login route proxy-only; `GET /api/auth/me` | No static `admin123` cloud token. Login works only when Hiraya.Api is up. |
| Incorrect `/admin` access | Critical | Pending | — | Phase 3 |
| Seed-password backdoor | Critical | Pending | — | Phase 2 (`PortalAuthService` / `SeedData`) |
| Static cloud token | Critical | Fixed (web fallback) | Removed `hiraya-cloud-mysql` login/store path | PASS in source: token no longer issued. Seed HMAC backdoor remains Phase 2. |
| Desktop attendance stub | High | Pending | — | Phase 5 |
| Desktop progress stub | High | Pending | — | Phase 6 |
| Desktop payments stub | High | Pending | — | Phase 7 |
| Reports stub | High | Pending | — | Phase 8 |
| Mobile layout issue | High | Pending | — | Phase 9 |
| About section overlap | High | Pending | — | Phase 9 |
| No automated tests | High | Pending | — | Phase 11 |
