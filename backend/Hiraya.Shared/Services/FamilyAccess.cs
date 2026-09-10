using Hiraya.Shared.Models;

namespace Hiraya.Shared.Services;

public static class FamilyAccess
{
    public static void EnsureLegacyLinks(HirayaDatabase db)
    {
        db.ParentStudents ??= [];
        db.AccountInvitations ??= [];
        db.StudentOps ??= [];
        db.CenterHolidays ??= [];
        db.TeacherDuties ??= [];
        var now = DateTime.UtcNow.ToString("o");
        foreach (var student in db.Students.Where(s => !string.IsNullOrWhiteSpace(s.ParentId)))
        {
            if (db.ParentStudents.Any(l =>
                    l.ParentId == student.ParentId && l.StudentId == student.StudentId))
                continue;
            db.ParentStudents.Add(new ParentStudent
            {
                ParentStudentId = IdFactory.New("ps"),
                ParentId = student.ParentId,
                StudentId = student.StudentId,
                Relationship = FamilyRelationships.Guardian,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            });
        }
    }

    public static bool CanSignIn(HirayaUser user) => AccountStatuses.AllowsPortalLogin(user.Status);

    public static HashSet<string> AuthorizedStudentIds(HirayaDatabase db, HirayaUser user)
    {
        EnsureLegacyLinks(db);
        if (user.Role == UserRoles.Parent)
        {
            if (!CanSignIn(user))
                return [];
            return db.ParentStudents
                .Where(l => l.IsActive && l.ParentId == user.UserId)
                .Select(l => l.StudentId)
                .ToHashSet();
        }

        if (user.Role == UserRoles.Student)
        {
            return db.Students
                .Where(s => string.Equals(s.StudentId, user.UserId, StringComparison.OrdinalIgnoreCase))
                .Select(s => s.StudentId)
                .ToHashSet();
        }

        if (user.Role == UserRoles.Teacher)
            return AssignedStudentIdsForTeacher(db, user.UserId);

        return [];
    }

    public static HashSet<string> AssignedStudentIdsForTeacher(HirayaDatabase db, string teacherId) =>
        db.Enrollments
            .Where(e =>
                EnrollmentStatuses.CountsTowardCapacity(e.Status) &&
                (e.TeacherId == teacherId ||
                 db.Classes.Any(c => c.ClassId == e.ClassId && c.TeacherId == teacherId)))
            .Select(e => e.StudentId)
            .ToHashSet();

    public static bool CanViewStudent(HirayaDatabase db, HirayaUser user, string? studentId)
    {
        if (string.IsNullOrWhiteSpace(studentId))
            return false;
        if (UserRoles.IsAdmin(user.Role) || user.Role == UserRoles.Staff)
            return db.Students.Any(s => s.StudentId == studentId);
        if (user.Role == UserRoles.Teacher)
            return AssignedStudentIdsForTeacher(db, user.UserId).Contains(studentId);
        return AuthorizedStudentIds(db, user).Contains(studentId);
    }

    public static void EnsureCanViewStudent(HirayaDatabase db, HirayaUser user, string studentId)
    {
        if (!CanViewStudent(db, user, studentId))
            throw new UnauthorizedAccessException("You do not have access to that student.");
    }

    public static IReadOnlyList<ParentStudent> ActiveLinksForParent(HirayaDatabase db, string parentUserId)
    {
        EnsureLegacyLinks(db);
        return db.ParentStudents
            .Where(l => l.ParentId == parentUserId && l.IsActive)
            .OrderBy(l => l.CreatedAt)
            .ToList();
    }

    public static IReadOnlyList<(HirayaUser Parent, ParentStudent Link)> GuardiansOf(HirayaDatabase db, string studentId)
    {
        EnsureLegacyLinks(db);
        return db.ParentStudents
            .Where(l => l.StudentId == studentId && l.IsActive)
            .Select(l => (Parent: db.Users.FirstOrDefault(u => u.UserId == l.ParentId), Link: l))
            .Where(x => x.Parent != null)
            .Select(x => (x.Parent!, x.Link))
            .ToList();
    }

    public static ParentStudent UpsertLink(HirayaDatabase db, string parentUserId, string studentId, string relationship)
    {
        EnsureLegacyLinks(db);
        var now = DateTime.UtcNow.ToString("o");
        var link = db.ParentStudents.FirstOrDefault(l => l.ParentId == parentUserId && l.StudentId == studentId);
        if (link == null)
        {
            link = new ParentStudent
            {
                ParentStudentId = IdFactory.New("ps"),
                ParentId = parentUserId,
                StudentId = studentId,
                CreatedAt = now
            };
            db.ParentStudents.Add(link);
        }

        link.Relationship = FamilyRelationships.Normalize(relationship);
        link.IsActive = true;
        link.UpdatedAt = now;

        var student = db.Students.FirstOrDefault(s => s.StudentId == studentId);
        if (student != null && string.IsNullOrWhiteSpace(student.ParentId))
            student.ParentId = parentUserId;
        return link;
    }

    public static void DeactivateLink(HirayaDatabase db, string parentUserId, string studentId)
    {
        EnsureLegacyLinks(db);
        var now = DateTime.UtcNow.ToString("o");
        var link = db.ParentStudents.FirstOrDefault(l => l.ParentId == parentUserId && l.StudentId == studentId);
        if (link == null)
            return;
        link.IsActive = false;
        link.UpdatedAt = now;

        var student = db.Students.FirstOrDefault(s => s.StudentId == studentId);
        if (student != null && student.ParentId == parentUserId)
        {
            var other = db.ParentStudents.FirstOrDefault(l =>
                l.StudentId == studentId && l.IsActive && l.ParentId != parentUserId);
            student.ParentId = other?.ParentId ?? "";
        }
    }

    public static void SyncPrimaryGuardian(HirayaDatabase db, string studentId, string? parentUserId)
    {
        var student = db.Students.FirstOrDefault(s => s.StudentId == studentId);
        if (student == null)
            return;
        if (string.IsNullOrWhiteSpace(parentUserId))
            return;
        UpsertLink(db, parentUserId, studentId, FamilyRelationships.Guardian);
        student.ParentId = parentUserId;
    }
}
