# Architecture

Live operations for staff are in **`docs/HIRAYA_SYSTEM_GUIDE.md`**.

The clients do **not** connect to the database. They use Hiraya.Api and the `X-Hiraya-Session` header.

```text
                 ┌───────────────────────┐
                 │  Next.js website      │
                 │  Render · apps/web    │
                 └──────────┬────────────┘
                            │  /api proxy
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
│ Expo mobile    │  │ Electron       │  │ Shared TS      │
│ apps/mobile    │  │ apps/desktop   │  │ packages/*     │
└───────┬────────┘  └───────┬────────┘  └───────┬────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │  HTTP + X-Hiraya-Session
                     ┌──────▼───────┐
                     │  Hiraya.Api  │
                     │  Render      │
                     └──────┬───────┘
                            │  center document
                     ┌──────▼───────┐
                     │ Neon store   │
                     └──────────────┘
```

## Shared packages

| Package | Role |
|---------|------|
| `@hiraya/types` | Domain models matching `HirayaDatabase` |
| `@hiraya/api` | HTTP client for auth, store, public, parent, modules |
| `@hiraya/validation` | Zod schemas |
| `@hiraya/utils` | RBAC helpers, IDs, labels |
| `@hiraya/config` | API URL + session header name |
| `@hiraya/ui` | Web/desktop design-system primitives (not used on React Native) |

## Auth

Login is `POST /api/auth/login`. The API issues a custom HMAC session token (not JWT). Clients send it as `X-Hiraya-Session`.

Roles: `super_admin`, `admin`, `teacher`, `staff`, `parent`, `student`.

Most operational CRUD still uses `GET/PUT /api/store` — the same document sync the MAUI app used.

## Platform UX

- **Web:** public marketing + enrollment + Super Admin operations. Website apply creates the parent, the child, and the family link at once.
- **Mobile:** teachers and parents only (home, schedule, alerts, progress). Children do not sign in.
- **Desktop:** Super Admin control desk — people, finance, calendar, **ABA schedule**, sessions, enrollment.

Ordinary staff saves use `POST /api/store/patch`. Public enrollment uses `POST /api/public/enrollment`.
