"use client"

import { FileSignature, Droplet, Wrench, Briefcase, Video } from "lucide-react"
import { PageHeader, PageWrapper, ModuleHubGrid } from "@/components/layout"

const tools = [
  {
    name: "Email Signature",
    description: "Generate a professional email signature with your ACOB contact details",
    href: "/tools/signature",
    icon: FileSignature,
    tag: "Branding",
    subLabel: "Signature builder",
    color: "bg-blue-500/10 text-info-foreground border-blue-500/20",
    fill: "bg-blue-500",
    hoverBorder: "hover:border-blue-500/60 dark:hover:border-blue-400/60",
    hoverText: "group-hover:text-blue-500",
  },
  {
    name: "10th Anniversary Signature",
    description: "Generate the temporary anniversary email signature with the commemorative branding",
    href: "/tools/signature-anniversary",
    icon: FileSignature,
    tag: "Special",
    subLabel: "Anniversary edition",
    color: "bg-amber-500/10 text-warning-foreground border-amber-500/20",
    fill: "bg-amber-500",
    hoverBorder: "hover:border-amber-500/60 dark:hover:border-amber-400/60",
    hoverText: "group-hover:text-amber-500",
  },
  {
    name: "Watermark Studio",
    description: "Add ACOB branding watermarks to your images and videos",
    href: "/tools/watermark",
    icon: Droplet,
    tag: "Media",
    subLabel: "Image & video branding",
    color: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
    fill: "bg-teal-500",
    hoverBorder: "hover:border-teal-500/60 dark:hover:border-teal-400/60",
    hoverText: "group-hover:text-teal-500",
  },
  {
    name: "My Job Description",
    description: "View, edit, and print your job description from the tools workspace",
    href: "/tools/job-description",
    icon: Briefcase,
    tag: "HR",
    subLabel: "Role details & duties",
    color: "bg-emerald-500/10 text-success-foreground border-emerald-500/20",
    fill: "bg-emerald-500",
    hoverBorder: "hover:border-emerald-500/60 dark:hover:border-emerald-400/60",
    hoverText: "group-hover:text-emerald-500",
  },
  {
    name: "Media & PDF Suite",
    description: "Download, convert, compress media, and manage PDF documents",
    href: "/tools/media",
    icon: Video,
    tag: "Utility",
    subLabel: "PDF & media tools",
    color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    fill: "bg-indigo-500",
    hoverBorder: "hover:border-indigo-500/60 dark:hover:border-indigo-400/60",
    hoverText: "group-hover:text-indigo-500",
  },
]

export default function ToolsPage() {
  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Tools"
        description="Utility tools to help with your work"
        icon={Wrench}
        backLink={{ href: "/profile", label: "Back to Dashboard" }}
      />

      <ModuleHubGrid
        cards={tools.map((c) => ({
          title: c.name,
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
    </PageWrapper>
  )
}
