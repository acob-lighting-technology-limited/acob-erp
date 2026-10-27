/**
 * Matrix version history, shown at /admin/version-history.
 *
 * One release per calendar month, versioned YYYY.MM. Matrix ships continuously,
 * so a month is the honest unit: there is no release train to number, and a
 * hand-bumped semver would stop meaning anything within weeks.
 *
 * Releases before 2026.10 were backfilled from git history on 2026-10-26.
 *
 * When a change ships, add a line to the current month's release (start a new
 * release at the TOP when the month turns). Write what staff or admins will
 * notice and can now do, not how it was built: no refactors, lint fixes or
 * migrations. A change big enough to announce also gets an entry in
 * lib/whats-new.ts, which drives the one-time staff popup.
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
    version: "2026.10",
    title: "Security, mailboxes and requisitions",
    summary:
      "A full security audit was fixed end to end, requisitions were rebuilt, and staff mailboxes can now be run from inside Matrix.",
    areas: [
      {
        area: "Security",
        items: [
          "Fixed the findings of the October security audit: closed privilege escalation paths, checked every form submission, and stopped raw database errors reaching the screen",
          "Admins are alerted when someone changes the database outside Matrix",
          "Built-in error monitor that groups errors across users so problems are spotted early",
        ],
      },
      {
        area: "Requisitions & Payments",
        items: [
          "Requisitions rebuilt with petty cash, approval routing and signing",
          "Requisitions can be signed or rejected straight from the table, with a count on each tab",
          "Any payment can be charged to a project; payment requests now need a cost category and site location",
          "Payments split into All, Recurring and One-time tabs",
          "Paid payments, paid requisitions, approved fleet documents and resolved help desk attachments are archived to SharePoint automatically",
        ],
      },
      {
        area: "Mailboxes",
        items: [
          "Create, suspend, restore and forward staff mailboxes from Matrix, and reset mailbox passwords",
          "Admin Mailboxes page with storage usage and alerts when a mailbox is nearly full",
          "Staff email updates automatically when a name is edited",
          "Staff can set up their work email on their phone and copy their ACOB signature from the profile page",
        ],
      },
      {
        area: "Starlink & Sites",
        items: [
          "Starlink kits page, with billing emails filed against kit payments automatically",
          "Chosen staff are alerted when a Starlink payment fails or falls due",
          "Sites register under Portfolios; mini-grid projects link to their Starlink kits",
        ],
      },
      {
        area: "Attendance",
        items: [
          "Attendance change log showing every edit to a record",
          "Staff are told when the clock-in device is offline",
          "Attendance appeals now need both the lead and HR, with clear badges for who is pending",
          "Time physically in the office is shown separately from official credited hours",
          "Attendance is reconciled every hour, and the device retries punches that did not save",
          "Remote check-in removed",
        ],
      },
      {
        area: "Leave",
        items: [
          "Leave waiting for the MD is no longer cancelled automatically",
          "Multiple employees in the same department can now apply for overlapping leave without being blocked, with soft overlap notices shown to applicants and approvers",
        ],
      },
      {
        area: "Notifications",
        items: [
          "Notifications sorted into Needs you, Updates and Announcements",
          "Phone push notifications are sent only for things that need action",
          "What's New popup tells staff about changes the first time they log in after one ships",
        ],
      },
      {
        area: "Reports & Meetings",
        items: [
          "Weekly PowerPoint export shows task and action point counts for every staff member",
          "Weekly KSS and General Meeting appear on the calendar with the Teams link",
        ],
      },
      {
        area: "Staff & Profile",
        items: [
          "Tap any staff photo to open their contact card",
          "Staff without a photo are prompted to upload one",
          "In-app Matrix guide behind the ? icon in the top bar",
          "Redesigned birthday poster",
        ],
      },
      {
        area: "Lunch",
        items: ["Share the lunch menu to WhatsApp", "Staff can hide their name on lunch votes"],
      },
      {
        area: "PMS & CBT",
        items: ["Corporate KPIs have a plan year with a year picker", "Upload CBT questions in bulk from Excel or CSV"],
      },
      {
        area: "Tools",
        items: [
          "All ten PDF tools, including compress, OCR and passwords, now work on your device with no file size limit",
          "Media downloads stream straight to the download manager",
        ],
      },
      {
        area: "Everywhere",
        items: [
          "Detail views open as a side panel instead of a pop-up",
          "Every dialog becomes a bottom sheet on phones",
          "Data tables can export what they show",
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
