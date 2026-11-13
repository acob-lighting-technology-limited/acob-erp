"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2, PackageCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ResponsiveModal } from "@/components/ui/patterns/responsive-modal"
import { apiFetch } from "@/lib/api-client"
import { ASSET_REPORT_KINDS, ASSET_REPORT_KIND_LABELS, type AssetReportKind } from "@/lib/assets/asset-reports"
import { cn } from "@/lib/utils"
import { formatWATDate } from "@/lib/utils/date"

/** What the staff asset page knows about one of the person's assignments. */
export interface StaffAssetAssignment {
  id: string
  acceptance_status: string
  respond_by: string | null
  open_report_kind: string | null
  asset: { unique_code: string; asset_model?: string } | null
  assetTypeLabel: string
}

function assetName(a: StaffAssetAssignment) {
  return [a.assetTypeLabel, a.asset?.unique_code].filter(Boolean).join(" · ")
}

async function postJson(url: string, body?: unknown): Promise<string | null> {
  const res = await apiFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.ok) return null
  const payload = (await res.json().catch(() => null)) as { error?: string } | null
  return payload?.error || "Something went wrong. Please try again."
}

/** Confirms receipt of one assignment, then refreshes the page's server data. */
export function useAcceptAssignment() {
  const router = useRouter()
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const accept = async (assignment: StaffAssetAssignment) => {
    setAcceptingId(assignment.id)
    try {
      const error = await postJson(`/api/assets/assignments/${assignment.id}/accept`)
      if (error) toast.error(error)
      else {
        toast.success(`Thanks. ${assignment.asset?.unique_code ?? "The asset"} is recorded as received.`)
        router.refresh()
      }
    } finally {
      setAcceptingId(null)
    }
  }
  return { accept, acceptingId }
}

/**
 * Above the table while anything waits to be confirmed: one line per asset with Accept and
 * "I didn't get this". It says plainly what happens if they do nothing, so silence is a choice and
 * not a surprise.
 */
export function AssetAcceptanceBanner({
  pending,
  acceptingId,
  onAccept,
  onNotReceived,
}: {
  pending: StaffAssetAssignment[]
  acceptingId: string | null
  onAccept: (a: StaffAssetAssignment) => void
  onNotReceived: (a: StaffAssetAssignment) => void
}) {
  if (pending.length === 0) return null
  return (
    <section className="border-info/30 bg-info/10 mb-4 rounded-xl border p-4" aria-label="Assets to confirm">
      <div className="flex items-start gap-3">
        <PackageCheck className="text-info mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-semibold">
            {pending.length === 1
              ? "Please confirm you received this asset"
              : `Please confirm ${pending.length} assets`}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Accepting records that it is in your care. If you don&apos;t respond, it is recorded as received after three
            working days.
          </p>
          <ul className="mt-3 space-y-2">
            {pending.map((a) => (
              <li
                key={a.id}
                className="bg-background flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium">{assetName(a)}</p>
                  <p className="text-muted-foreground text-xs">
                    {a.asset?.asset_model ? `${a.asset.asset_model} · ` : ""}
                    {a.open_report_kind === "not_received"
                      ? "You reported you didn't get this. An asset admin is checking."
                      : a.respond_by
                        ? `Respond by ${formatWATDate(a.respond_by, { weekday: "short", day: "numeric", month: "short" })}`
                        : "Waiting for you"}
                  </p>
                </div>
                {a.open_report_kind !== "not_received" && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onNotReceived(a)}
                      disabled={acceptingId === a.id}
                    >
                      I didn&apos;t get this
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={() => onAccept(a)} loading={acceptingId === a.id}>
                      <CheckCircle2 className="h-4 w-4" />
                      Accept
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/**
 * Report a problem with an asset assigned to you: a fault goes to the asset issues list, anything
 * about the record goes to the asset admins to check. `initialKind` opens it on a reason (the
 * banner's "I didn't get this"). Give it a `key` per opening so its state starts fresh.
 */
export function ReportAssetProblemDialog({
  assignment,
  initialKind,
  onOpenChange,
}: {
  assignment: StaffAssetAssignment | null
  initialKind?: AssetReportKind
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [kind, setKind] = useState<AssetReportKind | null>(initialKind ?? null)
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  if (!assignment) return null

  // "I didn't receive it" only makes sense while the assignment is new.
  const kinds = ASSET_REPORT_KINDS.filter(
    (k) => k !== "not_received" || ["pending", "auto_accepted"].includes(assignment.acceptance_status)
  )
  const noteRequired = kind === "faulty" || kind === "wrong_details"

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!kind) {
      toast.error("Choose what the problem is")
      return
    }
    setSaving(true)
    try {
      const error = await postJson("/api/assets/reports", { assignment_id: assignment.id, kind, note })
      if (error) {
        toast.error(error)
        return
      }
      toast.success(
        kind === "faulty"
          ? "Fault reported. The asset team has been told."
          : "Report sent. An asset admin will check it and let you know."
      )
      onOpenChange(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveModal
      open={Boolean(assignment)}
      onOpenChange={onOpenChange}
      title="Report a problem"
      description={assetName(assignment)}
    >
      <form onSubmit={submit} className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">What&apos;s wrong?</legend>
          {kinds.map((k) => (
            <label
              key={k}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                kind === k ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              )}
            >
              <input
                type="radio"
                name="asset-report-kind"
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
                className="accent-primary mt-1"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{ASSET_REPORT_KIND_LABELS[k].label}</span>
                <span className="text-muted-foreground block text-xs">{ASSET_REPORT_KIND_LABELS[k].hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="asset-report-note">
            {kind === "faulty" ? "Describe the fault" : kind === "wrong_details" ? "What is wrong?" : "Details"}
            {noteRequired ? "" : " (optional)"}
          </Label>
          <Textarea
            id="asset-report-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder={
              kind === "faulty"
                ? "e.g. The screen flickers and the battery drains in an hour"
                : kind === "already_returned"
                  ? "e.g. Handed it to Farouk on 3 Nov"
                  : kind === "not_with_me"
                    ? "e.g. It is with the new site engineer"
                    : ""
            }
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={!kind}>
            Send report
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  )
}
