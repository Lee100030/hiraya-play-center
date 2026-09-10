namespace Hiraya.Shared.Services;

public sealed record PageGuideCopy(string Description, IReadOnlyList<string> Actions, IReadOnlyList<string> Steps);

public static class PageGuideCatalog
{
    public static PageGuideCopy Get(string key) =>
        Copies.TryGetValue(key, out var copy) ? copy : Default;

    private static readonly PageGuideCopy Default = new(
        "Use this page to complete one task at a time.",
        ["Open a record for details"],
        ["Scan the list or summary.", "Open details when you need more.", "Return here to continue."]);

    private static readonly Dictionary<string, PageGuideCopy> Copies = new(StringComparer.OrdinalIgnoreCase)
    {
        ["dashboard-admin"] = new(
            "This dashboard is a starting point for the learning center today.",
            ["See counts that need attention", "Open a management page for details"],
            ["Read the summary cards.", "Check today’s classes and notifications.", "Use View all to open the full page."]),
        ["dashboard-teacher"] = new(
            "See what you need for today’s teaching, including who is on duty.",
            ["Open today’s class", "Check the duty roster", "View your students"],
            ["Check today’s classes first.", "Read who is on duty — the same roster every teacher sees.", "Open students or attendance when you are ready."]),
        ["dashboard-parent"] = new(
            "See what is happening with the selected child today.",
            ["Switch child if needed", "Open schedule, attendance, or progress"],
            ["Confirm the selected child.", "Read the next class and latest notes.", "Open a page only when you need the full history."]),
        ["students"] = new(
            "Manage student records from this page.",
            ["Add student", "Select a row then Edit", "Select rows then Delete", "Use All, Boys, or Girls"],
            ["Choose All, Boys, or Girls.", "Tick a student and select Edit, or Add student.", "The same modal is used to add and edit.", "Tick rows and use Delete at the top right."]),
        ["parents"] = new(
            "Select a parent to edit, delete, or activate. Add parent opens the same form.",
            ["Add parent", "Activate a pending account", "Activate all", "Select a row then Edit"],
            ["Tick a parent and select Edit, or Add parent.", "Set a password to activate a pending parent.", "Assign children inside the edit modal."]),
        ["staff"] = new(
            "Select a teacher to edit or delete. Add teacher opens the same form.",
            ["Add teacher", "Select a row then Edit", "Select rows then Delete"],
            ["Tick a teacher and select Edit, or Add teacher.", "The same modal is used to add and edit."]),
        ["classes"] = new(
            "View and manage classes.",
            ["Add a class", "Assign a teacher", "Open class details"],
            ["Select a class.", "Review the teacher and program.", "Edit only when needed."]),
        ["enrollment"] = new(
            "Review enrollment requests and active enrollments.",
            ["Approve pending requests", "Set a parent password if the family is new", "Search enrollments"],
            ["Check pending items first.", "Approve a request.", "If the parent is pending, set their password on the Parents page."]),
        ["programs"] = new(
            "Manage learning programs offered by the center.",
            ["Add a program", "Edit a program"],
            ["Select a program.", "Update its details.", "Save."]),
        ["attendance"] = new(
            "Record attendance for a class.",
            ["Select class and date", "Mark Present, Absent, Late, or Excused", "Save"],
            ["Select the class.", "Select the date.", "Mark each student.", "Save attendance."]),
        ["progress"] = new(
            "Record and review student learning progress.",
            ["Select a student", "Add an assessment", "Publish notes for parents"],
            ["Select a student.", "Choose the progress category.", "Add remarks.", "Save the record."]),
        ["schedules"] = new(
            "View official class schedules.",
            ["Filter by class or date", "Open a session", "Create a schedule if allowed"],
            ["Find the class.", "Open details for time, teacher, and room.", "Edit only from this page."]),
        ["calendar"] = new(
            "See center events and class sessions on the calendar.",
            ["Move between dates", "Open an event"],
            ["Pick a date.", "Select an event for details."]),
        ["payments"] = new(
            "View payment records and payment status.",
            ["Search a student", "Open a payment", "Collect or update if allowed"],
            ["Find the payment.", "Select it to see details.", "Use Collect only when recording a payment."]),
        ["payments-parent"] = new(
            "View your child’s payment records and payment status.",
            ["Select a payment to see details"],
            ["Choose the child if needed.", "Open a payment for the amount and status."]),
        ["reports"] = new(
            "Read center reports and summaries.",
            ["Choose a report", "Open details"],
            ["Select the report you need.", "Use other pages to change records."]),
        ["modules-admin"] = new(
            "Upload and manage learning materials for teachers.",
            ["Upload a module", "Assign classes", "Publish when ready"],
            ["Select Upload module.", "Enter the module information.", "Select the file.", "Publish when ready."]),
        ["modules-teacher"] = new(
            "Learning modules are teaching guides provided by Admin.",
            ["Find a module", "Preview or download"],
            ["Find a module.", "Open the module details.", "Preview or download the file."]),
        ["modules-parent"] = new(
            "View learning materials published for your child.",
            ["Open a module", "Preview or download"],
            ["Select a module.", "Open details to view or download."]),
        ["notifications"] = new(
            "Read alerts from the learning center.",
            ["Open a notification", "Mark as read"],
            ["Read new items first.", "Open a related page if a link is shown."]),
        ["announcements"] = new(
            "Read center announcements.",
            ["Open an announcement"],
            ["Select an announcement.", "Return here for the rest of the list."]),
        ["roster"] = new(
            "See students in your assigned classes.",
            ["Open attendance", "Open progress"],
            ["Find the student.", "Use Attendance or Progress for updates."]),
        ["tasks"] = new(
            "Organize your personal teaching tasks.",
            ["Create a task", "Mark it done"],
            ["Add a task.", "Set the due date.", "Open it when you work on it."]),
        ["users"] = new(
            "Manage user accounts for the system.",
            ["Add a user", "Activate an account", "Activate all accounts", "Archive an account"],
            ["Search for a user.", "Set a password on pending parents before they can sign in.", "Use Activate all accounts only for deactivated accounts."]),
        ["roles"] = new(
            "Control what each role can do.",
            ["Review a role", "Update permissions"],
            ["Select a role.", "Turn permissions on or off.", "Save."]),
        ["audit"] = new(
            "Review important system activity.",
            ["Search the log", "Open an entry"],
            ["Use filters to narrow results.", "Open an item only if you need more context."]),
        ["profile"] = new(
            "Update your name, photo, and contact details.",
            ["Change photo", "Save profile"],
            ["Edit the fields you need.", "Save."]),
        ["account"] = new(
            "Update password and personal preferences.",
            ["Change password", "Save preferences"],
            ["Choose Security or Preferences.", "Save each section when finished."]),
        ["system"] = new(
            "Update learning center settings.",
            ["Edit center details", "Save"],
            ["Change only what you need.", "Save."]),
        ["website"] = new(
            "Manage public website content from this application.",
            ["Edit the landing page", "Edit About HIRAYA", "Manage gallery images"],
            ["Open Landing page, About, or Gallery.", "Save.", "Refresh the public website to confirm."]),
        ["website-landing"] = new(
            "Edit the public landing welcome and logo.",
            ["Change the logo", "Update welcome title and message", "Save"],
            ["Upload a logo if needed.", "Edit the welcome text.", "Save, then refresh the public website."]),
        ["website-about"] = new(
            "Edit the About HIRAYA text visitors see.",
            ["Update title, description, mission, and vision", "Save"],
            ["Edit the fields.", "Save.", "Refresh the public website."]),
        ["website-gallery"] = new(
            "Upload and publish activity photos for the public gallery.",
            ["Upload an image", "Publish or unpublish", "Reorder with display order"],
            ["Choose an image.", "Set title and caption.", "Publish when it should appear on the website."]),
        ["children"] = new(
            "See the children linked to this account.",
            ["Select a child", "Open their pages"],
            ["Choose a child.", "Use Home, Schedule, or Progress for that child."]),
        ["more"] = new(
            "Open less-used family pages from here.",
            ["Open a page"],
            ["Select the topic you need.", "Use Back to return."]),
        ["schedule-parent"] = new(
            "View your child’s upcoming classes.",
            ["Select a class to see time, subject, teacher, and room"],
            ["Confirm the selected child.", "Select a class for details."]),
        ["operations"] = new(
            "Open the center’s extra operation desks without changing existing pages.",
            ["Open a desk", "Return to Students or Schedules"],
            ["Pick the spreadsheet-style desk you need.", "Use existing pages for records you already manage."]),
        ["teacher-plan"] = new(
            "See a teacher’s day in time blocks, including sessions, breaks, and prep.",
            ["Choose a teacher", "Move between weeks"],
            ["Select the teacher.", "Read each time block for that weekday."]),
        ["teacher-duty"] = new(
            "Assign who is on duty each day. Lead names stay in red. Teachers see this same roster without editing.",
            ["Add a teacher to a date", "Edit a selected duty", "Delete selected names"],
            ["Use Add duty or the + on a day.", "Select a teacher from the list.", "Tick names, then Edit or Delete."]),
        ["teacher-duty-view"] = new(
            "This is the center duty roster. Administration publishes it; every teacher sees the same calendar.",
            ["Find your name", "Move between months"],
            ["Your name is highlighted when you are on duty.", "Red names are the lead for that day.", "Ask an administrator if a date needs to change."]),
        ["school-calendar"] = new(
            "See holidays and school events for the year.",
            ["Switch 2026 or 2027"],
            ["Choose the year.", "Red dates are holidays or key events."]),
        ["playgroup"] = new(
            "See playgroup slots and upcoming student records.",
            ["Move between weeks", "Open student records"],
            ["Read the 11:00 and 1:30 slots.", "Use Upcoming for inactive or pending students."]),
        ["uniform"] = new(
            "Track uniform inventory separately from payments.",
            ["Return to students"],
            ["Use this desk for stock notes.", "ID and nametag flags stay on the student roster tabs."]),
    };
}
