# HIRAYA Migration Notes

## Phase 1 (13 September 2026)

Website login, store, enrollment, and health **only** proxy to Hiraya.Api. The Next.js MySQL twin is no longer used for login or `PUT /api/store`.

`GET /api/auth/me` was added so web and desktop can reject expired/forged sessions instead of trusting `localStorage` user JSON alone.

Public enrollment responses include `applicationId` for the confirmation screen.

**Hosted site:** still needs `HIRAYA_API_INTERNAL` (or equivalent) on Vercel plus a running API. See `HIRAYA_DEPLOYMENT_CHECKLIST.md`.
