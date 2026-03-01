import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  Users,
  Package,
  ClipboardList,
  FileText,
  MessageSquare,
  ScrollText,
  Briefcase,
  ArrowRight,
  Shield,
  CreditCard,
  FolderKanban,
  AlertTriangle,
  AlertCircle,
  Info,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn, formatName } from "@/lib/utils"
import { PageWrapper, PageHeader, Section } from "@/components/layout"
import { StatCard } from "@/components/ui/stat-card"

type NotificationType = "error" | "warning" | "info"

interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: string
  link: string
  linkText: string
}

interface ModuleAction {
  title: string
  description: string
  href: string
  icon: LucideIcon
  color: string
  roles: string[]
}

interface RecentActivityItem {
  id: string
  actorName: string
  actionLabel: string
  moduleLabel: string
  moduleKey: string
  createdAt: string
}

const notificationPriority: Record<NotificationType, number> = {
  error: 0,
  warning: 1,
  info: 2,
}

const notificationStyles: Record<
  NotificationType,
  { cardClass: string; badgeClass: string; icon: LucideIcon; label: string }
> = {
  error: {
    cardClass: "border-red-200/70 bg-red-50/70 dark:border-red-900/50 dark:bg-red-950/25",
    badgeClass: "border-red-300 text-red-700 dark:border-red-800 dark:text-red-300",
    icon: AlertCircle,
    label: "Critical",
  },
  warning: {
    cardClass: "border-amber-200/70 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/25",
    badgeClass: "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300",
    icon: AlertTriangle,
    label: "Attention",
  },
  info: {
    cardClass: "border-blue-200/70 bg-blue-50/70 dark:border-blue-900/50 dark:bg-blue-950/25",
    badgeClass: "border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300",
    icon: Info,
    label: "Info",
  },
}

const activityRouteMap: Record<string, string> = {
  task: "/admin/tasks",
  tasks: "/admin/tasks",
  feedback: "/admin/feedback",
  profile: "/admin/hr/employees",
  profiles: "/admin/hr/employees",
  pending_user: "/admin/hr/employees",
  pending_users: "/admin/hr/employees",
  department_payments: "/admin/finance/payments",
  payment_documents: "/admin/finance/payments",
  help_desk_ticket: "/admin/help-desk",
  help_desk_tickets: "/admin/help-desk",
  correspondence_record: "/admin/correspondence",
  correspondence_records: "/admin/correspondence",
  asset: "/admin/assets",
  assets: "/admin/assets",
  asset_assignment: "/admin/assets",
  asset_assignments: "/admin/assets",
  project: "/admin/projects",
  projects: "/admin/projects",
  audit_log: "/admin/audit-logs",
  audit_logs: "/admin/audit-logs",
}

const primaryModules: ModuleAction[] = [
  {
    title: "HR Administration",
    description: "Manage leave, attendance, and performance",
    href: "/admin/hr",
    icon: Users,
    color: "bg-teal-500",
    roles: ["super_admin", "admin", "lead"],
  },
  {
    title: "Task Management",
    description: "Create and assign tasks to employees",
    href: "/admin/tasks",
    icon: ClipboardList,
    color: "bg-green-500",
    roles: ["super_admin", "admin", "lead"],
  },
  {
    title: "Help Desk",
    description: "Manage support tickets, approvals, and SLA tracking",
    href: "/admin/help-desk",
    icon: ClipboardList,
    color: "bg-emerald-500",
    roles: ["super_admin", "admin", "lead"],
  },
  {
    title: "Correspondence",
    description: "Track incoming/outgoing letters and approval workflow",
    href: "/admin/correspondence",
    icon: FileText,
    color: "bg-violet-500",
    roles: ["super_admin", "admin", "lead"],
  },
  {
    title: "Reports",
    description: "Monitor performance, delivery, and operational outputs",
    href: "/admin/reports",
    icon: FileText,
    color: "bg-orange-500",
    roles: ["super_admin", "admin", "lead"],
  },
  {
    title: "Finance",
    description: "Review finance modules and payment operations",
    href: "/admin/finance",
    icon: CreditCard,
    color: "bg-indigo-500",
    roles: ["super_admin", "admin", "lead"],
  },
  {
    title: "Projects",
    description: "Track projects, owners, and current execution status",
    href: "/admin/projects",
    icon: FolderKanban,
    color: "bg-fuchsia-500",
    roles: ["super_admin", "admin", "lead"],
  },
]

const secondaryModules: ModuleAction[] = [
  {
    title: "Employee Management",
    description: "View and manage all employees",
    href: "/admin/hr/employees",
    icon: Users,
    color: "bg-blue-500",
    roles: ["super_admin", "admin", "lead"],
  },
  {
    title: "Asset Management",
    description: "Manage asset inventory and assignments",
    href: "/admin/assets",
    icon: Package,
    color: "bg-purple-500",
    roles: ["super_admin", "admin", "lead"],
  },
  {
    title: "Documentation",
    description: "View all employee documentation",
    href: "/admin/documentation",
    icon: FileText,
    color: "bg-orange-500",
    roles: ["super_admin", "admin", "lead"],
  },
  {
    title: "Job Descriptions",
    description: "View employee job descriptions",
    href: "/admin/job-descriptions",
    icon: Briefcase,
    color: "bg-pink-500",
    roles: ["super_admin", "admin", "lead"],
  },
  {
    title: "Feedback Management",
    description: "Review and respond to feedback",
    href: "/admin/feedback",
    icon: MessageSquare,
    color: "bg-cyan-500",
    roles: ["super_admin", "admin", "lead"],
  },
  {
    title: "Audit Logs",
    description: "View system activity logs",
    href: "/admin/audit-logs",
    icon: ScrollText,
    color: "bg-red-500",
    roles: ["super_admin", "admin", "lead"],
  },
  {
    title: "Payments",
    description: "Manage department payments",
    href: "/admin/finance/payments",
    icon: CreditCard,
    color: "bg-indigo-500",
    roles: ["super_admin", "admin", "lead"],
  },
]

function normalizeToken(value?: string | null): string {
  if (!value) return ""
  return value.trim().toLowerCase().replace(/\s+/g, "_")
}

function humanizeToken(value?: string | null, fallback = "System"): string {
  if (!value) return fallback
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function resolveActivityRoute(moduleKey: string): string {
  return activityRouteMap[moduleKey] || "/admin/audit-logs"
}

function pickObject(value: any): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value
}

function extractChangedFields(item: any): string[] {
  const directFields = Array.isArray(item.changed_fields) ? item.changed_fields : []
  const metadataFields = Array.isArray(item?.metadata?.changed_fields) ? item.metadata.changed_fields : []
  const newValues = pickObject(item.new_values || item?.metadata?.new_values)
  const oldValues = pickObject(item.old_values || item?.metadata?.old_values)
  const fromValues = Array.from(new Set([...Object.keys(newValues), ...Object.keys(oldValues)]))

  const ignored = new Set([
    "id",
    "created_at",
    "updated_at",
    "user_id",
    "entity_id",
    "record_id",
    "table_name",
    "action",
    "operation",
  ])

  const merged = [...directFields, ...metadataFields, ...fromValues]

  return Array.from(
    new Set(
      merged
        .map((field: string) => String(field || "").trim())
        .filter((field: string) => field.length > 0 && !ignored.has(field))
    )
  )
}

function extractTargetLabel(item: any): string | null {
  const newValues = pickObject(item.new_values || item?.metadata?.new_values)
  const oldValues = pickObject(item.old_values || item?.metadata?.old_values)

  const fullNameFromNew =
    newValues.first_name && newValues.last_name ? `${newValues.first_name} ${newValues.last_name}` : null
  const fullNameFromOld =
    oldValues.first_name && oldValues.last_name ? `${oldValues.first_name} ${oldValues.last_name}` : null

  if (fullNameFromNew) return fullNameFromNew
  if (fullNameFromOld) return fullNameFromOld

  const candidates = [
    newValues.title,
    newValues.name,
    newValues.project_name,
    newValues.asset_name,
    newValues.ticket_number,
    oldValues.title,
    oldValues.name,
    oldValues.project_name,
    oldValues.asset_name,
    oldValues.ticket_number,
  ]

  const label = candidates.find((value) => typeof value === "string" && value.trim().length > 0)
  if (label) return String(label).trim()

  if (typeof item.entity_id === "string" && item.entity_id.length > 0) {
    return `#${item.entity_id.slice(0, 8)}`
  }

  return null
}

function actionVerb(value: string): string {
  const token = normalizeToken(value)
  if (["insert", "create", "created", "add", "added"].includes(token)) return "Created"
  if (["delete", "deleted", "remove", "removed"].includes(token)) return "Deleted"
  if (["assign", "assigned", "reassign", "reassigned"].includes(token)) return "Assigned"
  if (["approve", "approved"].includes(token)) return "Approved"
  if (["reject", "rejected"].includes(token)) return "Rejected"
  if (["status_change", "update", "updated", "edit", "edited", "modify", "modified"].includes(token)) return "Updated"
  return humanizeToken(value, "Updated")
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch user profile with role
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user?.id).single()

  // Fetch stats
  const [
    { count: employeeCount },
    { count: assetCount },
    { count: taskCount },
    { count: docCount },
    { count: feedbackCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("assets").select("*", { count: "exact", head: true }),
    supabase.from("tasks").select("*", { count: "exact", head: true }),
    supabase.from("user_documentation").select("*", { count: "exact", head: true }),
    supabase.from("feedback").select("*", { count: "exact", head: true }),
  ])

  // Recent cross-module activity from audit logs
  const { data: rawRecentActivity } = await supabase
    .from("audit_logs")
    .select(
      "id, user_id, created_at, action, operation, entity_type, table_name, entity_id, department, metadata, changed_fields, new_values, old_values"
    )
    .not("action", "in", '("sync","migrate","update_schema","migration")')
    .order("created_at", { ascending: false })
    .limit(6)

  const filteredRawActivity = (rawRecentActivity || []).filter((item: any) => {
    const action = normalizeToken(item.action || item.operation)
    return !["sync", "migrate", "update_schema", "migration"].includes(action)
  })

  const actorIds = Array.from(new Set(filteredRawActivity.map((item: any) => item.user_id).filter(Boolean)))
  let actorMap = new Map<string, { first_name?: string; last_name?: string; company_email?: string }>()

  if (actorIds.length > 0) {
    const { data: actorProfiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, company_email")
      .in("id", actorIds)

    actorMap = new Map((actorProfiles || []).map((actor: any) => [actor.id, actor]))
  }

  const recentActivity: RecentActivityItem[] = filteredRawActivity.map((item: any) => {
    const actor = actorMap.get(item.user_id)
    const actorName =
      actor?.first_name && actor?.last_name
        ? `${formatName(actor.first_name)} ${formatName(actor.last_name)}`
        : actor?.company_email || "System"

    const rawAction = item.action || item.operation || "updated"
    const moduleKey = normalizeToken(item.entity_type || item.table_name || "system")
    const moduleLabel = humanizeToken(item.entity_type || item.table_name, "System")
    const target = extractTargetLabel(item)
    const changedFields = extractChangedFields(item)
      .slice(0, 3)
      .map((field) => humanizeToken(field, field))
    const changedSummary = changedFields.length > 0 ? ` (${changedFields.join(", ")})` : ""

    return {
      id: item.id,
      actorName,
      actionLabel: `${actionVerb(rawAction)} ${moduleLabel}${target ? `: ${target}` : ""}${changedSummary}`,
      moduleLabel,
      moduleKey,
      createdAt: item.created_at,
    }
  })

  // Action queue (existing notification sources only)
  const notifications: NotificationItem[] = []

  // Pending user approvals
  const { count: pendingUsersCount } = await supabase
    .from("pending_users")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")

  if (pendingUsersCount && pendingUsersCount > 0) {
    notifications.push({
      id: "pending-users",
      type: "warning",
      title: "Pending User Approvals",
      message: `You have ${pendingUsersCount} user${pendingUsersCount > 1 ? "s" : ""} waiting for approval.`,
      timestamp: "Just now",
      link: "/admin/hr/employees",
      linkText: "Review Employees",
    })
  }

  // Open feedback that needs attention
  const { count: openFeedbackCount } = await supabase
    .from("feedback")
    .select("*", { count: "exact", head: true })
    .eq("status", "open")

  if (openFeedbackCount && openFeedbackCount > 0) {
    notifications.push({
      id: "open-feedback",
      type: "info",
      title: "Open Feedback",
      message: `There ${openFeedbackCount === 1 ? "is" : "are"} ${openFeedbackCount} open feedback item${openFeedbackCount > 1 ? "s" : ""} that need attention.`,
      timestamp: "Recent",
      link: "/admin/feedback",
      linkText: "View Feedback",
    })
  }

  // Urgent tasks
  const { count: urgentTasksCount } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("priority", "urgent")
    .in("status", ["pending", "in_progress"])

  if (urgentTasksCount && urgentTasksCount > 0) {
    notifications.push({
      id: "urgent-tasks",
      type: "error",
      title: "Urgent Tasks",
      message: `You have ${urgentTasksCount} urgent task${urgentTasksCount > 1 ? "s" : ""} that need immediate attention.`,
      timestamp: "Urgent",
      link: "/admin/tasks",
      linkText: "View Tasks",
    })
  }

  // Overdue tasks
  const today = new Date().toISOString().split("T")[0]
  const { data: overdueTasks } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: false })
    .lt("due_date", today)
    .in("status", ["pending", "in_progress"])

  if (overdueTasks && overdueTasks.length > 0) {
    notifications.push({
      id: "overdue-tasks",
      type: "error",
      title: "Overdue Tasks",
      message: `There ${overdueTasks.length === 1 ? "is" : "are"} ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""} that need to be completed.`,
      timestamp: "Overdue",
      link: "/admin/tasks",
      linkText: "View Tasks",
    })
  }

  // Recent audit logs (show if there are many actions today)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { count: todayAuditCount } = await supabase
    .from("audit_logs")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayStart.toISOString())

  if (todayAuditCount && todayAuditCount > 50) {
    notifications.push({
      id: "high-activity",
      type: "info",
      title: "High System Activity",
      message: `There have been ${todayAuditCount} system activities today. Review audit logs for details.`,
      timestamp: "Today",
      link: "/admin/audit-logs",
      linkText: "View Audit Logs",
    })
  }

  const canAccessAction = (requiredRoles: string[]) => {
    return !!profile?.role && requiredRoles.includes(profile.role)
  }

  const filteredPrimaryModules = primaryModules.filter((action) => canAccessAction(action.roles))
  const filteredSecondaryModules = secondaryModules.filter((action) => canAccessAction(action.roles))
  const sortedNotifications = [...notifications].sort(
    (a, b) => notificationPriority[a.type] - notificationPriority[b.type]
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Admin Dashboard"
        description={`Operational control center for ${formatName(profile?.first_name) || "Admin"}: review queues, monitor workload, and execute priority actions.`}
        icon={Shield}
        actions={
          <>
            <Button asChild size="sm">
              <Link href="/admin/hr/employees">Manage Employees</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/tasks">Review Tasks</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/reports">Open Reports</Link>
            </Button>
          </>
        }
      />

      <Section title="Action Queue" description="Priority items that require administrative attention.">
        {sortedNotifications.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {sortedNotifications.map((item) => {
              const styles = notificationStyles[item.type]
              const SeverityIcon = styles.icon

              return (
                <Card key={item.id} className={cn("border", styles.cardClass)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        <SeverityIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">{item.title}</p>
                          <Badge variant="outline" className={styles.badgeClass}>
                            {styles.label}
                          </Badge>
                          <span className="text-muted-foreground text-xs">{item.timestamp}</span>
                        </div>
                        <p className="text-muted-foreground text-sm">{item.message}</p>
                        <Link
                          href={item.link}
                          className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-sm font-medium"
                        >
                          {item.linkText}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-center p-8">
              <p className="text-muted-foreground text-sm">No immediate operational alerts.</p>
            </CardContent>
          </Card>
        )}
      </Section>

      <Section title="Core KPIs" description="Current operational totals across core business areas.">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard
            title="Total Employees"
            value={employeeCount || 0}
            description="Registered user profiles"
            icon={Users}
            iconBgColor="bg-blue-100 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
          />
          <StatCard
            title="Assets"
            value={assetCount || 0}
            description="Tracked inventory records"
            icon={Package}
            iconBgColor="bg-purple-100 dark:bg-purple-900/30"
            iconColor="text-purple-600 dark:text-purple-400"
          />
          <StatCard
            title="Active Tasks"
            value={taskCount || 0}
            description="Total tasks in system"
            icon={ClipboardList}
            iconBgColor="bg-green-100 dark:bg-green-900/30"
            iconColor="text-green-600 dark:text-green-400"
          />
          <StatCard
            title="Documents"
            value={docCount || 0}
            description="User documentation files"
            icon={FileText}
            iconBgColor="bg-orange-100 dark:bg-orange-900/30"
            iconColor="text-orange-600 dark:text-orange-400"
          />
          <StatCard
            title="Feedback"
            value={feedbackCount || 0}
            description="Submitted feedback records"
            icon={MessageSquare}
            iconBgColor="bg-cyan-100 dark:bg-cyan-900/30"
            iconColor="text-cyan-600 dark:text-cyan-400"
          />
        </div>
      </Section>

      <Section title="Primary Modules" description="Core admin workstreams used for daily operational control.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPrimaryModules.map((action) => (
            <Link key={action.href} href={action.href} className="h-full">
              <Card className="group flex h-full cursor-pointer flex-col border transition-all hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="flex flex-1 flex-col p-4">
                  <div className="flex items-start gap-3">
                    <div className={`${action.color} shrink-0 rounded-lg p-2.5 text-white`}>
                      <action.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-foreground mb-1 text-sm font-semibold">{action.title}</h3>
                      <p className="text-muted-foreground line-clamp-2 text-xs">{action.description}</p>
                    </div>
                    <ArrowRight className="text-muted-foreground group-hover:text-primary h-4 w-4 flex-shrink-0 transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Secondary Modules" description="Additional administrative modules and supporting functions.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredSecondaryModules.map((action) => (
            <Link key={action.href} href={action.href} className="h-full">
              <Card className="group bg-muted/20 hover:bg-muted/35 flex h-full cursor-pointer flex-col border transition-all">
                <CardContent className="flex flex-1 flex-col p-3.5">
                  <div className="flex items-start gap-3">
                    <div className={`${action.color} shrink-0 rounded-md p-2 text-white`}>
                      <action.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-foreground mb-1 text-sm font-semibold">{action.title}</h3>
                      <p className="text-muted-foreground line-clamp-2 text-xs">{action.description}</p>
                    </div>
                    <ArrowRight className="text-muted-foreground group-hover:text-primary h-4 w-4 flex-shrink-0 transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Recent Activity" description="Latest cross-module changes recorded in the system.">
        <Card className="border">
          <CardHeader className="bg-muted/30 border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                <ScrollText className="h-4 w-4" />
                Recent Activity
              </CardTitle>
              <Link href="/admin/audit-logs">
                <Badge variant="outline" className="hover:bg-accent cursor-pointer text-xs">
                  View All
                </Badge>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            {recentActivity.length > 0 ? (
              <div className="divide-y">
                {recentActivity.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-sm font-medium">
                        <span className="font-semibold">{item.actorName}</span> {item.actionLabel}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {item.moduleLabel}
                        </Badge>
                        <span className="text-muted-foreground text-xs whitespace-nowrap">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={resolveActivityRoute(item.moduleKey)}
                      className="text-primary hover:text-primary/80 inline-flex shrink-0 items-center gap-1 text-xs font-medium"
                    >
                      Open
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">No recent system activity found.</p>
            )}
          </CardContent>
        </Card>
      </Section>
    </PageWrapper>
  )
}
