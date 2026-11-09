import type { ElementType } from "react"
import {
  ClipboardList,
  FileBarChart,
  FileText,
  Landmark,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageSquare,
  Target,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react"
import { deptRelativePath, isDeptPathAllowed } from "@/lib/dept/delegated-pages"
import { pmsNavChildren } from "@/lib/pms/sections"
import type { NavChild } from "@/lib/nav/types"

export type NavItem = {
  section: string
  name: string
  href: string
  icon: ElementType
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
    },
    {
      section: "management",
      name: "HR",
      description: "Human Resources",
      href: `${base}/hr`,
      icon: Users,
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
      children: pmsNavChildren(`${base}/pms`),
    },
    {
      section: "management",
      name: "Accounts",
      href: `${base}/accounts`,
      icon: Landmark,
      children: [
        { name: "Requisitions", href: `${base}/accounts/requisitions` },
        { name: "Assets", href: `${base}/assets` },
      ],
    },
    {
      section: "management",
      name: "Corporate Services",
      href: `${base}/corporate-services`,
      icon: Target,
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
    },
    {
      section: "operations",
      name: "Help Desk",
      href: `${base}/help-desk`,
      icon: Ticket,
    },
    {
      section: "operations",
      name: "Reports",
      href: `${base}/reports`,
      icon: FileBarChart,
      children: [{ name: "Weekly", href: `${base}/reports/weekly-reports` }],
    },
    {
      section: "operations",
      name: "Correspondence",
      href: `${base}/correspondence`,
      icon: Mail,
    },
    {
      section: "operations",
      name: "Communications",
      href: `${base}/communications`,
      icon: Megaphone,
      children: [{ name: "Broadcast", href: `${base}/communications/broadcast` }],
    },
    {
      section: "operations",
      name: "Documentation",
      href: `${base}/documentation`,
      icon: FileText,
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
    },
  ]
}

/**
 * What a delegate sees of the department console: only the pages they were given. A group with
 * nothing allowed disappears; one that is reachable only through a child links to that child.
 */
export function filterDeptNavigationForDelegate(items: NavItem[], pages: string[]): NavItem[] {
  const allowed = (href: string) => isDeptPathAllowed(pages, deptRelativePath(href))
  return items.reduce<NavItem[]>((kept, item) => {
    const children = item.children?.filter((child: NavChild) => allowed(child.href))
    const selfAllowed = allowed(item.href)
    if (!selfAllowed && !children?.length) return kept
    kept.push({
      ...item,
      href: selfAllowed ? item.href : children![0].href,
      retargeted: !selfAllowed,
      children: children?.length ? children : undefined,
    })
    return kept
  }, [])
}
