using Hiraya.Shared;
using Hiraya.Shared.Models;
using Hiraya.Shared.Services;
using Hiraya.Shared.Services.Firebase;

namespace Hiraya.Api;

public static class PaymentApi
{
    public static void Map(WebApplication app)
    {
        app.MapPost("/api/payments/{paymentId}/receipt", async (
            string paymentId,
            HttpRequest request,
            IHirayaRepository repo,
            IHirayaAppPaths paths) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            if (!Navigation.CanManagePayments(actor.Role))
                return Results.Json(new { error = "You cannot upload receipts." }, statusCode: StatusCodes.Status403Forbidden);
            if (!request.HasFormContentType)
                return Results.Json(new { error = "Upload a receipt file." }, statusCode: StatusCodes.Status400BadRequest);
            var form = await request.ReadFormAsync();
            var file = form.Files.GetFile("file") ?? form.Files.FirstOrDefault();
            if (file is null || file.Length == 0)
                return Results.Json(new { error = "Choose a receipt to upload." }, statusCode: StatusCodes.Status400BadRequest);
            try
            {
                await SaveReceiptAsync(paymentId, file.FileName, file.OpenReadStream(), file.Length, repo, paths);
                return Results.Ok();
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        }).DisableAntiforgery();

        app.MapGet("/api/payments/{paymentId}/receipt", async (
            string paymentId,
            HttpRequest request,
            IHirayaRepository repo,
            IHirayaAppPaths paths) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            if (!Navigation.CanManagePayments(actor.Role))
                return Results.Json(new { error = "You cannot open receipts." }, statusCode: StatusCodes.Status403Forbidden);
            var db = await repo.LoadAsync();
            var payment = db.Payments.FirstOrDefault(p => string.Equals(p.PaymentId, paymentId, StringComparison.OrdinalIgnoreCase));
            if (payment is null || string.IsNullOrWhiteSpace(payment.ReceiptPath))
                return Results.NotFound();
            var full = ReceiptAbsolute(paths, payment.ReceiptPath);
            if (full is null)
                return Results.NotFound();
            var bytes = await File.ReadAllBytesAsync(full);
            var ext = Path.GetExtension(full);
            var mime = LearningModuleRules.ContentType(ext);
            var name = string.IsNullOrWhiteSpace(payment.ReceiptName) ? Path.GetFileName(full) : payment.ReceiptName;
            return Results.File(bytes, mime, name);
        });

        app.MapPost("/api/students/{studentId}/balance-notice", async (
            string studentId,
            NoticeMailBody? body,
            HttpRequest request,
            IHirayaRepository repo,
            IHirayaAppPaths paths,
            IEmailSender email) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            if (!Navigation.CanManagePayments(actor.Role))
                return Results.Json(new { error = "You cannot send balance notices." }, statusCode: StatusCodes.Status403Forbidden);
            try
            {
                var result = await SendBalanceNoticeAsync(studentId, body, actor, repo, paths, email);
                return Results.Json(result);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });

        app.MapPost("/api/payments/{paymentId}/notify", async (
            string paymentId,
            NoticeMailBody? body,
            HttpRequest request,
            IHirayaRepository repo,
            IHirayaAppPaths paths,
            IEmailSender email) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            if (!Navigation.CanManagePayments(actor.Role))
                return Results.Json(new { error = "You cannot send payment notices." }, statusCode: StatusCodes.Status403Forbidden);
            try
            {
                var result = await SendTeacherNoticeAsync(paymentId, body, actor, repo, paths, email);
                return Results.Json(result);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });

        app.MapPost("/api/payments/{paymentId}/payslip", async (
            string paymentId,
            NoticeMailBody? body,
            HttpRequest request,
            IHirayaRepository repo,
            IHirayaAppPaths paths,
            IEmailSender email) =>
        {
            var actor = await ParentPortalApi.ActorAsync(request, repo);
            if (actor is null)
                return Results.Unauthorized();
            if (!Navigation.CanManagePayments(actor.Role))
                return Results.Json(new { error = "You cannot send payslips." }, statusCode: StatusCodes.Status403Forbidden);

            try
            {
                var result = await SendPayslipAsync(paymentId, body, actor, repo, paths, email);
                return Results.Json(result);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        });
    }

    private static async Task<object> SendPayslipAsync(
        string paymentId,
        NoticeMailBody? body,
        HirayaUser actor,
        IHirayaRepository repo,
        IHirayaAppPaths paths,
        IEmailSender email)
    {
        var id = (paymentId ?? "").Trim();
        if (string.IsNullOrWhiteSpace(id))
            throw new InvalidOperationException("Payment id is required.");

        var db = await repo.LoadAsync();
        var payment = db.Payments.FirstOrDefault(p =>
            string.Equals(p.PaymentId, id, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("Payment not found.");

        if (!string.Equals(payment.EnrollmentId, "teacher", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Payslips are only available for teacher payments.");

        var teacher = db.Users.FirstOrDefault(u =>
            string.Equals(u.UserId, payment.StudentId, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("Teacher account not found for this payment.");

        await RememberEmailsAsync(repo, Pair(teacher.UserId, body?.PersonalEmail));
        await RememberAccountAsync(repo, id, null, body?.AccountNumber, body?.FromAccountNumber, body?.Amount, body?.AmountPaid);
        db = await repo.LoadAsync();
        teacher = db.Users.FirstOrDefault(u =>
            string.Equals(u.UserId, payment.StudentId, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("Teacher account not found for this payment.");
        payment = db.Payments.FirstOrDefault(p =>
            string.Equals(p.PaymentId, id, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("Payment not found.");

        if (!TryDeliveryAddress(teacher, out var to, out var addressError))
            throw new InvalidOperationException(addressError);

        var center = string.IsNullOrWhiteSpace(db.Settings.CenterName) ? "Hiraya Kids Learning Center" : db.Settings.CenterName.Trim();
        var name = DisplayName(teacher);
        var amount = payment.Amount.ToString("N2");
        var paid = payment.AmountPaid.ToString("N2");
        var date = DateLabel(payment.PaymentDate, payment.PaidAt);
        var status = string.IsNullOrWhiteSpace(payment.PaymentStatus) ? "pending" : payment.PaymentStatus.Trim();
        var method = string.IsNullOrWhiteSpace(payment.PaymentMethod) ? "cash" : payment.PaymentMethod.Trim();
        var notes = string.IsNullOrWhiteSpace(payment.Notes) ? "—" : payment.Notes.Trim();
        var account = (payment.AccountNumber ?? "").Trim();
        var fromAccount = (payment.FromAccountNumber ?? "").Trim();
        var accountLine = AccountSentence(fromAccount, account);
        var receipt = ReceiptAttachment(paths, payment);
        var receiptLine = receipt is null ? "" : " The receipt is attached.";
        var subject = $"{center} · Your salary is on your account · {date}";
        var text = string.Join('\n', new[]
        {
            center,
            $"Good day, {name}. Your salary of ₱{amount} for {date} is now on your Hiraya account.{accountLine}{receiptLine}",
            "",
            $"Teacher: {name}",
            $"Email: {to}",
            $"Payment date: {date}",
            $"Amount: ₱{amount}",
            $"Amount paid: ₱{paid}",
            $"Method: {method}",
            $"Status: {status}",
            $"Sent from: {(string.IsNullOrWhiteSpace(fromAccount) ? "—" : fromAccount)}",
            $"Paid to: {(string.IsNullOrWhiteSpace(account) ? "—" : account)}",
            $"Notes: {notes}",
            "",
            $"Reference: {payment.PaymentId}",
            "",
            $"This notice was sent by {center}."
        });
        var html = $"""
            <div style="font-family:Segoe UI,Arial,sans-serif;color:#0b1f14;line-height:1.5">
              <h2 style="margin:0 0 8px">{System.Net.WebUtility.HtmlEncode(center)}</h2>
              <p style="margin:0 0 16px">Good day, {System.Net.WebUtility.HtmlEncode(name)}. Your salary of ₱{amount} for {System.Net.WebUtility.HtmlEncode(date)} is now on your Hiraya account.{System.Net.WebUtility.HtmlEncode(accountLine)}{System.Net.WebUtility.HtmlEncode(receiptLine)}</p>
              <table style="border-collapse:collapse;width:100%;max-width:520px">
                <tr><td style="padding:6px 0;color:#4a5c54">Teacher</td><td style="padding:6px 0"><strong>{System.Net.WebUtility.HtmlEncode(name)}</strong></td></tr>
                <tr><td style="padding:6px 0;color:#4a5c54">Payment date</td><td style="padding:6px 0">{System.Net.WebUtility.HtmlEncode(date)}</td></tr>
                <tr><td style="padding:6px 0;color:#4a5c54">Amount</td><td style="padding:6px 0">₱{amount}</td></tr>
                <tr><td style="padding:6px 0;color:#4a5c54">Amount paid</td><td style="padding:6px 0">₱{paid}</td></tr>
                <tr><td style="padding:6px 0;color:#4a5c54">Method</td><td style="padding:6px 0">{System.Net.WebUtility.HtmlEncode(method)}</td></tr>
                <tr><td style="padding:6px 0;color:#4a5c54">Status</td><td style="padding:6px 0">{System.Net.WebUtility.HtmlEncode(status)}</td></tr>
                <tr><td style="padding:6px 0;color:#4a5c54">Sent from</td><td style="padding:6px 0">{System.Net.WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(fromAccount) ? "—" : fromAccount)}</td></tr>
                <tr><td style="padding:6px 0;color:#4a5c54">Paid to</td><td style="padding:6px 0">{System.Net.WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(account) ? "—" : account)}</td></tr>
                <tr><td style="padding:6px 0;color:#4a5c54">Notes</td><td style="padding:6px 0">{System.Net.WebUtility.HtmlEncode(notes)}</td></tr>
              </table>
              <p style="margin:16px 0 0;color:#4a5c54;font-size:12px">Reference: {System.Net.WebUtility.HtmlEncode(payment.PaymentId)}</p>
            </div>
            """;

        var emailed = false;
        if (email.IsConfigured)
        {
            await email.SendAsync(to, subject, text, html, receipt);
            emailed = true;
        }
        else
        {
            throw new InvalidOperationException(
                "SMTP is not configured. Set Smtp settings (or HIRAYA_SMTP_HOST / HIRAYA_SMTP_USER / HIRAYA_SMTP_PASSWORD), or use Open email draft instead.");
        }

        var notifyMessage =
            $"Good day, {name}. Your salary of ₱{amount} for {date} is now on your Hiraya account. Amount released: ₱{paid}.{accountLine} Status: {status}.";

        await repo.MutateAsync(async live =>
        {
            NotificationService.Push(
                live,
                teacher.UserId,
                notifyMessage,
                NotificationKinds.Payment,
                "Salary on your account",
                "payments");
            AuditService.Append(live, actor, AuditModules.Payments, "payslip",
                "payment", payment.PaymentId, $"Sent payslip to {to} for {name}.");
            await Task.CompletedTask;
        });

        return new { emailed, notified = true, to };
    }

    private static async Task<object> SendBalanceNoticeAsync(
        string studentId,
        NoticeMailBody? body,
        HirayaUser actor,
        IHirayaRepository repo,
        IHirayaAppPaths paths,
        IEmailSender email)
    {
        var id = (studentId ?? "").Trim();
        var db = await repo.LoadAsync();
        FamilyAccess.EnsureLegacyLinks(db);
        var student = db.Students.FirstOrDefault(s => string.Equals(s.StudentId, id, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("Student not found.");
        var parents = ParentsFor(db, student);
        if (parents.Count == 0)
            throw new InvalidOperationException("No linked parent to notify. Link a parent on the student record first.");
        await RememberEmailsAsync(repo, ParentMailUpdates(parents, body));
        await RememberAccountAsync(repo, null, student.StudentId, body?.AccountNumber, body?.FromAccountNumber);
        db = await repo.LoadAsync();
        student = db.Students.FirstOrDefault(s => string.Equals(s.StudentId, id, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("Student not found.");
        parents = ParentsFor(db, student);

        var due = OpenBalance(db, student.StudentId);
        var dueAt = OpenDue(db, student.StudentId);
        var received = OpenReceivedBy(db, student.StudentId);
        var center = CenterName(db);
        var child = DisplayName(student);
        var amount = due.ToString("N2");
        var dueText = string.IsNullOrWhiteSpace(dueAt) ? "" : $" Please settle on or before {DateLabel(dueAt, "")}.";
        var receivedText = string.IsNullOrWhiteSpace(received) ? "" : $" Last received by {received}.";
        var account = OpenAccount(db, student.StudentId);
        var fromAccount = OpenFromAccount(db, student.StudentId);
        if (body?.AccountNumber != null) account = body.AccountNumber.Trim();
        if (body?.FromAccountNumber != null) fromAccount = body.FromAccountNumber.Trim();
        var accountText = AccountSentence(fromAccount, account);
        var receipt = ReceiptAttachment(paths, ReceiptPayment(db, student.StudentId));
        var receiptText = receipt is null ? "" : " The receipt is attached.";
        var title = due > 0 ? "Remaining balance" : "Account settled";
        var message = due > 0
            ? $"Good day. This is {center}. {child} has a remaining balance of ₱{amount}.{dueText}{accountText}{receivedText}{receiptText} You can also see this balance on your Hiraya account."
            : $"Good day. This is {center}. {child} has no remaining balance.{accountText}{receiptText} The account is settled, and you can see this on your Hiraya account.";
        var subject = $"{center} · {title} · {child}";
        var text = string.Join('\n', new[]
        {
            center,
            title,
            "",
            message,
            "",
            "Sign in to the Hiraya app to see this on your account."
        });
        var html = $"""
            <div style="font-family:Segoe UI,Arial,sans-serif;color:#0b1f14;line-height:1.5">
              <h2 style="margin:0 0 8px">{System.Net.WebUtility.HtmlEncode(center)}</h2>
              <p>{System.Net.WebUtility.HtmlEncode(message)}</p>
              <p style="color:#4a5c54">This notice is also on your Hiraya account.</p>
            </div>
            """;

        var emailedTo = new List<string>();
        string? emailError = null;
        if (email.IsConfigured)
        {
            var missing = new List<string>();
            foreach (var parent in parents)
            {
                if (!TryDeliveryAddress(parent, out var to, out _))
                {
                    missing.Add(DisplayName(parent));
                    continue;
                }
                try
                {
                    await email.SendAsync(to, subject, text, html, receipt);
                    emailedTo.Add(to);
                }
                catch (InvalidOperationException ex)
                {
                    emailError = ex.Message;
                }
            }
            if (missing.Count > 0 && emailError is null)
                emailError = $"Add a valid personal email for {string.Join(", ", missing)}. Hiraya sends from its mailbox; @hiraya.local sign-in addresses cannot receive mail.";
        }
        else
        {
            emailError = "SMTP is not ready on the API.";
        }

        await repo.MutateAsync(async live =>
        {
            NotificationService.PushToUsers(
                live,
                parents.Select(p => p.UserId),
                message,
                NotificationKinds.Payment,
                title,
                "payments");
            AuditService.Append(live, actor, AuditModules.Payments, "balance-notice",
                "student", student.StudentId, $"Notified {parents.Count} parent account(s) about {child}.");
            await Task.CompletedTask;
        });

        return new
        {
            notified = true,
            emailed = emailedTo.Count > 0,
            to = string.Join(", ", emailedTo),
            accountCount = parents.Count,
            smtpReady = email.IsConfigured,
            emailError
        };
    }

    private static async Task<object> SendTeacherNoticeAsync(
        string paymentId,
        NoticeMailBody? body,
        HirayaUser actor,
        IHirayaRepository repo,
        IHirayaAppPaths paths,
        IEmailSender email)
    {
        var id = (paymentId ?? "").Trim();
        var db = await repo.LoadAsync();
        var payment = db.Payments.FirstOrDefault(p => string.Equals(p.PaymentId, id, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("Payment not found.");
        if (!string.Equals(payment.EnrollmentId, "teacher", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("This notice is for a teacher payment.");
        var teacher = db.Users.FirstOrDefault(u => string.Equals(u.UserId, payment.StudentId, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("Teacher account not found.");
        await RememberEmailsAsync(repo, Pair(teacher.UserId, body?.PersonalEmail));
        await RememberAccountAsync(repo, id, null, body?.AccountNumber, body?.FromAccountNumber, body?.Amount, body?.AmountPaid);
        db = await repo.LoadAsync();
        payment = db.Payments.FirstOrDefault(p => string.Equals(p.PaymentId, id, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("Payment not found.");
        teacher = db.Users.FirstOrDefault(u => string.Equals(u.UserId, payment.StudentId, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("Teacher account not found.");

        var center = CenterName(db);
        var name = DisplayName(teacher);
        var paid = payment.AmountPaid.ToString("N2");
        var amount = payment.Amount.ToString("N2");
        var date = DateLabel(payment.PaymentDate, payment.PaidAt);
        var status = string.IsNullOrWhiteSpace(payment.PaymentStatus) ? "pending" : payment.PaymentStatus.Trim();
        var account = (payment.AccountNumber ?? "").Trim();
        var fromAccount = (payment.FromAccountNumber ?? "").Trim();
        var accountLine = AccountSentence(fromAccount, account);
        var receipt = ReceiptAttachment(paths, payment);
        var receiptLine = receipt is null ? "" : " The receipt is attached.";
        var message = $"Good day, {name}. Your salary of ₱{amount} for {date} is now on your Hiraya account. Amount released: ₱{paid}.{accountLine}{receiptLine} Status: {status}.";
        var subject = $"{center} · Your salary is on your account";
        var text = string.Join('\n', new[] { center, "Salary on your account", "", message });
        var html = $"""
            <div style="font-family:Segoe UI,Arial,sans-serif;color:#0b1f14;line-height:1.5">
              <h2 style="margin:0 0 8px">{System.Net.WebUtility.HtmlEncode(center)}</h2>
              <p>{System.Net.WebUtility.HtmlEncode(message)}</p>
            </div>
            """;

        var emailed = false;
        var to = "";
        string? emailError = null;
        if (!email.IsConfigured)
            emailError = "SMTP is not ready on the API.";
        else if (!TryDeliveryAddress(teacher, out to, out var addressError))
            emailError = addressError;
        else
        {
            try
            {
                await email.SendAsync(to, subject, text, html, receipt);
                emailed = true;
            }
            catch (InvalidOperationException ex)
            {
                emailError = ex.Message;
                to = "";
            }
        }

        await repo.MutateAsync(async live =>
        {
            NotificationService.Push(live, teacher.UserId, message, NotificationKinds.Payment, "Salary on your account", "payments");
            AuditService.Append(live, actor, AuditModules.Payments, "payment-notice",
                "payment", payment.PaymentId, $"Notified {name} on their account.");
            await Task.CompletedTask;
        });

        return new { notified = true, emailed, to = emailed ? to : "", accountCount = 1, smtpReady = email.IsConfigured, emailError };
    }

    private static IEnumerable<(string UserId, string Raw)> Pair(string userId, string? raw)
    {
        if (!string.IsNullOrWhiteSpace(raw))
            yield return (userId, raw);
    }

    private static IEnumerable<(string UserId, string Raw)> ParentMailUpdates(List<HirayaUser> parents, NoticeMailBody? body)
    {
        var listed = body?.Recipients ?? new List<NoticeMailRecipient>();
        if (listed.Count > 0)
        {
            foreach (var item in listed)
            {
                if (!string.IsNullOrWhiteSpace(item.UserId) && !string.IsNullOrWhiteSpace(item.PersonalEmail))
                    yield return (item.UserId.Trim(), item.PersonalEmail);
            }
            yield break;
        }
        if (parents.Count == 1 && !string.IsNullOrWhiteSpace(body?.PersonalEmail))
            yield return (parents[0].UserId, body!.PersonalEmail);
    }

    private static async Task RememberEmailsAsync(IHirayaRepository repo, IEnumerable<(string UserId, string Raw)> updates)
    {
        var pending = updates
            .Where(item => !string.IsNullOrWhiteSpace(item.UserId) && !string.IsNullOrWhiteSpace(item.Raw))
            .ToList();
        if (pending.Count == 0) return;
        foreach (var item in pending)
        {
            if (!PersonalMailbox.TryNormalize(item.Raw, out _, out var error))
                throw new InvalidOperationException(error);
        }
        await repo.MutateAsync(async live =>
        {
            foreach (var item in pending)
            {
                if (!PersonalMailbox.TryNormalize(item.Raw, out var email, out _)) continue;
                var user = live.Users.FirstOrDefault(u => string.Equals(u.UserId, item.UserId, StringComparison.OrdinalIgnoreCase));
                if (user != null) user.PersonalEmail = email;
            }
            await Task.CompletedTask;
        });
    }

    private static async Task RememberAccountAsync(
        IHirayaRepository repo,
        string? paymentId,
        string? studentId,
        string? accountNumber,
        string? fromAccountNumber,
        decimal? amount = null,
        decimal? amountPaid = null)
    {
        var account = (accountNumber ?? "").Trim();
        var fromAccount = (fromAccountNumber ?? "").Trim();
        await repo.MutateAsync(async live =>
        {
            Payment? payment = null;
            if (!string.IsNullOrWhiteSpace(paymentId))
            {
                payment = live.Payments.FirstOrDefault(p => string.Equals(p.PaymentId, paymentId, StringComparison.OrdinalIgnoreCase));
            }
            else if (!string.IsNullOrWhiteSpace(studentId))
            {
                var rows = live.Payments.Where(p => !IsTeacherPay(p) && string.Equals(p.StudentId, studentId, StringComparison.OrdinalIgnoreCase)).ToList();
                payment = rows.LastOrDefault(p => !IsClosed(p.PaymentStatus)) ?? rows.LastOrDefault();
            }
            if (payment != null)
            {
                payment.AccountNumber = account;
                payment.FromAccountNumber = fromAccount;
                if (amount is decimal nextAmount && nextAmount >= 0)
                    payment.Amount = nextAmount;
                if (amountPaid is decimal nextPaid && nextPaid >= 0)
                    payment.AmountPaid = nextPaid;
            }
            await Task.CompletedTask;
        });
    }

    private static string AccountSentence(string? fromAccount, string? toAccount)
    {
        var from = (fromAccount ?? "").Trim();
        var to = (toAccount ?? "").Trim();
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(from)) parts.Add($"Sent from account {from}.");
        if (!string.IsNullOrWhiteSpace(to)) parts.Add($"Sent to account {to}.");
        return parts.Count == 0 ? "" : " " + string.Join(' ', parts);
    }

    private static string OpenAccount(HirayaDatabase db, string studentId)
    {
        var rows = StudentPays(db, studentId).ToList();
        var named = rows.LastOrDefault(p => !IsClosed(p.PaymentStatus) && !string.IsNullOrWhiteSpace(p.AccountNumber))
                    ?? rows.LastOrDefault(p => !string.IsNullOrWhiteSpace(p.AccountNumber));
        return (named?.AccountNumber ?? "").Trim();
    }

    private static string OpenFromAccount(HirayaDatabase db, string studentId)
    {
        var rows = StudentPays(db, studentId).ToList();
        var named = rows.LastOrDefault(p => !IsClosed(p.PaymentStatus) && !string.IsNullOrWhiteSpace(p.FromAccountNumber))
                    ?? rows.LastOrDefault(p => !string.IsNullOrWhiteSpace(p.FromAccountNumber));
        return (named?.FromAccountNumber ?? "").Trim();
    }

    private static bool TryDeliveryAddress(HirayaUser user, out string email, out string error)
    {
        if (PersonalMailbox.TryNormalize(user.PersonalEmail, out email, out _))
        {
            error = "";
            return true;
        }
        if (PersonalMailbox.TryNormalize(user.Email, out email, out _))
        {
            error = "";
            return true;
        }
        email = "";
        var signIn = string.IsNullOrWhiteSpace(user.Email) ? "no Hiraya sign-in email" : user.Email.Trim();
        error = $"{DisplayName(user)} needs a personal email such as name@gmail.com. {signIn} is the Hiraya account and cannot receive this message.";
        return false;
    }

    private static List<HirayaUser> ParentsFor(HirayaDatabase db, Student student)
    {
        var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(student.ParentId)) ids.Add(student.ParentId);
        foreach (var link in db.ParentStudents.Where(l => l.IsActive && string.Equals(l.StudentId, student.StudentId, StringComparison.OrdinalIgnoreCase)))
        {
            if (!string.IsNullOrWhiteSpace(link.ParentId)) ids.Add(link.ParentId);
        }
        return db.Users.Where(u =>
            ids.Contains(u.UserId) &&
            u.Role == UserRoles.Parent &&
            AccountStatuses.AllowsPortalLogin(u.Status)).ToList();
    }

    private static bool IsTeacherPay(Payment row) =>
        string.Equals((row.EnrollmentId ?? "").Trim(), "teacher", StringComparison.OrdinalIgnoreCase);

    private static bool IsClosed(string? status)
    {
        var value = (status ?? "").Trim().ToLowerInvariant();
        return value is "paid" or "cancelled" or "canceled" or "void" or "waived";
    }

    private static IEnumerable<Payment> StudentPays(HirayaDatabase db, string studentId) =>
        db.Payments.Where(p => !IsTeacherPay(p) && string.Equals(p.StudentId, studentId, StringComparison.OrdinalIgnoreCase));

    private static decimal OpenBalance(HirayaDatabase db, string studentId) =>
        StudentTuition.Remaining(db, studentId);

    private static string OpenDue(HirayaDatabase db, string studentId)
    {
        var open = StudentPays(db, studentId).Where(p => !IsClosed(p.PaymentStatus));
        var raw = open.Select(p => (p.DueAt ?? "").Trim()).FirstOrDefault(v => v.Length > 0) ?? "";
        return raw.Length >= 10 ? raw[..10] : raw;
    }

    private static string OpenReceivedBy(HirayaDatabase db, string studentId)
    {
        var rows = StudentPays(db, studentId).ToList();
        var named = rows.FirstOrDefault(p => !IsClosed(p.PaymentStatus) && !string.IsNullOrWhiteSpace(p.ReceivedBy))
                    ?? rows.FirstOrDefault(p => !string.IsNullOrWhiteSpace(p.ReceivedBy));
        return (named?.ReceivedBy ?? "").Trim();
    }

    private static string CenterName(HirayaDatabase db) =>
        string.IsNullOrWhiteSpace(db.Settings.CenterName) ? "Hiraya Kids Learning Center" : db.Settings.CenterName.Trim();

    private static string DisplayName(Student student)
    {
        var parts = new[] { student.FirstName, student.MiddleName, student.LastName }.Where(x => !string.IsNullOrWhiteSpace(x));
        var name = string.Join(' ', parts).Trim();
        if (!string.IsNullOrWhiteSpace(name)) return name;
        return string.IsNullOrWhiteSpace(student.Fullname) ? student.StudentId : student.Fullname.Trim();
    }

    private static string DisplayName(HirayaUser user)
    {
        var parts = new[] { user.FirstName, user.MiddleName, user.LastName }
            .Where(x => !string.IsNullOrWhiteSpace(x));
        var name = string.Join(' ', parts).Trim();
        if (!string.IsNullOrWhiteSpace(name)) return name;
        if (!string.IsNullOrWhiteSpace(user.Fullname)) return user.Fullname.Trim();
        if (!string.IsNullOrWhiteSpace(user.Email)) return user.Email.Trim();
        return user.UserId;
    }

    private static string DateLabel(string paymentDate, string paidAt)
    {
        var raw = (paymentDate ?? "").Trim();
        if (string.IsNullOrWhiteSpace(raw)) raw = (paidAt ?? "").Trim();
        if (raw.Length >= 10) raw = raw[..10];
        if (DateTime.TryParse(raw, out var date))
            return date.ToString("MMM d, yyyy");
        return string.IsNullOrWhiteSpace(raw) ? "—" : raw;
    }

    private static async Task SaveReceiptAsync(
        string paymentId,
        string fileName,
        Stream content,
        long length,
        IHirayaRepository repo,
        IHirayaAppPaths paths)
    {
        var db = await repo.LoadAsync();
        var payment = db.Payments.FirstOrDefault(p => string.Equals(p.PaymentId, paymentId, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("Payment not found.");
        LearningModuleRules.EnsureUploadAllowed(db.Settings, fileName, length);
        var original = LearningModuleRules.SafeFileName(fileName);
        var ext = Path.GetExtension(original).ToLowerInvariant();
        if (ext is ".jpeg" or ".jpe" or ".jfif")
            ext = ".jpg";

        using var ms = new MemoryStream();
        await content.CopyToAsync(ms);
        var bytes = ms.ToArray();
        if (bytes.Length == 0)
            throw new InvalidOperationException("The selected file was empty.");

        var folder = Path.Combine(paths.DataDirectory, "media", "payment-receipts");
        Directory.CreateDirectory(folder);
        var relative = Path.Combine("media", "payment-receipts", payment.PaymentId + ext).Replace('\\', '/');
        var full = Path.Combine(paths.DataDirectory, relative.Replace('/', Path.DirectorySeparatorChar));
        var previous = ReceiptAbsolute(paths, payment.ReceiptPath);
        await File.WriteAllBytesAsync(full, bytes);
        if (previous is not null && !string.Equals(previous, Path.GetFullPath(full), StringComparison.OrdinalIgnoreCase))
        {
            try { File.Delete(previous); } catch { /* older receipt can stay if it is locked */ }
        }

        await repo.MutateAsync(async live =>
        {
            var row = live.Payments.FirstOrDefault(p => string.Equals(p.PaymentId, payment.PaymentId, StringComparison.OrdinalIgnoreCase));
            if (row is null)
                return;
            row.ReceiptPath = relative;
            row.ReceiptName = original;
            await Task.CompletedTask;
        });
    }

    private static string? ReceiptAbsolute(IHirayaAppPaths paths, string? relative)
    {
        var cleaned = (relative ?? "").Replace('\\', '/').Trim().TrimStart('/');
        if (string.IsNullOrWhiteSpace(cleaned) || cleaned.Contains("..", StringComparison.Ordinal))
            return null;
        if (!cleaned.StartsWith("media/payment-receipts/", StringComparison.OrdinalIgnoreCase))
            return null;
        var root = Path.GetFullPath(Path.Combine(paths.DataDirectory, "media", "payment-receipts"));
        var full = Path.GetFullPath(Path.Combine(paths.DataDirectory, cleaned.Replace('/', Path.DirectorySeparatorChar)));
        if (!full.StartsWith(root, StringComparison.OrdinalIgnoreCase) || !File.Exists(full))
            return null;
        return full;
    }

    private static EmailAttachment? ReceiptAttachment(IHirayaAppPaths paths, Payment? payment)
    {
        if (payment is null)
            return null;
        var full = ReceiptAbsolute(paths, payment.ReceiptPath);
        if (full is null)
            return null;
        var name = string.IsNullOrWhiteSpace(payment.ReceiptName) ? Path.GetFileName(full) : payment.ReceiptName.Trim();
        return new EmailAttachment(full, name, LearningModuleRules.ContentType(Path.GetExtension(full)));
    }

    private static Payment? ReceiptPayment(HirayaDatabase db, string studentId)
    {
        var rows = StudentPays(db, studentId).ToList();
        return rows.LastOrDefault(p => !IsClosed(p.PaymentStatus) && !string.IsNullOrWhiteSpace(p.ReceiptPath))
            ?? rows.LastOrDefault(p => !string.IsNullOrWhiteSpace(p.ReceiptPath))
            ?? rows.LastOrDefault(p => !IsClosed(p.PaymentStatus))
            ?? rows.LastOrDefault();
    }
}

public sealed class NoticeMailBody
{
    public string PersonalEmail { get; set; } = "";
    public string AccountNumber { get; set; } = "";
    public string FromAccountNumber { get; set; } = "";
    public decimal? Amount { get; set; }
    public decimal? AmountPaid { get; set; }
    public List<NoticeMailRecipient> Recipients { get; set; } = new();
}

public sealed class NoticeMailRecipient
{
    public string UserId { get; set; } = "";
    public string PersonalEmail { get; set; } = "";
}
