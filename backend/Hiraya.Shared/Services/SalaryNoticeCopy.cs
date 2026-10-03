namespace Hiraya.Shared.Services;

public sealed record SalaryNoticeCopy(
    string Status,
    string SubjectPhrase,
    string Headline,
    string Intro,
    string NotifyTitle);

public static class SalaryNotice
{
    public static string DeriveStatus(decimal amount, decimal paid, string? stored)
    {
        var status = (stored ?? "").Trim().ToLowerInvariant();
        if (status is "failed" or "refunded" or "cancelled" or "canceled" or "void" or "rejected" or "waived")
            return status is "canceled" or "void" ? "cancelled" : status;
        if (amount > 0 && paid > 0 && paid + 0.009m >= amount)
            return "paid";
        if (paid > 0 && paid + 0.009m < amount)
            return "partial";
        if (status == "overdue")
            return "overdue";
        return "pending";
    }

    public static SalaryNoticeCopy Describe(
        string teacherName,
        string date,
        decimal amount,
        decimal paid,
        string? stored,
        string? accountLine = null,
        string? receiptLine = null)
    {
        var status = DeriveStatus(amount, paid, stored);
        var name = string.IsNullOrWhiteSpace(teacherName) ? "there" : teacherName.Trim();
        var when = HirayaEmailLayout.Shown(date);
        var full = amount.ToString("N2");
        var released = paid.ToString("N2");
        var owed = Math.Max(0, amount - paid).ToString("N2");
        var extra = string.Join(' ', new[] { (accountLine ?? "").Trim(), (receiptLine ?? "").Trim() }.Where(part => part.Length > 0));
        if (extra.Length > 0)
            extra = " " + extra;

        var (phrase, headline, intro, title) = status switch
        {
            "paid" => (
                "Your salary is on your account",
                "Your salary is on your account",
                $"Good day, {name}. Your salary of ₱{full} for {when} is now on your Hiraya account.{extra}",
                "Salary on your account"),
            "partial" => (
                "You've received a partial salary payment",
                "You've received a partial salary payment",
                $"Good day, {name}. A partial salary payment of ₱{released} was recorded for {when}. The full amount is ₱{full}, and ₱{owed} is still owed.{extra}",
                "Partial salary payment"),
            "overdue" => (
                "Your salary payment is overdue",
                "Your salary payment is overdue",
                $"Good day, {name}. Your salary of ₱{full} for {when} is overdue. ₱{owed} is still owed.{extra}",
                "Salary payment overdue"),
            "failed" or "rejected" => (
                "Your salary payment did not go through",
                "Your salary payment did not go through",
                $"Good day, {name}. The salary payment of ₱{full} for {when} did not go through. ₱{owed} is still owed.{extra}",
                "Salary payment failed"),
            "refunded" => (
                "Your salary payment was refunded",
                "Your salary payment was refunded",
                $"Good day, {name}. The salary payment of ₱{full} for {when} was refunded.{extra}",
                "Salary payment refunded"),
            "cancelled" or "waived" => (
                "Your salary payment was cancelled",
                "Your salary payment was cancelled",
                $"Good day, {name}. The salary payment of ₱{full} for {when} was cancelled. It is not on your account.{extra}",
                "Salary payment cancelled"),
            _ => (
                "Your salary payment is being processed",
                "Your salary payment is being processed",
                $"Good day, {name}. Your salary of ₱{full} for {when} is being processed. No amount has been released yet.{extra}",
                "Salary payment processing")
        };

        return new SalaryNoticeCopy(status, phrase, headline, intro, title);
    }
}
