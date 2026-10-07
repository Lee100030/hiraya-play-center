using Hiraya.Shared.Models;

namespace Hiraya.Shared.Services;

/// <summary>
/// Remaining balance is tuition fee minus the sum of valid payments.
/// A down payment is just the first payment and is included once in that sum.
/// </summary>
public static class StudentTuition
{
    private static readonly HashSet<string> Excluded = new(StringComparer.OrdinalIgnoreCase)
    {
        "cancelled", "canceled", "void", "failed", "refunded", "rejected", "waived", "pending"
    };

    public static decimal Pesos(decimal value) =>
        decimal.Round(value < 0 ? 0 : value, 2, MidpointRounding.AwayFromZero);

    public static bool IsTeacherPayment(Payment row) =>
        string.Equals((row.EnrollmentId ?? "").Trim(), "teacher", StringComparison.OrdinalIgnoreCase);

    public static bool CountsTowardPaid(string? status) =>
        !Excluded.Contains((status ?? "").Trim());

    public static IEnumerable<Payment> StudentPayments(HirayaDatabase db, string studentId) =>
        (db.Payments ?? []).Where(row =>
            !IsTeacherPayment(row) &&
            string.Equals(row.StudentId, studentId, StringComparison.OrdinalIgnoreCase));

    public static decimal TuitionFee(HirayaDatabase db, string studentId)
    {
        var program = ProgramForStudent(db, studentId);
        if (program != null && program.TuitionFee > 0)
            return Pesos(program.TuitionFee);
        var ops = Ops(db, studentId);
        if (ops != null && ops.TuitionFee > 0)
            return Pesos(ops.TuitionFee);
        var fee = ops?.FeeAmount ?? 0;
        var largestBill = StudentPayments(db, studentId)
            .Where(row => CountsTowardPaid(row.PaymentStatus) && row.Amount > row.AmountPaid)
            .Select(row => row.Amount)
            .DefaultIfEmpty(0)
            .Max();
        if (largestBill > fee)
            return Pesos(largestBill);
        return Pesos(fee);
    }

    public static decimal TotalPaid(HirayaDatabase db, string studentId) =>
        Pesos(StudentPayments(db, studentId)
            .Where(row => CountsTowardPaid(row.PaymentStatus))
            .Sum(row => row.AmountPaid < 0 ? 0 : row.AmountPaid));

    public static decimal Remaining(HirayaDatabase db, string studentId) =>
        Pesos(TuitionFee(db, studentId) - TotalPaid(db, studentId));

    public static string Status(HirayaDatabase db, string studentId)
    {
        var tuition = TuitionFee(db, studentId);
        var paid = TotalPaid(db, studentId);
        if (paid <= 0) return "unpaid";
        if (paid + 0.009m < tuition) return "partial";
        return "paid";
    }

    public static void SyncStatus(HirayaDatabase db)
    {
        db.Students ??= [];
        db.StudentOps ??= [];
        db.Payments ??= [];
        foreach (var student in db.Students)
        {
            if (string.IsNullOrWhiteSpace(student.StudentId)) continue;
            if (TuitionFee(db, student.StudentId) <= 0 && TotalPaid(db, student.StudentId) <= 0 && Ops(db, student.StudentId) is null)
                continue;
            var status = Status(db, student.StudentId);
            var ops = Ops(db, student.StudentId);
            if (ops is null)
            {
                db.StudentOps.Add(new StudentOpsRecord
                {
                    StudentId = student.StudentId,
                    PaymentStatus = status
                });
            }
            else
            {
                ops.PaymentStatus = status;
            }
        }
    }

    public static void Enforce(HirayaDatabase previous, HirayaDatabase incoming)
    {
        incoming.StudentOps ??= [];
        var preserveIds = (incoming.Students ?? []).Select(s => s.StudentId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.OrdinalIgnoreCase);
        foreach (var id in preserveIds)
        {
            var ops = Ops(incoming, id);
            if (ops != null && ops.TuitionFee > 0) continue;
            var prior = TuitionFee(previous, id);
            var now = TuitionFee(incoming, id);
            var locked = prior > now + 0.009m && prior > 0 ? prior : now;
            if (locked <= 0) continue;
            if (ops is null)
            {
                incoming.StudentOps.Add(new StudentOpsRecord { StudentId = id, TuitionFee = locked, FeeAmount = locked });
            }
            else
            {
                ops.TuitionFee = locked;
                ops.FeeAmount = locked;
            }
        }
        SyncStatus(incoming);
        var ids = (incoming.Students ?? []).Select(s => s.StudentId)
            .Concat((incoming.Payments ?? []).Select(p => p.StudentId))
            .Concat((incoming.StudentOps ?? []).Select(o => o.StudentId))
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.OrdinalIgnoreCase);
        foreach (var id in ids)
        {
            if (!(incoming.Students ?? []).Any(s => string.Equals(s.StudentId, id, StringComparison.OrdinalIgnoreCase)))
                continue;
            var tuition = TuitionFee(incoming, id);
            var paid = TotalPaid(incoming, id);
            var priorTuition = TuitionFee(previous, id);
            var priorPaid = TotalPaid(previous, id);
            var program = ProgramForStudent(incoming, id);
            var unsetProgram = program != null && program.TuitionFee <= 0;
            if (!unsetProgram && tuition + 0.009m < priorTuition && paid > tuition + 0.009m)
                throw new InvalidOperationException($"Tuition fee cannot be less than the ₱{paid:N2} already paid.");
            if (paid > tuition + 0.009m && paid > priorPaid + 0.009m)
            {
                var room = Pesos(Math.Max(0, tuition - priorPaid));
                throw new InvalidOperationException($"Payment amount cannot exceed the remaining balance of ₱{room:N2}.");
            }
        }
    }

    private static StudentOpsRecord? Ops(HirayaDatabase db, string studentId) =>
        (db.StudentOps ?? []).FirstOrDefault(row => string.Equals(row.StudentId, studentId, StringComparison.OrdinalIgnoreCase));

    private static readonly HashSet<string> BuiltInLanes = new(StringComparer.OrdinalIgnoreCase)
    {
        "playgroup", "prekinder", "kinder", "nursery", "grade1", "grade2", "grade3", "aba", "tutorial"
    };

    private static LearningProgram? ProgramForStudent(HirayaDatabase db, string studentId)
    {
        var student = (db.Students ?? []).FirstOrDefault(row =>
            string.Equals(row.StudentId, studentId, StringComparison.OrdinalIgnoreCase));
        var enrollment = (db.Enrollments ?? []).FirstOrDefault(row =>
            string.Equals(row.StudentId, studentId, StringComparison.OrdinalIgnoreCase) &&
            row.Status is not ("cancelled" or "canceled" or "archived"));
        var cls = enrollment == null
            ? null
            : (db.Classes ?? []).FirstOrDefault(row => row.ClassId == enrollment.ClassId);
        var enrolledName = enrollment == null
            ? ""
            : (db.Programs ?? []).FirstOrDefault(row => row.ProgramId == enrollment.ProgramId)?.Name;
        var classProgramName = cls == null
            ? ""
            : (db.Programs ?? []).FirstOrDefault(row => row.ProgramId == cls.ProgramId)?.Name;
        foreach (var label in new[] { student?.Program, student?.GradeLevel, cls?.Name, classProgramName, enrolledName })
        {
            var program = ProgramFromLabel(db, label);
            if (program != null)
                return program;
        }

        return string.IsNullOrWhiteSpace(enrollment?.ProgramId)
            ? null
            : ProgramFromLabel(db, enrollment.ProgramId) ??
              (db.Programs ?? []).FirstOrDefault(program => program.ProgramId == enrollment.ProgramId);
    }

    /// <summary>
    /// Same row Program tuition management edits. "Playgroup 1:30-3:00" and "Bright Buds (12:00)"
    /// resolve to Playgroup and Bright Buds.
    /// </summary>
    private static LearningProgram? ProgramFromLabel(HirayaDatabase db, string? raw)
    {
        var label = (raw ?? "").Trim();
        if (label.Length == 0)
            return null;
        var lane = StaffService.NormalizeProgramSpecialty(label);
        if (BuiltInLanes.Contains(lane))
        {
            return (db.Programs ?? []).FirstOrDefault(program =>
                !string.Equals(program.Status, "archived", StringComparison.OrdinalIgnoreCase) &&
                (string.Equals(program.ProgramId, lane, StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(StaffService.NormalizeProgramSpecialty(program.Name), lane, StringComparison.OrdinalIgnoreCase)));
        }

        LearningProgram? best = null;
        foreach (var program in db.Programs ?? [])
        {
            if (string.Equals(program.Status, "archived", StringComparison.OrdinalIgnoreCase))
                continue;
            var name = (program.Name ?? "").Trim();
            if (name.Length == 0)
                continue;
            if (BuiltInLanes.Contains(StaffService.NormalizeProgramSpecialty(name)) &&
                !string.Equals(name, label, StringComparison.OrdinalIgnoreCase))
                continue;
            if (!LabelHasName(label, name))
                continue;
            if (best == null || name.Length > (best.Name ?? "").Length)
                best = program;
        }

        return best;
    }

    private static bool LabelHasName(string label, string name)
    {
        var text = label.Trim().ToLowerInvariant();
        var alias = name.Trim().ToLowerInvariant();
        if (alias.Length == 0)
            return false;
        if (text == alias)
            return true;
        var escaped = System.Text.RegularExpressions.Regex.Escape(alias).Replace("\\ ", "\\s+");
        return System.Text.RegularExpressions.Regex.IsMatch(
            text,
            $@"(?:^|[^a-z0-9]){escaped}(?![a-z0-9])",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.CultureInvariant);
    }
}
