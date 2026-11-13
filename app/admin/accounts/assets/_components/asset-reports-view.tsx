"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check, MessageSquareWarning, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DataTable } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { DetailList, SectionHeading } from "@/components/ui/detail-list"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ResponsiveModal } from "@/components/ui/patterns/responsive-modal"
import { apiFetch, apiJson } from "@/lib/api-client"
import { ASSET_TYPE_MAP } from "@/lib/asset-types"
import {
  ASSET_REPORT_KIND_LABELS,
  ASSET_REPORT_STATUS_LABELS,
  CUSTODY_REPORT_KINDS,
  type AssetReport,
  type AssetReportStatus,
} from "@/lib/assets/asset-reports"
import { QUERY_KEYS } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
import { formatWATDateTime } from "@/lib/utils/date"

const STATUS_CLASSES: Record<AssetReportStatus, string> = {
  open: "bg-warning/15 text-warning",
  resolved: "bg-success/15 text-success",
  rejected: "bg-muted text-muted-foreground",
}

export function useAssetReports() {
  return useQuery({
    queryKey: QUERY_KEYS.adminAssetReports(),
    queryFn: async () =>
      (await apiJson<{ data: AssetReport[] }>("/api/admin/assets/reports", { cache: "no-store" })).data,
    staleTime: 60_000,
    meta: { errorMessage: "Failed to load staff reports" },
  })
}

function assetLine(r: AssetReport) {
  const type = ASSET_TYPE_MAP[r.asset_type]?.label || r.asset_type
  return [type, r.asset_model].filter(Boolean).join(" · ")
}

type Decision = { report: AssetReport; outcome: "resolved" | "rejected" }

/**
 * Resolve or reject one report. Resolving an "I don't have it" report offers to release the asset
 * in the same step (ticked by default while the reporter still holds it); the admin is the one who
 * checked, so it never happens without them.
 */
function DecisionDialog({
  decision,
  onOpenChange,
  onDecided,
}: {
  decision: Decision | null
  onOpenChange: (open: boolean) => void
  onDecided: (released: boolean) => void
}) {
  const report = decision?.report
  const canRelease = Boolean(
    report && decision?.outcome === "resolved" && CUSTODY_REPORT_KINDS.has(report.kind) && report.assignment_current
  )
  const [note, setNote] = useState("")
  const [release, setRelease] = useState(canRelease)
  const [saving, setSaving] = useState(false)
  if (!decision || !report) return null
  const rejecting = decision.outcome === "rejected"

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const res = await apiFetch(`/api/admin/assets/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: decision.outcome, note, release: canRelease && release }),
      })
      const payload = (await res.json().catch(() => null)) as { error?: string; released?: boolean } | null
      if (!res.ok) {
        toast.error(payload?.error || "Could not save the decision")
        return
      }
      toast.success(
        rejecting
          ? `Report rejected. ${report.reported_by_name} has been told.`
          : `Report resolved${payload?.released ? " and the asset released" : ""}. ${report.reported_by_name} has been told.`
      )
      onDecided(Boolean(payload?.released))
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveModal
      open
      onOpenChange={onOpenChange}
      title={rejecting ? "Reject report" : "Resolve report"}
      description={`${report.unique_code}: ${ASSET_REPORT_KIND_LABELS[report.kind].label} (${report.reported_by_name})`}
    >
      <form onSubmit={submit} className="space-y-4">
        {report.kind === "wrong_details" && !rejecting ? (
          <p className="text-muted-foreground text-xs">
            Correct the details first with Edit / View Asset on the Assets tab, then resolve this.
          </p>
        ) : null}
        {canRelease ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5">
            <Checkbox checked={release} onCheckedChange={(v) => setRelease(v === true)} className="mt-0.5" />
            <span className="text-sm">
              <span className="block font-medium">Release the asset from {report.reported_by_name}</span>
              <span className="text-muted-foreground block text-xs">
                Only if you have confirmed it is back in store or no longer with them. You can reassign it afterwards.
              </span>
            </span>
          </label>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="asset-report-decision-note">
            {rejecting ? "Why are you rejecting it?" : "Note to the reporter (optional)"}
          </Label>
          <Textarea
            id="asset-report-decision-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder={rejecting ? "e.g. Our handover form shows you signed for it on 26 Jan" : ""}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={rejecting ? "destructive" : "default"}
            loading={saving}
            disabled={rejecting && note.trim().length < 3}
          >
            {rejecting ? "Reject" : "Resolve"}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  )
}

/**
 * Problems staff reported about assets assigned to them (from /accounts/assets): not received,
 * not with them, already returned, wrong details. Faults go to Asset issues instead. Open reports
 * show first; the person is notified of every decision.
 */
export function AssetReportsView({
  assetIds,
  onAssetsChanged,
}: {
  assetIds: Set<string>
  onAssetsChanged: () => void
}) {
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch } = useAssetReports()
  const [decision, setDecision] = useState<Decision | null>(null)

  const rows = useMemo(() => (data ?? []).filter((r) => assetIds.has(r.asset_id)), [data, assetIds])

  const filters = useMemo<DataTableFilter<AssetReport>[]>(
    () => [
      {
        key: "status",
        label: "Status",
        options: (Object.keys(ASSET_REPORT_STATUS_LABELS) as AssetReportStatus[]).map((status) => ({
          value: status,
          label: ASSET_REPORT_STATUS_LABELS[status],
        })),
        placeholder: "All",
        defaultValues: ["open"],
      },
      {
        key: "kind",
        label: "Problem",
        options: Object.entries(ASSET_REPORT_KIND_LABELS)
          .filter(([kind]) => kind !== "faulty")
          .map(([value, { label }]) => ({ value, label })),
        placeholder: "Any problem",
      },
    ],
    []
  )

  const columns = useMemo<DataTableColumn<AssetReport>[]>(
    () => [
      {
        key: "created_at",
        label: "Reported",
        sortable: true,
        accessor: (r) => r.created_at,
        render: (r) => <span className="text-sm whitespace-nowrap">{formatWATDateTime(r.created_at)}</span>,
      },
      {
        key: "unique_code",
        label: "Asset",
        sortable: true,
        accessor: (r) => r.unique_code,
        render: (r) => (
          <div>
            <div className="font-medium">{r.unique_code}</div>
            <div className="text-muted-foreground text-xs">{assetLine(r)}</div>
          </div>
        ),
      },
      {
        key: "kind",
        label: "Problem",
        accessor: (r) => ASSET_REPORT_KIND_LABELS[r.kind].label,
        render: (r) => (
          <div className="space-y-0.5">
            <div className="font-medium">{ASSET_REPORT_KIND_LABELS[r.kind].label}</div>
            {r.note ? <div className="text-muted-foreground line-clamp-1 text-xs">{r.note}</div> : null}
          </div>
        ),
        resizable: true,
        initialWidth: 260,
      },
      {
        key: "reported_by_name",
        label: "Reported by",
        sortable: true,
        accessor: (r) => r.reported_by_name,
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        accessor: (r) => r.status,
        render: (r) => <Badge className={STATUS_CLASSES[r.status]}>{ASSET_REPORT_STATUS_LABELS[r.status]}</Badge>,
      },
    ],
    []
  )

  const afterDecision = (released: boolean) => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminAssetReports() })
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminAssetHistory() })
    if (released) onAssetsChanged()
  }

  return (
    <>
      <DataTable<AssetReport>
        data={rows}
        columns={columns}
        filters={filters}
        getRowId={(r) => r.id}
        searchPlaceholder="Search asset code, person or note…"
        searchFn={(r, q) =>
          [r.unique_code, r.asset_model ?? "", r.reported_by_name, r.note ?? "", ASSET_REPORT_KIND_LABELS[r.kind].label]
            .join(" ")
            .toLowerCase()
            .includes(q)
        }
        pagination={{ pageSize: 50 }}
        isLoading={isLoading}
        error={error ? "Failed to load staff reports" : null}
        onRetry={() => void refetch()}
        rowActions={[
          {
            label: "Resolve",
            icon: Check,
            primary: true,
            onClick: (report) => setDecision({ report, outcome: "resolved" }),
            hidden: (report) => report.status !== "open",
          },
          {
            label: "Reject",
            icon: X,
            variant: "destructive",
            onClick: (report) => setDecision({ report, outcome: "rejected" }),
            hidden: (report) => report.status !== "open",
          },
        ]}
        viewToggle
        contactsView
        stickyToolbar
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        mobileRow={{
          title: (r) => `${r.unique_code} · ${ASSET_REPORT_KIND_LABELS[r.kind].label}`,
          subtitle: (r) => `${r.reported_by_name} · ${formatWATDateTime(r.created_at)}`,
          snippet: (r) => r.note,
          trailing: (r) => <Badge className={STATUS_CLASSES[r.status]}>{ASSET_REPORT_STATUS_LABELS[r.status]}</Badge>,
          detail: {
            title: (r) => `${r.unique_code} · ${ASSET_REPORT_KIND_LABELS[r.kind].label}`,
            subtitle: (r) => `${r.reported_by_name} · ${formatWATDateTime(r.created_at)}`,
            fields: (r) => [
              { label: "Asset", value: assetLine(r) || "—" },
              { label: "Status", value: ASSET_REPORT_STATUS_LABELS[r.status] },
              { label: "Their note", value: r.note || "No note.", fullWidth: true },
              ...(r.status !== "open"
                ? [
                    { label: "Decided by", value: r.resolved_by_name ?? "—" },
                    { label: "Decision note", value: r.resolution_note || "—", fullWidth: true },
                  ]
                : []),
            ],
          },
        }}
        emptyTitle="No staff reports"
        emptyDescription="When someone reports a problem with an asset assigned to them, it shows here."
        emptyIcon={MessageSquareWarning}
        expandable={{
          render: (r) => (
            <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
              <div className="space-y-3">
                <SectionHeading title="Report" />
                <DetailList
                  items={[
                    { label: "Problem", value: ASSET_REPORT_KIND_LABELS[r.kind].label },
                    { label: "Reported by", value: r.reported_by_name },
                    { label: "When", value: formatWATDateTime(r.created_at) },
                    { label: "Asset", value: `${r.unique_code}${assetLine(r) ? ` · ${assetLine(r)}` : ""}` },
                    {
                      label: "Still assigned to them",
                      value: r.assignment_current ? "Yes" : "No, it has moved since",
                    },
                  ]}
                />
                <section className="bg-muted/35 rounded-lg p-4" aria-label="Their note">
                  <span className="text-muted-foreground block text-xs font-semibold tracking-wide uppercase">
                    Their note
                  </span>
                  <p
                    className={cn(
                      "mt-2 text-sm leading-6 whitespace-pre-wrap",
                      r.note ? "text-foreground" : "text-muted-foreground italic"
                    )}
                  >
                    {r.note || "No note was added."}
                  </p>
                </section>
              </div>
              <div className="space-y-3">
                <SectionHeading title="Decision" />
                {r.status === "open" ? (
                  <>
                    <p className="text-muted-foreground text-xs">
                      {CUSTODY_REPORT_KINDS.has(r.kind)
                        ? "Check where the asset is. If they are right, resolve it and release the asset; if not, reject it and say why."
                        : "Fix the details with Edit / View Asset, then resolve it. Reject it if the details are right."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button className="gap-2" onClick={() => setDecision({ report: r, outcome: "resolved" })}>
                        <Check className="h-4 w-4" /> Resolve
                      </Button>
                      <Button
                        variant="destructive"
                        className="gap-2"
                        onClick={() => setDecision({ report: r, outcome: "rejected" })}
                      >
                        <X className="h-4 w-4" /> Reject
                      </Button>
                    </div>
                  </>
                ) : (
                  <DetailList
                    items={[
                      { label: "Outcome", value: ASSET_REPORT_STATUS_LABELS[r.status] },
                      { label: "Decided by", value: r.resolved_by_name },
                      { label: "When", value: r.resolved_at ? formatWATDateTime(r.resolved_at) : null },
                      ...(r.status === "resolved"
                        ? [{ label: "Asset released", value: r.released ? "Yes" : "No" }]
                        : []),
                      { label: "Note", value: r.resolution_note || "No note.", wide: true },
                    ]}
                  />
                )}
              </div>
            </div>
          ),
        }}
      />
      <DecisionDialog
        key={decision ? `${decision.report.id}-${decision.outcome}` : "closed"}
        decision={decision}
        onOpenChange={(open) => {
          if (!open) setDecision(null)
        }}
        onDecided={afterDecision}
      />
    </>
  )
}
