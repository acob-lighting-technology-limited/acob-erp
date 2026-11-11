import { CircleAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatWATDateTime } from "@/lib/utils/date"
import type { Requisition } from "@/lib/requisitions/types"

/**
 * Shown when a line of this requisition came back unpaid from the bank. It
 * stays until the requisition is paid in full, so the requester and signers
 * know to follow it up.
 */
export function UnpaidTag({
  requisition: r,
}: {
  requisition: Pick<Requisition, "unpaid_at" | "unpaid_note" | "unpaid_count">
}) {
  if (!r.unpaid_at) return null
  const times = (r.unpaid_count ?? 1) > 1 ? ` (${r.unpaid_count} times)` : ""
  return (
    <Badge
      variant="outline"
      className="border-danger/30 bg-danger/15 text-danger w-fit gap-1 text-xs"
      title={`${r.unpaid_note || "Not paid"} · ${formatWATDateTime(r.unpaid_at)}`}
    >
      <CircleAlert className="h-3 w-3" />
      Not paid{times}
    </Badge>
  )
}

/** The fuller notice for the requisition's own page. */
export function UnpaidNotice({
  requisition: r,
}: {
  requisition: Pick<Requisition, "unpaid_at" | "unpaid_note" | "unpaid_count">
}) {
  if (!r.unpaid_at) return null
  return (
    <div className="border-danger/30 bg-danger/15 text-danger flex items-start gap-2.5 rounded-md border px-3 py-2 text-xs">
      <CircleAlert className="mt-px h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          Not paid{(r.unpaid_count ?? 1) > 1 ? ` · ${r.unpaid_count} times` : ""} · {formatWATDateTime(r.unpaid_at)}
        </p>
        {r.unpaid_note ? <p className="mt-0.5 leading-relaxed">{r.unpaid_note}</p> : null}
        <p className="mt-0.5 leading-relaxed">
          It is back with Accounts for the next payment schedule. Follow it up with them.
        </p>
      </div>
    </div>
  )
}
