using Hiraya.Shared.Models;
using Hiraya.Shared.Security;
using Hiraya.Shared.Services.Firebase;

namespace Hiraya.Shared.Services;

public static class CenterOperationsCatalog
{
    public static void Ensure(HirayaDatabase db)
    {
        db.StudentOps ??= [];
        db.CenterHolidays ??= [];
        db.TeacherDuties ??= [];
        EnsureTeachers(db);
        EnsureProgramsAndClasses(db);
        EnsureStudents(db);
        EnsureHolidays(db);
        EnsureDuties(db);
        EnsureKnownTeacherOnRoster(db);
        EnsureWeekPlans(db);
    }

    public static bool RosterReady(HirayaDatabase db) =>
        db.Students.Any(s => s.StudentId == "stu_aki") &&
        db.Students.Any(s => s.StudentId == "stu_mira");

    public static bool NeedsHydrate(HirayaDatabase db)
    {
        db.StudentOps ??= [];
        db.CenterHolidays ??= [];
        db.TeacherDuties ??= [];
        db.Schedules ??= [];
        if (db.CenterHolidays.Count == 0 || db.TeacherDuties.Count == 0)
            return true;
        if (db.Users.Any(u => u.UserId == "usr_teacher_001") &&
            db.TeacherDuties.All(d => d.TeacherId != "usr_teacher_001"))
            return true;
        if (!db.Schedules.Any(s => (s.ScheduleId ?? "").StartsWith("ops_", StringComparison.Ordinal)))
            return true;
        return !RosterReady(db);
    }

    public static async Task HydrateIfNeededAsync(IHirayaRepository repository)
    {
        var db = await repository.LoadAsync();
        if (!NeedsHydrate(db))
            return;
        await repository.MutateAsync(data =>
        {
            Ensure(data);
            return Task.CompletedTask;
        });
    }

    public static bool IsBoy(Student student)
    {
        var gender = student.Gender?.Trim() ?? "";
        if (gender.Length == 0)
            return false;
        return gender.Equals("male", StringComparison.OrdinalIgnoreCase) ||
               gender.Equals("m", StringComparison.OrdinalIgnoreCase) ||
               gender.StartsWith("boy", StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsGirl(Student student)
    {
        var gender = student.Gender?.Trim() ?? "";
        if (gender.Length == 0)
            return false;
        return gender.Equals("female", StringComparison.OrdinalIgnoreCase) ||
               gender.Equals("f", StringComparison.OrdinalIgnoreCase) ||
               gender.StartsWith("girl", StringComparison.OrdinalIgnoreCase);
    }

    public static StudentOpsRecord FindOps(HirayaDatabase db, string studentId)
    {
        db.StudentOps ??= [];
        return db.StudentOps.FirstOrDefault(o => o.StudentId == studentId)
               ?? new StudentOpsRecord { StudentId = studentId };
    }

    public static StudentOpsRecord Ops(HirayaDatabase db, string studentId)
    {
        db.StudentOps ??= [];
        var row = db.StudentOps.FirstOrDefault(o => o.StudentId == studentId);
        if (row != null)
            return row;
        row = new StudentOpsRecord { StudentId = studentId };
        db.StudentOps.Add(row);
        return row;
    }

    private static void EnsureTeachers(HirayaDatabase db)
    {
        foreach (var (id, first, last, position) in new (string, string, string, string)[]
        {
            ("usr_t_jess", "Jess", "ABA", "ABA Therapist"),
            ("usr_t_rowie", "Rowie", "Santos", "Teacher"),
            ("usr_t_kat", "Kat", "Reyes", "Teacher"),
            ("usr_t_analyn", "Analyn", "Cruz", "Teacher"),
            ("usr_t_jessica", "Jessica", "Lim", "Teacher"),
            ("usr_t_diane", "Diane", "Tan", "Teacher"),
            ("usr_t_carol", "Carol", "Garcia", "Teacher"),
            ("usr_t_chris", "Chris", "Mendoza", "Teacher"),
            ("usr_t_ces", "Ces", "Villanueva", "Teacher")
        })
        {
            if (!db.Users.Any(u => u.UserId == id) &&
                !db.Users.Any(u => string.Equals(u.Email, $"{first.ToLowerInvariant()}@hiraya.local", StringComparison.OrdinalIgnoreCase)))
            {
                var user = new HirayaUser
                {
                    UserId = id,
                    FirstName = first,
                    LastName = last,
                    Username = first.ToLowerInvariant(),
                    Email = $"{first.ToLowerInvariant()}@hiraya.local",
                    Role = UserRoles.Teacher,
                    Status = "active",
                    Position = position,
                    Password = PasswordHasher.Hash("Teacher123"),
                    CreatedAt = "2026-01-01T00:00:00.000Z"
                };
                user.SyncDisplayName();
                db.Users.Add(user);
            }

            if (!db.TeacherProfiles.Any(p => p.UserId == id))
            {
                db.TeacherProfiles.Add(new TeacherProfile
                {
                    ProfileId = "tprof_" + id[4..],
                    UserId = id,
                    Position = position,
                    Status = "active",
                    HireDate = "2025-06-01T00:00:00.000Z"
                });
            }
        }
    }

    private static void EnsureProgramsAndClasses(HirayaDatabase db)
    {
        void Program(string id, string name)
        {
            if (db.Programs.Any(p => p.ProgramId == id))
                return;
            db.Programs.Add(new LearningProgram { ProgramId = id, Name = name, Description = name, Status = "active" });
        }

        Program("prg_playgroup", "Playgroup");
        Program("prg_aba", "ABA Therapy");
        Program("prg_tiny_tots", "Tiny Tots");
        Program("prg_bright_buds", "Bright Buds");
        Program("prg_rising_stars", "Rising Stars");
        Program("prg_tutorial", "Tutorial");
        Program("prg_3mo", "3-Months Program");
        Program("prg_10mo", "10-Months Program");

        void Class(string id, string name, string programId, string teacherId, string notes)
        {
            if (db.Classes.Any(c => c.ClassId == id))
                return;
            db.Classes.Add(new LearningClass
            {
                ClassId = id,
                Name = name,
                ProgramId = programId,
                TeacherId = teacherId,
                Room = "Main",
                Capacity = 20,
                ScheduleNotes = notes,
                Status = "active"
            });
        }

        Class("cls_playgroup_am", "Playgroup 11:00–12:30", "prg_playgroup", "usr_t_analyn", "Mon–Sat 11:00–12:30");
        Class("cls_playgroup_pm", "Playgroup 1:30–3:00", "prg_playgroup", "usr_t_carol", "Mon–Sat 1:30–3:00");
        Class("cls_aba_jess", "T. Jess ABA Therapy", "prg_aba", "usr_t_jess", "Mon–Fri 8:00–17:00");
        Class("cls_tiny_tots", "Tiny Tots (10:00)", "prg_tiny_tots", "usr_t_kat", "10:00–11:00");
        Class("cls_bright_buds", "Bright Buds (12:30)", "prg_bright_buds", "usr_t_jessica", "12:30");
        Class("cls_rising_stars", "Rising Stars (2:30)", "prg_rising_stars", "usr_t_diane", "14:30");
    }

    private const string RosterSheetVersion = "sheet-boys-v2";

    private static void EnsureStudents(HirayaDatabase db)
    {
        foreach (var row in Roster())
        {
            var student = db.Students.FirstOrDefault(s => s.StudentId == row.Id)
                ?? db.Students.FirstOrDefault(s => SameName(s, row.Last, row.First));
            var ops = student is null ? null : FindOps(db, student.StudentId);
            if (student != null && ops?.Package == RosterSheetVersion)
                continue;

            if (student is null)
            {
                student = new Student
                {
                    StudentId = row.Id,
                    EnrollmentDate = "2026-06-01T00:00:00.000Z",
                    QrCode = "HIRAYA-" + row.Id.ToUpperInvariant()
                };
                db.Students.Add(student);
            }

            ApplyRoster(student, row);
            ApplyOps(db, student.StudentId, row);
            Ops(db, student.StudentId).Package = RosterSheetVersion;
        }
    }

    private static void ApplyRoster(Student student, RosterRow row)
    {
        student.FirstName = row.First;
        student.MiddleName = row.Middle;
        student.LastName = row.Last;
        student.Birthdate = row.Birth;
        student.Age = string.IsNullOrWhiteSpace(row.Birth) ? row.ListedAge : AgeYears(row.Birth);
        student.Gender = row.Gender;
        student.Program = row.Slot;
        student.GradeLevel = row.Slot;
        student.Status = row.Active ? "active" : "inactive";
        StudentNames.SyncFullName(student);
    }

    private static void ApplyOps(HirayaDatabase db, string studentId, RosterRow row)
    {
        var ops = Ops(db, studentId);
        ops.CurrentSlot = row.Slot;
        ops.PaymentStatus = row.Paid ? "paid" : "awaiting";
        ops.FeeAmount = row.Fee;
        ops.LaceAmount = row.Lace;
        ops.Collector = row.Collector;
        ops.HasIdCard = row.Kit;
        ops.HasFetcherId = row.Kit;
        ops.HasNametag = row.Kit;
    }

    private static bool SameName(Student student, string last, string first) =>
        string.Equals(student.LastName, last, StringComparison.OrdinalIgnoreCase) &&
        string.Equals(student.FirstName, first, StringComparison.OrdinalIgnoreCase);

    private static int AgeYears(string iso)
    {
        if (!DateTime.TryParse(iso, out var birth))
            return 0;
        var today = DateTime.Today;
        var age = today.Year - birth.Year;
        if (birth.Date > today.AddYears(-age))
            age--;
        return Math.Max(0, age);
    }

    private static void EnsureHolidays(HirayaDatabase db)
    {
        foreach (var (date, title, kind) in Holidays())
        {
            if (db.CenterHolidays.Any(h => h.Date == date))
                continue;
            db.CenterHolidays.Add(new CenterHoliday
            {
                HolidayId = "hol_" + date.Replace("-", ""),
                Date = date,
                Title = title,
                Kind = kind
            });
        }
    }

    private static void EnsureDuties(HirayaDatabase db)
    {
        if (db.TeacherDuties.Count > 0)
            return;
        var teachers = new[]
        {
            "usr_teacher_001", "usr_t_rowie", "usr_t_kat", "usr_t_analyn", "usr_t_jessica",
            "usr_t_diane", "usr_t_carol", "usr_t_chris", "usr_t_ces"
        };
        var lead = new[] { "usr_t_diane", "usr_t_rowie", "usr_t_jessica", "usr_t_analyn" };
        for (var day = 1; day <= 30; day++)
        {
            var date = $"2026-09-{day:00}";
            var leadId = lead[day % lead.Length];
            foreach (var teacherId in teachers.Where((_, i) => (day + i) % 3 != 0).Take(4))
            {
                db.TeacherDuties.Add(new TeacherDuty
                {
                    DutyId = $"duty_{date}_{teacherId}",
                    WorkDate = date,
                    TeacherId = teacherId,
                    Marker = teacherId == leadId ? "lead" : "support",
                    Note = day == 1 ? "NC" : day == 2 && teacherId == "usr_t_kat" ? "halfday" : ""
                });
            }
        }
    }

    private static void EnsureKnownTeacherOnRoster(HirayaDatabase db)
    {
        const string id = "usr_teacher_001";
        if (!db.Users.Any(u => u.UserId == id))
            return;
        if (db.TeacherDuties.Any(d => d.TeacherId == id))
            return;
        foreach (var date in db.TeacherDuties.Select(d => d.WorkDate).Distinct().OrderBy(x => x).Where((_, i) => i % 2 == 0))
        {
            db.TeacherDuties.Add(new TeacherDuty
            {
                DutyId = $"duty_{date}_{id}",
                WorkDate = date,
                TeacherId = id,
                Marker = "support",
                Note = ""
            });
        }
    }

    private static void EnsureWeekPlans(HirayaDatabase db)
    {
        if (db.Schedules.Any(s => (s.ScheduleId ?? "").StartsWith("ops_", StringComparison.Ordinal)))
            return;

        void Session(string id, DateTime start, DateTime end, string title, string teacherId, string classId, string studentId, string kind, string notes)
        {
            db.Schedules.Add(new Schedule
            {
                ScheduleId = id,
                Title = title,
                Kind = kind,
                ClassId = classId,
                StudentId = studentId,
                TeacherId = teacherId,
                ScheduleType = kind,
                StartAt = DateTime.SpecifyKind(start, DateTimeKind.Local).ToUniversalTime().ToString("o"),
                EndAt = DateTime.SpecifyKind(end, DateTimeKind.Local).ToUniversalTime().ToString("o"),
                Room = "Therapy",
                Notes = notes,
                Status = "confirmed"
            });
        }

        var mon = new DateTime(2026, 9, 7);
        string[] abaKids = ["Victory", "Psyche", "JM", "Wade", "Mikko", "Psalm", "Majeed", "Nathan", "John Carwynn"];
        for (var d = 0; d < 5; d++)
        {
            var day = mon.AddDays(d);
            Session($"ops_aba_{d}_1", day.AddHours(8), day.AddHours(10), abaKids[d % abaKids.Length] + " ABA", "usr_t_jess", "cls_aba_jess", "", ScheduleKinds.ClassSession, "ABA");
            Session($"ops_aba_{d}_brk1", day.AddHours(10), day.AddHours(10).AddMinutes(30), "Break", "usr_t_jess", "cls_aba_jess", "", ScheduleKinds.TeacherTask, "break");
            Session($"ops_aba_{d}_2", day.AddHours(10).AddMinutes(30), day.AddHours(12).AddMinutes(30), abaKids[(d + 2) % abaKids.Length] + " ABA", "usr_t_jess", "cls_aba_jess", "", ScheduleKinds.ClassSession, "ABA");
            Session($"ops_aba_{d}_brk2", day.AddHours(12).AddMinutes(30), day.AddHours(13), "Break", "usr_t_jess", "cls_aba_jess", "", ScheduleKinds.TeacherTask, "break");
            Session($"ops_aba_{d}_3", day.AddHours(13), day.AddHours(15), abaKids[(d + 4) % abaKids.Length] + " ABA", "usr_t_jess", "cls_aba_jess", "", ScheduleKinds.ClassSession, "ABA");
            if (d < 4)
                Session($"ops_aba_{d}_4", day.AddHours(15), day.AddHours(17), d == 1 || d == 2 ? "Cleaners" : "Admin / huddle", "usr_t_jess", "cls_aba_jess", "", ScheduleKinds.TeacherTask, "prep");
            else
                Session($"ops_aba_{d}_4", day.AddHours(15), day.AddHours(17), "Batch prep / make-up / huddle", "usr_t_jess", "cls_aba_jess", "", ScheduleKinds.Activity, "makeup");
            Session($"ops_aba_{d}_buf", day.AddHours(17), day.AddHours(20), "Buffer / preparation", "usr_t_jess", "cls_aba_jess", "", ScheduleKinds.TeacherTask, "buffer");
        }

        string[] am = ["Zacc", "Viel", "Skye", "Kristoff", "Mesach", "Jarell"];
        string[] pm = ["Psalm", "Carren", "Mateen", "Vonn", "Amir", "JC", "Timothy", "Evan"];
        for (var d = 0; d < 6; d++)
        {
            var day = mon.AddDays(d);
            Session($"ops_pg_am_{d}", day.AddHours(11), day.AddHours(12).AddMinutes(30), string.Join(", ", am.Skip(d % 3).Take(3)), "usr_t_analyn", "cls_playgroup_am", "", ScheduleKinds.ClassSession, "playgroup");
            Session($"ops_pg_pm_{d}", day.AddHours(13).AddMinutes(30), day.AddHours(15), string.Join(", ", pm.Skip(d % 4).Take(4)), "usr_t_carol", "cls_playgroup_pm", "", ScheduleKinds.ClassSession, "playgroup");
        }
    }

    private static IEnumerable<(string Date, string Title, string Kind)> Holidays()
    {
        yield return ("2026-01-01", "New Year's Day Regular Holiday", "holiday");
        yield return ("2026-02-17", "Chinese New Year / school event", "holiday");
        yield return ("2026-04-02", "Maundy Thursday", "holiday");
        yield return ("2026-04-03", "Good Friday", "holiday");
        yield return ("2026-04-09", "Araw ng Kagitingan", "holiday");
        yield return ("2026-05-01", "Labor Day", "holiday");
        yield return ("2026-06-12", "Independence Day", "holiday");
        yield return ("2026-08-21", "Ninoy Aquino Day", "holiday");
        yield return ("2026-08-31", "National Heroes Day", "holiday");
        yield return ("2026-11-01", "All Saints' Day", "event");
        yield return ("2026-11-30", "Bonifacio Day", "holiday");
        yield return ("2026-12-08", "School Christmas program", "event");
        yield return ("2026-12-25", "Christmas Day", "holiday");
        yield return ("2026-12-30", "Rizal Day", "holiday");
        yield return ("2027-01-01", "New Year's Day Regular Holiday", "holiday");
        yield return ("2027-02-06", "Lunar New Year's Day", "holiday");
        yield return ("2027-04-25", "Easter Sunday period", "holiday");
        yield return ("2027-04-09", "Araw ng Kagitingan", "holiday");
        yield return ("2027-05-01", "Labor Day", "holiday");
        yield return ("2027-06-12", "Independence Day", "holiday");
        yield return ("2027-08-21", "Ninoy Aquino Day", "holiday");
        yield return ("2027-11-30", "Bonifacio Day", "holiday");
        yield return ("2027-12-25", "Christmas Day", "holiday");
        yield return ("2027-12-30", "Rizal Day", "holiday");
    }

    private sealed record RosterRow(
        string Id, string Last, string First, string Middle, string Gender, string Birth,
        string Slot, bool Active, bool Paid, string Collector, decimal Fee, decimal Lace, bool Kit, int ListedAge = 0);

    private static IEnumerable<RosterRow> Roster()
    {
        RosterRow B(string id, string last, string first, string middle, string birth, string slot, bool active = true, bool paid = true, string collector = "Angelica", decimal fee = 180, decimal lace = 0, bool kit = true, int listedAge = 0) =>
            new(id, last, first, middle, "male", birth, slot, active, paid, collector, fee, lace, kit, listedAge);
        RosterRow G(string id, string last, string first, string middle, string birth, string slot, bool active = true, bool paid = false, string collector = "Cady", decimal fee = 180, decimal lace = 0, bool kit = true) =>
            new(id, last, first, middle, "female", birth, slot, active, paid, collector, fee, lace, kit);

        const string Bright = "Bright Buds (12:30)";
        const string Rising = "Rising Stars (2:30)";
        const string Tiny = "Tiny Tots (10:00-11:30)";

        yield return B("stu_aki", "Acosta", "Aki Ryzen", "L.", "2021-06-09", Bright);
        yield return B("stu_ruan", "Baguipo", "Ruan Kallen", "V.", "2023-10-21", Rising, false);
        yield return B("stu_yohan", "Beloso", "Yohan Drel", "S.", "2022-11-03", Bright);
        yield return B("stu_zyan", "Boy", "Zyan Gabriel", "P.", "2022-07-25", Rising, false, true, "ABONO", 0, 125);
        yield return B("stu_mattheus", "Cabanado", "Mattheus Neo", "", "2023-12-17", Tiny, false);
        yield return B("stu_prince", "Custan", "Prince Yohan", "", "2022-12-19", Bright, false, true, "Cady");
        yield return B("stu_psyche", "Dela Cruz", "Reignier Psyche", "", "2020-01-23", Rising, true, true, "Angelica", 75);
        yield return B("stu_psalm", "Dela Cruz", "Xaviour Psalm", "", "2022-12-06", Bright, true, true, "Angelica", 75);
        yield return B("stu_zayn", "Dumlao", "Zayn Gabriel", "", "2022-02-20", Rising, false, true, "Cady");
        yield return B("stu_jesse", "Gapilango", "Jesse Caleb", "", "2022-09-24", Tiny, true, true, "Cady");
        yield return B("stu_dwayne", "Gomez", "Dwayne Eliah", "B.", "2022-11-29", Bright, true, true, "Cady", 180, 125);
        yield return B("stu_tallis", "Gonzales", "Talis Navi", "E.", "2023-02-07", Tiny, false, true, "Cady");
        yield return B("stu_calix", "Guerrero", "Calix Gabriel", "B.", "2022-05-04", Rising, true, true, "ABONO", 0);
        yield return B("stu_marco", "Lubaton", "Marco", "R.", "2021-10-30", Bright);
        yield return B("stu_zion", "Madio", "Zion Bert", "S.", "2021-01-07", Rising);
        yield return B("stu_skyler", "Miave", "Ray Skyler", "", "2017-06-19", Rising, false, false, "", 0);
        yield return B("stu_victory", "Moises", "Victory", "T.", "2022-12-31", Tiny, true, true, "Cady");
        yield return B("stu_nate", "Nofuente", "Nate Edward", "C.", "2020-07-24", Rising, false, true, "Cady");
        yield return B("stu_lycus", "Ocbiña", "Lycus Grey", "M.", "2021-09-12", Bright, true, true, "");
        yield return B("stu_jihyu", "Pangan", "Jihyu", "B.", "2023-04-11", Tiny, true, true, "");
        yield return B("stu_jace", "Pavon", "Jace Malcolm", "T.", "2019-06-18", Rising, true, true, "");
        yield return B("stu_tristan", "Permejo", "Tristan Liam", "J.", "2023-05-10", Tiny, true, true, "", 180, 125);
        yield return B("stu_lambert", "Salmingo", "Lambert Anthony", "A.", "2023-11-26", Bright, false, false, "", 0);
        yield return B("stu_samuel", "Sunga", "Samuel Asher", "", "2023-06-30", Tiny, false);
        yield return B("stu_noah", "Tabago", "Noah Elijah", "", "", Bright, false, false, "", 0, 0, true, 2);
        yield return B("stu_carwynn", "Santos", "John Carwynn", "", "2019-06-04", "ABA Therapy");
        yield return B("stu_jm", "Reyes", "JM", "", "2020-10-10", "ABA Therapy");
        yield return B("stu_wade", "Cruz", "Wade", "", "2020-08-08", "ABA Therapy");
        yield return B("stu_mikko", "Tan", "Mikko", "", "2019-11-11", "ABA Therapy");
        yield return B("stu_majeed", "Ali", "Majeed", "", "2020-02-02", "ABA Therapy");
        yield return B("stu_nathan_aba", "Lim", "Nathan", "", "2020-12-12", "ABA Therapy");

        yield return G("stu_mira", "Ayap", "Mira Claire Viel", "S.", "2023-12-18", "Tiny Tots (10:00)", false, true, "Angelica");
        yield return G("stu_asliah", "Bejosano", "Asliah Brielle", "B.", "2023-04-02", "Tiny Tots (10:00)", false);
        yield return G("stu_miriam", "Boakye", "Miriam Elgina", "", "2023-01-15", "Bright Buds (12:00)", false);
        yield return G("stu_lucy", "Custan", "Lucy Avior", "", "2023-06-20", "Tiny Tots (10:00)", false, false, "ABONO");
        yield return G("stu_aaliyah", "Fordan", "Aaliyah Louise", "A.", "2022-07-29", "Bright Buds (12:00)", true, true, "Cady", 180, 125);
        yield return G("stu_eliyah", "Mallari", "Eliyah", "C.", "2023-03-11", "Tiny Tots (10:00)", false);
        yield return G("stu_amory", "Samar", "Amory Winter", "G.", "2022-11-09", "Bright Buds (12:00)", false);
        yield return G("stu_akeela", "Sunga", "Akeela Zarene", "", "2023-02-14", "Tiny Tots (10:00)", true, true, "Angelica", 0, 125);
        yield return G("stu_eliana", "Torrecampo", "Eliana Sophia", "", "2023-08-30", "Bright Buds (12:00)", false);
        yield return G("stu_viel", "Santos", "Viel", "", "2022-05-05", "Playgroup 11:00–12:30");
        yield return G("stu_skye", "Garcia", "Skye", "", "2022-09-09", "Playgroup 11:00–12:30");
        yield return G("stu_carren", "Lopez", "Carren", "", "2021-04-04", "Playgroup 1:30–3:00");
    }
}
