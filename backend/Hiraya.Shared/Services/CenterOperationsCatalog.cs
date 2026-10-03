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
        db.Schedules ??= [];
        EnsureTeachers(db);
        EnsureProgramsAndClasses(db);
        EnsureStudents(db);
        EnsureDuties(db);
        EnsureKnownTeacherOnRoster(db);
        RemoveAutoCalendarData(db);
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
        if (db.TeacherDuties.Count == 0)
            return true;
        if (db.Users.Any(u => u.UserId == "usr_teacher_001") &&
            db.TeacherDuties.All(d => d.TeacherId != "usr_teacher_001"))
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

    private static void RemoveAutoCalendarData(HirayaDatabase db)
    {
        db.Schedules ??= [];
        db.CenterHolidays ??= [];
        // Drop demo week plans and seed sample schedules so the calendar stays empty until staff assign.
        db.Schedules.RemoveAll(s =>
        {
            var id = s.ScheduleId ?? "";
            return id.StartsWith("ops_", StringComparison.Ordinal) ||
                   id is "sch_001" or "sch_holiday_001";
        });
        var autoHolidayIds = new HashSet<string>(
            Holidays().Select(h => "hol_" + h.Date.Replace("-", "")),
            StringComparer.OrdinalIgnoreCase);
        db.CenterHolidays.RemoveAll(h => autoHolidayIds.Contains(h.HolidayId ?? ""));
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
