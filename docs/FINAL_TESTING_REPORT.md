# Final testing report — testing phase

Date: 7 October 2026  
Git: local uncommitted testing-phase changes (do not deploy unknown local work until the operator commits)

## What was verified in this pass

- Static review of auth, sanitizer, parent/teacher password confirmation, login throttles, approval email queueing, payment email CTA removal, balance readouts, job-application modal copy, notification coloring, mobile Field/messages/alerts, CI workflow.
- Unit tests in `packages/utils/*.test.mjs` were run after the code changes.
- `dotnet build` of Hiraya.Api was attempted; file lock is possible if the local API is already running.
- Browser/device/emulator/APK rebuild/Brevo extra send: not executed (standing rules + no extra live mail).

## Checklist

### AUTH

- [x] Login lockout + throttle exist on the API
- [x] Logout revokes ticket jti
- [x] Password change (self) hashes on server
- [x] Admin verification code endpoints exist
- [x] Role permissions enforced in API maps / sanitizer
- [ ] Live parent vs teacher vs logged-out crawl of every `/admin/*` URL in a browser (NEEDS REVIEW)
- [ ] RLS (N/A)

### SECURITY

- [x] No plaintext passwords returned (`ClonePublic`)
- [x] Admin password confirmation for other-user password set
- [x] Rate limiting on login and public forms
- [ ] Parent A/B live isolation probe (BLOCKED — no destructive live tests)

### WEBSITE / DESKTOP / MOBILE / EMAIL

See `docs/TESTING_PHASE_FIXES.md`. Several items are code-complete and marked NEEDS REVIEW or BLOCKED for hardware/SMTP/signing.

## Release recommendation

**NOT READY to claim “everything is fixed.”** Code for the listed tester bugs is in the workspace. Production still needs: commit + API/web deploy, SMTP verification of approval and admin password codes, Authenticode/Play signing for installers, and a live role-isolation pass.
