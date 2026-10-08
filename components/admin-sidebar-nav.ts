import Link from "next/link"
import {
  Briefcase,
  CalendarDays,
  LayoutDashboard,
  ClipboardList,
  Ticket,
  FileText,
  Landmark,
  MessageSquare,
  Settings,
  FileBarChart,
  FileCode2,
  Megaphone,
  ShieldCheck,
  FlaskConical,
  Users,
  Layers,
  Target,
  TrendingUp,
} from "lucide-react"
import { mdDeskNavChildren } from "@/components/md-desk/sections"
import { pmsNavChildren } from "@/lib/pms/sections"
import type { NavChild, RouteAliases } from "@/lib/nav/types"
import { GRANTABLE_ADMIN_ROUTES, type AdminRouteKeyV2 } from "@/lib/admin/policy-v2"

/** Admin and department-console sidebar navigation: the item tree, route aliases and route-key mapping. Split from admin-sidebar.tsx (audit 6.1). */
/**
 * Builds dept-scoped navigation for the /dept/[deptId]/ shell.
 * Hrefs point to /dept/[id]/... so clicking a nav item stays in the dept shell.
 *
 * What belongs here: the admin nav, minus anything org-wide. A department lead
 * manages their own department, so a domain is included when it can be
 * meaningfully scoped to one department and left out when it cannot. That is
 * why HR is here but its Departments child is not, and why these are absent:
 *
 *  - Settings, System & Security, Developer — org-wide by definition.
 *  - Notifications, Events, Tools, Corporate Services — single org-wide
 *    consoles with nothing department-shaped to scope to.
 *  - Portfolios, Projects, Purchasing, Inventory — cross-department by nature;
 *    a portfolio or a purchase order does not belong to one department.
 *
 * Add a domain here only once its pages exist under /dept/[dept_id]/ and its
 * queries are scoped by requireDeptScope.
 */
export function buildDeptNavigation(deptId: string): NavItem[] {
  const base = `/dept/${deptId}`
  return [
    {
      section: "overview",
      name: "Dashboard",
      href: base,
      icon: LayoutDashboard,
      roles: [],
    },
    {
      section: "management",
      name: "HR",
      description: "Human Resources",
      href: `${base}/hr`,
      icon: Users,
      roles: [],
      children: [
        { name: "Employees", href: `${base}/hr/employees` },
        // No "Departments" here — the dept shell is already scoped to one
        // department, so the org-wide department list belongs to /admin only.
        { name: "Attendance", href: `${base}/hr/attendance` },
        { name: "Leave", href: `${base}/hr/leave` },
        { name: "Offices & Rooms", href: `${base}/hr/offices-rooms` },
      ],
    },
    {
      section: "management",
      name: "PMS",
      description: "Performance Management System",
      href: `${base}/pms`,
      icon: TrendingUp,
      roles: [],
      children: pmsNavChildren(`${base}/pms`),
    },
    {
      section: "management",
      name: "Accounts",
      href: `${base}/accounts`,
      icon: Landmark,
      roles: [],
      children: [
        { name: "Requisitions", href: `${base}/accounts/requisitions` },
        { name: "Payments", href: `${base}/accounts/payments` },
        { name: "Bills", href: `${base}/accounts/bills` },
        { name: "Invoices", href: `${base}/accounts/invoices` },
        { name: "Finance Reports", href: `${base}/accounts/reports` },
        {
          name: "Assets",
          href: `${base}/assets`,
          children: [{ name: "Issues", href: `${base}/assets/issues` }],
        },
      ],
    },
    {
      section: "management",
      name: "Corporate Services",
      href: `${base}/corporate-services`,
      icon: Target,
      roles: [],
      children: [
        { name: "Scorecard", href: `${base}/corporate-services/scorecard` },
        { name: "Risk Register", href: `${base}/corporate-services/risk-register` },
      ],
    },
    {
      section: "operations",
      name: "Tasks",
      href: `${base}/tasks`,
      icon: ClipboardList,
      roles: [],
    },
    {
      section: "operations",
      name: "Help Desk",
      href: `${base}/help-desk`,
      icon: Ticket,
      roles: [],
    },
    {
      section: "operations",
      name: "Reports",
      href: `${base}/reports`,
      icon: FileBarChart,
      roles: [],
      children: [{ name: "Weekly", href: `${base}/reports/weekly-reports` }],
    },
    {
      section: "operations",
      name: "Correspondence",
      href: `${base}/correspondence`,
      icon: FileCode2,
      roles: [],
    },
    {
      section: "operations",
      name: "Communications",
      href: `${base}/communications`,
      icon: Megaphone,
      roles: [],
      children: [{ name: "Broadcast", href: `${base}/communications/broadcast` }],
    },
    {
      section: "operations",
      name: "Documentation",
      href: `${base}/documentation`,
      icon: FileText,
      roles: [],
      children: [
        { name: "Policies", href: `${base}/documentation/policies` },
        { name: "SOPs", href: `${base}/documentation/sops` },
        { name: "Personal", href: `${base}/documentation/personal` },
        { name: "Department", href: `${base}/documentation/department` },
      ],
    },
    {
      section: "operations",
      name: "Feedback",
      href: `${base}/feedback`,
      icon: MessageSquare,
      roles: [],
    },
  ]
}

export function normalizeAdminRoutes(routes: string[] | null | undefined): AdminRouteKeyV2[] {
  if (!Array.isArray(routes)) return []
  return Array.from(
    new Set(
      routes
        .map((value) =>
          String(value || "")
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    )
  ).filter((value): value is AdminRouteKeyV2 => GRANTABLE_ADMIN_ROUTES.includes(value as AdminRouteKeyV2))
}

export type NavItem = {
  section: string
  name: string
  href: string
  icon: React.ElementType
  roles: string[]
  /** Expansion or gloss for an abbreviated name, shown on hover. */
  description?: string
  children?: NavChild[]
  /**
   * The viewer cannot open this branch's own page, so `href` was retargeted to
   * the first descendant they can reach. The expanded row then toggles instead
   * of navigating — following it would land on a page whose name does not match
   * the label. The collapsed rail still uses `href`, since toggling is not
   * available there.
   */
  retargeted?: boolean
  badge?: number
}

/**
 * Management runs people -> performance -> money -> what the money bought ->
 * delivery -> governance, and Operations runs day-to-day work first, then the
 * things that report on it. navigationSections in sidebar.tsx lists the same
 * items in the same relative order; keep them in step.
 *
 * Purchasing and Inventory sit inside Accounts rather than beside it, so the
 * accounts -> purchase -> stock workflow reads as one node. They keep their own
 * grantable route keys, and filterNavChildren gates each one separately, so a
 * viewer granted only inventory.main still sees Inventory and nothing else —
 * with the Accounts row rendering as a toggle rather than a link, since it
 * would otherwise point at a page whose name does not match the label.
 */
export const adminNavigation: NavItem[] = [
  {
    section: "overview",
    name: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    roles: ["developer", "super_admin", "admin"],
  },
  {
    // Shown to the MD, delegates, super admins and developers (showMdDesk); the page re-checks.
    section: "management",
    name: "MD's Desk",
    href: "/admin/md-desk",
    icon: Briefcase,
    roles: ["developer", "super_admin", "admin"],
    children: mdDeskNavChildren("/admin/md-desk"),
  },
  {
    section: "management",
    name: "HR",
    description: "Human Resources",
    href: "/admin/hr",
    icon: Users,
    roles: ["developer", "super_admin", "admin"],
    children: [
      { name: "Employees", href: "/admin/hr/employees" },
      { name: "Departments", href: "/admin/hr/departments" },
      { name: "Job Descriptions", href: "/admin/hr/job-descriptions" },
      { name: "Attendance", href: "/admin/hr/attendance" },
      { name: "Leave", href: "/admin/hr/leave" },
      { name: "Lunch Register", href: "/admin/hr/lunch" },
      { name: "Resource Booking", href: "/admin/hr/resources" },
      { name: "Offices & Rooms", href: "/admin/hr/offices-rooms" },
    ],
  },
  {
    // Split out of HR — it had grown to 11 sub-items nested three levels
    // deep. Routes are unchanged (still /admin/pms/*), only the sidebar
    // grouping moved.
    section: "management",
    name: "PMS",
    description: "Performance Management System",
    href: "/admin/pms",
    icon: TrendingUp,
    roles: ["developer", "super_admin", "admin"],
    children: pmsNavChildren("/admin/pms"),
  },
  {
    // Accounts also surfaces Purchasing, Inventory and Assets as nested groups
    // so the financial workflow (accounts → purchase → stock → what it bought)
    // is one coherent node rather than four separate top-level items. This
    // matches the staff sidebar, which has always listed Assets under Accounts.
    section: "management",
    name: "Accounts",
    href: "/admin/accounts",
    icon: Landmark,
    roles: ["developer", "super_admin", "admin"],
    children: [
      { name: "Requisitions", href: "/admin/accounts/requisitions" },
      { name: "Payments", href: "/admin/accounts/payments" },
      { name: "Bills", href: "/admin/accounts/bills" },
      { name: "Invoices", href: "/admin/accounts/invoices" },
      { name: "Payroll", href: "/admin/payroll" },
      { name: "Finance Reports", href: "/admin/accounts/reports" },
      {
        name: "Purchasing",
        href: "/admin/purchasing",
        children: [
          { name: "Orders", href: "/admin/purchasing/orders" },
          { name: "Receipts", href: "/admin/purchasing/receipts" },
          { name: "Suppliers", href: "/admin/purchasing/suppliers" },
        ],
      },
      {
        name: "Inventory",
        href: "/admin/inventory",
        children: [
          { name: "Products", href: "/admin/inventory/products" },
          { name: "Categories", href: "/admin/inventory/categories" },
          { name: "Warehouses", href: "/admin/inventory/warehouses" },
          { name: "Movements", href: "/admin/inventory/movements" },
        ],
      },
      {
        name: "Assets",
        href: "/admin/assets",
        children: [{ name: "Issues", href: "/admin/assets/issues" }],
      },
    ],
  },
  {
    section: "management",
    name: "Portfolios",
    href: "/admin/portfolios",
    icon: Layers,
    roles: ["developer", "super_admin", "admin"],
    children: [
      { name: "Portfolios", href: "/admin/portfolios" },
      { name: "Projects", href: "/admin/projects" },
    ],
  },
  {
    section: "management",
    name: "Corporate Services",
    href: "/admin/corporate-services",
    icon: Target,
    roles: ["developer", "super_admin", "admin"],
    children: [
      { name: "Scorecard", href: "/admin/corporate-services/scorecard" },
      { name: "Risk Register", href: "/admin/corporate-services/risk-register" },
    ],
  },
  {
    // Operations, not Management: tasks are day-to-day work, and the staff shell
    // has always listed them there.
    section: "operations",
    name: "Tasks",
    href: "/admin/tasks",
    icon: ClipboardList,
    roles: ["developer", "super_admin", "admin"],
  },
  {
    section: "operations",
    name: "Help Desk",
    href: "/admin/help-desk",
    icon: Ticket,
    roles: ["developer", "super_admin", "admin"],
  },
  {
    section: "operations",
    name: "Events",
    href: "/admin/events",
    icon: CalendarDays,
    roles: ["developer", "super_admin", "admin"],
  },
  {
    section: "operations",
    name: "Reports",
    href: "/admin/reports",
    icon: FileBarChart,
    roles: ["developer", "super_admin", "admin"],
    children: [
      {
        name: "General Meeting",
        href: "/admin/reports/general-meeting",
        children: [
          { name: "Attendance", href: "/admin/reports/general-meeting/attendance" },
          { name: "Action Tracker", href: "/admin/reports/general-meeting/action-tracker" },
          { name: "Challenges", href: "/admin/reports/general-meeting/challenges" },
          { name: "KSS", href: "/admin/reports/general-meeting/kss" },
          { name: "Minutes", href: "/admin/reports/general-meeting/minutes-of-meeting" },
          { name: "Weekly", href: "/admin/reports/general-meeting/weekly-reports" },
          { name: "Records", href: "/admin/reports/general-meeting/records" },
        ],
      },
    ],
  },
  {
    section: "operations",
    name: "Correspondence",
    href: "/admin/correspondence",
    icon: FileCode2,
    roles: ["developer", "super_admin", "admin"],
  },
  {
    section: "operations",
    name: "Communications",
    href: "/admin/communications",
    icon: Megaphone,
    roles: ["developer", "super_admin", "admin"],
    children: [
      { name: "Broadcast", href: "/admin/communications/broadcast" },
      {
        // Not to be confused with Reports > General Meeting, which is the
        // reports themselves. This branch is the mail-out and the reminders
        // that go with them.
        name: "Meeting Mail",
        href: "/admin/communications/meetings",
        children: [
          { name: "Report Mail-out", href: "/admin/communications/meetings/mail" },
          { name: "Reminders", href: "/admin/communications/meetings/reminders" },
        ],
      },
    ],
  },
  {
    section: "operations",
    name: "Documentation",
    href: "/admin/documentation",
    icon: FileText,
    roles: ["developer", "super_admin", "admin"],
    children: [
      { name: "Policies", href: "/admin/documentation/policies" },
      { name: "SOPs", href: "/admin/documentation/sops" },
      { name: "Personal", href: "/admin/documentation/personal" },
      { name: "Department", href: "/admin/documentation/department" },
    ],
  },
  {
    section: "compliance",
    name: "System & Security",
    href: "/admin/security",
    icon: ShieldCheck,
    roles: ["developer", "super_admin", "admin"],
    children: [
      { name: "Audit Logs", href: "/admin/audit-logs" },
      { name: "Network Activity", href: "/admin/security/network-activity" },
      { name: "Bypass & Override", href: "/admin/security/bypass-override" },
    ],
  },
  {
    section: "compliance",
    name: "Settings",
    href: "/admin/settings",
    icon: Settings,
    roles: ["developer", "super_admin", "admin"],
    children: [
      { name: "Users", href: "/admin/settings/users" },
      // Lists every account and its sign-in state, and resolves to settings.main
      // for exactly that reason. It sat under HR, where its visibility was
      // controlled by a grant unrelated to the item it appeared beside.
      { name: "Onboarding", href: "/admin/onboarding" },
      { name: "Roles", href: "/admin/settings/roles" },
      { name: "Company", href: "/admin/settings/company" },
      { name: "Attendance", href: "/admin/settings/attendance" },
      { name: "CBT", href: "/admin/settings/cbt" },
      { name: "Mail", href: "/admin/settings/mail" },
      { name: "Maintenance", href: "/admin/settings/maintenance" },
    ],
  },
  {
    // Its own collapsible item under Compliance. Developer-only —
    // /admin/dev resolves to dev.main, which canAccessRouteV2 gates to the
    // developer role, so the whole branch is hidden from admin / super_admin.
    section: "compliance",
    name: "Developer",
    href: "/admin/dev",
    icon: FlaskConical,
    roles: ["developer"],
    children: [
      { name: "Login Logs", href: "/admin/dev/login-logs" },
      { name: "Role Escalations", href: "/admin/dev/role-escalations" },
      { name: "Security Events", href: "/admin/dev/security-events" },
      { name: "Impersonation", href: "/admin/dev/impersonation" },
      { name: "UI Errors", href: "/admin/dev/ui-errors" },
      { name: "Tests", href: "/admin/dev/tests" },
      { name: "ACOBot", href: "/admin/dev/acobot" },
    ],
  },
]
export const adminSections = [
  { key: "overview", label: "Overview" },
  { key: "management", label: "Management" },
  { key: "operations", label: "Operations" },
  { key: "compliance", label: "Compliance" },
]

export const ADMIN_ROUTE_ALIASES: RouteAliases = {
  // Accounts — legacy /admin/finance and /admin/payments/* redirect into accounts.
  "/admin/accounts": ["/admin/finance", "/admin/payments"],
  "/admin/finance": ["/admin/payments"],
  // Corporate Services — legacy /admin/corporate-scorecard redirects into scorecard.
  "/admin/corporate-services": ["/admin/corporate-scorecard"],
}
