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
            db.EnrollmentApplications.Add(new EnrollmentApplication
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
            });

            NotificationService.PushToUsers(
                db,
                NotificationService.Recipients(db, NotificationAudiences.Admins).Select(u => u.UserId),
                $"A new enrollment application has been submitted. Student: {childName}. Program: {program}.",
                NotificationKinds.Enrollment,
                "New enrollment request",
                "enrollment");

            AuditService.Append(db, "", "Public", AuditModules.Enrollment, "apply",
                "application", applicationId, $"Application submitted for {childName}.");
            await Task.CompletedTask;
        });

        await TrySendReceivedAsync(
            guardianEmail,
            guardianName,
            "we received your enrollment application",
            $"We received the enrollment application for {childName} ({program}). It is waiting for review. Acceptance, the parent portal, and tuition are separate steps and have not happened yet.");
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
        await TrySendReceivedAsync(
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

            if (app.Status != "pending_review" && app.Status != "pending")
                throw new InvalidOperationException("Application already processed.");

            if (string.Equals(app.ApplicationKind, "teacher", StringComparison.OrdinalIgnoreCase))
            {
                app.Status = "approved";
                AuditService.Append(db, adminUserId, "", AuditModules.Enrollment, "approve-teacher",
                    "application", applicationId, $"Approved teacher application for {app.StudentFullname}. No student was created.");
                NotificationService.PushToUsers(
                    db,
                    NotificationService.Recipients(db, NotificationAudiences.Admins).Select(u => u.UserId),
                    $"Teacher application for {app.StudentFullname} was approved. Add the teacher account from Teachers. No student was created.",
                    NotificationKinds.Enrollment,
                    "Teacher application approved",
                    "enrollment");
                await Task.CompletedTask;
                return;
            }

            var learningClass = ResolveClass(db, classId, app.PreferredProgram);
            if (learningClass != null && ClassService.OccupiedSeats(db, learningClass.ClassId) >= learningClass.Capacity)
                throw new InvalidOperationException($"Class \"{learningClass.Name}\" is at capacity.");

            var studentNumber = $"STU-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";
            var studentId = $"stu_{Guid.NewGuid():N}"[..16];
            var parent = EnsureParentFromApplication(db, app);
            var programName = learningClass == null
                ? app.PreferredProgram
                : ClassService.ProgramName(db, learningClass.ProgramId);

            db.Students.Add(new Student
            {
                StudentId = studentId,
                Fullname = app.StudentFullname,
                Birthdate = app.StudentBirthdate,
                Age = app.StudentAge,
                Gender = app.StudentGender,
                ParentId = parent.UserId,
                QrCode = $"HIRAYA-{studentNumber}",
                GradeLevel = programName,
                Program = programName,
                Status = "active",
                EnrollmentDate = DateTime.UtcNow.ToString("o"),
                Notes = $"Enrolled via application {applicationId}"
            });

            FamilyAccess.UpsertLink(db, parent.UserId, studentId, FamilyRelationships.Guardian);

            db.Enrollments.Add(new Enrollment
            {
                EnrollmentId = $"enr_{Guid.NewGuid():N}"[..16],
                StudentId = studentId,
                ClassId = learningClass?.ClassId ?? "",
                ProgramId = learningClass?.ProgramId ?? "",
                TeacherId = learningClass?.TeacherId ?? "",
                Period = DefaultPeriod(),
                Status = EnrollmentStatuses.Active,
                EnrollmentDate = DateTime.UtcNow.ToString("o"),
                ApprovedBy = adminUserId
            });

            app.Status = "approved";
            app.StudentNumber = studentNumber;
            AuditService.Append(db, adminUserId, "", AuditModules.Enrollment, "approve",
                "application", applicationId, $"Approved application for {app.StudentFullname}.");
            notice = new EnrollmentApprovalNotice
            {
                ParentUserId = parent.UserId,
                ParentEmail = parent.Email,
                ParentName = parent.Fullname,
                StudentName = app.StudentFullname,
                Program = programName,
                ParentNeedsActivation = string.Equals(parent.Status, AccountStatuses.PendingActivation, StringComparison.OrdinalIgnoreCase)
            };
            await Task.CompletedTask;
        });

        if (notice is null || _parents is null)
            return;
        try
        {
            await _parents.NotifyEnrollmentAcceptedAsync(notice);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Enrollment was accepted, but the parent notice could not be prepared.");
        }
    }

    private async Task TrySendReceivedAsync(string email, string name, string subjectLine, string body)
    {
        if (_parents is null)
            return;
        try
        {
            await _parents.NotifyApplicationReceivedAsync(email, name, subjectLine, body);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Application was saved, but the receipt email could not be sent.");
        }
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
            if (app.Status != "pending_review" && app.Status != "pending")
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

    private static HirayaUser EnsureParentFromApplication(HirayaDatabase db, EnrollmentApplication app)
    {
        var email = (app.ParentEmail ?? "").Trim();
        var existing = db.Users.FirstOrDefault(u =>
            u.Role == UserRoles.Parent &&
            string.Equals(u.Email, email, StringComparison.OrdinalIgnoreCase));
        if (existing != null)
            return existing;

        var (first, last) = SplitPersonName(app.ParentFullname);
        var now = DateTime.UtcNow.ToString("o");
        var parent = new HirayaUser
        {
            UserId = IdFactory.New("usr"),
            FirstName = first,
            LastName = last,
            Email = email,
            Phone = (app.ParentPhone ?? "").Trim(),
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
