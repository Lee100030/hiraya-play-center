# HIRAYA role permission matrix

**Locked product rule (15 September 2026):**

- **One Super Administrator** (`admin` / `Admin123` in development). Full access to every record.
- **No separate Administrator, Staff, or Student logins.** Those leftover accounts are deactivated on API start.
- **Teachers** sign in on desktop, website, or Expo Go. They only see assigned classes and students.
- **Parents** sign in on website or Expo Go (and desktop if they have an account). They only see **their children**. Kids do not have accounts.

| Module | Super Admin | Teacher | Parent |
| --- | ---: | ---: | ---: |
| Teacher Monitoring | CRUD | Own profile | No |
| Student Monitoring | CRUD | Assigned only | Linked children only |
| Parent Monitoring | CRUD | No | Own profile |
| Enrollment | CRUD | View assigned | Own requests / children |
| Programs | CRUD | View | View child’s program |
| Classes | CRUD | Assigned only | Child’s class |
| Schedule | CRUD | Assigned only | Linked children |
| Tasks | CRUD | Own assigned; update status | No |
| Announcements | CRUD | Matching audience | Matching audience |
| Session packages | CRUD | Assigned students (view) | Linked children (view only) |
| Attendance | CRUD | Assigned students | View own children |
| Progress | CRUD | Assigned students | View own children (published) |
| Payments | CRUD | No | Own children |
| Reports | All | Assigned data | Own children |
| Settings | CRUD | No | Own profile |
| User management | CRUD (teachers & parents only) | No | No |

Sign-in roles allowed: `super_admin`, `teacher`, `parent`.
