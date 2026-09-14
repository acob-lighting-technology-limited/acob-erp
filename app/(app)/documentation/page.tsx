import Link from "next/link"
import { redirect } from "next/navigation"
import { PageHeader, PageWrapper, Section } from "@/components/layout"
import { Badge } from "@/components/ui/badge"
import { IconFill } from "@/components/ui/icon-fill"
import { ChevronRight, FileText, FolderOpen, ListChecks, ScrollText } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { getControlledDocSummary } from "@/lib/documentation/controlled-summary"
import { getDocumentationData } from "./data"
import type { DocumentationAttachment } from "@/lib/documentation/sharepoint"

export interface Documentation {
  id: string
  title: string
  content: string
  category?: string
  tags?: string[]
  is_draft: boolean
  sharepoint_folder_path?: string | null
  sharepoint_text_file_path?: string | null
  sharepoint_attachments?: DocumentationAttachment[]
  created_at: string
  updated_at: string
}

export default async function DocumentationPage() {
  const data = await getDocumentationData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const docsData = data as {
    docs: Documentation[]
    userId: string
    departmentDocs: { enabled: boolean }
  }

  const supabase = await createClient()
  const summary = await getControlledDocSummary(getServiceRoleClientOrFallback(supabase), docsData.userId)
  const pendingPolicies = summary.policiesPendingAcknowledgement

  const docSections = [
    {
      title: "Company Policies",
      description: "The rules that apply to everyone. Read each one and acknowledge it.",
      href: "/documentation/policies",
      icon: ScrollText,
      tag: pendingPolicies > 0 ? `${pendingPolicies} to acknowledge` : `${summary.policies} Policies`,
      subLabel:
        pendingPolicies > 0 ? "Action needed" : summary.policies > 0 ? "All acknowledged" : "None published yet",
      enabled: true,
      color:
        pendingPolicies > 0
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
          : "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
      fill: pendingPolicies > 0 ? "bg-amber-500" : "bg-violet-500",
      hoverBorder:
        pendingPolicies > 0
          ? "hover:border-amber-500/60 dark:hover:border-amber-400/60"
          : "hover:border-violet-500/60 dark:hover:border-violet-400/60",
      hoverText: pendingPolicies > 0 ? "group-hover:text-amber-500" : "group-hover:text-violet-500",
    },
    {
      title: "Standard Operating Procedures",
      description: "Step-by-step procedures for company-wide tasks and your department's work.",
      href: "/documentation/sops",
      icon: ListChecks,
      tag: `${summary.sops} SOPs`,
      subLabel: "How we do things",
      enabled: true,
      color: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
      fill: "bg-sky-500",
      hoverBorder: "hover:border-sky-500/60 dark:hover:border-sky-400/60",
      hoverText: "group-hover:text-sky-500",
    },
    {
      title: "Personal Documentation",
      description: "Create and manage your own work documentation.",
      href: "/documentation/personal",
      icon: FileText,
      tag: `${docsData.docs.length} Docs`,
      subLabel: "Your work docs",
      enabled: true,
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      fill: "bg-blue-500",
      hoverBorder: "hover:border-blue-500/60 dark:hover:border-blue-400/60",
      hoverText: "group-hover:text-blue-500",
    },
    {
      title: "Department Documents",
      description: "Browse your department's confidential OneDrive files and reference materials.",
      href: "/documentation/department",
      icon: FolderOpen,
      tag: docsData.departmentDocs.enabled ? "Available" : "Locked",
      subLabel: docsData.departmentDocs.enabled ? "OneDrive repository" : "Access disabled",
      enabled: docsData.departmentDocs.enabled,
      color: docsData.departmentDocs.enabled
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
        : "bg-muted text-muted-foreground border-muted-foreground/20",
      fill: "bg-emerald-500",
      hoverBorder: docsData.departmentDocs.enabled
        ? "hover:border-emerald-500/60 dark:hover:border-emerald-400/60"
        : "",
      hoverText: docsData.departmentDocs.enabled ? "group-hover:text-emerald-500" : "",
    },
  ]

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Documentation"
        description="Company policies, SOPs, your personal work docs, and department files"
        icon={FileText}
        backLink={{ href: "/profile", label: "Back to Dashboard" }}
      />

      <Section title="Available Repositories">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {docSections.map((item) => {
            const cardContent = (
              <div
                className={cn(
                  "bg-card border-border flex h-full flex-col justify-between rounded-xl border p-4.5 shadow-md transition-all duration-200",
                  item.enabled
                    ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-xl"
                    : "cursor-not-allowed opacity-60",
                  item.hoverBorder
                )}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <IconFill
                        icon={item.icon}
                        fillColor={item.fill}
                        className={cn(
                          "h-9 w-9 rounded-lg border transition-transform duration-200",
                          item.enabled && "group-hover:scale-105",
                          item.color
                        )}
                        iconClassName="h-5 w-5"
                      />
                      <h3 className={cn("text-foreground text-base font-semibold transition-colors", item.hoverText)}>
                        {item.title}
                      </h3>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold", item.color)}
                    >
                      {item.tag}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">{item.description}</p>
                </div>
                <div className="border-border/40 mt-4 flex items-center justify-between border-t pt-2.5">
                  <span className="text-muted-foreground text-[11px] font-medium">{item.subLabel}</span>
                  {item.enabled ? (
                    <IconFill
                      icon={ChevronRight}
                      fillColor={item.fill}
                      hoverTextClassName="group-hover:text-white"
                      className={cn(
                        "border-border h-6 w-6 rounded-full border transition-all duration-200 group-hover:translate-x-0.5",
                        item.hoverBorder
                      )}
                      iconClassName="text-muted-foreground h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="text-muted-foreground text-xs font-medium">Disabled</span>
                  )}
                </div>
              </div>
            )

            if (!item.enabled) {
              return <div key={item.title}>{cardContent}</div>
            }

            return (
              <Link key={item.title} href={item.href} className="group block">
                {cardContent}
              </Link>
            )
          })}
        </div>
      </Section>
    </PageWrapper>
  )
}
