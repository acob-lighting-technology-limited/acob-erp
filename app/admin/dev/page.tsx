import { PageHeader, PageWrapper, ModuleHubGrid } from "@/components/layout"
import {
  Code2,
  ScrollText,
  ShieldEllipsis,
  ShieldAlert,
  FlaskConical,
  Bug,
  UserRoundCog,
  Bot,
  ChevronRight,
} from "lucide-react"

import type { Metadata } from "next"

export const metadata: Metadata = { title: "Admin Developer" }

const sections = [
  {
    title: "Login Logs",
    description: "Track who logged in, when, from where, and with what auth method.",
    href: "/admin/dev/login-logs",
    icon: ScrollText,
    color: "bg-info/10 text-info border-info/20",
    fill: "bg-blue-500",
    hoverBorder: "hover:border-info/50",
    hoverText: "group-hover:text-blue-500",
    subLabel: "Auth & session logs",
  },
  {
    title: "Role Escalations",
    description: "Audit role elevations and sensitive permission transitions.",
    href: "/admin/dev/role-escalations",
    icon: ShieldEllipsis,
    color: "bg-purple/10 text-purple border-purple/20",
    fill: "bg-purple-500",
    hoverBorder: "hover:border-purple/50",
    hoverText: "group-hover:text-purple-500",
    subLabel: "Permission audits",
  },
  {
    title: "Security Events",
    description: "Inspect suspicious or high-risk security-related audit events.",
    href: "/admin/dev/security-events",
    icon: ShieldAlert,
    color: "bg-danger/10 text-danger border-danger/20",
    fill: "bg-red-500",
    hoverBorder: "hover:border-danger/50",
    hoverText: "group-hover:text-red-500",
    subLabel: "Security audit trail",
  },
  {
    title: "Error Monitor",
    description: "Investigate browser, server, failed action and Supabase errors.",
    href: "/admin/dev/ui-errors",
    icon: Bug,
    color: "bg-warning/10 text-warning border-warning/20",
    fill: "bg-amber-500",
    hoverBorder: "hover:border-warning/50",
    hoverText: "group-hover:text-amber-500",
    subLabel: "Global error tracking",
  },
  {
    title: "Tests",
    description: "End-to-end flow tests for Leave, Help Desk, and Tasks — no account switching required.",
    href: "/admin/dev/tests",
    icon: FlaskConical,
    color: "bg-teal-500/10 text-success border-teal-500/20",
    fill: "bg-teal-500",
    hoverBorder: "hover:border-success/50",
    hoverText: "group-hover:text-teal-500",
    subLabel: "End-to-end test runner",
  },
  {
    title: "Session Impersonation",
    description: "Switch into any account for end-to-end flow validation without shared passwords.",
    href: "/admin/dev/impersonation",
    icon: UserRoundCog,
    color: "bg-indigo-500/10 text-info border-indigo-500/20",
    fill: "bg-indigo-500",
    hoverBorder: "hover:border-info/50",
    hoverText: "group-hover:text-indigo-500",
    subLabel: "Account validation tool",
  },
  {
    title: "ACOBot Conversations",
    description: "Review every question staff and website visitors asked ACOBot, its answer, and who asked it.",
    href: "/admin/dev/acobot",
    icon: Bot,
    color: "bg-success/10 text-success border-success/20",
    fill: "bg-emerald-500",
    hoverBorder: "hover:border-success/50",
    hoverText: "group-hover:text-emerald-500",
    subLabel: "AI chat log inspector",
  },
]

export default function DevHomePage() {
  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="DEV Control Plane"
        description="Developer-only operational and security control surfaces, excluding shared system settings"
        icon={Code2}
        backLink={{ href: "/admin", label: "Back to Admin" }}
      />

      <ModuleHubGrid
        className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3"
        cards={sections.map((c) => ({
          title: c.title,
          description: c.description,
          href: c.href,
          icon: c.icon,
          footer: c.subLabel,
          color: c.color,
          fill: c.fill,
          hoverBorder: c.hoverBorder,
          hoverText: c.hoverText,
        }))}
      />
    </PageWrapper>
  )
}
