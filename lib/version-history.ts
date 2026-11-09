/**
 * Matrix version history, shown at /admin/version-history.
 *
 * One release per calendar month, versioned YYYY.MM. Matrix ships continuously,
 * so a month is the honest unit: there is no release train to number, and a
 * hand-bumped semver would stop meaning anything within weeks.
 *
 * Releases before 2026.10 were backfilled from git history on 2026-10-26.
 *
 * When a feature ships that staff or admins will notice, add one line to the
 * current month's release under the right area (start a new release at the TOP
 * when the month turns). One line per feature, not per tweak. Write what people
 * can now see or do, not how it was built. Skip refactors, lint, tooling and
 * small visual tweaks. A month that grows long is condensed: merge related lines
 * and keep every real capability. A change big enough to announce also gets an
 * entry in lib/whats-new.ts, which drives the one-time staff popup.
 */

import { formatWATDate } from "@/lib/utils/date"

export interface ReleaseArea {
  /** Module or part of the app, e.g. "Attendance". */
  area: string
  items: string[]
}

export interface Release {
  /** YYYY.MM — the month the changes went live. */
  version: string
  title: string
  summary: string
  areas: ReleaseArea[]
}

export const RELEASES: Release[] = [
  {
    version: "2026.11",
    title: "Help Desk, signing and everyday lists",
    summary:
      "Help Desk runs on its own, requisitions and signing are easier to use, and lists and sheets behave consistently.",
    areas: [
      {
        area: "Help Desk",
        items: [
          "Tickets run on their own and no longer create task items. They can be assigned when created (with a warning if the assignee is on leave) and reassigned from any open status",
          "Resolving is separate from closing: requesters or leads close a ticket with a 1–5 service rating, and tickets that grow into projects can be converted into formal tasks",
        ],
      },
      {
        area: "Attendance",
        items: [
          "Attendance appeals now go to the department lead and then to the Admin & HR Lead, or the person they have delegated to; holding the admin role no longer lets someone approve them",
          "A day's status is now changed first by the employee's department lead, not from the admin attendance page",
          "A lead filing an appeal for their staff no longer counts against the three permission days a month",
          "Appeals nobody decided by the end of the month after the day now expire; the day stays as recorded and the employee is told",
          "Leads' daily summary lists overdue appeals (five working days) and those expiring this week",
          "Overriding an approval is only open once it is stuck: five working days with no decision, or the approver on leave with no delegate",
          "Appeals approved by the person they are about are marked Self-approved and listed for the MD under MD's Desk, with a monthly notice",
          "Attendance policy settings are now in the Attendance page menu, and CBT settings are a button on the CBT page",
        ],
      },
      {
        area: "Admin access",
        items: [
          "HR and IT pages now separate viewing from editing: the lead of the owning department edits, everyone else with the admin role views, and a notice names who can make changes",
          "Settings > Access lists every admin with a View or Edit choice for HR and IT; leads hand work to a delegate, with an end date, from Delegate access on their department page",
          "Mailbox changes now need IT edit access, not just the admin role",
          "IT pages (Onboarding, Mailboxes, Mail, Starlink, Network Activity, Bypass & Override) moved under IT, Payroll, Inventory and Assets under Accounts, and PMS under HR; old links still work",
        ],
      },
      {
        area: "Starlink & Payments",
        items: [
          "Populated missing states across Starlink accounts (Adewole, Bondu, Olooji, Sule) to match their community projects",
          "Improved Starlink Kits table: added kit count to tab, displayed kit numbers alongside account IDs, and rearranged columns so status and schedule appear before monthly billing amounts",
          "Converted payment details from an overlaid modal into a dedicated full page with return navigation to Starlink when opened via Open Payment",
        ],
      },
      {
        area: "Projects",
        items: [
          "Registered missing operational and under-construction mini-grid projects (Onipanu, Erinla, and Bondu) in the projects catalogue",
        ],
      },
      {
        area: "UI & Badges",
        items: [
          "Standardized status badges across Leave, Fleet, Reviews, Help Desk, Payroll, CBT, and Admin tables to use semantic status colors (green for approved/completed/active, amber for pending, purple for contract) rather than defaulting to uniform gold or dark primary badges",
          "Enhanced list views and side sheets across Impersonation, Payroll, Attendance, Stock Movements, Challenges, and Tasks with one-click actions, expandable details, and full record properties",
          "Adopted standardized department short codes in list views and card subtitles across Impersonation, User Settings, Challenges, CBT logs, and Leave Management to eliminate text truncation on mobile while retaining full department names in side sheets and search filters",
          "Removed duplicate inline Action columns on desktop data tables where rowActions was active, keeping a single standardized trailing Action column",
        ],
      },
      {
        area: "Tasks",
        items: [
          "New tasks default to 'Does not repeat' with start date and 5-working-day deadline displayed and automatically selected",
          "Enforced a 3 to 200 character limit on task titles with live counter feedback, and capped task descriptions at 5,000 characters to keep lists and table views clean and scannable",
          "Differentiated recurring cadence badges from linked project and portfolio metadata with neutral styling to keep action buttons distinct from structural context",
          "The User Task Plan table now automatically seeds its time period filter to the current week on load, showing active weekly tasks immediately without manual filtering",
        ],
      },
      {
        area: "Leave Management",
        items: [
          "Fixed contrast and color clashing on leave rejection banners, approval stage notes, and concurrent leave notices in both dark and light modes",
          "Leave Without Pay (LWOP) is now automatically hidden from the admin leave calendar by default, with a dedicated toolbar toggle to show or hide it on demand",
        ],
      },
      {
        area: "Attendance",
        items: [
          "Separated Attendance Appeals filtering into distinct Status and Stage controls, defaulting to open appeals in actionable stages ('Pending Admin' and 'Pending Lead & Admin') on load.",
          "Admin attendance records group exceptions by what needs attention, approved exceptions and covered days",
        ],
      },
      {
        area: "Lunch",
        items: ["Lunch voting shows when each vote was cast"],
      },
      {
        area: "Reports & Meetings",
        items: ["Minutes summaries open with a clearer header and cards for quick scanning"],
      },
      {
        area: "Requisitions & Signing",
        items: [
          "Requisition amounts are larger and easier to read in the list",
          "Beneficiary account name, account number, bank and amount can each be copied with one click",
          "Settings → Signing offers Replace signature and Change PIN once you have them. A missing signature or PIN when you sign sends you to set it up, then back to the requisition",
        ],
      },
      {
        area: "Everywhere",
        items: ["Side sheets and dialogs no longer leave the page behind them scrollable"],
      },
    ],
  },
  {
    version: "2026.10",
    title: "Security, mailboxes and requisitions",
    summary:
      "A full security audit was fixed end to end, requisitions were rebuilt, and staff mailboxes can now be run from inside Matrix.",
    areas: [
      {
        area: "Security",
        items: [
          "The October security audit is fixed: privilege escalation paths are closed, every form submission is checked, and raw database errors no longer reach the screen",
          "Admins are alerted when someone changes the database outside Matrix, and the error monitor groups errors across users so problems are spotted early",
        ],
      },
      {
        area: "Requisitions & Payments",
        items: [
          "Requisitions rebuilt with petty cash, approval routing, signing, and signing or rejecting straight from the table",
          "Payments can be charged to a project, need a cost category and site location, and are split into All, Recurring and One-time tabs",
          "Paid payments and requisitions, approved fleet documents and resolved help desk attachments are archived to SharePoint automatically",
        ],
      },
      {
        area: "Mailboxes",
        items: [
          "Staff mailboxes can be created, suspended, restored, forwarded and have their passwords reset from Matrix, with an activity history for every operation",
          "New mailboxes default to 250 MB with presets up to 5 GB; admins see storage use and are alerted when a mailbox is nearly full",
          "Staff can set up their work email on their phone and copy their ACOB signature from the profile page, and their email updates when their name is edited",
        ],
      },
      {
        area: "Starlink & Sites",
        items: [
          "Starlink kits page, with billing emails filed against kit payments automatically and chosen staff alerted when a payment fails or falls due",
          "Sites register under Portfolios, and mini-grid projects link to their Starlink kits",
        ],
      },
      {
        area: "Attendance",
        items: [
          "Weekend clock-ins and clock-outs show as Present with their punch times, and are kept out of workday calculations",
          "Attendance appeals need both the lead and HR, with full audit history, and the change log shows every edit to a record",
          "Staff are told when the clock-in device is offline, punches that failed to save are retried, and attendance is reconciled every hour",
          "Time physically in the office is shown separately from official credited hours. Remote check-in has been removed",
        ],
      },
      {
        area: "Leave",
        items: [
          "Leave waiting for the MD is no longer cancelled automatically",
          "Staff in the same department can apply for overlapping leave, with soft overlap notices for applicants and approvers",
          "Leave details open in a side sheet with the full approval timeline and prominent rejection reasons",
        ],
      },
      {
        area: "Notifications & Meetings",
        items: [
          "Notifications are sorted into Needs you, Updates and Announcements, and phone push is sent only for things that need action",
          "Meeting recipients are managed from a button on the Records page, and the weekly PowerPoint shows task and action point counts for each staff member",
          "Weekly KSS and General Meeting appear on the calendar with the Teams link",
        ],
      },
      {
        area: "Staff, Lunch, PMS & Tasks",
        items: [
          "Tap a staff photo to open their contact card, and the in-app guide sits behind the ? icon in the top bar",
          "Lunch menus can be shared to WhatsApp, and staff can hide their name on lunch votes",
          "Corporate KPIs have a plan year picker, and CBT questions can be uploaded in bulk from Excel or CSV",
          "Task sheets show assignment, status changes, notes and review decisions in one timeline, and closed or cancelled projects are excluded from new task assignments",
        ],
      },
      {
        area: "Tools & Operations",
        items: [
          "All ten PDF tools, including compress, OCR and passwords, work on your device with no file size limit",
          "Asset history follows a clear event timeline",
        ],
      },
      {
        area: "Everywhere",
        items: [
          "Detail views open as a side panel instead of a pop-up, and every dialog becomes a bottom sheet on phones",
          "Tapping a row on a phone opens its sheet with every column and all its actions, and data tables can export what they show",
        ],
      },
    ],
  },
  {
    version: "2026.09",
    title: "Mobile, MD's Desk and the company calendar",
    summary:
      "Matrix became properly usable on phones, installable as an app, and gained MD's Desk, the events calendar, policies and the risk register.",
    areas: [
      {
        area: "Mobile & App",
        items: [
          "Install Matrix on your phone as an app, with push notifications",
          "Every table switches between List, Cards and Table views",
          "Stats fit on one row on phones, and tapping a row opens a detail sheet",
        ],
      },
      {
        area: "MD's Desk",
        items: ["MD's Desk with an approvals queue, delegates and task reviews"],
      },
      {
        area: "Events",
        items: ["Company events calendar with public holidays", "Sidebar badges for pending RSVPs and new events"],
      },
      {
        area: "Documentation",
        items: ["Company policies and SOPs, with staff acknowledgements"],
      },
      {
        area: "Corporate Services",
        items: [
          "Risk register built on the ACOB template, fed automatically by weekly report challenges, with workbook import",
          "Corporate scorecard with a RACI matrix, pacing, and Excel and PDF export",
          "Tasks link to corporate KPIs, and scorecard progress can be derived from tasks",
        ],
      },
      {
        area: "Tasks & Projects",
        items: [
          "Tasks have serial numbers, weights and a required corporate KPI",
          "Overdue tasks get a warning and a grace period before they fail, with emails at each step",
          "Projects group tasks into EPC plans; assignees are notified and emailed",
          "Portfolio analytics with charts",
        ],
      },
      {
        area: "Meetings",
        items: [
          "KSS presenter department rotates automatically, with a Monday heads-up email",
          "Digital General Meeting attendance with QR check-in",
          "IT is alerted when a meeting reminder fails to send",
        ],
      },
      {
        area: "Attendance",
        items: [
          "NYSC CDS days recognised in attendance",
          "Out-of-station periods can span weekends",
          "Manual attendance overrides can be reverted",
          "Staff photos in the daily roster",
        ],
      },
      {
        area: "HR",
        items: [
          "Job descriptions",
          "A lead can hold more than one department",
          "Employment confirmation date recorded",
        ],
      },
      {
        area: "Everywhere",
        items: [
          "Staff photos shown across leave, help desk, tasks, reports and menus",
          "System satisfaction survey",
          "Sidebar reorganised so the same feature sits under the same heading everywhere",
        ],
      },
    ],
  },
  {
    version: "2026.08",
    title: "Payroll, lunch and the new task system",
    summary:
      "Payroll arrived with payslips, lunch voting launched, leave gained a calendar and attachments, and tasks became weighted and reviewed.",
    areas: [
      {
        area: "Payroll",
        items: [
          "Payroll calculator and gross salary management",
          "Payslips generated as PDF and emailed to staff",
          "Unpaid leave deducted from payroll, with a payroll register and range exports",
        ],
      },
      {
        area: "Lunch",
        items: ["Lunch menu voting", "Anonymous staff reviews of past lunch menus"],
      },
      {
        area: "Leave",
        items: [
          "Leave calendar for HR and department leads",
          "Attach medical evidence and download the handover checklist",
          "Leave counted in working days, not calendar days",
        ],
      },
      {
        area: "Attendance",
        items: [
          "New status: incomplete with permission (IWP), with monthly quotas",
          "Attendance leaderboard",
          "Biometric clock-out no longer overwrites manual statuses",
        ],
      },
      {
        area: "Tasks",
        items: ["Task weights, ratings and review decisions", "Tasks link to goals"],
      },
      {
        area: "PMS & CBT",
        items: [
          "Review cycles kept current automatically, with cadences",
          "Department leads manage their own CBT question bank",
        ],
      },
      {
        area: "Corporate Services",
        items: [
          "Corporate scorecard: 61-KPI register with a RACI cascade",
          "Portfolios with implementation plans and health tracking",
        ],
      },
      {
        area: "Reports",
        items: ["Action tracker gained directives, blockers and evidence"],
      },
      {
        area: "Help Desk & Feedback",
        items: ["Attach files to help desk tickets", "Anonymous feedback addressed to a department lead"],
      },
      {
        area: "Accounts",
        items: ["Accounts section created, and requisitions gained funding categories and an emergency approval route"],
      },
      {
        area: "Tools",
        items: ["Media & PDF suite: download, convert and compress media, and work with PDFs"],
      },
      {
        area: "Email",
        items: ["All system email sent from one sender, with replies routed to the right team"],
      },
    ],
  },
  {
    version: "2026.07",
    title: "ACOB Matrix",
    summary:
      "The ERP was renamed Matrix. Attendance reporting, meeting automation, requisitions and the projects and tasks modules arrived.",
    areas: [
      {
        area: "Brand",
        items: ["Renamed to ACOB Matrix, with new logos"],
      },
      {
        area: "Attendance",
        items: [
          "Daily attendance report emailed to management",
          "Out-of-station periods",
          "Early departure statuses, hourly scoring and early office closure",
        ],
      },
      {
        area: "Meetings",
        items: [
          "Meeting reports and recordings synced automatically",
          "Download meeting recordings; attendance and transcript arrive in one email",
        ],
      },
      {
        area: "Onboarding & HR",
        items: [
          "Employment type chosen during onboarding",
          "Admins and HR leads notified of new onboarding submissions",
          "Staff profile photos",
          "Birthday explorer",
        ],
      },
      {
        area: "Projects & Tasks",
        items: ["Projects and tasks modules", "Requisition system"],
      },
      {
        area: "Correspondence",
        items: ["External references numbered per department, copied with one click"],
      },
      {
        area: "Home",
        items: ["Needs-attention panel on the staff home page"],
      },
      {
        area: "Security",
        items: ["Public self-registration closed; database access tightened"],
      },
    ],
  },
  {
    version: "2026.06",
    title: "Attendance manager, appeals and page-level permissions",
    summary: "Admin access moved to page-level grants, and attendance gained a manager, appeals and a timeline.",
    areas: [
      {
        area: "Admin access",
        items: [
          "Admins are granted individual pages instead of whole areas",
          "Department consoles locked to their own department",
        ],
      },
      {
        area: "Attendance",
        items: [
          "Attendance manager for HR",
          "Manual overrides simplified to leave with pay and absent with permission",
          "Attendance appeals and a per-day timeline",
        ],
      },
      {
        area: "Leave",
        items: ["Leave balance tracking"],
      },
      {
        area: "PMS & CBT",
        items: ["Standalone CBT page with date-of-birth verification", "Refined review cycle metrics"],
      },
      {
        area: "Profile",
        items: ["Redesigned profile page", "ACOBot assistant"],
      },
      {
        area: "Meetings",
        items: ["Scheduled meeting reminders"],
      },
    ],
  },
  {
    version: "2026.05",
    title: "Biometric attendance",
    summary: "The Hikvision clock-in device was connected, so attendance records itself.",
    areas: [
      {
        area: "Attendance",
        items: [
          "Hikvision biometric device connected to Matrix",
          "Clock-out updates on every scan after the first",
          "One rule decides each day's attendance status everywhere",
        ],
      },
      {
        area: "Admin",
        items: ["Department consoles for leads", "Governance controls for admin permissions"],
      },
      {
        area: "Onboarding",
        items: ["Rejected onboarding forms can be resubmitted"],
      },
      {
        area: "Security",
        items: ["Rate limiting on the API"],
      },
    ],
  },
  {
    version: "2026.04",
    title: "Performance management",
    summary: "PMS and CBT tests launched, alongside the birthday page.",
    areas: [
      {
        area: "PMS & CBT",
        items: ["Performance management (PMS) for staff and admins", "CBT tests"],
      },
      {
        area: "HR",
        items: ["Birthday page"],
      },
      {
        area: "Tools",
        items: ["10th anniversary email signature", "Alternate contacts on signatures"],
      },
      {
        area: "Correspondence",
        items: ["Correspondence routes and admin workflows aligned"],
      },
    ],
  },
  {
    version: "2026.03",
    title: "Leave, help desk and correspondence",
    summary:
      "Leave requests, the help desk and the correspondence register went live, and every change started being audited.",
    areas: [
      {
        area: "Leave",
        items: ["Leave requests with approval workflows"],
      },
      {
        area: "Help Desk",
        items: ["Help desk tickets with approvals"],
      },
      {
        area: "Correspondence",
        items: ["Correspondence register with reference numbers"],
      },
      {
        area: "HR",
        items: ["Resource booking (fleet)", "Office locations"],
      },
      {
        area: "Reports",
        items: [
          "Weekly reports lock after the deadline, with a 24-hour grace period",
          "KSS roster and meeting document library",
          "Uploads restricted to PDF",
        ],
      },
      {
        area: "Notifications",
        items: ["Notifications page"],
      },
      {
        area: "Security",
        items: ["Every change is recorded in the audit log", "Full security and performance audit fixed"],
      },
    ],
  },
  {
    version: "2026.02",
    title: "Secure sign-in, weekly reports and meeting mail",
    summary: "Account activation and the weekly report cycle arrived, together with meeting reminders and broadcasts.",
    areas: [
      {
        area: "Sign-in",
        items: ["First-time password setup with a 6-digit code", "Secure account activation and onboarding approval"],
      },
      {
        area: "Reports",
        items: ["Weekly reports and the action tracker", "One export format for reports"],
      },
      {
        area: "Communications",
        items: [
          "Mailing system and broadcasts",
          "Meeting reminders, including the knowledge-sharing presenter",
          "Secondary email recipients",
        ],
      },
      {
        area: "Security",
        items: ["Database security audit fixed"],
      },
    ],
  },
  {
    version: "2026.01",
    title: "From signature tool to ERP",
    summary:
      "The app grew from a signature tool into a company ERP, with HR, finance, inventory, purchasing and settings.",
    areas: [
      {
        area: "New modules",
        items: [
          "HR: employees and departments",
          "Finance: bills and expenses",
          "Inventory: products and categories",
          "Purchasing: suppliers and orders",
          "Settings: company, users and roles",
          "Employee portal",
          "CRM",
        ],
      },
      {
        area: "Employees",
        items: ["Employee numbers, required for new users", "Employee status management"],
      },
      {
        area: "Reports",
        items: ["Staff assets report export"],
      },
      {
        area: "Everywhere",
        items: ["Pages load faster, rendered on the server"],
      },
    ],
  },
  {
    version: "2025.12",
    title: "Payments and staff management",
    summary: "Payments arrived, and staff management and the signature and watermark tools improved.",
    areas: [
      {
        area: "Payments",
        items: ["Payment tracking with dashboard stats, print and export"],
      },
      {
        area: "Staff",
        items: ["Better staff management", "Searchable multi-select pickers"],
      },
      {
        area: "Tools",
        items: ["Signature creator updates", "Watermark presets and custom file names"],
      },
      {
        area: "Everywhere",
        items: ["Maintenance page for planned downtime", "Mobile layout improvements"],
      },
    ],
  },
  {
    version: "2025.11",
    title: "Assets, projects and audit logs",
    summary: "Asset management, projects and the audit log were added.",
    areas: [
      {
        area: "Assets",
        items: [
          "Asset management: assign assets to staff or departments",
          "Every asset has a unique code",
          "Asset issues tracker",
        ],
      },
      {
        area: "Projects",
        items: ["Projects management"],
      },
      {
        area: "Audit Logs",
        items: ["Audit log of who changed what, with a details view"],
      },
      {
        area: "Sign-in",
        items: ["Forgot password"],
      },
      {
        area: "Everywhere",
        items: ["Mobile layouts across pages", "Buttons show progress while working"],
      },
    ],
  },
  {
    version: "2025.10",
    title: "Where it started",
    summary: "ACOB Signature Creator went live on 30 October 2025.",
    areas: [
      {
        area: "Tools",
        items: ["Email signature creator for ACOB staff", "Watermark tool with drag-and-drop"],
      },
    ],
  },
]

/** "2026.10" → "October 2026". */
export function releaseMonthLabel(version: string): string {
  return formatWATDate(`${version.replace(".", "-")}-15T12:00:00+01:00`, { month: "long", year: "numeric" })
}
