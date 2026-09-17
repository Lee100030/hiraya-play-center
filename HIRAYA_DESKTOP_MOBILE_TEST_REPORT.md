# HIRAYA desktop–mobile test report

**Date:** 15 September 2026  
**Live round-trip:** Verified against `Hiraya.Api` on `http://127.0.0.1:5188` with MySQL `hiraya_learning_center`.

## Automated

| Check | Result |
| --- | --- |
| `node --test packages/utils/session-remaining.test.mjs` | Pass (remaining cannot go negative) |
| `node packages/utils/workflow-roundtrip.test.mjs` | **25/25 pass** |

Round-trip used seed logins `admin` / `Admin123`, `teacher` / `Teacher123`, `parent` / `Parent123`.

What it proved on the shared store:

1. Super Admin can save a class schedule, assigned task, published “everyone” announcement, and a session package.
2. Teacher GET sees that schedule, task, announcement, and a notification; sees **stu_001** only (not all 45 students).
3. Teacher PUT marks the task completed with remarks; Super Admin GET sees `completed` / `Done in API test` and a completion alert.
4. Super Admin increments used sessions (10 total, 2 used → remaining **8**). Parent GET shows remaining **8**, not a hardcoded 10.
5. Parent GET sees linked children `stu_001`, `stu_002` only, the announcement, the child schedule, and **no** staff tasks.
6. Parent PUT with `students: []` still returns the two children (family write overlays alerts only).

## UI still to click

Vite desktop (`:5173`), Next website (`:3000`), and Expo Metro (`:8081`) were running. Electron needs a **Ctrl+R** (or relaunch) so Management shows Schedule / Task / Announcement / Session. Phone screens were not driven in this pass.

## Manual path (optional)

1. Super Admin on desktop: Schedule management → create class for teacher `teacher`, save.
2. Teacher on Expo: Calendar shows the row (same `/api/store`).
3. Super Admin: Task management → assign to that teacher.
4. Teacher: Home → My tasks → In progress → Completed with remarks.
5. Super Admin: Task list shows Completed + response; admin notification created.
6. Super Admin: Announcement management → audience Teachers or Parents → publish.
7. Matching mobile user: Announcements / News.
8. Super Admin: Session management → package for a linked child → Complete session.
9. Parent mobile: Sessions shows remaining = total − used.
