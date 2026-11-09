import type { ReactNode } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { AlertTriangle, CalendarClock, ClipboardList, Clock, Stamp, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageWrapper, PageHeader, Section } from "@/components/layout"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { RecentActivityFeed } from "@/components/admin/recent-activity-feed"
import { ActionQueue } from "@/components/admin/action-queue"
import { AwayToday } from "@/components/admin/away-today"
import type { DashboardData } from "@/lib/admin/dashboard-data"
import { ADMIN_BASE, shellBackHref, shellHref } from "@/lib/dept/shell-links"

interface DashboardViewProps {
  data: DashboardData
  title: string
  description: string
  icon: LucideIcon
  /** "/admin" or "/dept/<id>": the shell every link on the page stays inside. */
  basePath: string
  /** Whether the viewer may open this `/admin/…` route; rows and buttons they cannot open are left out. */
  canAccess: (adminHref: string) => boolean
  showAuditActivity: boolean
  /** Extra stats a shell wants beside the shared "Today" row (rendered under it). */
  extraStats?: ReactNode
}

const HEADER_LINKS = [
  { href: "/admin/hr/employees", label: "Manage Employees", variant: "default" as const },
  { href: "/admin/tasks", label: "Review Tasks", variant: "outline" as const },
  { href: "/admin/reports", label: "Open Reports", variant: "outline" as const },
]

/**
 * The dashboard for /admin and /dept/[dept_id]. Both pages are thin wrappers over this, so a change to the
 * layout reaches both. Links are written as `/admin/…` and rewritten into the current shell here.
 */
export function DashboardView({
  data,
  title,
  description,
  icon,
  basePath,
  canAccess,
  showAuditActivity,
  extraStats,
}: DashboardViewProps) {
  const queue = data.actionQueue
    .filter((item) => canAccess(item.href))
    // A page the dept console lacks falls back to its nearest ancestor (help desk management -> help desk).
    .map((item) => ({ ...item, href: shellBackHref(item.href, basePath) }))
  const headerLinks = HEADER_LINKS.filter((link) => canAccess(link.href)).flatMap((link) => {
    const href = shellHref(link.href, basePath)
    return href ? [{ ...link, href }] : []
  })

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title={title}
        description={description}
        icon={icon}
        actions={
          <>
            {headerLinks.map((link) => (
              <Button key={link.href} asChild size="sm" variant={link.variant}>
                <Link href={link.href}>{link.label}</Link>
              </Button>
            ))}
          </>
        }
      />

      {/* StatGrid keeps the first three on a phone, so source order is the mobile priority. */}
      <Section title="Today" description="Live counts for the people and work in your scope.">
        <StatGrid>
          <StatCard
            variant="compact"
            title="Clocked In Today"
            value={data.clockedInCount}
            description={`of ${data.activeStaffCount} active staff`}
            icon={Clock}
            iconBgColor="bg-info/15"
            iconColor="text-info"
          />
          <StatCard
            variant="compact"
            title="Overdue Tasks"
            value={data.overdueTaskCount}
            description={data.overdueTaskCount > 0 ? "Past their deadline" : "Nothing overdue"}
            icon={AlertTriangle}
            iconBgColor={data.overdueTaskCount > 0 ? "bg-danger/15" : "bg-muted"}
            iconColor={data.overdueTaskCount > 0 ? "text-danger" : "text-muted-foreground"}
          />
          <StatCard
            variant="compact"
            title="Pending Leave"
            value={data.pendingLeaveCount}
            description="Requests not yet decided"
            icon={CalendarClock}
            iconBgColor="bg-warning/15"
            iconColor="text-warning"
          />
          <StatCard
            variant="compact"
            title="Open Tasks"
            value={data.openTaskCount}
            description="Pending, in progress, in review or blocked"
            icon={ClipboardList}
            iconBgColor="bg-success/15"
            iconColor="text-success"
          />
          <StatCard
            variant="compact"
            title="Active Staff"
            value={data.activeStaffCount}
            description="Current employees"
            icon={Users}
            iconBgColor="bg-purple/15"
            iconColor="text-purple"
          />
        </StatGrid>
      </Section>

      {extraStats}

      {/* 2x2 on desktop with every row the same height; each card scrolls inside
          it instead of leaving the grid ragged. Phones stack at natural height. */}
      <div className="grid grid-cols-1 gap-6 lg:auto-rows-[400px] lg:grid-cols-2">
        {showAuditActivity && (
          <RecentActivityFeed
            activity={data.recentActivity}
            showViewAll={basePath === ADMIN_BASE && canAccess("/admin/audit-logs")}
            basePath={basePath}
          />
        )}
        <ActionQueue
          title="Pending approvals"
          icon={Stamp}
          items={queue.filter((item) => item.group === "approvals")}
          emptyTitle="No approvals waiting"
          emptyDescription="Leave, appeals, requisitions and sign-ups awaiting a decision will appear here."
        />
        <ActionQueue
          title="Needs attention"
          icon={AlertTriangle}
          items={queue.filter((item) => item.group === "attention")}
          emptyTitle="Nothing overdue or stuck"
          emptyDescription="Overdue tasks, due payments and open tickets will appear here."
        />
        <AwayToday items={data.awayToday} todayIso={data.todayIso} />
      </div>
    </PageWrapper>
  )
}
