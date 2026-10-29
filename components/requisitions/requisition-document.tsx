/* eslint-disable @next/next/no-img-element -- signatures are short-lived signed URLs; print needs plain <img> */
import type { Requisition, RequisitionStage, RequisitionStageCode } from "@/lib/requisitions/types"
import { formatNaira } from "@/lib/requisitions/format"
import { STAGE_LABELS } from "@/lib/requisitions/routing"
import { cn } from "@/lib/utils"

/**
 * The requisition as the paper form: Payment Request Form or Petty-Cash
 * Voucher. Always light (it is a sheet of paper) and printable with the
 * browser's Save as PDF.
 */

function formatDate(value: string | null | undefined) {
  if (!value) return ""
  return new Date(value).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  })
}

function Letterhead({ boxLabel, boxValue }: { boxLabel: string; boxValue: string }) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <p className="text-right font-mono text-xs text-slate-500 sm:text-left">RC: 1324192</p>
        <img src="/images/acob-logo-light.png" alt="ACOB Lighting Technology Limited" className="h-12 w-auto" />
        <p className="text-xs text-slate-500">...Lighting up Nigeria</p>
      </div>
      <div className="space-y-2 sm:max-w-xs">
        <div className="space-y-0.5 text-xs leading-snug text-slate-600">
          <p>
            Plot 2, Block 14 Extension, Federal Ministry of Works and Housing Sites and Services Scheme, Gwarinpa Phase
            2, Abuja FCT.
          </p>
          <p>info@acoblighting.com, infoacob@gmail.com</p>
          <p>+234 704 920 2634, +234 803 290 2825</p>
          <p>www.acoblighting.com</p>
        </div>
        <div className="border border-slate-400 px-3 py-1.5 text-xs">
          <span className="font-bold uppercase">{boxLabel}:</span> <span className="font-semibold">{boxValue}</span>
        </div>
      </div>
    </div>
  )
}

function FieldLine({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-end sm:gap-2">
      <span className="shrink-0 text-xs font-bold uppercase">{label}:</span>
      <span className="min-h-[1.25rem] flex-1 border-b border-slate-500 pb-0.5 text-[12px] font-medium whitespace-pre-wrap">
        {value || ""}
      </span>
    </div>
  )
}

function BeneficiaryTable({ req }: { req: Requisition }) {
  const showAmounts = req.beneficiary_details.length > 1 && req.beneficiary_details.some((b) => b.amount != null)
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <p className="w-28 shrink-0 text-xs font-bold uppercase">Beneficiary details:</p>
      <div className="flex-1 overflow-x-auto">
        <table className="w-full border-collapse border border-slate-500 text-xs">
          <thead>
            <tr className="font-bold uppercase">
              <th className="border border-slate-500 p-1.5">Account name</th>
              <th className="border border-slate-500 p-1.5">Account no</th>
              <th className="border border-slate-500 p-1.5">Bank name</th>
              {showAmounts && <th className="border border-slate-500 p-1.5">Amount</th>}
            </tr>
          </thead>
          <tbody>
            {req.beneficiary_details.map((b, i) => (
              <tr key={`row-${i}`}>
                <td className="border border-slate-500 p-1.5">{b.account_name}</td>
                <td className="border border-slate-500 p-1.5 font-mono">{b.account_number}</td>
                <td className="border border-slate-500 p-1.5">{b.bank_name}</td>
                {showAmounts && (
                  <td className="border border-slate-500 p-1.5 text-right">
                    {b.amount != null ? formatNaira(b.amount) : ""}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SignatureSlot({ label, stage }: { label: string; stage?: RequisitionStage }) {
  let body: React.ReactNode = null
  if (stage?.state === "signed") {
    body = (
      <>
        {stage.signature_url ? (
          <img
            src={stage.signature_url}
            alt={`Signature of ${stage.actor?.full_name || "signer"}`}
            className="h-10 w-auto"
          />
        ) : null}
        <span className="font-semibold">{stage.actor?.full_name}</span>
        <span className="text-xs text-slate-500">{formatDate(stage.acted_at)}</span>
      </>
    )
  } else if (stage?.state === "bypassed") {
    body = (
      <span className="text-xs font-semibold text-slate-500 uppercase">
        Bypassed by {stage.actor?.full_name || "a later signer"} · {formatDate(stage.acted_at)}
      </span>
    )
  } else if (stage?.state === "not_required") {
    body = <span className="text-xs font-semibold text-slate-500 uppercase">Not required</span>
  } else if (stage?.state === "rejected") {
    body = (
      <span className="text-xs font-semibold text-red-700 uppercase">
        Rejected by {stage.actor?.full_name} · {formatDate(stage.acted_at)}
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-2">
      <span className="shrink-0 text-xs font-bold uppercase">{label}:</span>
      <span className="flex min-h-[2.75rem] flex-1 flex-col justify-end border-b border-slate-500 pb-0.5 text-xs">
        {body}
      </span>
    </div>
  )
}

function stageFor(req: Requisition, code: RequisitionStageCode) {
  return req.stages?.find((s) => s.stage_code === code)
}

function ProcessedSlot({ req }: { req: Requisition }) {
  const payments = req.payments || []
  const last = payments[payments.length - 1]
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-2">
      <span className="shrink-0 text-xs font-bold uppercase">Processed by:</span>
      <span className="flex min-h-[2.75rem] flex-1 flex-col justify-end border-b border-slate-500 pb-0.5 text-xs">
        {last ? (
          <>
            {last.signature_url ? (
              <img
                src={last.signature_url}
                alt={`Signature of ${last.recorder?.full_name || "processor"}`}
                className="h-10 w-auto"
              />
            ) : null}
            <span className="font-semibold">{last.recorder?.full_name}</span>
            <span className="text-xs text-slate-500">
              {payments.length > 1 ? `${payments.length} payments, ` : ""}
              {formatNaira(req.amount_paid)} paid · last {formatDate(last.paid_on)}
              {last.reference ? ` · ref ${last.reference}` : ""}
            </span>
          </>
        ) : null}
      </span>
    </div>
  )
}

function PaymentRequestSheet({ req }: { req: Requisition }) {
  return (
    <>
      <Letterhead boxLabel="Site location" boxValue={req.site_location || ""} />
      <div className="mb-5 border border-slate-500 py-2 text-center text-sm font-bold tracking-wide uppercase">
        Payment Request Form
      </div>
      <div className="space-y-4">
        <FieldLine label="Requested by" value={req.requester?.full_name} />
        <FieldLine label="Amount in words" value={req.amount_in_words} />
        <FieldLine label="Purpose" value={req.purpose} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr]">
          <div className="border border-slate-500 px-2 py-1.5 text-xs">
            <span className="font-bold uppercase">Project:</span> {req.project_name}
          </div>
          <div className="border border-slate-500 px-2 py-1.5 text-xs">
            <span className="font-bold uppercase">Date:</span> {formatDate(req.created_at)}
          </div>
          <div className="border border-slate-500 px-2 py-1.5 text-xs">
            <span className="font-bold uppercase">Amount (₦):</span> {formatNaira(req.amount).slice(1)}
          </div>
        </div>
        {req.funding_category_name ? (
          <p className="text-xs">
            <span className="font-bold uppercase">Funding:</span> {req.funding_category_name}
          </p>
        ) : null}
        <BeneficiaryTable req={req} />
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 pt-4 sm:grid-cols-2">
          <SignatureSlot label={STAGE_LABELS.reviewed + " by"} stage={stageFor(req, "reviewed")} />
          <SignatureSlot label={STAGE_LABELS.authorized + " by"} stage={stageFor(req, "authorized")} />
          <SignatureSlot label={STAGE_LABELS.verified + " by"} stage={stageFor(req, "verified")} />
          <SignatureSlot label={STAGE_LABELS.approved + " by"} stage={stageFor(req, "approved")} />
          <ProcessedSlot req={req} />
        </div>
      </div>
    </>
  )
}

function PettyCashSheet({ req }: { req: Requisition }) {
  return (
    <>
      <Letterhead boxLabel="Date" boxValue={formatDate(req.created_at)} />
      <table className="mb-4 w-full border-collapse border border-slate-500 text-xs">
        <thead>
          <tr>
            <th colSpan={3} className="border border-slate-500 p-2 text-sm font-bold tracking-wide uppercase">
              Petty-Cash Voucher
            </th>
          </tr>
          <tr className="font-bold uppercase">
            <th className="w-12 border border-slate-500 p-1.5">S/N</th>
            <th className="border border-slate-500 p-1.5">Description</th>
            <th className="w-36 border border-slate-500 p-1.5">Amount</th>
          </tr>
        </thead>
        <tbody>
          {req.line_items.map((item, i) => (
            <tr key={`row-${i}`}>
              <td className="border border-slate-500 p-1.5 text-center">{i + 1}</td>
              <td className="border border-slate-500 p-1.5">{item.description}</td>
              <td className="border border-slate-500 p-1.5 text-right">{formatNaira(item.amount).slice(1)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2} className="p-1.5 text-right font-bold uppercase">
              Total amount (₦)
            </td>
            <td className="border border-slate-500 p-1.5 text-right font-bold">{formatNaira(req.amount).slice(1)}</td>
          </tr>
        </tbody>
      </table>
      <div className="space-y-4">
        <FieldLine label="Total amount in words" value={req.amount_in_words} />
        <BeneficiaryTable req={req} />
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 pt-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-2">
            <span className="shrink-0 text-xs font-bold uppercase">Requested by:</span>
            <span className="flex min-h-[2.75rem] flex-1 flex-col justify-end border-b border-slate-500 pb-0.5 text-xs">
              <span className="font-semibold">{req.requester?.full_name}</span>
              <span className="text-xs text-slate-500">Submitted {formatDate(req.created_at)}</span>
            </span>
          </div>
          <SignatureSlot label={STAGE_LABELS.authorized + " by"} stage={stageFor(req, "authorized")} />
          <SignatureSlot label={STAGE_LABELS.approved + " by"} stage={stageFor(req, "approved")} />
          {req.payments?.length ? <ProcessedSlot req={req} /> : null}
        </div>
      </div>
    </>
  )
}

export function RequisitionDocument({ requisition, className }: { requisition: Requisition; className?: string }) {
  return (
    <article
      className={cn(
        "requisition-document mx-auto w-full max-w-[210mm] rounded-lg border border-slate-300 bg-white p-5 text-slate-900 shadow-sm sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none",
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between font-mono text-xs text-slate-500">
        <span>{requisition.requisition_number}</span>
        <span>{requisition.department}</span>
      </div>
      {requisition.form_type === "petty_cash" ? (
        <PettyCashSheet req={requisition} />
      ) : (
        <PaymentRequestSheet req={requisition} />
      )}
      <p className="mt-8 text-center text-xs font-bold tracking-wide uppercase">Attach relevant supporting documents</p>
    </article>
  )
}
