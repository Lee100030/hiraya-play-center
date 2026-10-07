# Performance audit — testing phase

Date: 7 October 2026

## Measure-first notes

The live API (`https://hiraya-play-center.onrender.com/api/health`) sits on Render free compute. Cold start after idle is the dominant user-facing delay (often tens of seconds), not missing CDN for private JSON.

Do not add load balancers or larger instances without traffic evidence. Current concurrent use is a single learning center.

## Bottlenecks (known, not guessed)

| Area | Finding |
| --- | --- |
| Cloud compute | Render free dyno sleep / cold start |
| API | Whole-store load/mutate on many writes; sanitizer clones the store per GET |
| Database | JSON document; extra B-tree indexes on SQL columns are not the access pattern |
| Website | Next.js on Vercel; public pages can use CDN for images/static assets |
| Email | SMTP in-request caused approval delay; now queued after commit |
| Desktop | First packaged sign-in waits for API wake |
| Caching | Private store/session/payments/messages must remain `Cache-Control: no-store` (public site already sets no-store on `/api/public/site`) |

## Safe cache candidates

- Crest, photos, CSS/JS from Vercel
- Public program/about copy **with** invalidation when admin saves website content (API already `no-store` for `/api/public/site`)

## Unsafe to cache

Parent, student, payment, attendance, progress, messages, notifications, session tokens.

## Scaling

Not required at current scale. Sessions are HMAC tokens (not in-memory server sessions), so a second API instance can authenticate. Throttles and verification codes **are** in-memory and would need Redis/equivalent before multi-instance production.

## Compute recommendation

Keep current Render size until cold-start complaints persist after a paid always-on instance is justified. Expected benefit of paid instance: remove sleep delay, not faster SQL.
