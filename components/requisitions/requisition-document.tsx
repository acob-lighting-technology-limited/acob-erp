/* eslint-disable @next/next/no-img-element -- signatures are short-lived signed URLs, and the PDF capture needs plain <img> */
import type { Ref } from "react"
import { Globe, Mail, MapPin, Phone } from "lucide-react"
import type { Requisition, RequisitionStage, RequisitionStageCode } from "@/lib/requisitions/types"
import { formatNaira } from "@/lib/requisitions/format"
import { MAX_BENEFICIARIES } from "@/lib/requisitions/limits"
import { accountNamesMatch } from "@/lib/requisitions/nuban"
import { isRaisedByHolder, STAGE_LABELS } from "@/lib/requisitions/routing"
import { cn } from "@/lib/utils"
import { SignatureMark } from "./signature-mark"

/**
 * The requisition as the paper form: Payment Request Form or Petty-Cash
 * Voucher. Always light (it is a sheet of paper). Layout switches on the
 * sheet's own width (container queries), so the PDF captured at A4 width looks
 * the same whatever screen it was downloaded from.
 */

/** The ACOB Lighting wordmark. The acob-logo-* files carry the Matrix brand. */
const LETTERHEAD_LOGO = "/images/acob-lighting-letterhead.png"

const CONTACT_LINES = [
  {
    icon: MapPin,
    text: "Plot 2, Block 14 Extension, Federal Ministry of Works and Housing Sites and Services Scheme, Gwarinpa Phase 2, Abuja FCT.",
  },
  { icon: Mail, text: "info@acoblighting.com, infoacob@gmail.com" },
  { icon: Phone, text: "+234 704 920 2634, +234 803 290 2825" },
  { icon: Globe, text: "www.acoblighting.com" },
] as const

function formatDate(value: string | null | undefined) {
  if (!value) return ""
  return new Date(value).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  })
}

interface RefCell {
  label: string
  value: string
}

function Letterhead({ cells }: { cells: RefCell[] }) {
  return (
    <header className="mb-5">
      <div className="flex flex-col gap-3 border-b-2 border-slate-800 pb-3 @xl:flex-row @xl:items-start @xl:justify-between">
        <div className="space-y-1.5">
          <img src={LETTERHEAD_LOGO} alt="ACOB Lighting Technology Limited" className="h-11 w-auto" />
          <p className="text-xs text-slate-500">
            <span className="font-mono">RC: 1324192</span> · ...Lighting up Nigeria
          </p>
        </div>
        <address className="space-y-1 text-xs leading-snug text-slate-600 not-italic @xl:max-w-[19rem]">
          {CONTACT_LINES.map(({ icon: Icon, text }) => (
            <p key={text} className="flex items-start gap-1.5">
              <Icon className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              <span>{text}</span>
            </p>
          ))}
        </address>
      </div>
      {cells.length === 2 ? (
        // Two references, each in its own box, at either end of the line.
        <div className="mt-3 flex flex-col gap-2 text-xs @xl:flex-row @xl:justify-between">
          {cells.map((cell) => (
            <div key={`cell-${cell.label}`} className="border border-slate-500 px-2.5 py-1.5">
              <span className="font-bold uppercase">{cell.label}:</span>{" "}
              <span className="font-semibold">{cell.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 border border-slate-500 text-xs @xl:grid-cols-3">
          {cells.map((cell, i) => (
            <div
              key={`cell-${cell.label}`}
              className={cn("px-2.5 py-1.5", i > 0 && "border-t border-slate-500 @xl:border-t-0 @xl:border-l")}
            >
              <span className="font-bold uppercase">{cell.label}:</span>{" "}
              <span className="font-semibold">{cell.value}</span>
            </div>
          ))}
        </div>
      )}
    </header>
  )
}

function FormTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 border border-slate-500 py-2 text-center text-sm font-bold tracking-wide uppercase">
      {children}
    </div>
  )
}

/** One ruled line per line of text, so a long field fills as many lines as it needs. */
const RULED_LINES = {
  backgroundImage: "linear-gradient(to bottom, transparent calc(1.5rem - 1px), #64748b calc(1.5rem - 1px))",
  backgroundSize: "100% 1.5rem",
} as const

/** A filled-in form field: the label on the first line, the value written on ruled lines. */
function FieldLine({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col @xl:flex-row @xl:items-start @xl:gap-2">
      <span className="shrink-0 text-xs leading-6 font-bold uppercase">{label}:</span>
      <span
        className="min-h-6 flex-1 text-xs leading-6 font-medium break-words whitespace-pre-wrap"
        style={RULED_LINES}
      >
        {value?.trim() || ""}
      </span>
    </div>
  )
}

/** Petty-cash vouchers print with at least this many item rows, like the paper pad, so the page reads as a form. */
const MIN_VOUCHER_ROWS = 12

function blankRows(filled: number, upTo: number) {
  return Array.from({ length: Math.max(0, upTo - filled) }, (_, i) => i)
}

function BeneficiaryTable({ req }: { req: Requisition }) {
  const showAmounts = req.beneficiary_details.length > 1 && req.beneficiary_details.some((b) => b.amount != null)
  const showPurpose = req.beneficiary_details.some((b) => b.purpose)
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold uppercase">Beneficiary details:</p>
      <div className="min-w-0">
        <table className="w-full border-collapse border border-slate-500 text-xs break-words">
          <thead>
            <tr className="font-bold uppercase">
              <th className="border border-slate-500 p-1.5">Account name</th>
              <th className="border border-slate-500 p-1.5">Account no</th>
              <th className="border border-slate-500 p-1.5">Bank name</th>
              {showPurpose && <th className="border border-slate-500 p-1.5">Purpose</th>}
              {showAmounts && <th className="border border-slate-500 p-1.5">Amount</th>}
            </tr>
          </thead>
          <tbody>
            {req.beneficiary_details.map((b, i) => (
              <tr key={`row-${i}`}>
                <td className="border border-slate-500 p-1.5">
                  {b.account_name}
                  {b.verified_account_name ? (
                    <span className="block text-slate-500">
                      {accountNamesMatch(b.account_name, b.verified_account_name)
                        ? "✓ Confirmed by the bank"
                        : `Bank has: ${b.verified_account_name}`}
                    </span>
                  ) : null}
                </td>
                <td className="border border-slate-500 p-1.5 font-mono">{b.account_number}</td>
                <td className="border border-slate-500 p-1.5">{b.bank_name}</td>
                {showPurpose && <td className="border border-slate-500 p-1.5">{b.purpose || ""}</td>}
                {showAmounts && (
                  <td className="border border-slate-500 p-1.5 text-right">
                    {b.amount != null ? formatNaira(b.amount) : ""}
                  </td>
                )}
              </tr>
            ))}
            {/* Empty ruled rows up to what the form allows, as on the printed sheet. */}
            {blankRows(req.beneficiary_details.length, MAX_BENEFICIARIES[req.form_type]).map((i) => (
              <tr key={`blank-${i}`} aria-hidden>
                {Array.from({ length: 3 + Number(showPurpose) + Number(showAmounts) }, (_, c) => (
                  <td key={c} className="h-8 border border-slate-500" />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface SlotContent {
  /** Signature image, or a short status line when the slot was not signed. */
  signatureUrl?: string | null
  status?: { text: string; tone?: "muted" | "danger" }
  name?: string | null
  date?: string | null
  /** Extra line under the name row (payment totals and reference). */
  detail?: string | null
}

/**
 * One signature box: label beside the line; above the line, the signature with
 * the signer's name and date in one row under it.
 */
function Slot({ label, content }: { label: string; content: SlotContent }) {
  const { signatureUrl, status, name, date, detail } = content
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
      <span className="self-end pb-0.5 text-xs font-bold uppercase">{label}:</span>
      <div className="border-b border-slate-500 pb-0.5">
        <div className="flex h-11 items-end">
          {signatureUrl ? (
            <SignatureMark src={signatureUrl} name={name} className="max-h-11" />
          ) : status ? (
            <span
              className={cn(
                "text-xs font-semibold uppercase",
                status.tone === "danger" ? "text-red-700" : "text-slate-500"
              )}
            >
              {status.text}
            </span>
          ) : null}
        </div>
        <div className="flex min-h-4 items-baseline gap-3 text-xs">
          {name ? <span className="truncate font-semibold">{name}</span> : null}
          {date ? <span className="shrink-0 text-slate-500">{date}</span> : null}
        </div>
      </div>
      {detail ? (
        <>
          <span aria-hidden />
          <p className="pt-1 text-xs text-slate-500">{detail}</p>
        </>
      ) : null}
    </div>
  )
}

function requesterContent(req: Requisition): SlotContent {
  return {
    signatureUrl: req.requester_signature_url,
    name: req.requester?.full_name,
    date: formatDate(req.created_at),
  }
}

function stageContent(req: Requisition, stage?: RequisitionStage): SlotContent {
  if (!stage) return {}
  const who = stage.actor?.full_name
  switch (stage.state) {
    case "signed":
      return { signatureUrl: stage.signature_url, name: who, date: formatDate(stage.acted_at) }
    case "bypassed":
      return {
        status: { text: `Bypassed by ${who || "a later signer"}` },
        date: formatDate(stage.acted_at),
      }
    case "rejected":
      return { status: { text: "Rejected", tone: "danger" }, name: who, date: formatDate(stage.acted_at) }
    case "not_required":
      // The requester holds this role, so their own signature stands here.
      return isRaisedByHolder(stage) ? requesterContent(req) : { status: { text: "Not required" } }
    default:
      return {}
  }
}

function stageFor(req: Requisition, code: RequisitionStageCode) {
  return req.stages?.find((s) => s.stage_code === code)
}

function StageSlot({ req, code }: { req: Requisition; code: RequisitionStageCode }) {
  return <Slot label={`${STAGE_LABELS[code]} by`} content={stageContent(req, stageFor(req, code))} />
}

function ProcessedSlot({ req }: { req: Requisition }) {
  const payments = req.payments || []
  const last = payments[payments.length - 1]
  const content: SlotContent = last
    ? {
        signatureUrl: last.signature_url,
        name: last.recorder?.full_name,
        date: formatDate(last.paid_on),
        detail: [
          payments.length > 1 ? `${payments.length} payments` : null,
          `${formatNaira(req.amount_paid)} paid`,
          last.reference ? `ref ${last.reference}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      }
    : {}
  return <Slot label="Processed by" content={content} />
}

function SignatureGrid({ children }: { children: React.ReactNode }) {
  // Signatures follow the content. The sheet stays A4, so any spare room is blank paper at the foot.
  return <div className="grid grid-cols-1 gap-x-8 gap-y-5 pt-10 @xl:grid-cols-2">{children}</div>
}

function PaymentRequestSheet({ req }: { req: Requisition }) {
  return (
    <>
      <Letterhead
        cells={[
          { label: "No", value: req.requisition_number },
          { label: "Department", value: req.department },
        ]}
      />
      <FormTitle>Payment Request Form</FormTitle>
      <div className="flex flex-1 flex-col gap-4">
        {/* Requested by, with the requester's signature beside it (no date: that is for the signatories below). */}
        <div className="grid grid-cols-1 gap-2 @xl:grid-cols-[7fr_3fr] @xl:gap-4">
          <FieldLine label="Requested by" value={req.requester?.full_name} />
          <div className="flex items-end gap-2">
            <span className="shrink-0 text-xs leading-6 font-bold uppercase">Sign:</span>
            <span className="relative h-6 flex-1" style={RULED_LINES}>
              {req.requester_signature_url ? (
                <SignatureMark
                  src={req.requester_signature_url}
                  name={req.requester?.full_name}
                  className="absolute bottom-0.5 left-1 max-h-10"
                />
              ) : null}
            </span>
          </div>
        </div>
        <FieldLine label="Amount in words" value={req.amount_in_words} />
        <FieldLine label="Purpose" value={req.purpose} />
        {/* The project is the site; there is no separate site location. */}
        <div className="grid grid-cols-1 gap-2 @xl:grid-cols-[2fr_1fr_1fr]">
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
        <BeneficiaryTable req={req} />
        <SignatureGrid>
          <StageSlot req={req} code="reviewed" />
          <StageSlot req={req} code="authorized" />
          <StageSlot req={req} code="verified" />
          <StageSlot req={req} code="approved" />
          <ProcessedSlot req={req} />
        </SignatureGrid>
      </div>
    </>
  )
}

function PettyCashSheet({ req }: { req: Requisition }) {
  return (
    <>
      <Letterhead
        cells={[
          { label: "No", value: req.requisition_number },
          { label: "Department", value: req.department },
          { label: "Date", value: formatDate(req.created_at) },
        ]}
      />
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
          {blankRows(req.line_items.length, MIN_VOUCHER_ROWS).map((i) => (
            <tr key={`blank-${i}`} aria-hidden>
              <td className="h-7 border border-slate-500" />
              <td className="border border-slate-500" />
              <td className="border border-slate-500" />
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
      <div className="flex flex-1 flex-col gap-4">
        <FieldLine label="Total amount in words" value={req.amount_in_words} />
        <BeneficiaryTable req={req} />
        <SignatureGrid>
          <Slot label="Requested by" content={requesterContent(req)} />
          <StageSlot req={req} code="authorized" />
          <StageSlot req={req} code="approved" />
          {req.payments?.length ? <ProcessedSlot req={req} /> : null}
        </SignatureGrid>
      </div>
    </>
  )
}

export function RequisitionDocument({
  requisition,
  className,
  ref,
}: {
  requisition: Requisition
  className?: string
  ref?: Ref<HTMLElement>
}) {
  return (
    <article
      ref={ref}
      className={cn(
        // A4 proportions whatever is written; a longer form grows the sheet instead of squashing.
        "requisition-document @container mx-auto flex aspect-[210/297] w-full max-w-[210mm] flex-col rounded-lg border border-slate-300 bg-white p-5 text-slate-900 shadow-sm sm:p-10",
        className
      )}
    >
      {requisition.form_type === "petty_cash" ? (
        <PettyCashSheet req={requisition} />
      ) : (
        <PaymentRequestSheet req={requisition} />
      )}
      <p className="mt-6 text-center text-xs font-bold tracking-wide uppercase">Attach relevant supporting documents</p>
    </article>
  )
}
