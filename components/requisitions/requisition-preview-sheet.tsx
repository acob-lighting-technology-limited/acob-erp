"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  FastForward,
  AlertCircle,
  ArrowUpRight,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  Folder,
  Loader2,
  PenLine,
  User,
  Wallet,
  XCircle,
} from "lucide-react"
import { DetailSheet } from "@/components/ui/detail-sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { apiJson } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { QUERY_KEYS } from "@/lib/query-keys"
import { formatWATDate } from "@/lib/utils/date"
import { formatNaira, progressLabel, STATUS_LABELS } from "@/lib/requisitions/format"
import { FORM_LABELS } from "@/lib/requisitions/limits"
import type { Requisition, RequisitionViewerActions } from "@/lib/requisitions/types"
import { statusBadgeClass } from "./requisition-detail"
import { RequisitionBeneficiaryTable } from "./requisition-beneficiary-table"
import { RequisitionStageList } from "./requisition-stage-list"
import { STAFF_REQUISITIONS_PATH } from "./requisition-paths"
import type { SignMode } from "./sign-dialog"

import { LinesSkeleton } from "@/components/skeletons"
export interface RequisitionPreviewSheetProps {
  requisitionId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSign?: (requisition: Requisition, viewer: RequisitionViewerActions, mode: SignMode) => void
  onPay?: (requisition: Requisition, viewer: RequisitionViewerActions) => void
  /** Where the full page lives on this surface (staff, admin or a department console). */
  detailBasePath?: string
}

interface RequisitionResponse {
  data: Requisition
  viewer: RequisitionViewerActions & { is_admin: boolean }
}

export function RequisitionPreviewSheet({
  requisitionId,
  open,
  onOpenChange,
  onSign,
  onPay,
  detailBasePath = STAFF_REQUISITIONS_PATH,
}: RequisitionPreviewSheetProps) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.requisition(requisitionId ?? ""),
    queryFn: () => apiJson<RequisitionResponse>(`/api/requisitions/${requisitionId}`),
    enabled: Boolean(open && requisitionId),
    staleTime: 10_000,
  })

  const requisition = data?.data
  const viewer = data?.viewer
  const fullPageHref = requisition ? `${detailBasePath}/${requisition.id}` : "#"

  return (
    <DetailSheet
      wide
      flush
      open={open}
      onOpenChange={onOpenChange}
      title={requisition ? requisition.requisition_number : "Requisition details"}
      description={
        requisition ? `Quick preview of requisition ${requisition.requisition_number}` : "Requisition preview"
      }
      badges={
        requisition ? (
          <>
            <Badge variant="outline" className="text-xs font-semibold">
              {FORM_LABELS[requisition.form_type]}
            </Badge>
            <Badge variant="outline" className={cn(statusBadgeClass(requisition.status), "text-xs")}>
              {STATUS_LABELS[requisition.status]}
            </Badge>
            <span className="text-muted-foreground text-xs">{progressLabel(requisition)}</span>
          </>
        ) : null
      }
      footer={
        <>
          <Button asChild variant="outline" size="sm" className="h-8 text-xs">
            <Link href={fullPageHref} onClick={() => onOpenChange(false)}>
              <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Full voucher page
            </Link>
          </Button>

          <div className="flex items-center gap-2">
            {requisition && viewer?.can_record_payment && onPay ? (
              <Button size="sm" className="h-8 text-xs" onClick={() => onPay(requisition, viewer)}>
                <Wallet className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Record payment
              </Button>
            ) : null}
            {requisition && viewer?.sign_stage_id && onSign ? (
              <>
                {viewer.can_reject ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive h-8 text-xs"
                    onClick={() => onSign(requisition, viewer, "reject")}
                  >
                    <XCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    Reject
                  </Button>
                ) : null}
                <Button size="sm" className="h-8 text-xs" onClick={() => onSign(requisition, viewer, "sign")}>
                  {viewer.would_bypass_stage_ids.length ? (
                    <>
                      <FastForward className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Override
                    </>
                  ) : (
                    <>
                      <PenLine className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Sign
                    </>
                  )}
                </Button>
              </>
            ) : null}
            <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </>
      }
    >
      {isLoading ? (
        <div className="flex-1 p-6">
          <LinesSkeleton lines={6} />
        </div>
      ) : error || !requisition ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <AlertCircle className="text-destructive h-8 w-8" aria-hidden />
          <p className="text-sm font-medium">Could not load requisition</p>
          <p className="text-muted-foreground text-xs">
            {error instanceof Error ? error.message : "Requisition not found or access denied"}
          </p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {/* Amount & Requester Highlight Box */}
          <div className="bg-muted/40 space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="text-muted-foreground block text-xs font-medium tracking-wider uppercase">
                  Amount requested
                </span>
                <span className="font-mono text-2xl font-bold tracking-tight">{formatNaira(requisition.amount)}</span>
              </div>
              {requisition.original_amount !== requisition.amount ? (
                <div className="text-right">
                  <span className="text-muted-foreground block text-xs">Originally requested</span>
                  <span className="text-muted-foreground font-mono text-xs line-through">
                    {formatNaira(requisition.original_amount)}
                  </span>
                </div>
              ) : null}
            </div>

            {requisition.amount_in_words ? (
              <p className="text-muted-foreground border-border/60 border-t pt-2 text-xs italic">
                {requisition.amount_in_words}
              </p>
            ) : null}

            <div className="border-border/60 grid grid-cols-1 gap-2 border-t pt-3 text-xs sm:grid-cols-2">
              <div className="text-muted-foreground flex items-center gap-2">
                <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="text-foreground font-medium">{requisition.requester?.full_name || "—"}</span>
              </div>
              <div className="text-muted-foreground flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{requisition.department}</span>
              </div>
              <div className="text-muted-foreground flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{formatWATDate(requisition.created_at)}</span>
              </div>
              {requisition.project_name ? (
                <div className="text-muted-foreground flex items-center gap-2">
                  <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{requisition.project_name}</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Purpose */}
          {requisition.purpose ? (
            <div className="space-y-1.5">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Purpose / Details
              </h3>
              <p className="bg-card rounded-md border p-3 text-sm leading-relaxed whitespace-pre-wrap">
                {requisition.purpose}
              </p>
            </div>
          ) : null}

          {/* Line items for petty cash or multi-item vouchers */}
          {requisition.line_items?.length ? (
            <div className="space-y-2">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Items breakdown</h3>
              <div className="overflow-hidden rounded-md border">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground border-b font-medium">
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requisition.line_items.map((item, idx) => (
                      <tr key={`row-${idx}`} className="border-b last:border-b-0">
                        <td className="p-2">{item.description}</td>
                        <td className="p-2 text-right font-mono font-medium">{formatNaira(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Beneficiary Details */}
          {requisition.beneficiary_details?.length ? (
            <div className="space-y-2">
              <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                <CreditCard className="h-3.5 w-3.5" aria-hidden />
                Beneficiary details
              </h3>
              <RequisitionBeneficiaryTable beneficiaries={requisition.beneficiary_details} />
            </div>
          ) : null}

          {/* Approval Route */}
          <div className="space-y-3">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Approval route</h3>
            <RequisitionStageList
              requisition={requisition}
              heading={false}
              className="bg-card rounded-lg border p-3.5"
            />
          </div>

          {/* Attachments / Supporting Documents */}
          {requisition.attachments?.length ? (
            <div className="space-y-2">
              <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                <FileText className="h-3.5 w-3.5" aria-hidden />
                Supporting documents ({requisition.attachments.length})
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {requisition.attachments.map((file) =>
                  file.signed_url ? (
                    <a
                      key={file.file_path}
                      href={file.signed_url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:bg-muted flex items-center gap-2 rounded-md border p-2.5 text-xs transition"
                    >
                      <FileText className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
                      <span className="flex-1 truncate font-medium">{file.file_name}</span>
                      <ArrowUpRight className="text-muted-foreground h-3 w-3 shrink-0" aria-hidden />
                    </a>
                  ) : (
                    <div
                      key={file.file_path}
                      className="text-muted-foreground flex items-center gap-2 rounded-md border p-2.5 text-xs"
                    >
                      <FileText className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="flex-1 truncate">{file.file_name}</span>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null}

          {/* Payments if recorded */}
          {requisition.payments?.length ? (
            <div className="space-y-2">
              <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                <Wallet className="h-3.5 w-3.5" aria-hidden />
                Payments recorded
              </h3>
              <div className="bg-card space-y-2 rounded-md border p-3">
                {requisition.payments.map((p) => (
                  <div key={p.id} className="space-y-0.5 border-b pb-2 text-xs last:border-b-0 last:pb-0">
                    <p className="font-medium">
                      {formatNaira(p.amount)} via {p.method} on{" "}
                      {new Date(p.paid_on).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" })}
                    </p>
                    <p className="text-muted-foreground">
                      Recorded by {p.recorder?.full_name || "—"}
                      {p.reference ? ` · Ref: ${p.reference}` : ""}
                    </p>
                    {p.receipt_url ? (
                      <a
                        href={p.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary inline-block pt-0.5 text-xs underline"
                      >
                        View payment receipt
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Rejection note */}
          {requisition.status === "rejected" && requisition.rejection_reason ? (
            <div className="border-destructive/40 bg-destructive/5 space-y-1 rounded-md border p-3 text-xs">
              <p className="text-destructive flex items-center gap-1.5 font-semibold">
                <XCircle className="h-3.5 w-3.5" aria-hidden /> Rejection reason
              </p>
              <p className="text-muted-foreground">{requisition.rejection_reason}</p>
            </div>
          ) : null}
        </div>
      )}
    </DetailSheet>
  )
}
