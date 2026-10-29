"use client"

import {
  ClipboardList,
  FileText,
  ChevronRight,
  Presentation,
  Users,
  UserCheck,
  AlertTriangle,
  QrCode,
} from "lucide-react"
import { PageWrapper, PageHeader, ModuleHubGrid } from "@/components/layout"
import { PageSection } from "@/components/ui/patterns"
import { WeekSetupCard } from "./_components/week-setup-card"

export default function AdminGeneralMeetingReportsPage() {
  const reportCards = [
    {
      title: "Meeting Attendance",
      description:
        "Generate weekly QR & 6-digit codes, print sign-in sheets, and track real-time biometric-verified meeting attendance.",
      href: "/admin/reports/general-meeting/attendance",
      icon: QrCode,
      color: "bg-purple/10 text-purple border-purple/20",
      fill: "bg-purple-500",
      hoverBorder: "hover:border-purple/50",
      hoverText: "group-hover:text-purple-500",
      subLabel: "QR, 6-digit code & roster",
    },
    {
      title: "Action Tracker Management",
      description: "Oversee project progress, track pending actions across all departments, and manage status updates.",
      href: "/admin/reports/general-meeting/action-tracker",
      icon: ClipboardList,
      color: "bg-info/10 text-info border-info/20",
      fill: "bg-blue-500",
      hoverBorder: "hover:border-info/50",
      hoverText: "group-hover:text-blue-500",
      subLabel: "Project progress & actions",
    },
    {
      title: "Weekly Reports Administration",
      description: "Review, manage, and export weekly status updates and performance summaries from all employees.",
      href: "/admin/reports/general-meeting/weekly-reports",
      icon: FileText,
      color: "bg-success/10 text-success border-success/20",
      fill: "bg-emerald-500",
      hoverBorder: "hover:border-success/50",
      hoverText: "group-hover:text-emerald-500",
      subLabel: "Department updates",
    },
    {
      title: "Departmental Challenges",
      description: "Oversee and resolve departmental challenges, track action plans, and update resolution statuses.",
      href: "/admin/reports/general-meeting/challenges",
      icon: AlertTriangle,
      color: "bg-danger/10 text-danger border-danger/20",
      fill: "bg-rose-500",
      hoverBorder: "hover:border-danger/50",
      hoverText: "group-hover:text-rose-500",
      subLabel: "Blockers & mitigation status",
    },
    {
      title: "Knowledge Sharing Session",
      description: "Upload weekly Knowledge Sharing Session files and capture department and presenter details.",
      href: "/admin/reports/general-meeting/kss",
      icon: Presentation,
      color: "bg-indigo-500/10 text-info border-indigo-500/20",
      fill: "bg-indigo-500",
      hoverBorder: "hover:border-info/50",
      hoverText: "group-hover:text-indigo-500",
      subLabel: "Weekly presentations & slides",
    },
    {
      title: "Minutes",
      description: "Upload and store weekly Minutes of Meeting PDFs for reference and mailing.",
      href: "/admin/reports/general-meeting/minutes-of-meeting",
      icon: Users,
      color: "bg-warning/10 text-warning border-warning/20",
      fill: "bg-amber-500",
      hoverBorder: "hover:border-warning/50",
      hoverText: "group-hover:text-amber-500",
      subLabel: "PDF archives & logs",
    },
    {
      title: "Records",
      description: "Teams attendance reports and transcripts, auto-synced per meeting. Manage sync from here.",
      href: "/admin/reports/general-meeting/records",
      icon: UserCheck,
      color: "bg-teal-500/10 text-success border-teal-500/20",
      fill: "bg-teal-500",
      hoverBorder: "hover:border-success/50",
      hoverText: "group-hover:text-teal-500",
      subLabel: "Attendance & transcript sync",
    },
  ]

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="General Meeting"
        description="Manage the documents and trackers that support your weekly general meeting workflow."
        icon={Users}
        backLink={{ href: "/admin/reports", label: "Back to Reports" }}
      />

      <PageSection title="General Meeting" className="space-y-4">
        <WeekSetupCard />

        <ModuleHubGrid
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          cards={reportCards.map((c) => ({
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
      </PageSection>
    </PageWrapper>
  )
}
