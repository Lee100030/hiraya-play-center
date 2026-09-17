# HIRAYA CRUD implementation report

**Date:** 15 September 2026  
**Rule:** Do not mark Complete until tested against a restarted Hiraya.Api + MySQL.

| Module | Create | Read | Update | Delete/Archive | API | DB | Live test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Teachers | Wired | Wired | Wired | Wired | REST | Yes | Pending restart |
| Students | Wired | Wired | Wired | Wired | Store PUT | Yes | Pending |
| Parents | Wired | Wired | Wired | Wired | REST | Yes | Pending |
| Programs | Wired | Wired | Wired | Wired | Store PUT | Yes | Pending |
| Classes | Wired | Wired | Wired | Wired | Store PUT | Yes | Pending |
| Enrollment | Wired | Wired | Wired | Approve/reject | REST + store | Yes | Pending |
| Schedules | Wired (desktop Management) | Wired | Wired | Cancel status | Store PUT + conflict check | Yes | Pending restart |
| Tasks | Wired | Wired | Status on mobile | Cancel status | Store PUT | `staff_tasks` | Pending restart |
| Announcements | Wired | Wired | Wired | Archive status | Store PUT | `announcements` | Pending restart |
| Session packages | Wired | Wired | Wired + complete | Suspend status | Store PUT | `session_packages` | Pending restart |
| Notifications | Generated on assign/publish | Wired | Mark read | — | Store PUT | `notifications` | Pending restart |
| Learning modules | Wired | Wired | Wired | Archive | Store PUT | Yes | Pending |
| Attendance / progress / payments | Partial (often view) | Wired | Teacher attendance merge exists | — | Store | Yes | Incomplete UI |

Restart Hiraya.Api so `EnsureWorkflowSchema` creates `staff_tasks`, `session_packages`, and `session_history`.
