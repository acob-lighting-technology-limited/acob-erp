"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { CalendarClock, CheckCircle2, Contact, Eye, Plus, Receipt, RefreshCw, Send, Wallet } from "lucide-react"
import { DataTable, DataTablePage, type DataTableColumn } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { NairaAmount } from "@/components/requisitions/naira-amount"
import { apiJson } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { formatNaira } from "@/lib/requisitions/format"
import type { PaymentSchedule } from "@/lib/requisitions/types"
import { formatWATDate } from "@/lib/utils/date"
import { ADMIN_REQUISITIONS_PATH, PAYEES_PATH, SCHEDULES_PATH } from "../requisition-paths"
import { NewScheduleDialog } from "./new-schedule-dialog"
import { ScheduleStatusBadge, SCHEDULE_STATUS_LABELS } from "./schedule-status"

interface ListResponse {
  data: PaymentSchedule[]
  viewer: { is_officer: boolean; is_md: boolean }
}

/**
 * Payment schedules: verified Payment Requests batched for the MD to pay at the
 * bank. Accounts' payment officer builds them; the MD and admins can look.
 */
export function SchedulesListPage() {
  const router = useRouter()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.requisitionSchedules(),
    queryFn: () => apiJson<ListResponse>("/api/requisitions/schedules"),
  })
  const rows = data?.data || []
  const isOfficer = Boolean(data?.viewer.is_officer)
  const open = (s: PaymentSchedule) => router.push(`${SCHEDULES_PATH}/${s.id}`)

  const columns: DataTableColumn<PaymentSchedule>[] = [
    {
      key: "schedule_number",
      label: "Schedule",
      sortable: true,
      accessor: (s) => s.schedule_number,
      render: (s) => (
        <Link href={`${SCHEDULES_PATH}/${s.id}`} className="text-primary font-mono text-xs font-semibold">
          {s.schedule_number}
        </Link>
      ),
    },
    {
      key: "payment_date",
      label: "Payment date",
      sortable: true,
      accessor: (s) => s.payment_date,
      render: (s) => formatWATDate(s.payment_date),
    },
    {
      key: "line_count",
      label: "Payments",
      align: "right",
      sortable: true,
      accessor: (s) => s.line_count ?? 0,
    },
    {
      key: "total_amount",
      label: "Total",
      align: "right",
      sortable: true,
      accessor: (s) => s.total_amount ?? 0,
      render: (s) => <NairaAmount value={s.total_amount ?? 0} />,
    },
    {
      key: "paid_amount",
      label: "Paid",
      align: "right",
      accessor: (s) => s.paid_amount ?? 0,
      render: (s) => <NairaAmount value={s.paid_amount ?? 0} />,
      hideOnMobile: true,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (s) => SCHEDULE_STATUS_LABELS[s.status],
      render: (s) => <ScheduleStatusBadge status={s.status} />,
    },
    {
      key: "creator",
      label: "Prepared by",
      accessor: (s) => s.creator?.full_name || "",
      hideOnMobile: true,
    },
  ]

  const sum = (pick: (s: PaymentSchedule) => number) => rows.reduce((t, s) => t + pick(s), 0)

  return (
    <DataTablePage
      title="Payment schedules"
      description="Verified Payment Requests batched for the MD to pay at the bank."
      icon={CalendarClock}
      backLink={{ href: ADMIN_REQUISITIONS_PATH, label: "Back to requisitions" }}
      spacing="tight"
      actionsPlacement="inline-always"
      actions={
        <div className="flex items-center gap-2">
          {isOfficer ? (
            <Button asChild variant="outline" size="sm" aria-label="Payee register">
              <Link href={PAYEES_PATH}>
                <Contact className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Payee register</span>
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void refetch()} aria-label="Refresh">
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          {isOfficer ? (
            <Button size="sm" onClick={() => setIsCreateOpen(true)} aria-label="New schedule">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">New schedule</span>
            </Button>
          ) : null}
        </div>
      }
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Drafts"
            value={rows.filter((s) => s.status === "draft").length}
            icon={CalendarClock}
            iconBgColor="bg-amber-500/10"
            iconColor="text-amber-500"
          />
          <StatCard
            variant="compact"
            title="Finalized"
            value={rows.filter((s) => s.status === "sent").length}
            icon={Send}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            variant="compact"
            title="Closed"
            value={rows.filter((s) => s.status === "closed").length}
            icon={CheckCircle2}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
          <StatCard
            variant="compact"
            title="Paid so far"
            value={formatNaira(sum((s) => s.paid_amount ?? 0))}
            icon={Wallet}
            iconBgColor="bg-purple-500/10"
            iconColor="text-purple-500"
          />
        </StatGrid>
      }
    >
      <DataTable<PaymentSchedule>
        data={rows}
        columns={columns}
        getRowId={(s) => s.id}
        searchPlaceholder="Search schedule number…"
        searchFn={(s, q) => s.schedule_number.toLowerCase().includes(q)}
        rowActions={[
          {
            // The officer's way in once the MD has paid: opens the schedule with the recording form up.
            label: "Record what was paid",
            icon: Receipt,
            primary: true,
            onClick: (s) => router.push(`${SCHEDULES_PATH}/${s.id}?record=1`),
            hidden: (s) => !isOfficer || s.status !== "sent",
          },
          { label: "Open", icon: Eye, onClick: open },
        ]}
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        onRetry={() => void refetch()}
        pagination={{ pageSize: 25 }}
        emptyTitle="No payment schedules yet"
        emptyDescription={
          isOfficer
            ? "Start one to batch verified Payment Requests for the MD."
            : "Accounts' payment officer starts these."
        }
        mobileRow={{
          title: (s) => s.schedule_number,
          subtitle: (s) => `${formatWATDate(s.payment_date)} · ${s.line_count ?? 0} payments`,
          trailing: (s) => <ScheduleStatusBadge status={s.status} />,
        }}
      />
      <NewScheduleDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={(id) => router.push(`${SCHEDULES_PATH}/${id}?add=1`)}
      />
    </DataTablePage>
  )
}
