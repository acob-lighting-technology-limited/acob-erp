"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Download,
  FileCheck2,
  Plus,
  Receipt,
  Send,
  Trash2,
  Wallet,
} from "lucide-react"
import { DataTable, DataTablePage, type DataTableColumn } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { NairaAmount } from "@/components/requisitions/naira-amount"
import { apiFetch, apiJson } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { formatNaira } from "@/lib/requisitions/format"
import type { PaymentSchedule, PaymentScheduleItem } from "@/lib/requisitions/types"
import { formatWATDate, formatWATDateTime } from "@/lib/utils/date"
import { useConfirm } from "@/providers/confirm-provider"
import { SCHEDULES_PATH, STAFF_REQUISITIONS_PATH } from "../requisition-paths"
import { AddLinesDialog } from "./add-lines-dialog"
import { ApproveScheduleDialog } from "./approve-schedule-dialog"
import { OutcomesDialog } from "./outcomes-dialog"
import { OutcomeBadge, ScheduleStatusBadge } from "./schedule-status"

interface DetailResponse {
  data: PaymentSchedule
  viewer: { is_officer: boolean; is_md: boolean; approvable_count: number; signing_setup_missing: string[] }
}

/**
 * One payment schedule. Draft: the officer adds payments and downloads the
 * bank file, then sends it to the MD. Sent: the officer records what the bank
 * paid. Paid lines then wait for the MD's Approved signature.
 */
export function ScheduleDetail({ id }: { id: string }) {
  const confirm = useConfirm()
  const [adding, setAdding] = useState(false)
  const [recording, setRecording] = useState(false)
  const [approving, setApproving] = useState(false)
  const [sending, setSending] = useState(false)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.requisitionSchedule(id),
    queryFn: () => apiJson<DetailResponse>(`/api/requisitions/schedules/${id}`),
  })
  const schedule = data?.data
  const viewer = data?.viewer
  const items = schedule?.items || []
  const isDraft = schedule?.status === "draft"
  const isOfficer = Boolean(viewer?.is_officer)
  const pendingCount = items.filter((i) => i.outcome === "pending").length

  const total = items.reduce((s, i) => s + Number(i.amount), 0)
  const paid = items.filter((i) => i.outcome === "paid").reduce((s, i) => s + Number(i.amount), 0)
  const unpaid = items.filter((i) => i.outcome === "unpaid").reduce((s, i) => s + Number(i.amount), 0)

  const send = async () => {
    const ok = await confirm({
      title: `Send ${schedule?.schedule_number} to the MD?`,
      description: `${items.length} payments, ${formatNaira(total)}. Its payments can no longer be changed after this. Download the bank file to give him.`,
      confirmLabel: "Send to MD",
    })
    if (!ok) return
    setSending(true)
    try {
      const res = await apiFetch(`/api/requisitions/schedules/${id}/send`, { method: "POST" })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Could not send")
      toast.success("Sent to the MD")
      await refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send")
    } finally {
      setSending(false)
    }
  }

  const remove = async (item: PaymentScheduleItem) => {
    const ok = await confirm({
      title: `Take ${item.account_name} off this schedule?`,
      description: "It goes back to the payments waiting to be scheduled.",
      confirmLabel: "Remove",
      destructive: true,
    })
    if (!ok) return
    try {
      const res = await apiFetch(`/api/requisitions/schedules/${id}/items?item_id=${item.id}`, { method: "DELETE" })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Could not remove")
      toast.success("Removed")
      await refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove")
    }
  }

  const columns: DataTableColumn<PaymentScheduleItem>[] = [
    {
      key: "transaction_ref",
      label: "Transaction ref",
      accessor: (i) => i.transaction_ref,
      render: (i) => <span className="font-mono text-xs">{i.transaction_ref}</span>,
    },
    {
      key: "account_name",
      label: "Beneficiary",
      sortable: true,
      accessor: (i) => i.account_name,
      render: (i) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{i.account_name}</p>
          <p className="text-muted-foreground font-mono text-xs">{i.beneficiary_code}</p>
        </div>
      ),
    },
    {
      key: "bank",
      label: "Bank · account",
      accessor: (i) => `${i.bank_name} ${i.account_number}`,
      render: (i) => (
        <div className="text-xs">
          <p>{i.bank_name}</p>
          <p className="text-muted-foreground font-mono">
            {i.account_number} · sort {Number(i.bank_code)}
          </p>
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: "amount",
      label: "Amount",
      align: "right",
      sortable: true,
      accessor: (i) => Number(i.amount),
      render: (i) => <NairaAmount value={i.amount} />,
    },
    {
      key: "requisition",
      label: "Requisition",
      accessor: (i) => i.requisition?.requisition_number || "",
      render: (i) => (
        <div className="min-w-0 text-xs">
          <Link
            href={`${STAFF_REQUISITIONS_PATH}/${i.requisition_id}`}
            className="text-primary font-mono font-semibold"
          >
            {i.requisition?.requisition_number}
          </Link>
          <p className="text-muted-foreground truncate">
            {i.requisition?.requester?.full_name} · {i.requisition?.department}
          </p>
        </div>
      ),
    },
    {
      key: "outcome",
      label: "Outcome",
      accessor: (i) => i.outcome,
      render: (i) => (
        <div className="flex flex-col gap-1">
          <OutcomeBadge outcome={i.outcome} />
          {i.outcome === "unpaid" && i.outcome_note ? (
            <span className="text-danger text-xs">{i.outcome_note}</span>
          ) : null}
          {i.recorded_at ? (
            <span className="text-muted-foreground text-xs">
              {i.recorder?.full_name} · {formatWATDateTime(i.recorded_at)}
            </span>
          ) : null}
          {i.receipt_url ? (
            <a href={i.receipt_url} target="_blank" rel="noreferrer" className="text-primary text-xs underline">
              Receipt
            </a>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <DataTablePage
      title={schedule ? `Payment schedule ${schedule.schedule_number}` : "Payment schedule"}
      description={
        schedule
          ? `Payment date ${formatWATDate(schedule.payment_date)} · debit account ${schedule.debit_account}${schedule.note ? ` · ${schedule.note}` : ""}`
          : undefined
      }
      icon={CalendarClock}
      backLink={{ href: SCHEDULES_PATH, label: "Back to payment schedules" }}
      spacing="tight"
      actionsPlacement="inline-always"
      actions={
        schedule ? (
          <div className="flex flex-wrap items-center gap-2">
            <ScheduleStatusBadge status={schedule.status} />
            {items.length ? (
              <Button asChild variant="outline" size="sm" aria-label="Download bank file">
                <a href={`/api/requisitions/schedules/${id}/bank-file`}>
                  <Download className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Bank file</span>
                </a>
              </Button>
            ) : null}
            {isOfficer && isDraft ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setAdding(true)} aria-label="Add payments">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add payments</span>
                </Button>
                <Button size="sm" onClick={send} disabled={sending || !items.length} aria-label="Send to MD">
                  <Send className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Send to MD</span>
                </Button>
              </>
            ) : null}
            {isOfficer && schedule.status === "sent" && pendingCount ? (
              <Button size="sm" onClick={() => setRecording(true)} aria-label="Record what was paid">
                <Receipt className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Record what was paid</span>
              </Button>
            ) : null}
            {viewer?.approvable_count ? (
              <Button size="sm" onClick={() => setApproving(true)} aria-label="Approve paid">
                <FileCheck2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Approve {viewer.approvable_count} paid</span>
              </Button>
            ) : null}
          </div>
        ) : undefined
      }
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Payments"
            value={items.length}
            icon={CalendarClock}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            variant="compact"
            title="Total"
            value={formatNaira(total)}
            icon={Wallet}
            iconBgColor="bg-purple-500/10"
            iconColor="text-purple-500"
          />
          <StatCard
            variant="compact"
            title="Paid"
            value={formatNaira(paid)}
            icon={CheckCircle2}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
          <StatCard
            variant="compact"
            title="Not paid"
            value={formatNaira(unpaid)}
            icon={CircleAlert}
            iconBgColor="bg-red-500/10"
            iconColor="text-red-500"
          />
        </StatGrid>
      }
    >
      <DataTable<PaymentScheduleItem>
        data={items}
        columns={columns}
        getRowId={(i) => i.id}
        searchPlaceholder="Search name, reference, account…"
        searchFn={(i, q) =>
          [i.account_name, i.transaction_ref, i.account_number, i.requisition?.requisition_number]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))
        }
        rowActions={
          isOfficer && isDraft
            ? [{ label: "Remove", icon: Trash2, variant: "destructive", onClick: (i) => void remove(i) }]
            : undefined
        }
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        onRetry={() => void refetch()}
        emptyTitle="No payments on this schedule yet"
        emptyDescription={isOfficer && isDraft ? "Add verified Payment Requests to it." : undefined}
        mobileRow={{
          title: (i) => i.account_name,
          subtitle: (i) => `${i.transaction_ref} · ${i.bank_name}`,
          trailing: (i) => <NairaAmount value={i.amount} />,
        }}
      />

      {schedule && isOfficer && isDraft ? (
        <AddLinesDialog open={adding} onOpenChange={setAdding} scheduleId={id} onAdded={() => void refetch()} />
      ) : null}
      {schedule && recording ? (
        <OutcomesDialog
          open
          onOpenChange={setRecording}
          scheduleId={id}
          items={items}
          setupMissing={viewer?.signing_setup_missing || []}
          onDone={() => void refetch()}
        />
      ) : null}
      {schedule && viewer?.approvable_count ? (
        <ApproveScheduleDialog
          open={approving}
          onOpenChange={setApproving}
          scheduleId={id}
          scheduleNumber={schedule.schedule_number}
          count={viewer.approvable_count}
          setupMissing={viewer.signing_setup_missing}
          onDone={() => void refetch()}
        />
      ) : null}
    </DataTablePage>
  )
}
