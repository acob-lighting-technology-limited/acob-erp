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
    color: "bg-info/10 text-info border-info/20",
    fill: "bg-blue-500",
    hoverBorder: "hover:border-info/50",
    hoverText: "group-hover:text-blue-500",
  },
  {
    name: "10th Anniversary Signature",
    description: "Generate the temporary anniversary email signature with the commemorative branding",
    href: "/tools/signature-anniversary",
    icon: FileSignature,
    tag: "Special",
    subLabel: "Anniversary edition",
    color: "bg-warning/10 text-warning border-warning/20",
    fill: "bg-amber-500",
    hoverBorder: "hover:border-warning/50",
    hoverText: "group-hover:text-amber-500",
  },
  {
    name: "Watermark Studio",
    description: "Add ACOB branding watermarks to your images and videos",
    href: "/tools/watermark",
    icon: Droplet,
    tag: "Media",
    subLabel: "Image & video branding",
    color: "bg-teal-500/10 text-success border-teal-500/20",
    fill: "bg-teal-500",
    hoverBorder: "hover:border-success/50",
    hoverText: "group-hover:text-teal-500",
  },
  {
    name: "My Job Description",
    description: "View, edit, and print your job description from the tools workspace",
    href: "/tools/job-description",
    icon: Briefcase,
    tag: "HR",
    subLabel: "Role details & duties",
    color: "bg-success/10 text-success border-success/20",
    fill: "bg-emerald-500",
    hoverBorder: "hover:border-success/50",
    hoverText: "group-hover:text-emerald-500",
  },
  {
    name: "Media & PDF Suite",
    description: "Download, convert, compress media, and manage PDF documents",
    href: "/tools/media",
    icon: Video,
    tag: "Utility",
    subLabel: "PDF & media tools",
    color: "bg-indigo-500/10 text-info border-indigo-500/20",
    fill: "bg-indigo-500",
    hoverBorder: "hover:border-info/50",
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
