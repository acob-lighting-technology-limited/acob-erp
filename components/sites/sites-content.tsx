"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, CalendarClock, FileQuestion, MapPin, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DataTablePage } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { useSites } from "@/hooks/use-sites"
import { documentStanding } from "@/lib/sites/conveyance"
import type { SiteRecord } from "@/lib/sites/records"
import { toLocalISODate } from "@/lib/utils/date"
import { SitesTable, type SiteDialogState } from "./sites-table"

/**
 * The Sites register page — every signed and profiled site with its
 * conveyance documents. One component for /portfolios/sites and
 * /admin/portfolios/sites; the API decides who may edit.
 */
export function SitesContent({ isAdmin }: { isAdmin: boolean }) {
  const [dialog, setDialog] = useState<SiteDialogState>({ mode: "closed" })
  const [deleting, setDeleting] = useState<SiteRecord | null>(null)
  const { data, isLoading } = useSites()
  const canEdit = isAdmin && (data?.canEdit ?? false)

  // Counted per site, not per document: "3 sites have expired paperwork" is the
  // number management asks for.
  const stats = useMemo(() => {
    const today = toLocalISODate()
    const sites = data?.data ?? []
    const anyDoc = (site: SiteRecord, standing: string) =>
      site.documents.some((doc) => documentStanding(doc, today) === standing)
    return {
      total: sites.length,
      expired: sites.filter((s) => anyDoc(s, "expired")).length,
      expiring: sites.filter((s) => anyDoc(s, "expiring")).length,
      unrecorded: sites.filter((s) => s.documents.length === 0).length,
    }
  }, [data])

  return (
    <DataTablePage
      title="Sites"
      description="Every signed and profiled site, and whether its conveyance documents are still valid."
      icon={MapPin}
      actions={
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button size="sm" onClick={() => setDialog({ mode: "add" })}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Site</span>
              <span className="sm:hidden">Add</span>
            </Button>
          )}
        </div>
      }
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Sites"
            value={stats.total}
            icon={MapPin}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            variant="compact"
            title="Expired documents"
            value={stats.expired}
            tooltip="Sites with at least one document past its expiry date"
            icon={AlertTriangle}
            iconBgColor={stats.expired > 0 ? "bg-red-500/10" : "bg-slate-500/10"}
            iconColor={stats.expired > 0 ? "text-red-500" : "text-slate-500"}
          />
          <StatCard
            variant="compact"
            title="Expiring soon"
            value={stats.expiring}
            tooltip="Sites with a document that expires within 60 days"
            icon={CalendarClock}
            iconBgColor={stats.expiring > 0 ? "bg-amber-500/10" : "bg-slate-500/10"}
            iconColor={stats.expiring > 0 ? "text-amber-500" : "text-slate-500"}
          />
          <StatCard
            variant="compact"
            title="No documents"
            value={stats.unrecorded}
            tooltip="Sites with no conveyance documents recorded yet"
            icon={FileQuestion}
            iconBgColor="bg-violet-500/10"
            iconColor="text-violet-500"
          />
        </StatGrid>
      }
    >
      <SitesTable
        isAdmin={isAdmin}
        dialog={dialog}
        setDialog={setDialog}
        deleting={deleting}
        setDeleting={setDeleting}
      />
    </DataTablePage>
  )
}
