"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  CircleSlash,
  FileText,
  Loader2,
  Printer,
  SkipForward,
  Wallet,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { apiFetch } from "@/lib/api-client"
import { formatNaira, progressLabel, STATUS_LABELS, stageTitle } from "@/lib/requisitions/format"
import { FORM_LABELS } from "@/lib/requisitions/limits"
import type { Requisition, RequisitionStage, RequisitionViewerActions } from "@/lib/requisitions/types"
import { RequisitionDocument } from "./requisition-document"
import { PaymentDialog } from "./payment-dialog"
import { SignDialog, type SignMode } from "./sign-dialog"
import { useStaffOptions } from "./use-staff-options"

export type Viewer = RequisitionViewerActions & { is_admin: boolean }

export function when(value: string | null) {
  if (!value) return ""
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  })
}

export function statusBadgeVariant(status: Requisition["status"]) {
  if (status === "rejected") return "destructive" as const
  if (status === "paid") return "default" as const
  return "secondary" as const
}

export function StageIcon({ stage }: { stage: RequisitionStage }) {
  const cls = "mt-0.5 h-4 w-4 shrink-0"
  if (stage.state === "signed") return <CheckCircle2 className={`${cls} text-emerald-600`} aria-hidden />
  if (stage.state === "bypassed") return <SkipForward className={`${cls} text-muted-foreground`} aria-hidden />
  if (stage.state === "not_required") return <CircleSlash className={`${cls} text-muted-foreground`} aria-hidden />
  if (stage.state === "rejected") return <XCircle className={`${cls} text-destructive`} aria-hidden />
  return <Circle className={`${cls} text-amber-500`} aria-hidden />
}

export function stageLine(stage: RequisitionStage) {
  switch (stage.state) {
    case "signed":
      return `Signed by ${stage.actor?.full_name || "—"} · ${when(stage.acted_at)}`
    case "bypassed":
      return `Bypassed by ${stage.actor?.full_name || "a later signer"} · ${when(stage.acted_at)}`
    case "rejected":
      return `Rejected by ${stage.actor?.full_name || "—"} · ${when(stage.acted_at)}`
    case "not_required":
      return "Not required"
    default:
      return stage.assignee ? `Waiting on ${stage.assignee.full_name}` : "Nobody assigned"
  }
}

function ReassignDialog({
  stage,
  onClose,
  requisitionId,
  onDone,
}: {
  stage: RequisitionStage | null
  onClose: () => void
  requisitionId: string
  onDone: () => void
}) {
  const options = useStaffOptions(Boolean(stage))
  const [assignee, setAssignee] = useState("")
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!stage || !assignee) return
    setBusy(true)
    try {
      const res = await apiFetch(`/api/requisitions/${requisitionId}/stages/${stage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignee_id: assignee }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Could not reassign")
      toast.success("Stage reassigned")
      onClose()
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reassign")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={Boolean(stage)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign stage</DialogTitle>
          <DialogDescription>{stage ? stageTitle(stage) : ""}</DialogDescription>
        </DialogHeader>
        <SearchableSelect
          value={assignee}
          onValueChange={setAssignee}
          options={options}
          placeholder="Pick who signs this stage"
          searchPlaceholder="Search staff"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !assignee}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Reassign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** One requisition: the paper form, its history, and what the viewer can do now. */
export function RequisitionDetail({ id, backHref }: { id: string; backHref: string }) {
  const [requisition, setRequisition] = useState<Requisition | null>(null)
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signMode, setSignMode] = useState<SignMode | null>(null)
  const [paying, setPaying] = useState(false)
  const [reassigning, setReassigning] = useState<RequisitionStage | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/requisitions/${id}`)
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
      <div className="text-muted-foreground flex min-h-[50vh] items-center justify-center gap-2 text-sm">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading requisition…
      </div>
    )
  }

  const canSign = Boolean(viewer.sign_stage_id)
  const stages = requisition.stages || []

  return (
    <div className="space-y-6 p-4 md:p-8 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to requisitions
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <h1 className="text-xl font-semibold">
          {FORM_LABELS[requisition.form_type]} {requisition.requisition_number}
        </h1>
        <Badge variant={statusBadgeVariant(requisition.status)}>{STATUS_LABELS[requisition.status]}</Badge>
        <span className="text-muted-foreground text-sm">{progressLabel(requisition)}</span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <RequisitionDocument requisition={requisition} />

        <aside className="space-y-4 print:hidden">
          {canSign || viewer.can_record_payment ? (
            <Card className="border-primary/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Waiting on you</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {canSign ? (
                  <>
                    <Button onClick={() => setSignMode("sign")}>Sign</Button>
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
              <ol className="space-y-3">
                {stages.map((stage) => (
                  <li key={stage.id} className="flex gap-2">
                    <StageIcon stage={stage} />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-medium">{stageTitle(stage)}</p>
                      <p className="text-muted-foreground text-xs">{stageLine(stage)}</p>
                      {stage.state_note ? (
                        <p className="text-muted-foreground text-xs italic">{stage.state_note}</p>
                      ) : null}
                      {stage.comments ? <p className="text-xs">“{stage.comments}”</p> : null}
                      {viewer.is_admin && stage.state === "pending" && requisition.status === "pending" ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => setReassigning(stage)}
                        >
                          Reassign
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
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
                      {new Date(payment.paid_on).toLocaleDateString("en-GB")}
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
                {requisition.attachments.map((file) =>
                  file.signed_url ? (
                    <a
                      key={file.file_path}
                      href={file.signed_url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:bg-muted flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <FileText className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
                      <span className="truncate">{file.file_name}</span>
                    </a>
                  ) : null
                )}
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
      <ReassignDialog
        stage={reassigning}
        onClose={() => setReassigning(null)}
        requisitionId={requisition.id}
        onDone={load}
      />
    </div>
  )
}
