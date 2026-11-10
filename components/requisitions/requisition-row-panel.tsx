import { Check, Eye, FastForward, Paperclip, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DetailList, SectionHeading, type DetailListItem } from "@/components/ui/detail-list"
import { formatNaira, stagesOverriddenBy } from "@/lib/requisitions/format"
import type { Requisition } from "@/lib/requisitions/types"
import { RequisitionBeneficiaryTable } from "./requisition-beneficiary-table"
import { RequisitionStageList, RequisitionStatusStrip } from "./requisition-stage-list"
import type { SignMode } from "./sign-dialog"

function overviewItems(r: Requisition): DetailListItem[] {
  const paid = Number(r.amount_paid) > 0 ? formatNaira(r.amount_paid) : "Not yet"
  if (r.form_type === "petty_cash") {
    return [
      { label: "Amount", value: formatNaira(r.amount) },
      { label: "Paid", value: paid },
      { label: "Items", value: String(r.line_items.length) },
    ]
  }
  return [
    { label: "Project", value: r.project_name },
    { label: "Site location", value: r.site_location },
    { label: "Funding", value: r.funding_category_name },
    { label: "Amount", value: formatNaira(r.amount) },
    { label: "Paid", value: paid },
    { label: "Purpose", value: <span className="whitespace-pre-line">{r.purpose}</span>, wide: true },
  ]
}

/**
 * A requisition's expanded row, laid out like leave's: overview, status and
 * who gets paid on the left; the approval stages on the right.
 */
export function RequisitionRowPanel({
  requisition: r,
  onOpen,
  onSign,
}: {
  requisition: Requisition
  onOpen: () => void
  /** Set when the viewer can sign this requisition now. */
  onSign?: (mode: SignMode) => void
}) {
  const overridden = stagesOverriddenBy(r, r.sign_stage_id)
  return (
    <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
      <div className="space-y-3">
        <SectionHeading
          title="Requisition overview"
          aside={
            <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onOpen}>
              <Eye className="h-3.5 w-3.5" />
              Open details
            </Button>
          }
        />
        <RequisitionStatusStrip requisition={r} />
        <DetailList items={overviewItems(r)} />

        {r.form_type === "petty_cash" && r.line_items.length ? (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full border-collapse text-xs">
              <tbody>
                {r.line_items.map((item, i) => (
                  <tr key={`item-${i}`} className="border-b last:border-b-0">
                    <td className="text-muted-foreground w-8 p-2">{i + 1}</td>
                    <td className="p-2">{item.description}</td>
                    <td className="p-2 text-right font-mono">{formatNaira(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {r.beneficiary_details.length ? (
          <section className="space-y-2.5 pt-1">
            <SectionHeading title="Beneficiaries" aside={String(r.beneficiary_details.length)} />
            <RequisitionBeneficiaryTable beneficiaries={r.beneficiary_details} />
          </section>
        ) : null}

        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Paperclip className="h-3.5 w-3.5" />
          {r.attachments?.length
            ? `${r.attachments.length} supporting document${r.attachments.length === 1 ? "" : "s"} · open details to view`
            : "No supporting documents attached."}
        </p>
      </div>

      <RequisitionStageList requisition={r} />

      {onSign ? (
        <div className="flex gap-2 border-t pt-3 md:col-span-2">
          {overridden.length ? (
            <Button onClick={() => onSign("sign")} className="gap-2">
              <FastForward className="h-4 w-4" /> Override
            </Button>
          ) : (
            <Button onClick={() => onSign("sign")} className="gap-2">
              <Check className="h-4 w-4" /> Sign
            </Button>
          )}
          <Button variant="destructive" onClick={() => onSign("reject")} className="gap-2">
            <X className="h-4 w-4" /> Reject
          </Button>
        </div>
      ) : null}
    </div>
  )
}
