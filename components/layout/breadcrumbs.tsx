"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface BreadcrumbItem {
  label: string
  href?: string
}

const SEGMENT_LABELS: Record<string, string> = {
  admin: "Admin",
  dept: "Dept Console",
  hr: "HR",
  pms: "PMS",
  cbt: "CBT",
  md: "MD",
  "md-desk": "MD's Desk",
  sop: "SOP",
  sops: "SOPs",
  it: "IT",
  dev: "Developer",
  ui: "UI",
  api: "API",
  users: "Users",
  roles: "Roles",
  settings: "Settings",
  compliance: "Compliance",
  operations: "Operations",
  management: "Management",
  correspondence: "Correspondence",
  communications: "Communications",
  documentation: "Documentation",
  feedback: "Feedback",
  reports: "Reports",
  leave: "Leave",
  attendance: "Attendance",
  performance: "Performance",
  accounts: "Accounts",
  finance: "Finance",
  purchasing: "Purchasing",
  inventory: "Inventory",
  projects: "Projects",
  portfolios: "Portfolios",
  security: "Security",
  tools: "Tools",
  onboarding: "Onboarding",
}

function formatSegmentLabel(segment: string): string {
  const lower = segment.toLowerCase()
  if (SEGMENT_LABELS[lower]) return SEGMENT_LABELS[lower]
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function Breadcrumbs({ items, className }: { items?: BreadcrumbItem[]; className?: string }) {
  const pathname = usePathname()

  let crumbs: BreadcrumbItem[] = items || []

  if (!items && pathname) {
    const rawSegments = pathname.split("/").filter(Boolean)
    if (rawSegments.length > 1) {
      let accumulatedPath = ""
      const generated: BreadcrumbItem[] = []

      for (let i = 0; i < rawSegments.length; i++) {
        const seg = rawSegments[i]
        accumulatedPath += `/${seg}`

        // Skip UUIDs from display while preserving full accumulated URL
        if (UUID_REGEX.test(seg)) {
          continue
        }

        const isLast = i === rawSegments.length - 1
        generated.push({
          label: formatSegmentLabel(seg),
          href: isLast ? undefined : accumulatedPath,
        })
      }

      if (generated.length > 1) {
        crumbs = generated
      }
    }
  }

  if (!crumbs || crumbs.length <= 1) {
    return null
  }

  return (
    <nav
      aria-label="Breadcrumbs"
      className={cn("text-muted-foreground mb-1.5 flex flex-wrap items-center gap-1 text-xs", className)}
    >
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1
        return (
          <span key={idx} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />}
            {crumb.href && !isLast ? (
              <Link href={crumb.href} className="hover:text-foreground transition-colors">
                {crumb.label}
              </Link>
            ) : (
              <span className={isLast ? "text-foreground font-medium" : ""}>{crumb.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
