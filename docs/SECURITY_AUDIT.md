# Security audit — testing phase

Date: 7 October 2026

## Authentication

- Session: `X-Hiraya-Session` HMAC tickets. Production requires `HIRAYA_SESSION_SECRET` not equal to the development secret.
- Passwords: PBKDF2 (`PasswordHasher`). `ClonePublic` and `StoreSanitizer` set `Password = null` before JSON leaves the API.
- Login lockout: 8 failures / 5 minutes, plus IP and identifier throttles.
- Roles: SuperAdmin (desktop/website admin), Teacher, Parent. Student portal sign-in is blocked by `ProductAccounts`.
- Frontend route hiding is not sufficient; `ParentPortalApi.ActorAsync` and role checks wrap sensitive maps. Store patches from non-admins are sanitized.

## Authorization findings addressed

- Admin setting a parent or teacher password now requires the **admin’s** password, verified against the hash on the live user record.
- SuperAdmin changing their own password requires an emailed one-time code when SMTP is configured.
- Parents cannot load another family’s children through `/api/parent/children?parentId=` (mismatch returns 403).

## RLS

Not applicable. The live database is a JSON document store on Neon. Isolation is application-level. Do not claim Postgres RLS is enforcing parent rows.

## Secrets

Do not put SMTP, Neon URIs, or session secrets in `NEXT_PUBLIC_`, `VITE_`, or `EXPO_PUBLIC_` variables. Packaged desktop talks to `https://www.hirayalearningcenter.app`.

## Rate limits

Server-side only (`PublicRequestThrottle`, `SensitiveActionCodes`, login lockout). In-memory; a new API instance does not share counters. Horizontal scaling would need a shared store.

## Unsigned clients

Windows NSIS is not Authenticode-signed. Android preview APK is not a Play production artifact. Do not tell users to disable OS protections.

## Residual risks

- In-memory throttles and verification codes reset on Render restart.
- Free Render disk drops uploaded files on restart.
- Local desktop sessions do not work against Render (different session secret).
- Backup restore was not executed in this pass.
