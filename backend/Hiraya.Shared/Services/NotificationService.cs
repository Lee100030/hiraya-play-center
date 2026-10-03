using Hiraya.Shared.Models;
using Hiraya.Shared.Services.Firebase;

namespace Hiraya.Shared.Services;

public class NotificationSendRequest
{
    public string Audience { get; set; } = NotificationAudiences.Admins;
    public string UserId { get; set; } = "";
    public string Kind { get; set; } = NotificationKinds.System;
    public string Title { get; set; } = "";
    public string Message { get; set; } = "";
    public string Href { get; set; } = "";
}

public class NewsSaveRequest
{
    public string NewsId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public bool Publish { get; set; } = true;
    public bool Notify { get; set; } = true;
}

public class DirectMessageRequest
{
    public string ToUserId { get; set; } = "";
    public string GroupId { get; set; } = "";
    public string Body { get; set; } = "";
}

public class ChatGroupCreateRequest
{
    public string Name { get; set; } = "";
    public List<string> MemberIds { get; set; } = new();
}

public class NotificationService
{
    private readonly IHirayaRepository _repository;

    public NotificationService(IHirayaRepository repository) => _repository = repository;

    public static IEnumerable<SystemAlert> Inbox(HirayaDatabase db, HirayaUser user, bool includeArchived = false)
    {
        return db.Alerts
            .Where(a => a.RecipientId == user.UserId)
            .Where(a => includeArchived || !IsArchived(a))
            .OrderByDescending(a => a.CreatedAt);
    }

    public static int UnreadCount(HirayaDatabase db, HirayaUser user) =>
        Inbox(db, user).Count(a => !a.Read);

    public static IEnumerable<NewsItem> PublishedNews(HirayaDatabase db) =>
        db.News
            .Where(n => n.IsPublished && n.Status != "archived")
            .OrderByDescending(n => n.PublishedAt);

    public static void Push(
        HirayaDatabase db,
        string recipientId,
        string message,
        string kind = NotificationKinds.System,
        string? title = null,
        string? href = null)
    {
        if (string.IsNullOrWhiteSpace(recipientId) || string.IsNullOrWhiteSpace(message))
            return;

        db.Alerts.Add(new SystemAlert
        {
            AlertId = IdFactory.New("al"),
            Kind = string.IsNullOrWhiteSpace(kind) ? NotificationKinds.System : kind,
            Title = string.IsNullOrWhiteSpace(title) ? NotificationKinds.Label(kind) : title.Trim(),
            Message = message.Trim(),
            RecipientId = recipientId,
            Href = href?.Trim() ?? "",
            Status = "active",
            CreatedAt = DateTime.UtcNow.ToString("o"),
            Read = false
        });
    }

    public static void PushToUsers(
        HirayaDatabase db,
        IEnumerable<string> recipientIds,
        string message,
        string kind = NotificationKinds.System,
        string? title = null,
        string? href = null)
    {
        foreach (var id in recipientIds.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct())
            Push(db, id, message, kind, title, href);
    }

    public static IReadOnlyList<HirayaUser> Recipients(HirayaDatabase db, string audience, string? userId = null)
    {
        var active = db.Users.Where(u =>
            !string.Equals(u.Status, "archived", StringComparison.OrdinalIgnoreCase));

        return audience switch
        {
            NotificationAudiences.User when !string.IsNullOrWhiteSpace(userId) =>
                active.Where(u => u.UserId == userId).ToList(),
            NotificationAudiences.Admins =>
                active.Where(u => u.Role is UserRoles.SuperAdmin or UserRoles.Admin).ToList(),
            NotificationAudiences.Teachers =>
                active.Where(u => u.Role == UserRoles.Teacher).ToList(),
            NotificationAudiences.Staff =>
                active.Where(u => u.Role == UserRoles.Staff).ToList(),
            NotificationAudiences.Parents =>
                active.Where(u => u.Role == UserRoles.Parent).ToList(),
            NotificationAudiences.Employees =>
                active.Where(u => u.Role is UserRoles.SuperAdmin or UserRoles.Admin or UserRoles.Teacher or UserRoles.Staff).ToList(),
            NotificationAudiences.Everyone =>
                active.ToList(),
            _ => []
        };
    }

    public static bool IsArchived(SystemAlert alert) =>
        string.Equals(alert.Status, "archived", StringComparison.OrdinalIgnoreCase);

    public async Task SendAsync(NotificationSendRequest input, HirayaUser actor)
    {
        if (!Navigation.CanSendNotifications(actor.Role))
            throw new UnauthorizedAccessException("You cannot send notifications.");
        if (string.IsNullOrWhiteSpace(input.Message))
            throw new InvalidOperationException("Message is required.");
        if (input.Audience == NotificationAudiences.User && string.IsNullOrWhiteSpace(input.UserId))
            throw new InvalidOperationException("Select a recipient.");

        var title = string.IsNullOrWhiteSpace(input.Title) ? NotificationKinds.Label(input.Kind) : input.Title.Trim();
        var kind = NotificationKinds.All.Contains(input.Kind) ? input.Kind : NotificationKinds.System;
        var href = input.Href.Trim();

        await _repository.MutateAsync(async db =>
        {
            var people = Recipients(db, input.Audience, input.UserId);
            if (people.Count == 0)
                throw new InvalidOperationException("No recipients matched that audience.");

            PushToUsers(db, people.Select(u => u.UserId), input.Message.Trim(), kind, title, href);
            AuditService.Append(db, actor, AuditModules.Notifications, "send",
                "notification", input.Audience, $"Sent “{title}” to {people.Count} recipient(s).");
            await Task.CompletedTask;
        });
    }

    public static string DirectThreadKey(string a, string b)
    {
        var ids = new[] { a.Trim(), b.Trim() }.OrderBy(x => x, StringComparer.OrdinalIgnoreCase).ToArray();
        return $"dm:{ids[0]}:{ids[1]}";
    }

    public static string GroupThreadKey(string groupId) => $"group:{(groupId ?? "").Trim()}";

    public static IEnumerable<string> PackedIds(string? packed) =>
        (packed ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase);

    public static bool AreCoParents(HirayaDatabase db, string parentA, string parentB)
    {
        if (string.IsNullOrWhiteSpace(parentA) || string.IsNullOrWhiteSpace(parentB))
            return false;
        if (string.Equals(parentA, parentB, StringComparison.OrdinalIgnoreCase))
            return false;
        var kidsA = StudentIdsForParent(db, parentA);
        if (kidsA.Count == 0) return false;
        return StudentIdsForParent(db, parentB).Overlaps(kidsA);
    }

    public static HashSet<string> StudentIdsForParent(HirayaDatabase db, string parentId)
    {
        var ids = db.ParentStudents
            .Where(l => l.IsActive && string.Equals(l.ParentId, parentId, StringComparison.OrdinalIgnoreCase))
            .Select(l => l.StudentId)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var student in db.Students.Where(s => string.Equals(s.ParentId, parentId, StringComparison.OrdinalIgnoreCase)))
            ids.Add(student.StudentId);
        return ids;
    }

    public static bool CanDirectMessage(HirayaDatabase db, HirayaUser actor, HirayaUser target)
    {
        if (string.Equals(actor.UserId, target.UserId, StringComparison.OrdinalIgnoreCase))
            return false;
        if (!string.Equals(target.Status, "active", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(target.Status, "pending", StringComparison.OrdinalIgnoreCase))
            return false;

        if (UserRoles.IsAdmin(actor.Role))
            return target.Role is UserRoles.Teacher or UserRoles.Parent || UserRoles.IsAdmin(target.Role);

        if (actor.Role == UserRoles.Teacher)
            return target.Role == UserRoles.Teacher || UserRoles.IsAdmin(target.Role);

        if (actor.Role == UserRoles.Parent)
            return UserRoles.IsAdmin(target.Role) ||
                   (target.Role == UserRoles.Parent && AreCoParents(db, actor.UserId, target.UserId));

        return false;
    }

    public static IEnumerable<HirayaUser> MessageContacts(HirayaDatabase db, HirayaUser actor)
    {
        return db.Users
            .Where(u => CanDirectMessage(db, actor, u))
            .OrderBy(u => PersonLabel(u), StringComparer.OrdinalIgnoreCase);
    }

    public async Task CreateGroupAsync(HirayaUser actor, ChatGroupCreateRequest input)
    {
        if (!UserRoles.IsAdmin(actor.Role))
            throw new UnauthorizedAccessException("Only the administrator can create a group chat.");
        var name = (input.Name ?? "").Trim();
        if (name.Length == 0)
            throw new InvalidOperationException("Give the group a name.");
        if (name.Length > 80)
            throw new InvalidOperationException("Keep the group name under 80 characters.");

        await _repository.MutateAsync(async db =>
        {
            WorkflowOps.EnsureLists(db);
            var memberIds = (input.MemberIds ?? [])
                .Select(id => (id ?? "").Trim())
                .Where(id => id.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (!memberIds.Contains(actor.UserId, StringComparer.OrdinalIgnoreCase))
                memberIds.Insert(0, actor.UserId);

            var people = db.Users
                .Where(u => memberIds.Contains(u.UserId, StringComparer.OrdinalIgnoreCase))
                .Where(u =>
                    u.Role is UserRoles.Teacher or UserRoles.Parent ||
                    UserRoles.IsAdmin(u.Role))
                .ToList();
            if (people.Count < 2)
                throw new InvalidOperationException("Add at least one teacher or parent besides yourself.");

            var now = DateTime.UtcNow.ToString("o");
            var group = new ChatGroup
            {
                GroupId = IdFactory.New("cg"),
                Name = name,
                MemberIds = string.Join(",", people.Select(u => u.UserId)),
                CreatedBy = actor.UserId,
                CreatedAt = now,
                UpdatedAt = now,
                Status = "active"
            };
            db.ChatGroups.Add(group);
            AuditService.Append(db, actor, AuditModules.Notifications, "group",
                "chat_group", group.GroupId, $"{PersonLabel(actor)} created group “{name}” ({people.Count} members).");
            await Task.CompletedTask;
        });
    }

    public async Task SendDirectAsync(HirayaUser actor, DirectMessageRequest input)
    {
        var body = (input.Body ?? "").Trim();
        if (body.Length == 0)
            throw new InvalidOperationException("Write a message first.");
        if (body.Length > 2000)
            throw new InvalidOperationException("Keep the message under 2,000 characters.");

        await _repository.MutateAsync(async db =>
        {
            WorkflowOps.EnsureLists(db);
            var groupId = (input.GroupId ?? "").Trim();
            if (groupId.Length > 0)
            {
                SendGroupMessage(db, actor, groupId, body);
                await Task.CompletedTask;
                return;
            }

            var targetId = (input.ToUserId ?? "").Trim();
            if (targetId.Length == 0 && actor.Role is UserRoles.Teacher or UserRoles.Parent)
            {
                var admin = db.Users.FirstOrDefault(u => u.Role == UserRoles.SuperAdmin);
                targetId = admin?.UserId ?? "";
            }

            var target = db.Users.FirstOrDefault(u => u.UserId == targetId)
                         ?? throw new InvalidOperationException("That person was not found.");
            if (!CanDirectMessage(db, actor, target))
                throw new UnauthorizedAccessException("You cannot message that person.");

            DeliverDirect(db, actor, target, body);
            await Task.CompletedTask;
        });
    }

    static void SendGroupMessage(HirayaDatabase db, HirayaUser actor, string groupId, string body)
    {
        var group = db.ChatGroups.FirstOrDefault(g =>
                        g.GroupId == groupId &&
                        !string.Equals(g.Status, "archived", StringComparison.OrdinalIgnoreCase))
                    ?? throw new InvalidOperationException("That group was not found.");
        var members = PackedIds(group.MemberIds).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (!members.Contains(actor.UserId))
            throw new UnauthorizedAccessException("You are not in that group.");

        var people = db.Users.Where(u => members.Contains(u.UserId)).ToList();
        if (people.Count == 0)
            throw new InvalidOperationException("That group has no members.");

        var thread = GroupThreadKey(group.GroupId);
        var now = DateTime.UtcNow.ToString("o");
        var senderName = PersonLabel(actor);
        group.UpdatedAt = now;

        foreach (var member in people)
        {
            var mine = string.Equals(member.UserId, actor.UserId, StringComparison.OrdinalIgnoreCase);
            db.Alerts.Add(new SystemAlert
            {
                AlertId = IdFactory.New("al"),
                Kind = NotificationKinds.Direct,
                Title = mine ? $"To {group.Name}" : senderName,
                Message = body,
                RecipientId = member.UserId,
                Href = group.GroupId,
                RelatedRecordId = thread,
                Status = mine ? "sent" : "unread",
                CreatedAt = now,
                Read = mine,
                ReadAt = mine ? now : ""
            });
        }

        AuditService.Append(db, actor, AuditModules.Notifications, "group_message",
            "chat_group", group.GroupId, $"{senderName} messaged group “{group.Name}”.");
    }

    static void DeliverDirect(HirayaDatabase db, HirayaUser actor, HirayaUser target, string body)
    {
        var thread = DirectThreadKey(actor.UserId, target.UserId);
        var now = DateTime.UtcNow.ToString("o");
        var senderName = PersonLabel(actor);
        var targetName = PersonLabel(target);

        db.Alerts.Add(new SystemAlert
        {
            AlertId = IdFactory.New("al"),
            Kind = NotificationKinds.Direct,
            Title = senderName,
            Message = body,
            RecipientId = target.UserId,
            Href = actor.UserId,
            RelatedRecordId = thread,
            Status = "unread",
            CreatedAt = now,
            Read = false
        });
        db.Alerts.Add(new SystemAlert
        {
            AlertId = IdFactory.New("al"),
            Kind = NotificationKinds.Direct,
            Title = $"To {targetName}",
            Message = body,
            RecipientId = actor.UserId,
            Href = target.UserId,
            RelatedRecordId = thread,
            Status = "sent",
            CreatedAt = now,
            Read = true,
            ReadAt = now
        });
        AuditService.Append(db, actor, AuditModules.Notifications, "direct",
            "user", target.UserId, $"{senderName} messaged {targetName}.");
    }

    public async Task DeleteDirectMessageAsync(HirayaUser actor, string alertId)
    {
        var id = (alertId ?? "").Trim();
        if (id.Length == 0)
            throw new InvalidOperationException("That message was not found.");

        await _repository.MutateAsync(async db =>
        {
            WorkflowOps.EnsureLists(db);
            var mine = db.Alerts.FirstOrDefault(a =>
                           a.AlertId == id &&
                           string.Equals(a.Kind, NotificationKinds.Direct, StringComparison.OrdinalIgnoreCase) &&
                           string.Equals(a.RecipientId, actor.UserId, StringComparison.OrdinalIgnoreCase))
                       ?? throw new InvalidOperationException("That message was not found.");

            if (!string.Equals(mine.Status, "sent", StringComparison.OrdinalIgnoreCase))
                throw new UnauthorizedAccessException("You can only delete messages you sent.");

            var thread = mine.RelatedRecordId ?? "";
            var body = mine.Message ?? "";
            var created = mine.CreatedAt ?? "";
            var removed = db.Alerts.RemoveAll(a =>
                string.Equals(a.Kind, NotificationKinds.Direct, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(a.RelatedRecordId, thread, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(a.Message, body, StringComparison.Ordinal) &&
                string.Equals(a.CreatedAt, created, StringComparison.Ordinal));

            if (removed == 0)
                throw new InvalidOperationException("That message was not found.");

            AuditService.Append(db, actor, AuditModules.Notifications, "delete",
                "alert", id, $"{PersonLabel(actor)} deleted a direct message.");
            await Task.CompletedTask;
        });
    }

    static string PersonLabel(HirayaUser user)
    {
        var assembled = $"{user.FirstName} {user.LastName}".Trim();
        if (!string.IsNullOrWhiteSpace(assembled))
            return assembled;
        if (!string.IsNullOrWhiteSpace(user.Fullname))
            return user.Fullname.Trim();
        return string.IsNullOrWhiteSpace(user.Email) ? user.UserId : user.Email;
    }

    public async Task MarkReadAsync(string alertId, HirayaUser actor, bool read = true)
    {
        await _repository.MutateAsync(async db =>
        {
            var alert = db.Alerts.FirstOrDefault(a => a.AlertId == alertId && a.RecipientId == actor.UserId)
                        ?? throw new InvalidOperationException("Notification not found.");
            alert.Read = read;
            await Task.CompletedTask;
        });
    }

    public async Task MarkAllReadAsync(HirayaUser actor)
    {
        await _repository.MutateAsync(async db =>
        {
            foreach (var alert in Inbox(db, actor).Where(a => !a.Read))
                alert.Read = true;
            await Task.CompletedTask;
        });
    }

    public async Task ArchiveAsync(string alertId, HirayaUser actor)
    {
        await _repository.MutateAsync(async db =>
        {
            var alert = db.Alerts.FirstOrDefault(a => a.AlertId == alertId && a.RecipientId == actor.UserId)
                        ?? throw new InvalidOperationException("Notification not found.");
            alert.Status = "archived";
            alert.Read = true;
            await Task.CompletedTask;
        });
    }

    public async Task SaveNewsAsync(NewsSaveRequest input, HirayaUser actor)
    {
        if (!Navigation.CanManageAnnouncements(actor.Role))
            throw new UnauthorizedAccessException("You cannot manage announcements.");
        if (string.IsNullOrWhiteSpace(input.Title) || string.IsNullOrWhiteSpace(input.Body))
            throw new InvalidOperationException("Title and body are required.");

        await _repository.MutateAsync(async db =>
        {
            var isNew = string.IsNullOrWhiteSpace(input.NewsId);
            var id = isNew ? IdFactory.New("news") : input.NewsId;
            var existing = db.News.FirstOrDefault(n => n.NewsId == id);
            if (!isNew && existing == null)
                throw new InvalidOperationException("Announcement not found.");
            if (existing != null && existing.Status == "archived")
                throw new InvalidOperationException("Archived announcements cannot be edited.");

            var wasPublished = existing?.IsPublished == true;
            var now = DateTime.UtcNow.ToString("o");
            var item = new NewsItem
            {
                NewsId = id,
                Title = input.Title.Trim(),
                Body = input.Body.Trim(),
                CreatedBy = existing?.CreatedBy is { Length: > 0 } by ? by : actor.UserId,
                IsPublished = input.Publish,
                Status = input.Publish ? "published" : "draft",
                PublishedAt = input.Publish
                    ? (wasPublished ? existing!.PublishedAt : now)
                    : existing?.PublishedAt ?? ""
            };

            db.News.RemoveAll(n => n.NewsId == id);
            db.News.Add(item);

            if (input.Publish && input.Notify && (!wasPublished || isNew))
            {
                PushToUsers(
                    db,
                    Recipients(db, NotificationAudiences.Everyone).Select(u => u.UserId),
                    item.Body,
                    NotificationKinds.Announcement,
                    item.Title,
                    "announcements");
            }

            AuditService.Append(db, actor, AuditModules.Announcements, isNew ? "create" : "update",
                "news", id, $"{(input.Publish ? "Published" : "Saved draft")} “{item.Title}”.");
            await Task.CompletedTask;
        });
    }

    public async Task ArchiveNewsAsync(string newsId, HirayaUser actor)
    {
        if (!Navigation.CanManageAnnouncements(actor.Role))
            throw new UnauthorizedAccessException("You cannot manage announcements.");

        await _repository.MutateAsync(async db =>
        {
            var item = db.News.FirstOrDefault(n => n.NewsId == newsId)
                       ?? throw new InvalidOperationException("Announcement not found.");
            item.Status = "archived";
            item.IsPublished = false;
            AuditService.Append(db, actor, AuditModules.Announcements, "archive", "news", newsId, $"Archived “{item.Title}”.");
            await Task.CompletedTask;
        });
    }
}
