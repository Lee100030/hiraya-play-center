using Hiraya.Shared.Models;
using Hiraya.Shared.Security;
using Hiraya.Shared.Services.Firebase;
using Microsoft.Extensions.Logging;

namespace Hiraya.Shared.Services;

public sealed class EnrollmentApprovalNotice
{
    public string ParentUserId { get; init; } = "";
    public string ParentEmail { get; init; } = "";
    public string ParentName { get; init; } = "";
    public string StudentName { get; init; } = "";
    public string Program { get; init; } = "";
    public bool ParentNeedsActivation { get; init; }
}

public class EnrollmentService
{
    private readonly IHirayaRepository _repository;
    private readonly ParentAccountService? _parents;
    private readonly ILogger<EnrollmentService>? _logger;

    public EnrollmentService(
        IHirayaRepository repository,
        ParentAccountService? parents = null,
        ILogger<EnrollmentService>? logger = null)
    {
        _repository = repository;
        _parents = parents;
        _logger = logger;
    }

    public async Task<string> SubmitPublicApplicationAsync(
        string studentFullname,
        string studentBirthdate,
        string studentGender,
        string preferredProgram,
        string parentFullname,
        string parentEmail,
        string parentPhone,
        string? studentAddress = null,
        string? studentPhone = null,
        string? studentEmail = null,
        string? guardianRelationship = null,
        string? preferredSchedule = null,
        string? enrollmentType = null,
        string? notes = null)
    {
        if (string.IsNullOrWhiteSpace(studentFullname) || studentFullname.Trim().Length < 2)
            throw new InvalidOperationException("Please enter the child’s full name.");
        if (!DateTime.TryParse(studentBirthdate, out _))
            throw new InvalidOperationException("Please enter a valid date of birth.");
        if (string.IsNullOrWhiteSpace(parentFullname) || parentFullname.Trim().Length < 2)
            throw new InvalidOperationException("Please enter the parent or guardian’s name.");
        if (string.IsNullOrWhiteSpace(parentEmail) || !parentEmail.Contains('@'))
            throw new InvalidOperationException("Please enter a valid email address.");
        var digits = new string((parentPhone ?? "").Where(char.IsDigit).ToArray());
        if (digits.Length < 7)
            throw new InvalidOperationException("Please enter a valid contact number.");
        if (string.IsNullOrWhiteSpace(preferredProgram))
            throw new InvalidOperationException("Please choose a program.");

        var age = ComputeAge(studentBirthdate);
        var applicationId = $"app_{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid().ToString("N")[..6]}";
        var childName = studentFullname.Trim();
        var guardianName = parentFullname.Trim();
        var guardianEmail = parentEmail.Trim();
        var guardianPhone = (parentPhone ?? "").Trim();
        var program = preferredProgram.Trim();

        await _repository.MutateAsync(async db =>
        {
            var duplicate = db.EnrollmentApplications.Any(a =>
                a.Status == "pending_review" &&
                string.Equals(a.ParentEmail, guardianEmail, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(a.StudentFullname, childName, StringComparison.OrdinalIgnoreCase));
            if (duplicate)
                throw new InvalidOperationException("An application for this child is already waiting for review.");
            var application = new EnrollmentApplication
            {
                ApplicationId = applicationId,
                StudentFullname = childName,
                StudentBirthdate = studentBirthdate,
                StudentAge = age,
                StudentGender = studentGender,
                ParentFullname = guardianName,
                ParentEmail = guardianEmail,
                ParentPhone = guardianPhone,
                PreferredProgram = program,
                SubmittedAt = DateTime.UtcNow.ToString("o"),
                Status = "pending_review",
                ApplicationKind = "student",
                Notes = FormatApplicationNotes(
                    studentAddress,
                    studentPhone,
                    studentEmail,
                    guardianRelationship,
                    preferredSchedule,
                    enrollmentType,
                    notes)
            };
            db.EnrollmentApplications.Add(application);
            RegisterFamilyFromApplication(db, application);

            NotificationService.PushToUsers(
                db,
                NotificationService.Recipients(db, NotificationAudiences.Admins).Select(u => u.UserId),
                $"A new enrollment application has been submitted. Parent: {guardianName}. Student: {childName}. Program: {program}. Both records are in Parent and Student management, already linked.",
                NotificationKinds.Enrollment,
                "New enrollment request",
                "enrollment");

            AuditService.Append(db, "", "Public", AuditModules.Enrollment, "apply",
                "application", applicationId, $"Application submitted for {childName}. Parent and student records were saved and linked.");
            await Task.CompletedTask;
        });

        QueueReceipt(
            guardianEmail,
            guardianName,
            "we received your enrollment application",
            $"We received the enrollment application for {childName} ({program}). The parent and the child are now on file at the center and linked together. Class placement still waits for review.");
        return applicationId;
    }

    public async Task<string> SubmitTeacherApplicationAsync(string fullname, string email, string phone, string position, string? notes)
    {
        var name = (fullname ?? "").Trim();
        var mail = (email ?? "").Trim();
        var contact = (phone ?? "").Trim();
        var role = (position ?? "").Trim();
        if (name.Length < 2)
            throw new InvalidOperationException("Please enter your full name.");
        if (mail.Length < 5 || !mail.Contains('@') || !mail.Contains('.'))
            throw new InvalidOperationException("Please enter a valid email.");
        var digits = new string(contact.Where(char.IsDigit).ToArray());
        if (digits.Length < 7)
            throw new InvalidOperationException("Please enter a valid contact number.");
        if (string.IsNullOrWhiteSpace(role))
            throw new InvalidOperationException("Please choose the role you want to teach.");

        var applicationId = $"tch_{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid().ToString("N")[..6]}";
        await _repository.MutateAsync(async db =>
        {
            var duplicate = db.EnrollmentApplications.Any(a =>
                string.Equals(a.ApplicationKind, "teacher", StringComparison.OrdinalIgnoreCase) &&
                a.Status == "pending_review" &&
                string.Equals(a.ParentEmail, mail, StringComparison.OrdinalIgnoreCase));
            if (duplicate)
                throw new InvalidOperationException("A teacher application for this email is already waiting for review.");
            db.EnrollmentApplications.Add(new EnrollmentApplication
            {
                ApplicationId = applicationId,
                ApplicationKind = "teacher",
                StudentFullname = name,
                ParentFullname = name,
                ParentEmail = mail,
                ParentPhone = contact,
                PreferredProgram = role,
                SubmittedAt = DateTime.UtcNow.ToString("o"),
                Status = "pending_review",
                Notes = (notes ?? "").Trim()
            });
            NotificationService.PushToUsers(
                db,
                NotificationService.Recipients(db, NotificationAudiences.Admins).Select(u => u.UserId),
                $"A teacher application was submitted. Applicant: {name}. Role: {role}. This is not a student enrollment.",
                NotificationKinds.Enrollment,
                "New teacher application",
                "enrollment");
            AuditService.Append(db, "", "Public", AuditModules.Enrollment, "apply-teacher",
                "application", applicationId, $"Teacher application submitted by {name}.");
            await Task.CompletedTask;
        });
        QueueReceipt(
            mail,
            name,
            "we received your teacher application",
            $"We received your teacher application for {role}. It is waiting for review. Applying does not mean you have been accepted, and no interview has been scheduled.");
        return applicationId;
    }

    public async Task ApproveApplicationAsync(string applicationId, HirayaUser actor, string? classId = null)
    {
        if (!Navigation.CanManageEnrollment(actor.Role))
            throw new UnauthorizedAccessException("Only administrators can approve enrollment applications.");
        var adminUserId = actor.UserId;
        EnrollmentApprovalNotice? notice = null;
        await _repository.MutateAsync(async db =>
        {
            var app = db.EnrollmentApplications.FirstOrDefault(a => a.ApplicationId == applicationId)
                      ?? throw new InvalidOperationException("Application not found.");

            var isTeacher = string.Equals(app.ApplicationKind, "teacher", StringComparison.OrdinalIgnoreCase);
            var teacherWaiting = isTeacher &&
                (app.Status == "pending_review" || app.Status == "pending" || app.Status == "interview" || app.Status == "approved");
            if (!isTeacher && app.Status != "pending_review" && app.Status != "pending")
                throw new InvalidOperationException("Application already processed.");
            if (isTeacher && !teacherWaiting)
                throw new InvalidOperationException("Application already processed.");

            if (isTeacher)
            {
                var teacher = StaffService.EnsureTeacherFromApplication(db, app, actor);
                app.Status = "approved";
                app.StudentNumber = teacher.UserId;
                AuditService.Append(db, adminUserId, "", AuditModules.Enrollment, "approve-teacher",
                    "application", applicationId, $"Approved teacher application for {app.StudentFullname}. Teacher is now in Teacher management.");
                NotificationService.PushToUsers(
                    db,
                    NotificationService.Recipients(db, NotificationAudiences.Admins).Select(u => u.UserId),
                    $"Teacher application for {app.StudentFullname} was approved. The teacher now appears in Teacher management.",
                    NotificationKinds.Enrollment,
                    "Teacher application approved",
                    "teachers");
                NotificationService.Push(
                    db,
                    teacher.UserId,
                    "Your teacher application was approved. Open Teacher management to finish the profile and set a sign-in password.",
                    NotificationKinds.Enrollment,
                    "Teacher application approved",
                    "teachers");
                await Task.CompletedTask;
                return;
            }

            var parent = CreateLearnerFromApplication(db, app, actor, classId);
            notice = new EnrollmentApprovalNotice
            {
                ParentUserId = parent.UserId,
                ParentEmail = OriginalEmail(app.ParentEmail, parent.Email),
                ParentName = parent.Fullname,
                StudentName = app.StudentFullname,
                Program = app.PreferredProgram,
                ParentNeedsActivation = string.Equals(parent.Status, AccountStatuses.PendingActivation, StringComparison.OrdinalIgnoreCase)
            };
            await Task.CompletedTask;
        });

        if (notice is null || _parents is null)
            return;
        _ = Task.Run(async () =>
        {
            try
            {
                await _parents.NotifyEnrollmentAcceptedAsync(notice);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Enrollment was accepted, but the parent notice could not be prepared.");
            }
        });
    }

    public async Task ImportApprovedTeachersAsync(HirayaUser actor)
    {
        if (!Navigation.CanManageEnrollment(actor.Role) && !Navigation.CanManageStaff(actor.Role))
            throw new UnauthorizedAccessException("Only administrators can import approved teachers.");
        await _repository.MutateAsync(async db =>
        {
            foreach (var app in db.EnrollmentApplications
                .Where(a =>
                    string.Equals(a.ApplicationKind, "teacher", StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(a.Status, "approved", StringComparison.OrdinalIgnoreCase))
                .ToList())
            {
                var teacher = StaffService.EnsureTeacherFromApplication(db, app, actor);
                app.StudentNumber = teacher.UserId;
            }
            await Task.CompletedTask;
        });
    }

    private void QueueReceipt(string email, string name, string subjectLine, string body)
    {
        if (_parents is null)
            return;
        _ = Task.Run(async () =>
        {
            try
            {
                await _parents.NotifyApplicationReceivedAsync(email, name, subjectLine, body);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Application was saved, but the receipt email could not be sent.");
            }
        });
    }

    public async Task ScheduleTeacherInterviewAsync(
        string applicationId,
        HirayaUser actor,
        string when,
        string place,
        string? instructions)
    {
        if (!Navigation.CanManageEnrollment(actor.Role))
            throw new UnauthorizedAccessException("Only administrators can schedule teacher interviews.");
        var at = (when ?? "").Trim();
        var where = (place ?? "").Trim();
        var note = (instructions ?? "").Trim();
        if (at.Length < 3)
            throw new InvalidOperationException("Enter the interview date and time.");
        if (where.Length < 3)
            throw new InvalidOperationException("Enter the interview location or link.");

        string email = "";
        string name = "";
        await _repository.MutateAsync(async db =>
        {
            var app = db.EnrollmentApplications.FirstOrDefault(a => a.ApplicationId == applicationId)
                      ?? throw new InvalidOperationException("Application not found.");
            if (!string.Equals(app.ApplicationKind, "teacher", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Only a teacher application can be moved to interview.");
            if (app.Status != "pending_review" && app.Status != "pending")
                throw new InvalidOperationException("This application is not waiting for review.");
            app.Status = "interview";
            var line = $"Interview: {at} at {where}." + (note.Length > 0 ? $" {note}" : "");
            app.Notes = string.IsNullOrWhiteSpace(app.Notes) ? line : $"{app.Notes.Trim()}\n{line}";
            email = app.ParentEmail;
            name = app.StudentFullname;
            AuditService.Append(db, actor.UserId, "", AuditModules.Enrollment, "interview",
                "application", applicationId, $"Scheduled an interview for {name} on {at} at {where}.");
            NotificationService.PushToUsers(
                db,
                NotificationService.Recipients(db, NotificationAudiences.Admins).Select(u => u.UserId),
                $"Interview scheduled for {name} on {at} at {where}. This is not a job offer.",
                NotificationKinds.Enrollment,
                "Teacher interview",
                "enrollment");
            await Task.CompletedTask;
        });

        if (_parents is null)
            return;
        try
        {
            await _parents.NotifyTeacherInterviewAsync(email, name, at, where, string.IsNullOrWhiteSpace(note)
                ? "Please arrive a few minutes early and bring a valid ID."
                : note);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "The interview was saved, but the email could not be sent.");
        }
    }

    public async Task RejectApplicationAsync(string applicationId, HirayaUser actor)
    {
        if (!Navigation.CanManageEnrollment(actor.Role))
            throw new UnauthorizedAccessException("Only administrators can reject enrollment applications.");
        await _repository.MutateAsync(async db =>
        {
            var app = db.EnrollmentApplications.FirstOrDefault(a => a.ApplicationId == applicationId)
                      ?? throw new InvalidOperationException("Application not found.");
            var isTeacher = string.Equals(app.ApplicationKind, "teacher", StringComparison.OrdinalIgnoreCase);
            if (app.Status != "pending_review" && app.Status != "pending" && !(isTeacher && app.Status == "interview"))
                throw new InvalidOperationException("Application already processed.");
            app.Status = "rejected";
            AuditService.Append(db, actor.UserId, "", AuditModules.Enrollment, "reject",
                "application", applicationId, $"Rejected application for {app.StudentFullname}.");
            await Task.CompletedTask;
        });
    }

    public async Task CancelApplicationAsync(string applicationId, HirayaUser actor)
    {
        if (!Navigation.CanManageEnrollment(actor.Role))
            throw new UnauthorizedAccessException("Only administrators can cancel enrollment applications.");
        await _repository.MutateAsync(async db =>
        {
            var app = db.EnrollmentApplications.FirstOrDefault(a => a.ApplicationId == applicationId)
                      ?? throw new InvalidOperationException("Application not found.");
            if (app.Status != "pending_review" && app.Status != "pending")
                throw new InvalidOperationException("Application already processed.");
            app.Status = "cancelled";
            AuditService.Append(db, actor.UserId, "", AuditModules.Enrollment, "cancel",
                "application", applicationId, $"Cancelled application for {app.StudentFullname}.");
            await Task.CompletedTask;
        });
    }

    public async Task EnrollStudentAsync(string studentId, string classId, string period, string adminUserId, string status)
    {
        await _repository.MutateAsync(async db =>
        {
            var student = db.Students.FirstOrDefault(s => s.StudentId == studentId)
                          ?? throw new InvalidOperationException("Student not found.");
            var learningClass = db.Classes.FirstOrDefault(c => c.ClassId == classId)
                                ?? throw new InvalidOperationException("Class not found.");
            if (string.Equals(learningClass.Status, "archived", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Cannot enroll into an archived class.");

            var normalized = string.IsNullOrWhiteSpace(status) ? EnrollmentStatuses.Pending : status.Trim();
            if (EnrollmentStatuses.CountsTowardCapacity(normalized) &&
                ClassService.OccupiedSeats(db, classId) >= learningClass.Capacity)
                throw new InvalidOperationException($"Class \"{learningClass.Name}\" is at capacity.");

            if (db.Enrollments.Any(e =>
                    e.StudentId == studentId &&
                    e.ClassId == classId &&
                    EnrollmentStatuses.CountsTowardCapacity(e.Status)))
                throw new InvalidOperationException("That student is already in this class.");

            var programName = ClassService.ProgramName(db, learningClass.ProgramId);
            db.Enrollments.Add(new Enrollment
            {
                EnrollmentId = IdFactory.New("enr"),
                StudentId = studentId,
                ClassId = classId,
                ProgramId = learningClass.ProgramId,
                TeacherId = learningClass.TeacherId,
                Period = string.IsNullOrWhiteSpace(period) ? DefaultPeriod() : period.Trim(),
                Status = normalized,
                EnrollmentDate = DateTime.UtcNow.ToString("o"),
                ApprovedBy = normalized == EnrollmentStatuses.Active ? adminUserId : ""
            });

            student.Program = programName;
            student.GradeLevel = programName;
            if (normalized == EnrollmentStatuses.Active)
                student.Status = "active";

            AuditService.Append(db, adminUserId, "", AuditModules.Enrollment, "enroll",
                "enrollment", studentId, $"Enrolled {StudentNames.Display(student)} in {learningClass.Name} ({normalized}).");
            await Task.CompletedTask;
        });
    }

    public async Task SetEnrollmentStatusAsync(string enrollmentId, string status, string adminUserId)
    {
        if (!EnrollmentStatuses.All.Contains(status))
            throw new InvalidOperationException("Invalid enrollment status.");

        await _repository.MutateAsync(async db =>
        {
            var enrollment = db.Enrollments.FirstOrDefault(e => e.EnrollmentId == enrollmentId)
                             ?? throw new InvalidOperationException("Enrollment not found.");
            var previous = enrollment.Status;
            enrollment.Status = status;
            if (status == EnrollmentStatuses.Active)
                enrollment.ApprovedBy = adminUserId;

            if (!string.IsNullOrWhiteSpace(enrollment.ClassId) &&
                EnrollmentStatuses.CountsTowardCapacity(status) &&
                !EnrollmentStatuses.CountsTowardCapacity(previous))
            {
                var learningClass = db.Classes.FirstOrDefault(c => c.ClassId == enrollment.ClassId);
                if (learningClass != null && ClassService.OccupiedSeats(db, learningClass.ClassId) > learningClass.Capacity)
                    throw new InvalidOperationException($"Class \"{learningClass.Name}\" is at capacity.");
            }

            AuditService.Append(db, adminUserId, "", AuditModules.Enrollment, "status",
                "enrollment", enrollmentId, $"Enrollment status {previous} → {status}.");
            await Task.CompletedTask;
        });
    }

    public async Task AssignClassAsync(string enrollmentId, string classId)
    {
        await _repository.MutateAsync(async db =>
        {
            var enrollment = db.Enrollments.FirstOrDefault(e => e.EnrollmentId == enrollmentId)
                             ?? throw new InvalidOperationException("Enrollment not found.");
            var learningClass = db.Classes.FirstOrDefault(c => c.ClassId == classId)
                                ?? throw new InvalidOperationException("Class not found.");

            if (enrollment.ClassId != classId &&
                EnrollmentStatuses.CountsTowardCapacity(enrollment.Status) &&
                ClassService.OccupiedSeats(db, classId) >= learningClass.Capacity)
                throw new InvalidOperationException($"Class \"{learningClass.Name}\" is at capacity.");

            enrollment.ClassId = classId;
            enrollment.ProgramId = learningClass.ProgramId;
            enrollment.TeacherId = learningClass.TeacherId;

            var student = db.Students.FirstOrDefault(s => s.StudentId == enrollment.StudentId);
            if (student != null)
            {
                var programName = ClassService.ProgramName(db, learningClass.ProgramId);
                student.Program = programName;
                student.GradeLevel = programName;
            }

            await Task.CompletedTask;
        });
    }

    public static void MaterializeNewlyApproved(HirayaDatabase before, HirayaDatabase after, HirayaUser actor)
    {
        WorkflowOps.EnsureLists(before);
        WorkflowOps.EnsureLists(after);
        foreach (var app in after.EnrollmentApplications)
        {
            if (string.Equals(app.ApplicationKind, "teacher", StringComparison.OrdinalIgnoreCase))
                continue;
            if (!IsApprovedStatus(app.Status))
                continue;
            var prior = before.EnrollmentApplications.FirstOrDefault(a => a.ApplicationId == app.ApplicationId);
            if (prior != null && IsApprovedStatus(prior.Status))
                continue;
            CreateLearnerFromApplication(after, app, actor, null);
        }
    }

    static bool IsApprovedStatus(string? status) =>
        string.Equals(status, "approved", StringComparison.OrdinalIgnoreCase);

    static (HirayaUser Parent, Student Child) RegisterFamilyFromApplication(HirayaDatabase db, EnrollmentApplication app)
    {
        FamilyAccess.EnsureLegacyLinks(db);
        var parent = EnsureParentFromApplication(db, app);
        var relationship = FamilyRelationships.Normalize(NoteValue(app.Notes, "Relationship"));
        var existing = db.Students.FirstOrDefault(s =>
            s.ParentId == parent.UserId &&
            string.Equals(s.Fullname, app.StudentFullname, StringComparison.OrdinalIgnoreCase));
        if (existing != null)
        {
            FamilyAccess.UpsertLink(db, parent.UserId, existing.StudentId, relationship);
            var qr = existing.QrCode ?? "";
            if (string.IsNullOrWhiteSpace(app.StudentNumber) &&
                qr.StartsWith("HIRAYA-", StringComparison.OrdinalIgnoreCase))
                app.StudentNumber = qr["HIRAYA-".Length..];
            return (parent, existing);
        }

        var studentNumber = $"STU-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";
        var (first, last) = SplitPersonName(app.StudentFullname);
        var address = NoteValue(app.Notes, "Address");
        var studentPhone = NoteValue(app.Notes, "Student contact");
        var now = DateTime.UtcNow.ToString("o");
        var student = new Student
        {
            StudentId = IdFactory.New("stu"),
            FirstName = first,
            LastName = last,
            Fullname = string.IsNullOrWhiteSpace(app.StudentFullname) ? $"{first} {last}".Trim() : app.StudentFullname.Trim(),
            Birthdate = app.StudentBirthdate,
            Age = app.StudentAge > 0 ? app.StudentAge : ComputeAge(app.StudentBirthdate),
            Gender = app.StudentGender,
            Address = address,
            ContactNumber = studentPhone,
            ParentId = parent.UserId,
            EmergencyContact = parent.Fullname,
            EmergencyPhone = parent.Phone ?? "",
            QrCode = $"HIRAYA-{studentNumber}",
            GradeLevel = app.PreferredProgram,
            Program = app.PreferredProgram,
            Status = "pending",
            EnrollmentDate = now,
            Notes = $"Applied via website application {app.ApplicationId}"
        };
        db.Students.Add(student);
        FamilyAccess.UpsertLink(db, parent.UserId, student.StudentId, relationship);
        app.StudentNumber = studentNumber;
        return (parent, student);
    }

    static HirayaUser CreateLearnerFromApplication(
        HirayaDatabase db,
        EnrollmentApplication app,
        HirayaUser actor,
        string? classId)
    {
        var learningClass = ResolveClass(db, classId, app.PreferredProgram);
        if (learningClass != null && ClassService.OccupiedSeats(db, learningClass.ClassId) >= learningClass.Capacity)
            throw new InvalidOperationException($"Class \"{learningClass.Name}\" is at capacity.");

        var (parent, student) = RegisterFamilyFromApplication(db, app);
        var programName = learningClass == null
            ? app.PreferredProgram
            : ClassService.ProgramName(db, learningClass.ProgramId);
        student.Status = "active";
        student.Program = programName;
        student.GradeLevel = programName;
        student.ParentId = parent.UserId;

        var classKey = learningClass?.ClassId ?? "";
        if (!db.Enrollments.Any(e =>
                e.StudentId == student.StudentId &&
                string.Equals(e.ClassId, classKey, StringComparison.OrdinalIgnoreCase) &&
                EnrollmentStatuses.IsAssignedLive(e.Status)))
        {
            db.Enrollments.Add(new Enrollment
            {
                EnrollmentId = IdFactory.New("enr"),
                StudentId = student.StudentId,
                ClassId = classKey,
                ProgramId = learningClass?.ProgramId ?? "",
                TeacherId = learningClass?.TeacherId ?? "",
                Period = DefaultPeriod(),
                Status = EnrollmentStatuses.Active,
                EnrollmentDate = DateTime.UtcNow.ToString("o"),
                ApprovedBy = actor.UserId
            });
        }

        app.Status = "approved";
        AuditService.Append(db, actor.UserId, "", AuditModules.Enrollment, "approve",
            "application", app.ApplicationId, $"Approved application for {app.StudentFullname}. Parent {parent.Fullname} stays linked to the child.");
        return parent;
    }

    private static LearningClass? ResolveClass(HirayaDatabase db, string? classId, string preferredProgram)
    {
        if (!string.IsNullOrWhiteSpace(classId))
            return db.Classes.FirstOrDefault(c => c.ClassId == classId);

        if (string.IsNullOrWhiteSpace(preferredProgram))
            return db.Classes.FirstOrDefault(c =>
                string.Equals(c.Status, "active", StringComparison.OrdinalIgnoreCase));

        return db.Classes.FirstOrDefault(c =>
        {
            var program = ClassService.ProgramName(db, c.ProgramId);
            return string.Equals(c.Name, preferredProgram, StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(program, preferredProgram, StringComparison.OrdinalIgnoreCase);
        });
    }

    private static string DefaultPeriod()
    {
        var year = DateTime.Today.Month >= 6 ? DateTime.Today.Year : DateTime.Today.Year - 1;
        return $"{year}–{year + 1}";
    }

    private static int ComputeAge(string birthdate)
    {
        if (!DateTime.TryParse(birthdate, out var dob)) return 0;
        var today = DateTime.UtcNow.Date;
        var age = today.Year - dob.Year;
        if (dob.Date > today.AddYears(-age)) age--;
        return Math.Max(age, 0);
    }

    private static string OriginalEmail(string? applicationEmail, string? accountEmail)
    {
        var original = (applicationEmail ?? "").Trim();
        if (original.Contains('@'))
            return original;
        return (accountEmail ?? "").Trim();
    }

    static HirayaUser? FindExistingParent(HirayaDatabase db, EnrollmentApplication app)
    {
        var email = (app.ParentEmail ?? "").Trim();
        return db.Users.FirstOrDefault(u =>
            UserRoles.IsParent(u.Role) &&
            (LoginIdentity.Matches(u, email) ||
             string.Equals(u.Email, email, StringComparison.OrdinalIgnoreCase)));
    }

    private static HirayaUser EnsureParentFromApplication(HirayaDatabase db, EnrollmentApplication app)
    {
        var email = (app.ParentEmail ?? "").Trim();
        var existing = FindExistingParent(db, app);
        var address = NoteValue(app.Notes, "Address");
        if (existing != null)
        {
            if (string.IsNullOrWhiteSpace(existing.Phone))
                existing.Phone = (app.ParentPhone ?? "").Trim();
            if (string.IsNullOrWhiteSpace(existing.Address) && address.Length > 0)
                existing.Address = address;
            if (string.IsNullOrWhiteSpace(existing.Fullname))
            {
                var names = SplitPersonName(app.ParentFullname);
                existing.FirstName = names.First;
                existing.LastName = names.Last;
            }
            existing.SyncDisplayName();
            existing.UpdatedAt = DateTime.UtcNow.ToString("o");
            return existing;
        }

        var (first, last) = SplitPersonName(app.ParentFullname);
        var now = DateTime.UtcNow.ToString("o");
        var parent = new HirayaUser
        {
            UserId = IdFactory.New("usr"),
            FirstName = first,
            LastName = last,
            Email = email,
            PersonalEmail = LooksLikePersonalInbox(email) ? email : "",
            Phone = (app.ParentPhone ?? "").Trim(),
            Address = address,
            Role = UserRoles.Parent,
            Status = AccountStatuses.PendingActivation,
            Password = PasswordHasher.Hash(InvitationTokens.NewToken()),
            CreatedAt = now,
            UpdatedAt = now
        };
        parent.SyncDisplayName();
        db.Users.Add(parent);
        return parent;
    }

    static bool LooksLikePersonalInbox(string email)
    {
        var at = email.IndexOf('@');
        if (at <= 0 || at == email.Length - 1) return false;
        var domain = email[(at + 1)..];
        return domain.Contains('.', StringComparison.Ordinal);
    }

    static string NoteValue(string? notes, string label)
    {
        foreach (var line in (notes ?? "").Split('\n', '\r'))
        {
            var text = line.Trim();
            if (text.StartsWith(label, StringComparison.OrdinalIgnoreCase))
                return text[label.Length..].Trim().TrimStart(':').Trim();
        }
        return "";
    }

    private static (string First, string Last) SplitPersonName(string? fullname)
    {
        var parts = (fullname ?? "").Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0)
            return ("Guardian", "Family");
        if (parts.Length == 1)
            return (parts[0], "Family");
        return (string.Join(" ", parts[..^1]), parts[^1]);
    }

    private static string FormatApplicationNotes(
        string? studentAddress,
        string? studentPhone,
        string? studentEmail,
        string? guardianRelationship,
        string? preferredSchedule,
        string? enrollmentType,
        string? notes)
    {
        var lines = new List<string>();
        if (!string.IsNullOrWhiteSpace(studentAddress))
            lines.Add($"Address: {studentAddress.Trim()}");
        if (!string.IsNullOrWhiteSpace(studentPhone))
            lines.Add($"Student contact: {studentPhone.Trim()}");
        if (!string.IsNullOrWhiteSpace(studentEmail))
            lines.Add($"Student email: {studentEmail.Trim()}");
        if (!string.IsNullOrWhiteSpace(guardianRelationship))
            lines.Add($"Relationship: {guardianRelationship.Trim()}");
        if (!string.IsNullOrWhiteSpace(preferredSchedule))
            lines.Add($"Preferred schedule: {preferredSchedule.Trim()}");
        if (!string.IsNullOrWhiteSpace(enrollmentType))
            lines.Add($"Enrollment type: {enrollmentType.Trim()}");
        if (!string.IsNullOrWhiteSpace(notes))
            lines.Add(notes.Trim());
        return string.Join("\n", lines);
    }
}

public static class IdFactory
{
    public static string New(string prefix) =>
        $"{prefix}_{Guid.NewGuid():N}"[..18];
}
