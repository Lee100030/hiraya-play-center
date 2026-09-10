# Architecture

The original product is a **.NET MAUI Blazor Hybrid** client plus **Blazor Server** public site, both calling **Hiraya.Api** (ASP.NET Core Minimal APIs) over **EF Core → MySQL**.

The new clients do **not** connect to the database. They use the same HTTP API and `X-Hiraya-Session` header.

```text
                 ┌───────────────────────┐
                 │  Next.js website      │
                 │  apps/web             │
                 └──────────┬────────────┘
                            │
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
                     │  backend/    │
                     └──────┬───────┘
                            │  EF Core
                     ┌──────▼───────┐
                     │ MySQL        │
                     │ hiraya_      │
                     │ learning_    │
                     │ center       │
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

- **Web:** public marketing + full operations + family portal, responsive sidebar that collapses on small screens.
- **Mobile:** family-first bottom tabs (home, children, schedule, alerts, more). Staff remains desktop-oriented, matching the original Android rule.
- **Desktop:** native Electron window, application menu, wide operations desk (not a browser chrome around the marketing site).
