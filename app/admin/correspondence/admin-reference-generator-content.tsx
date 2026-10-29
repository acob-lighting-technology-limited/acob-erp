"use client"

import { useCallback, useMemo, useState } from "react"
import { formatWATDate } from "@/lib/utils/date"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PromptDialog } from "@/components/ui/prompt-dialog"
import {
  Building2,
  Calendar,
  CalendarClock,
  CheckCircle,
  CircleDot,
  Clock,
  Download,
  FileText,
  ListFilter,
  ShieldCheck,
  User,
} from "lucide-react"
import type { CorrespondenceRecord, CorrespondenceStatus } from "@/types/correspondence"
import { getCanonicalDepartmentOrder } from "@/shared/departments"
import { useDepartments } from "@/hooks/use-departments"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter, DataTableTab } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn, formatName } from "@/lib/utils"
import { logger } from "@/lib/logger"
import { ExportOptionsDialog } from "@/components/admin/export-options-dialog"
import { apiFetch, apiJson } from "@/lib/api-client"
import {
  exportCorrespondenceToExcel,
  exportCorrespondenceToPDF,
  exportCorrespondenceToWord,
} from "@/lib/correspondence/correspondence-export"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"

const log = logger("reference-generator")

interface AdminReferenceGeneratorContentProps {
  initialRecords: CorrespondenceRecord[]
  lockedDepartment?: string
  backLinkHref?: string
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function AdminReferenceGeneratorContent({
  initialRecords,
  lockedDepartment,
  backLinkHref = "/admin",
}: AdminReferenceGeneratorContentProps) {
  const { departments: dynamicDepartments } = useDepartments()
  const availableDepartments = dynamicDepartments.length > 0 ? dynamicDepartments : getCanonicalDepartmentOrder()

  const [loadingRecordId, setLoadingRecordId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"all" | "external" | "internal">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [isExporting, setIsExporting] = useState(false)
  const [exportOptionsOpen, setExportOptionsOpen] = useState(false)
  const [departmentFilter, setDepartmentFilter] = useState("")
  // This table is server-paginated, so the DataTable cannot filter rows itself —
  // every active filter has to be forwarded to the API or it does nothing.
  const [statusFilter, setStatusFilter] = useState("")
  const [yearFilter, setYearFilter] = useState("")

  const recordsUrl = useCallback(
    (params: URLSearchParams) => {
      if (lockedDepartment) params.set("department", lockedDepartment)
      else if (departmentFilter) params.set("department", departmentFilter)
      return `/api/correspondence/records?${params.toString()}`
    },
    [lockedDepartment, departmentFilter]
  )

  /** Applies the filter-bar selections that the server understands. */
  const applyServerFilters = useCallback(
    (params: URLSearchParams) => {
      if (statusFilter) params.set("status", statusFilter)
      if (yearFilter) {
        params.set("date_from", `${yearFilter}-01-01`)
        params.set("date_to", `${yearFilter}-12-31T23:59:59.999Z`)
      }
      return params
    },
    [statusFilter, yearFilter]
  )

  const [decisionPrompt, setDecisionPrompt] = useState<{
    recordId: string
    decision: "approved" | "rejected" | "returned_for_correction"
  } | null>(null)

  const queryClient = useQueryClient()
  const countsDepartment = lockedDepartment || departmentFilter || null

  // Header counts: one cached query of `limit=1` probes (only `total` is read).
  const { data: counts } = useQuery({
    queryKey: QUERY_KEYS.correspondenceCounts(countsDepartment),
    queryFn: async () => {
      const totalFor = async (extra: Record<string, string>) => {
        const json = await apiJson<{ total?: number }>(
          recordsUrl(new URLSearchParams({ page: "1", limit: "1", ...extra })),
          { cache: "no-store" }
        )
        return Number(json.total || 0)
      }
      const [all, external, internal, underReview, approved, rejected] = await Promise.all([
        totalFor({}),
        totalFor({ letter_type: "external" }),
        totalFor({ letter_type: "internal" }),
        totalFor({ status: "under_review" }),
        totalFor({ status: "approved" }),
        totalFor({ status: "rejected" }),
      ])
      return { all, external, internal, underReview, approved, rejected }
    },
  })
  const tabCounts = {
    all: counts?.all ?? initialRecords.length,
    external: counts?.external ?? 0,
    internal: counts?.internal ?? 0,
  }
  const globalCounts = {
    total: counts?.all ?? 0,
    underReview: counts?.underReview ?? 0,
    approved: counts?.approved ?? 0,
    rejected: counts?.rejected ?? 0,
  }

  const stats = useMemo(() => {
    return {
      total: globalCounts.total,
      underReview: globalCounts.underReview,
      approved: globalCounts.approved,
      rejected: globalCounts.rejected,
    }
  }, [globalCounts.total, globalCounts.underReview, globalCounts.approved, globalCounts.rejected])
  const statusLabel = (status: string) => (status === "under_review" ? "Sent for review" : formatName(status))
  const statusBadgeClass = (status: string) => {
    if (status === "approved") return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
    if (status === "rejected") return "bg-red-500/10 text-red-500 border-red-500/20"
    if (status === "returned_for_correction") return "bg-amber-500/10 text-amber-500 border-amber-500/20"
    if (status === "under_review") return "bg-blue-500/10 text-blue-500 border-blue-500/20"
    if (status === "draft") return "bg-slate-500/10 text-slate-500 border-slate-500/20"
    if (status === "sent" || status === "filed") return "bg-violet-500/10 text-violet-500 border-violet-500/20"
    return "bg-muted text-muted-foreground border-muted-foreground/20"
  }

  const handleExport = async (format: "excel" | "pdf" | "word") => {
    setIsExporting(true)
    const exportToast = toast.loading(`Exporting correspondence to ${format}...`)
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "5000",
      })
      if (activeTab !== "all") params.set("letter_type", activeTab)
      if (searchQuery.trim()) params.set("search", searchQuery.trim())
      applyServerFilters(params)

      const res = await apiFetch(recordsUrl(params), { cache: "no-store" })
      const json = await res.json()
      const allMatchingRecords = json.data || []

      if (allMatchingRecords.length === 0) {
        toast.error("No correspondence records to export", { id: exportToast })
        return
      }

      if (format === "excel") {
        await exportCorrespondenceToExcel(allMatchingRecords)
      } else if (format === "pdf") {
        await exportCorrespondenceToPDF(allMatchingRecords)
      } else if (format === "word") {
        await exportCorrespondenceToWord(allMatchingRecords)
      }
      toast.success("Export completed successfully", { id: exportToast })
    } catch (err) {
      log.error("Failed to export correspondence records", err)
      toast.error("Export failed", { id: exportToast })
    } finally {
      setIsExporting(false)
    }
  }

  const recordsKey = QUERY_KEYS.correspondenceRecords({
    page,
    activeTab,
    search: searchQuery.trim(),
    department: countsDepartment,
    statusFilter,
    yearFilter,
  })
  const { data: recordsPage, isFetching: isLoadingRecords } = useQuery({
    queryKey: recordsKey,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "50" })
      if (activeTab !== "all") params.set("letter_type", activeTab)
      if (searchQuery.trim()) params.set("search", searchQuery.trim())
      applyServerFilters(params)
      const json = await apiJson<{ data?: CorrespondenceRecord[]; total?: number }>(recordsUrl(params), {
        cache: "no-store",
      })
      return { records: json.data ?? [], total: Number(json.total || 0) }
    },
    placeholderData: keepPreviousData,
    initialData:
      page === 1 && activeTab === "all" && !searchQuery.trim() && !statusFilter && !yearFilter && !departmentFilter
        ? { records: initialRecords, total: initialRecords.length }
        : undefined,
    // The server render is a first paint only; refetch the real page on mount.
    initialDataUpdatedAt: 0,
  })
  const records = recordsPage?.records ?? []
  const total = recordsPage?.total ?? 0
  const isLoading = isLoadingRecords || isExporting

  async function decide(recordId: string, decision: "approved" | "rejected" | "returned_for_correction") {
    setDecisionPrompt({ recordId, decision })
  }

  async function submitDecisionNote(comments: string) {
    if (!decisionPrompt) return

    const { recordId, decision } = decisionPrompt
    setLoadingRecordId(recordId)
    try {
      const res = await apiFetch(`/api/correspondence/records/${recordId}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          comments: comments || null,
          acting_department: lockedDepartment || null,
        }),
      })

      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || "Failed to apply decision")
      }

      const updatedRecord = body.data?.record as CorrespondenceRecord | undefined
      const newStatus = (updatedRecord?.status ?? decision) as CorrespondenceStatus
      toast.success(`Record ${newStatus.replaceAll("_", " ")}`)
      queryClient.setQueryData<typeof recordsPage>(recordsKey, (current) =>
        current
          ? {
              ...current,
              records: current.records.map((record) =>
                record.id === recordId ? { ...record, ...updatedRecord, status: newStatus } : record
              ),
            }
          : current
      )
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.correspondenceCounts(countsDepartment) })
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to apply decision"))
    } finally {
      setLoadingRecordId(null)
      setDecisionPrompt(null)
    }
  }

  const columns: DataTableColumn<CorrespondenceRecord>[] = [
    {
      key: "reference_number",
      label: "Reference",
      sortable: true,
      resizable: true,
      initialWidth: 220,
      accessor: (r) => r.reference_number,
      render: (r) => {
        if (!["approved", "sent", "filed"].includes(r.status) || !r.reference_number) {
          return "-"
        }

        const copyToClipboard = (text: string) => {
          navigator.clipboard.writeText(text)
          toast.success(`Copied: ${text}`)
        }

        if (r.letter_type === "external" && r.simulated_sequence) {
          const lastSlashIndex = r.reference_number.lastIndexOf("/")
          if (lastSlashIndex !== -1) {
            const prefix = r.reference_number.substring(0, lastSlashIndex + 1)
            const seqStr = String(r.simulated_sequence).padStart(3, "0")
            const simulatedRef = `${prefix}${seqStr}`
            if (simulatedRef !== r.reference_number) {
              return (
                <span className="flex flex-wrap items-center gap-x-1 font-medium">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="cursor-pointer border-0 bg-transparent p-0 text-left font-medium hover:underline"
                        onClick={() => copyToClipboard(r.reference_number!)}
                      >
                        {r.reference_number}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Click to copy original reference</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground cursor-pointer border-0 bg-transparent p-0 text-left text-xs font-normal hover:underline"
                        onClick={(e) => {
                          e.stopPropagation()
                          copyToClipboard(simulatedRef)
                        }}
                      >
                        ({simulatedRef})
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Click to copy simulated reference</p>
                    </TooltipContent>
                  </Tooltip>
                </span>
              )
            }
          }
        }
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="cursor-pointer border-0 bg-transparent p-0 text-left font-medium hover:underline"
                onClick={() => copyToClipboard(r.reference_number!)}
              >
                {r.reference_number}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Click to copy reference</p>
            </TooltipContent>
          </Tooltip>
        )
      },
    },
    {
      key: "letter_type",
      label: "Type",
      sortable: true,
      accessor: (r) => r.letter_type || "external",
      render: (r) => <Badge variant="outline">{r.letter_type || "external"}</Badge>,
    },
    {
      key: "department",
      label: "Department",
      sortable: true,
      hideOnMobile: true,
      accessor: (r) => r.department_name || r.assigned_department_name || "-",
      render: (r) => (
        <span
          className="block max-w-[180px] truncate"
          title={r.department_name || r.assigned_department_name || undefined}
        >
          {r.department_name || r.assigned_department_name || "-"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (r) => r.status,
      render: (r) => <Badge className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</Badge>,
    },
    {
      key: "requested_by",
      label: "Requested by",
      sortable: true,
      hideOnMobile: true,
      accessor: (r) => r.sender_name || "-",
    },
    {
      key: "created_at",
      label: "Date",
      sortable: true,
      hideOnMobile: true,
      accessor: (r) => r.created_at,
      render: (r) =>
        r.created_at ? formatWATDate(r.created_at, { day: "2-digit", month: "short", year: "numeric" }) : "-",
    },
  ]

  const tabs: DataTableTab[] = [
    { key: "all", label: `All (${tabCounts.all})` },
    { key: "external", label: `External (${tabCounts.external})` },
    { key: "internal", label: `Internal (${tabCounts.internal})` },
  ]

  const filters: DataTableFilter<CorrespondenceRecord>[] = [
    {
      key: "status",
      label: "Status",
      options: [
        { value: "draft", label: "Draft" },
        { value: "under_review", label: "Sent for review" },
        { value: "approved", label: "Approved" },
        { value: "rejected", label: "Rejected" },
        { value: "returned_for_correction", label: "Returned for correction" },
        { value: "assigned_action_pending", label: "Assigned action pending" },
        { value: "open", label: "Open" },
        { value: "sent", label: "Sent" },
        { value: "filed", label: "Filed" },
      ],
      multi: false,
      // Server does the actual filtering (see onFilterChange -> statusFilter).
      mode: "custom",
      filterFn: () => true,
    },
    {
      key: "year",
      label: "Year",
      multi: false,
      // Dedupe the years themselves — a Set of freshly-built objects never
      // collapses duplicates, so every record used to add its own option.
      options: Array.from(
        new Set(
          records
            .map((record) => new Date(record.created_at || "").getFullYear())
            .filter((year) => Number.isFinite(year))
        )
      )
        .sort((a, b) => b - a)
        .map((year) => ({ value: String(year), label: String(year) })),
      // Server does the actual filtering (see onFilterChange → yearFilter).
      mode: "custom",
      filterFn: () => true,
    },
    // Department filter is server-side (see onFilterChange → departmentFilter).
    // Hidden when the page is already locked to a single department.
    ...(lockedDepartment
      ? []
      : [
          {
            key: "department",
            label: "Department",
            icon: <Building2 className="h-4 w-4" />,
            multi: false,
            mode: "custom" as const,
            // Server does the actual filtering; keep client-side rows intact.
            filterFn: () => true,
            options: availableDepartments.map((name) => ({ value: name, label: name })),
          } satisfies DataTableFilter<CorrespondenceRecord>,
        ]),
  ]

  return (
    <DataTablePage
      title="Correspondence"
      description="Manage correspondence references and tracking."
      icon={ListFilter}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tab) => {
        setActiveTab(tab as "all" | "external" | "internal")
        setPage(1)
      }}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => setExportOptionsOpen(true)}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      }
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Under Review"
            value={stats.underReview}
            icon={Clock}
            iconBgColor="bg-amber-500/10"
            iconColor="text-amber-500"
          />
          <StatCard
            variant="compact"
            title="Approved"
            value={stats.approved}
            icon={CheckCircle}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
          <StatCard
            variant="compact"
            title="Rejected"
            value={stats.rejected}
            icon={ShieldCheck}
            iconBgColor="bg-red-500/10"
            iconColor="text-red-500"
          />
          <StatCard
            variant="compact"
            title="Total"
            value={stats.total}
            icon={FileText}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
        </StatGrid>
      }
    >
      <DataTable<CorrespondenceRecord>
        data={records}
        columns={columns}
        getRowId={(r) => r.id}
        searchPlaceholder="Search reference, subject, recipient, or sender..."
        searchFn={(r, q) =>
          `${r.reference_number} ${r.subject} ${r.recipient_name || ""} ${r.sender_name || ""}`
            .toLowerCase()
            .includes(q)
        }
        filters={filters}
        isLoading={isLoading}
        pagination={{ pageSize: 50, serverSide: true }}
        totalRows={total}
        currentPage={page - 1}
        onPageChange={(p) => setPage(p + 1)}
        onSearchChange={setSearchQuery}
        onFilterChange={(f) => {
          const dept = f.department?.[0] ?? ""
          const status = f.status?.[0] ?? ""
          const year = f.year?.[0] ?? ""

          if (dept === departmentFilter && status === statusFilter && year === yearFilter) {
            return
          }

          setDepartmentFilter(dept)
          setStatusFilter(status)
          setYearFilter(year)
          setPage(1)
        }}
        rowActions={[
          {
            label: "Approve",
            onClick: (r) => decide(r.id, "approved"),
            hidden: (r) => r.status !== "under_review" || loadingRecordId === r.id,
          },
          {
            label: "Reject",
            onClick: (r) => decide(r.id, "rejected"),
            hidden: (r) => r.status !== "under_review" || loadingRecordId === r.id,
          },
          {
            label: "Return for correction",
            onClick: (r) => decide(r.id, "returned_for_correction"),
            hidden: (r) => r.status !== "under_review" || loadingRecordId === r.id,
          },
        ]}
        expandable={{
          render: (r) => (
            <div className="grid gap-3 md:grid-cols-2">
              <p className="text-sm md:col-span-2">
                <span className="text-muted-foreground">Subject:</span> {r.subject}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Department:</span>{" "}
                {r.department_name || r.assigned_department_name || "-"}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Recipient:</span> {r.recipient_name || "-"}
                {r.recipient_code ? ` (${r.recipient_code})` : ""}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Requested by:</span> {r.sender_name || "-"}
              </p>
              {r.created_by_name && r.created_by_name !== r.sender_name && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Created by:</span> {r.created_by_name}
                </p>
              )}
              <p className="text-sm">
                <span className="text-muted-foreground">Due Date:</span> {r.due_date || "-"}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Action Required:</span> {r.action_required ? "Yes" : "No"}
              </p>
            </div>
          ),
        }}
        viewToggle
        contactsView
        stickyToolbar
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        mobileRow={{
          title: (r) => `${r.reference_number} · ${r.subject}`,
          subtitle: (r) =>
            `${r.department_name || r.assigned_department_name || "No dept"} · ${r.recipient_name || "No recipient"} · ${formatWATDate(r.created_at)}`,
          trailing: (r) => (
            <Badge variant="outline" className={`text-xs capitalize ${statusBadgeClass(r.status)}`}>
              {statusLabel(r.status)}
            </Badge>
          ),
          detail: {
            title: (r) => r.reference_number || "Reference Pending",
            subtitle: (r) => (
              <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-1.5 text-xs">
                <Badge variant="outline" className="text-xs font-medium uppercase">
                  {r.letter_type || "external"}
                </Badge>
                {(r.department_name || r.assigned_department_name) && (
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="text-muted-foreground/70 h-3.5 w-3.5" />
                    <span>{r.department_name || r.assigned_department_name}</span>
                  </span>
                )}
              </div>
            ),
            badges: (r) => <Badge className={cn("text-xs", statusBadgeClass(r.status))}>{statusLabel(r.status)}</Badge>,
            fields: (r) => [
              {
                icon: FileText,
                label: "Title / Subject",
                value: r.subject,
                fullWidth: true,
                copyable: true,
              },
              {
                icon: Building2,
                label: "Department",
                value: r.department_name || r.assigned_department_name || "—",
                fullWidth: true,
              },
              {
                icon: Calendar,
                label: "Date",
                value: r.created_at
                  ? formatWATDate(r.created_at, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
                  : "—",
              },
              {
                icon: CalendarClock,
                label: "Due Date",
                value: r.due_date || "—",
                muted: !r.due_date,
              },
              {
                icon: User,
                label: "Recipient",
                value: r.recipient_name
                  ? `${r.recipient_name}${r.recipient_code ? ` (${r.recipient_code})` : ""}`
                  : "No recipient",
                fullWidth: Boolean(r.recipient_name && r.recipient_name.length > 25),
              },
              {
                icon: User,
                label: "Requested by",
                value: r.sender_name || "—",
              },
              ...(r.created_by_name && r.created_by_name !== r.sender_name
                ? [
                    {
                      icon: User,
                      label: "Created by",
                      value: r.created_by_name,
                    },
                  ]
                : []),
              {
                icon: CircleDot,
                label: "Action Required",
                value: r.action_required ? "Yes" : "No",
              },
              ...((r.metadata as Record<string, string> | null)?.notes
                ? [
                    {
                      icon: FileText,
                      label: "Notes",
                      value: (r.metadata as Record<string, string>).notes,
                      copyable: true,
                      fullWidth: true,
                    },
                  ]
                : []),
            ],
            actions: (r) => [
              ...(r.status === "under_review" && loadingRecordId !== r.id
                ? [
                    {
                      label: "Approve",
                      onClick: () => decide(r.id, "approved"),
                    },
                    {
                      label: "Reject",
                      variant: "destructive" as const,
                      onClick: () => decide(r.id, "rejected"),
                    },
                    {
                      label: "Return for correction",
                      variant: "outline" as const,
                      onClick: () => decide(r.id, "returned_for_correction"),
                    },
                  ]
                : []),
            ],
          },
        }}
        cardRenderer={(r) => (
          <div className="bg-card space-y-3 rounded-xl border p-4 text-xs transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">{r.reference_number}</p>
                <p className="text-muted-foreground line-clamp-1 text-xs">{r.subject}</p>
              </div>
              <Badge variant="outline" className={`capitalize ${statusBadgeClass(r.status)}`}>
                {statusLabel(r.status)}
              </Badge>
            </div>
            <div className="text-muted-foreground space-y-1 border-t pt-2 text-xs">
              <p>Recipient: {r.recipient_name || "—"}</p>
              <div className="flex items-center justify-between text-xs">
                <span>{r.department_name || r.assigned_department_name || "—"}</span>
                <span>{formatWATDate(r.created_at)}</span>
              </div>
            </div>
          </div>
        )}
        emptyTitle="No references found"
        emptyDescription="No correspondence records match the current filters."
        emptyIcon={ListFilter}
        skeletonRows={5}
        urlSync
      />

      <PromptDialog
        open={decisionPrompt !== null}
        onOpenChange={(open) => {
          if (!open) setDecisionPrompt(null)
        }}
        title={
          decisionPrompt?.decision === "approved"
            ? "Approval note"
            : decisionPrompt?.decision === "rejected"
              ? "Why are you rejecting this reference?"
              : "Why are you returning this reference?"
        }
        description="Add a note so the requester can see why this action was taken."
        label="Approver note"
        placeholder="Write a short explanation..."
        inputType="textarea"
        required={decisionPrompt?.decision !== "approved"}
        confirmLabel="Submit decision"
        confirmVariant={decisionPrompt?.decision === "rejected" ? "destructive" : "default"}
        onConfirm={submitDecisionNote}
      />

      <ExportOptionsDialog
        open={exportOptionsOpen}
        onOpenChange={setExportOptionsOpen}
        title="Export Correspondence"
        options={[
          { id: "excel", label: "Excel (.xlsx)", icon: "excel" },
          { id: "pdf", label: "PDF", icon: "pdf" },
          { id: "word", label: "Word (.docx)", icon: "word" },
        ]}
        onSelect={(id) => {
          void handleExport(id as "excel" | "pdf" | "word")
        }}
      />
    </DataTablePage>
  )
}
