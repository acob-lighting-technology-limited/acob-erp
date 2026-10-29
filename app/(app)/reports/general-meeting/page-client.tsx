"use client"

import {
  FileBarChart,
  ClipboardList,
  FileText,
  ChevronRight,
  Presentation,
  Users,
  AlertTriangle,
  QrCode,
} from "lucide-react"
import { PageWrapper, PageHeader, ModuleHubGrid } from "@/components/layout"
import { PageSection } from "@/components/ui/patterns"

export default function PortalGeneralMeetingPage() {
  const reportCards = [
    {
      title: "Meeting Attendance",
      description: "Check in with this week's 6-digit meeting code or room QR scan after your entrance punch.",
      href: "/reports/general-meeting/attendance",
      icon: QrCode,
      tag: "Check-In",
      subLabel: "Attendance check-in",
      color: "bg-purple/10 text-purple border-purple/20",
      fill: "bg-purple-500",
      hoverBorder: "hover:border-purple/50",
      hoverText: "group-hover:text-purple-500",
    },
    {
      title: "Weekly Reports",
      description: "View and submit weekly status updates and performance summaries for your department.",
      href: "/reports/general-meeting/weekly-reports",
      icon: FileText,
      tag: "Weekly",
      subLabel: "Department updates",
      color: "bg-success/10 text-success border-success/20",
      fill: "bg-emerald-500",
      hoverBorder: "hover:border-success/50",
      hoverText: "group-hover:text-emerald-500",
    },
    {
      title: "Action Tracker",
      description: "Track project progress, pending actions, and update completion status for your team.",
      href: "/reports/general-meeting/action-tracker",
      icon: ClipboardList,
      tag: "Active",
      subLabel: "Project progress & actions",
      color: "bg-info/10 text-info border-info/20",
      fill: "bg-blue-500",
      hoverBorder: "hover:border-info/50",
      hoverText: "group-hover:text-blue-500",
    },
    {
      title: "Departmental Challenges",
      description: "Review challenges, blockers, and mitigation plans flagged by departments across meeting weeks.",
      href: "/reports/general-meeting/challenges",
      icon: AlertTriangle,
      tag: "Challenges",
      subLabel: "Department blockers & mitigation",
      color: "bg-danger/10 text-danger border-danger/20",
      fill: "bg-rose-500",
      hoverBorder: "hover:border-danger/50",
      hoverText: "group-hover:text-rose-500",
    },
    {
      title: "Knowledge Sharing Session",
      description: "Upload weekly Knowledge Sharing Session files and track who presented by department.",
      href: "/reports/general-meeting/kss",
      icon: Presentation,
      tag: "KSS",
      subLabel: "Weekly presentations & slides",
      color: "bg-indigo-500/10 text-info border-indigo-500/20",
      fill: "bg-indigo-500",
      hoverBorder: "hover:border-info/50",
      hoverText: "group-hover:text-indigo-500",
    },
    {
      title: "Minutes",
      description: "Upload and access weekly Minutes of Meeting PDFs for future reference.",
      href: "/reports/general-meeting/minutes-of-meeting",
      icon: Users,
      tag: "MOM",
      subLabel: "PDF archives & logs",
      color: "bg-warning/10 text-warning border-warning/20",
      fill: "bg-amber-500",
      hoverBorder: "hover:border-warning/50",
      hoverText: "group-hover:text-amber-500",
    },
  ]

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="General Meeting"
        description="Access the documents and trackers that support your weekly general meeting."
        icon={FileBarChart}
        backLink={{ href: "/reports", label: "Back to Reports" }}
      />

      <PageSection title="Available Trackers & Reports">
        <ModuleHubGrid
          cards={reportCards.map((c) => ({
            title: c.title,
            description: c.description,
            href: c.href,
            icon: c.icon,
            tag: c.tag,
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
