import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { DetailList, SectionHeading } from "@/components/ui/detail-list"
import { formatNaira, progressLabel } from "@/lib/requisitions/format"
import type { PaymentScheduleItem, Requisition } from "@/lib/requisitions/types"
import { formatWATDateTime } from "@/lib/utils/date"
import { ADMIN_REQUISITIONS_PATH } from "../requisition-paths"
import { RequisitionStageList, RequisitionStatusStrip } from "../requisition-stage-list"
import { UnpaidTag } from "../unpaid-tag"
import { OutcomeBadge } from "./schedule-status"

/**
 * The expanded row of a schedule line: where its requisition stands (status and
 * the approval route), what this line pays and what the bank did with it.
 */
export function ScheduleLinePanel({ item }: { item: PaymentScheduleItem }) {
  const r = item.requisition
  if (!r) return <p className="text-muted-foreground text-xs">This requisition is no longer available.</p>
  // The shape the route and status strip draw from; the rest of a requisition is not needed here.
  const requisition = r as unknown as Requisition

  return (
    <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
      <div className="space-y-3">
        <SectionHeading
          title="This payment"
          aside={
            <Link
              href={`${ADMIN_REQUISITIONS_PATH}/${r.id}`}
              className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
            >
              Open {r.requisition_number}
              <ExternalLink className="h-3 w-3" />
            </Link>
          }
        />
        <RequisitionStatusStrip requisition={requisition} />
        {r.unpaid_at ? <UnpaidTag requisition={r} /> : null}
        <DetailList
          items={[
            { label: "Requested", value: formatWATDateTime(r.created_at) },
            { label: "Requested by", value: r.requester?.full_name },
            { label: "Department", value: r.department },
            { label: "Beneficiary", value: `${item.account_name} · ${item.bank_name} ${item.account_number}` },
            { label: "This payment", value: formatNaira(item.amount) },
            {
              label: "Whole request",
              value: `${formatNaira(r.amount)} · paid ${formatNaira(r.amount_paid)}`,
            },
            { label: "Where it is", value: progressLabel(requisition) },
            { label: "Bank outcome", value: <OutcomeBadge outcome={item.outcome} /> },
            ...(item.outcome_note ? [{ label: "Note", value: item.outcome_note }] : []),
            ...(item.bank_reference ? [{ label: "Bank reference", value: item.bank_reference }] : []),
            { label: "Purpose", value: <span className="whitespace-pre-line">{r.purpose}</span>, wide: true },
          ]}
        />
      </div>
      <RequisitionStageList requisition={requisition} />
    </div>
  )
}
