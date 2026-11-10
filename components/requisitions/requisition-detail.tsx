"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { AlertCircle, ArrowLeft, Download, FastForward, FileText, Loader2, Wallet, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { apiFetch } from "@/lib/api-client"
import { formatNaira, progressLabel, STATUS_LABELS } from "@/lib/requisitions/format"
import { downloadRequisitionPdf } from "@/lib/requisitions/document-pdf"
import { attachmentHref, attachmentKind } from "@/lib/requisitions/attachment-types"
import { FORM_LABELS } from "@/lib/requisitions/limits"
import type { Requisition, RequisitionViewerActions } from "@/lib/requisitions/types"
import { RequisitionAttachments } from "./requisition-attachments"
import { RequisitionDocument } from "./requisition-document"
import { RequisitionStageList, when } from "./requisition-stage-list"
import { PaymentDialog } from "./payment-dialog"
import { SignDialog, type SignMode } from "./sign-dialog"

import { LinesSkeleton } from "@/components/skeletons"
export type Viewer = RequisitionViewerActions & { is_admin: boolean }

export function statusBadgeVariant(status: Requisition["status"]) {
  if (status === "rejected") return "destructive" as const
  if (status === "paid") return "default" as const
  return "secondary" as const
}

/** One requisition: the paper form, its history, and what the viewer can do now. */
export function RequisitionDetail({ id, backHref }: { id: string; backHref: string }) {
  const [requisition, setRequisition] = useState<Requisition | null>(null)
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signMode, setSignMode] = useState<SignMode | null>(null)
  const [paying, setPaying] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const sheetRef = useRef<HTMLElement>(null)

  const downloadPdf = async () => {
    if (!sheetRef.current || !requisition) return
    setDownloading(true)
    try {
      // Slashes are not allowed in file names: PR/HR/26/001 saves as PR-HR-26-001.pdf.
      await downloadRequisitionPdf(
        sheetRef.current,
        `${requisition.requisition_number.replace(/\//g, "-")}.pdf`,
        (requisition.attachments || []).map((file, i) => ({
          name: file.file_name,
          kind: attachmentKind(file.file_name, file.file_type),
          href: attachmentHref(requisition.id, i),
        }))
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the PDF")
    } finally {
      setDownloading(false)
    }
  }

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await apiFetch(`/api/requisitions/${id}`)
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Could not load this requisition")
      setRequisition(json.data)
      setViewer(json.viewer)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this requisition")
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (error) {
    return (
      <div className="bg-card mx-auto my-12 max-w-xl space-y-4 rounded-xl border p-6 text-center">
        <AlertCircle className="text-destructive mx-auto h-10 w-10" aria-hidden />
        <h2 className="text-lg font-semibold">Requisition not found</h2>
        <p className="text-muted-foreground text-sm">{error}</p>
        <Button asChild variant="outline" size="sm">
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to requisitions
          </Link>
        </Button>
      </div>
    )
  }

  if (!requisition || !viewer) {
    return (
      <div className="min-h-[50vh] p-6">
        <LinesSkeleton lines={6} />
      </div>
    )
  }

  const canSign = Boolean(viewer.sign_stage_id)

  return (
    <PageWrapper maxWidth="full">
      <div className="space-y-3">
        <PageHeader
          title={`${FORM_LABELS[requisition.form_type]} ${requisition.requisition_number}`}
          backLink={{ href: backHref, label: "Back to requisitions" }}
          actions={
            <Button variant="outline" size="sm" onClick={downloadPdf} disabled={downloading}>
              {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download PDF
            </Button>
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusBadgeVariant(requisition.status)}>{STATUS_LABELS[requisition.status]}</Badge>
          {progressLabel(requisition) !== STATUS_LABELS[requisition.status] ? (
            <span className="text-muted-foreground text-sm">{progressLabel(requisition)}</span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <RequisitionDocument ref={sheetRef} requisition={requisition} />
          <RequisitionAttachments requisition={requisition} />
        </div>

        <aside className="space-y-4">
          {canSign || viewer.can_record_payment ? (
            <Card className="border-primary/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Waiting on you</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {canSign ? (
                  <>
                    {viewer.would_bypass_stage_ids.length ? (
                      <>
                        <p className="text-muted-foreground w-full text-xs">
                          Earlier signers have not signed yet. You can override them.
                        </p>
                        <Button onClick={() => setSignMode("sign")}>
                          <FastForward className="mr-2 h-4 w-4" /> Override
                        </Button>
                      </>
                    ) : (
                      <Button onClick={() => setSignMode("sign")}>Sign</Button>
                    )}
                    <Button variant="outline" onClick={() => setSignMode("reject")}>
                      Reject
                    </Button>
                  </>
                ) : null}
                {viewer.can_record_payment ? (
                  <Button onClick={() => setPaying(true)}>
                    <Wallet className="mr-2 h-4 w-4" /> Record payment
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Approval route</CardTitle>
            </CardHeader>
            <CardContent>
              <RequisitionStageList requisition={requisition} heading={false} />
            </CardContent>
          </Card>

          {requisition.amount_changes?.length ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Amount changes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-muted-foreground text-xs">
                  Originally requested: {formatNaira(requisition.original_amount)}
                </p>
                {requisition.amount_changes.map((change) => (
                  <div key={change.id} className="space-y-0.5 text-sm">
                    <p>
                      {formatNaira(change.old_amount)} → <strong>{formatNaira(change.new_amount)}</strong>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {change.changer?.full_name || "—"} · {when(change.created_at)}
                    </p>
                    <p className="text-xs">“{change.reason}”</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {requisition.payments?.length ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Payments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {requisition.payments.map((payment) => (
                  <div key={payment.id} className="space-y-0.5 text-sm">
                    <p>
                      <strong>{formatNaira(payment.amount)}</strong> by{" "}
                      {payment.method === "cash" ? "cash" : "transfer"} on{" "}
                      {new Date(payment.paid_on).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" })}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {payment.recorder?.full_name || "—"}
                      {payment.reference ? ` · ref ${payment.reference}` : ""}
                    </p>
                    {payment.note ? <p className="text-xs">{payment.note}</p> : null}
                    {payment.receipt_url ? (
                      <a
                        href={payment.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary text-xs underline"
                      >
                        View receipt
                      </a>
                    ) : null}
                  </div>
                ))}
                <p className="text-muted-foreground text-xs">
                  {formatNaira(requisition.amount_paid)} of {formatNaira(requisition.amount)} paid
                </p>
              </CardContent>
            </Card>
          ) : null}

          {requisition.attachments?.length ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Supporting documents</CardTitle>
              </CardHeader>
              <CardContent className="max-h-60 space-y-2 overflow-y-auto pr-1">
                {requisition.attachments.map((file, i) => (
                  <a
                    key={`${file.file_path}-${i}`}
                    href={`#attachment-${i}`}
                    className="hover:bg-muted flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <FileText className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{file.file_name}</span>
                  </a>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {requisition.help_desk_ticket ? (
            <Card>
              <CardContent className="pt-6 text-sm">
                Raised for help desk ticket{" "}
                <Link href={`/help-desk/${requisition.help_desk_ticket.id}`} className="text-primary underline">
                  {requisition.help_desk_ticket.ticket_number}
                </Link>
                : {requisition.help_desk_ticket.title}
              </CardContent>
            </Card>
          ) : null}

          {requisition.status === "rejected" && requisition.rejection_reason ? (
            <Card className="border-destructive/40">
              <CardContent className="pt-6 text-sm">
                <p className="font-medium">Rejected</p>
                <p className="text-muted-foreground">{requisition.rejection_reason}</p>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>

      {signMode ? (
        <SignDialog
          open={Boolean(signMode)}
          onOpenChange={(open) => !open && setSignMode(null)}
          mode={signMode}
          requisition={requisition}
          viewer={viewer}
          onDone={load}
        />
      ) : null}
      <PaymentDialog open={paying} onOpenChange={setPaying} requisition={requisition} viewer={viewer} onDone={load} />
    </PageWrapper>
  )
}
