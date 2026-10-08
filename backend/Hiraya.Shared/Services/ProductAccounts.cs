using Hiraya.Shared.Models;

namespace Hiraya.Shared.Services;

public static class ProductAccounts
{
    public const string SignInBlocked =
        "Only the Super Administrator, teachers, and parents may sign in. Children use a parent account.";

    public static bool MaySignIn(string? role) =>
        UserRoles.Is(role, UserRoles.SuperAdmin, UserRoles.Teacher, UserRoles.Parent);

    public static bool IsAssignableRole(string? role) =>
        UserRoles.Is(role, UserRoles.Teacher, UserRoles.Parent);

    public static void NormalizeDirectory(HirayaDatabase db)
    {
        var activeDirectors = db.Users
            .Where(u => u.Role == UserRoles.SuperAdmin && AccountStatuses.AllowsPortalLogin(u.Status))
            .OrderBy(u => u.CreatedAt)
            .ThenBy(u => u.UserId)
            .ToList();
        var keepId = activeDirectors.FirstOrDefault(u => u.UserId == SeedData.SuperAdminId)?.UserId
                     ?? activeDirectors.FirstOrDefault()?.UserId
                     ?? SeedData.SuperAdminId;

        foreach (var user in db.Users)
        {
            if (user.Role == UserRoles.Admin)
            {
                if (string.Equals(user.Username, "admin", StringComparison.OrdinalIgnoreCase) ||
                    user.UserId == SeedData.SuperAdminId)
                    user.Role = UserRoles.SuperAdmin;
                else
                    user.Status = AccountStatuses.Deactivated;
            }

            if (user.Role == UserRoles.SuperAdmin && user.UserId != keepId)
                user.Status = AccountStatuses.Deactivated;

            if (user.Role is UserRoles.Staff or UserRoles.Student)
                user.Status = AccountStatuses.Deactivated;
        }
    }

    public static void RequireParentOnEveryStudent(HirayaDatabase current, HirayaDatabase incoming)
    {
        foreach (var student in incoming.Students)
        {
            if (string.IsNullOrWhiteSpace(student.ParentId))
            {
                var prior = current.Students.FirstOrDefault(s => s.StudentId == student.StudentId);
                if (prior != null && !string.IsNullOrWhiteSpace(prior.ParentId))
                    student.ParentId = prior.ParentId;
            }

            if (string.IsNullOrWhiteSpace(student.ParentId))
            {
                var isNew = current.Students.All(s => s.StudentId != student.StudentId);
                if (!isNew)
                    continue;
                var who = string.IsNullOrWhiteSpace(student.Fullname) ? student.StudentId : student.Fullname;
                throw new InvalidOperationException(
                    $"Every learner must be linked to a parent account ({who}). Children do not sign in.");
            }

            var parent = incoming.Users.FirstOrDefault(u => u.UserId == student.ParentId)
                         ?? current.Users.FirstOrDefault(u => u.UserId == student.ParentId);
            if (parent is null || parent.Role != UserRoles.Parent)
                throw new InvalidOperationException("The linked guardian must be an existing parent account.");
        }
    }
}
