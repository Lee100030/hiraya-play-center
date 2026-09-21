# RION decisions needed

1. **Source of the “full” desktop** — This GitHub repo never contained it. Confirm whether to treat `C:\Users\LEE\Desktop\Hiraya play Center React` as the real source and copy it in later, or keep rebuilding inside `lee100030/hiraya-play-center`.
2. **Session remaining count** — Spec wants `remainingSessions = totalSessions - usedSessions`. Those columns are not on `Student` / `StudentOps` here. Need owner confirmation before a schema change.
3. **Tasks module** — No `tasks` collection in `HirayaDatabase`. Use leave requests / duties / news until a real Task model exists?
4. **Fix-spec files** — `hiraya-all-fix-prompts-combined.md` and `hiraya-fullstack-system-audit-prompt.md` are not in this workspace. Add them to the repo if they should bind UI.
5. **Teacher workspace URL** — Web has no `/admin/teachers/:id`. Desktop can use an in-window workspace; web route still to add for parity.
