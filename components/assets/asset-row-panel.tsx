"use client"

import { useQuery } from "@tanstack/react-query"
import { AlertCircle, Archive, CheckCircle2, MessageSquareWarning, Package, Wrench } from "lucide-react"
import { DetailList, SectionHeading } from "@/components/ui/detail-list"
import { Skeleton } from "@/components/ui/skeleton"
import { AssetTimeline } from "@/components/assets/asset-timeline"
import { apiJson } from "@/lib/api-client"
import { ASSET_TYPE_MAP } from "@/lib/asset-types"
import { buildAssetActivities, type AssetHistoryPayload } from "@/lib/assets/asset-activity"
import { ACCEPTANCE_LABELS, type AcceptanceStatus } from "@/lib/assets/acceptance"
import { QUERY_KEYS } from "@/lib/query-keys"
import { cn, formatName } from "@/lib/utils"
import { formatWATDate } from "@/lib/utils/date"
import type { Asset } from "@/app/admin/accounts/assets/_lib/types"

/** How many of the most recent events an expanded row shows before "View earlier". */
const TIMELINE_LIMIT = 5

export function useAssetActivities(assetId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.adminAssetHistory(assetId ?? undefined),
    enabled: Boolean(assetId),
    queryFn: async () => {
      const payload = await apiJson<AssetHistoryPayload>(`/api/admin/assets/${assetId}/history`, { cache: "no-store" })
      // The open assignment (not handed back), newest first: its acceptance is the asset's.
      const current = payload.assignments
        .filter((a) => !a.handed_over_at)
        .sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime())[0]
      return {
        activities: buildAssetActivities(payload),
        acceptance: (current?.acceptance_status ?? null) as AcceptanceStatus | null,
        openReports: (payload.reports ?? []).filter((r) => r.status === "open").length,
      }
    },
    staleTime: 60_000,
    meta: { errorMessage: "Failed to load asset history" },
  })
}

/** The one-line banner under the heading: where this asset is now. */
function StatusStrip({ asset, holder }: { asset: Asset; holder: string }) {
  const archived = Boolean(asset.deleted_at)
  const status = archived ? "archived" : asset.status
  const tone =
    status === "assigned" ? "success" : status === "available" ? "info" : status === "maintenance" ? "warning" : "muted"
  const Icon = archived ? Archive : status === "maintenance" ? Wrench : status === "assigned" ? CheckCircle2 : Package
  const text = archived
    ? `Archived${asset.delete_reason ? `: ${asset.delete_reason}` : ""}`
    : status === "assigned"
      ? `Assigned to ${holder}`
      : status === "available"
        ? "Available in store"
        : `${formatName(status)}${holder && holder !== "Unassigned" ? ` • ${holder}` : ""}`
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3 py-2 text-xs",
        tone === "success" && "border-success/30 bg-success/15 text-success",
        tone === "info" && "border-info/30 bg-info/15 text-info",
        tone === "warning" && "border-warning/30 bg-warning/15 text-warning",
        tone === "muted" && "border-muted bg-muted/40 text-muted-foreground"
      )}
    >
      <Icon className="mt-px h-4 w-4 shrink-0" />
      <p className="font-medium">{text}</p>
    </div>
  )
}

/**
 * An asset's expanded row, laid out like leave's and requisitions': the asset and where it is now
 * on the left (with whether the holder confirmed receipt), its timeline on the right. The
 * timeline loads when the row opens and reads oldest to newest, showing the latest few with the earlier
 * ones behind a button.
 */
export function AssetRowPanel({
  asset,
  holder,
  createdBy,
}: {
  asset: Asset
  /** Who or where it is assigned to now, as the table shows it. */
  holder: string
  createdBy: string
}) {
  const { data, isLoading, isError } = useAssetActivities(asset.id)
  const activities = data?.activities
  const openIssues = asset.unresolved_issues_count || 0

  return (
    <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
      <div className="space-y-3">
        <SectionHeading title="Asset overview" />
        <StatusStrip asset={asset} holder={holder} />
        {data?.openReports ? (
          <div className="border-warning/30 bg-warning/15 text-warning flex items-start gap-2.5 rounded-md border px-3 py-2 text-xs">
            <MessageSquareWarning className="mt-px h-4 w-4 shrink-0" />
            <p className="font-medium">
              {data.openReports === 1 ? "An open staff report" : `${data.openReports} open staff reports`} on this
              asset. See the Reports tab.
            </p>
          </div>
        ) : null}
        <DetailList
          items={[
            { label: "Type", value: ASSET_TYPE_MAP[asset.asset_type]?.label || asset.asset_type },
            { label: "Model", value: asset.asset_model || null },
            { label: "Serial number", value: asset.serial_number || null },
            { label: "Acquired", value: asset.acquisition_year ? String(asset.acquisition_year) : null },
            {
              label: "Office / room",
              value: asset.current_assignment?.office_location || asset.office_location || null,
            },
            { label: "Department", value: asset.current_assignment?.department || asset.department || null },
            ...(data?.acceptance && data.acceptance !== "not_required"
              ? [
                  {
                    label: "Receipt",
                    value: (
                      <span
                        className={cn(
                          "font-medium",
                          data.acceptance === "accepted" || data.acceptance === "auto_accepted"
                            ? "text-success"
                            : data.acceptance === "disputed"
                              ? "text-danger"
                              : "text-warning"
                        )}
                      >
                        {ACCEPTANCE_LABELS[data.acceptance]}
                      </span>
                    ),
                  },
                ]
              : []),
            { label: "Added by", value: createdBy },
            { label: "Added on", value: asset.created_at ? formatWATDate(asset.created_at) : null },
            {
              label: "Open issues",
              value:
                openIssues > 0 ? (
                  <span className="text-danger inline-flex items-center gap-1 font-medium">
                    <AlertCircle className="h-3.5 w-3.5" /> {openIssues}
                  </span>
                ) : (
                  "None"
                ),
            },
            { label: "Notes", value: asset.notes || "No notes added.", wide: true },
          ]}
        />
      </div>

      <section className="space-y-3">
        <SectionHeading
          title="Timeline"
          aside={activities?.length ? `${activities.length} event${activities.length === 1 ? "" : "s"}` : undefined}
        />
        {isLoading ? (
          <div className="space-y-3">
            {["first", "second", "third"].map((id) => (
              <div key={id} className="flex gap-3">
                <Skeleton className="h-5 w-5 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <p className="text-muted-foreground text-xs">Could not load this asset&apos;s history.</p>
        ) : activities && activities.length > 0 ? (
          <AssetTimeline activities={activities} limit={TIMELINE_LIMIT} />
        ) : (
          <p className="text-muted-foreground text-xs">No history recorded for this asset.</p>
        )}
      </section>
    </div>
  )
}
