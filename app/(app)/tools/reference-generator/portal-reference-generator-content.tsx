"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { FileCode2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter, DataTableTab } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import type { CorrespondenceRecord } from "@/types/correspondence"
import { CreateReferenceDialog } from "@/components/correspondence/create-reference-dialog"

interface DepartmentCodeOption {
  department_name: string
  department_code: string
}

interface PortalReferenceGeneratorContentProps {
  currentViewerName: string
  currentViewerDepartment: string
  currentViewerRole?: string
  isDepartmentLead?: boolean
  initialRecords: CorrespondenceRecord[]
  departmentCodes: DepartmentCodeOption[]
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function PortalReferenceGeneratorContent({
  currentViewerName,
  currentViewerDepartment,
  initialRecords,
  departmentCodes,
}: PortalReferenceGeneratorContentProps) {
  const initialDepartment = departmentCodes.some((item) => item.department_name === currentViewerDepartment)
    ? currentViewerDepartment
    : ""

  const [records, setRecords] = useState<CorrespondenceRecord[]>(initialRecords)
  const [activeTab, setActiveTab] = useState<"internal" | "external">("internal")
  const [isSaving, setIsSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [dispatchingId, setDispatchingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    department_name: initialDepartment,
    letter_type: "external",
    category: "notice",
    subject: "",
    recipient_name: "",
    sender_name: currentViewerName,
    action_required: false,
    due_date: "",
    metadata_text: "",
    attachments: [] as File[],
  })

  const stats = useMemo(
    () => ({
      total: records.length,
      open: records.filter((record) =>
        ["open", "draft", "under_review", "assigned_action_pending"].includes(record.status)
      ).length,
      closed: records.filter((record) => ["closed", "sent", "filed"].includes(record.status)).length,
      internal: records.filter((record) => record.letter_type === "internal").length,
      external: records.filter((record) => record.letter_type === "external").length,
    }),
    [records]
  )

  const tabs: DataTableTab[] = useMemo(
    () => [
      { key: "internal", label: `Internal (${stats.internal})` },
      { key: "external", label: `External (${stats.external})` },
    ],
    [stats.external, stats.internal]
  )

  const filteredRecords = useMemo(
    () =>
      records.filter((record) =>
        activeTab === "internal" ? record.letter_type === "internal" : record.letter_type === "external"
      ),
    [records, activeTab]
  )

  useEffect(() => {
    let active = true

    async function loadRecords() {
      const response = await fetch("/api/correspondence/records?page=1&limit=100", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok || !active) return
      setRecords(payload.data || [])
    }

    void loadRecords()

    return () => {
      active = false
    }
  }, [])

  async function createRecord(event: React.FormEvent) {
    event.preventDefault()
    if (!form.subject.trim()) {
      toast.error("Subject is required")
      return
    }
    if (!form.department_name) {
      toast.error("Department is required")
      return
    }

    setIsSaving(true)
    try {
      const metadata = form.metadata_text.trim() ? { notes: form.metadata_text.trim() } : null
      const formPayload = new FormData()
      formPayload.append("department_name", form.department_name)
      formPayload.append("letter_type", form.letter_type)
      formPayload.append("category", form.category)
      formPayload.append("subject", form.subject)
      formPayload.append("recipient_name", form.recipient_name || "")
      formPayload.append("sender_name", form.sender_name || "")
      formPayload.append("action_required", String(form.action_required))
      formPayload.append("due_date", form.due_date || "")
      formPayload.append("metadata", JSON.stringify(metadata || {}))
      form.attachments.forEach((file) => formPayload.append("attachments", file))
      const response = await fetch("/api/correspondence/records", {
        method: "POST",
        body: formPayload,
      })
      const responsePayload = await response.json()
      if (!response.ok) throw new Error(responsePayload.error || "Failed to create correspondence")
      toast.success("Correspondence created")
      setCreateOpen(false)
      setForm({
        department_name: initialDepartment,
        letter_type: "external",
        category: "notice",
        subject: "",
        recipient_name: "",
        sender_name: currentViewerName,
        action_required: false,
        due_date: "",
        metadata_text: "",
        attachments: [],
      })
      setRecords((current) => [responsePayload.data, ...current])
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to create correspondence"))
    } finally {
      setIsSaving(false)
    }
  }

  async function updateStatus(recordId: string, status: string) {
    try {
      const response = await fetch(`/api/correspondence/records/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to update status")
      toast.success("Status updated")
      setRecords((current) =>
        current.map((record) =>
          record.id === recordId ? { ...record, status: status as typeof record.status } : record
        )
      )
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to update status"))
    }
  }

  async function dispatchRecord(recordId: string) {
    setDispatchingId(recordId)
    try {
      const response = await fetch(`/api/correspondence/records/${recordId}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ final_status: "sent", dispatch_method: "email" }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to dispatch correspondence")
      toast.success("Correspondence dispatched")
      setRecords((current) =>
        current.map((record) => (record.id === recordId ? { ...record, status: "sent" } : record))
      )
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to dispatch correspondence"))
    } finally {
      setDispatchingId(null)
    }
  }

  const columns = useMemo<DataTableColumn<CorrespondenceRecord>[]>(
    () => [
      {
        key: "reference_number",
        label: "Reference",
        sortable: true,
        accessor: (row) => row.reference_number,
        resizable: true,
        initialWidth: 220,
        render: (row) => <span className="font-medium">{row.reference_number}</span>,
      },
      {
        key: "letter_type",
        label: "Type",
        sortable: true,
        accessor: (row) => row.letter_type || "-",
        render: (row) => <Badge variant="outline">{row.letter_type || "-"}</Badge>,
      },
      {
        key: "department",
        label: "Department",
        sortable: true,
        accessor: (row) => row.department_name || row.assigned_department_name || "-",
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        accessor: (row) => row.status,
        render: (row) => <Badge>{row.status.replaceAll("_", " ")}</Badge>,
      },
      {
        key: "subject",
        label: "Subject",
        sortable: true,
        accessor: (row) => row.subject,
      },
    ],
    []
  )

  const filters = useMemo<DataTableFilter<CorrespondenceRecord>[]>(
    () => [
      {
        key: "status",
        label: "Status",
        options: Array.from(new Set(records.map((record) => record.status))).map((status) => ({
          value: status,
          label: status.replaceAll("_", " "),
        })),
      },
      {
        key: "letter_type",
        label: "Type",
        options: [
          { value: "internal", label: "Internal" },
          { value: "external", label: "External" },
        ],
        mode: "custom",
        filterFn: (row, selected) => selected.includes(row.letter_type || ""),
      },
    ],
    [records]
  )

  return (
    <DataTablePage
      title="Reference Generator"
      description="Create and manage correspondence references."
      icon={FileCode2}
      backLink={{ href: "/tools", label: "Back to Tools" }}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tab) => setActiveTab(tab as "internal" | "external")}
      actions={
        <CreateReferenceDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          form={form}
          onFormChange={setForm}
          onSubmit={createRecord}
          isSaving={isSaving}
          departmentCodes={departmentCodes}
        />
      }
      stats={
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total"
            value={stats.total}
            icon={FileCode2}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            title="Open"
            value={stats.open}
            icon={FileCode2}
            iconBgColor="bg-amber-500/10"
            iconColor="text-amber-500"
          />
          <StatCard
            title="Closed"
            value={stats.closed}
            icon={FileCode2}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
          <StatCard
            title="Internal"
            value={stats.internal}
            icon={FileCode2}
            iconBgColor="bg-violet-500/10"
            iconColor="text-violet-500"
          />
        </div>
      }
    >
      <DataTable<CorrespondenceRecord>
        data={filteredRecords}
        columns={columns}
        filters={filters}
        getRowId={(row) => row.id}
        searchPlaceholder="Search reference, subject, recipient, or sender..."
        searchFn={(row, query) =>
          `${row.reference_number} ${row.subject} ${row.recipient_name || ""} ${row.sender_name || ""}`
            .toLowerCase()
            .includes(query)
        }
        rowActions={[
          {
            label: "Send for Review",
            onClick: (row) => {
              void updateStatus(row.id, "under_review")
            },
            hidden: (row) => row.status !== "draft",
          },
          {
            label: dispatchingId ? "Dispatching..." : "Dispatch",
            onClick: (row) => {
              void dispatchRecord(row.id)
            },
            hidden: (row) => row.status !== "approved" || dispatchingId === row.id,
          },
        ]}
        expandable={{
          render: (row) => (
            <div className="grid gap-3 md:grid-cols-2">
              <p className="text-sm">
                <span className="text-muted-foreground">Recipient:</span> {row.recipient_name || "-"}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Sender:</span> {row.sender_name || "-"}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Due Date:</span> {row.due_date || "-"}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Action Required:</span> {row.action_required ? "Yes" : "No"}
              </p>
            </div>
          ),
        }}
        emptyTitle="No references found"
        emptyDescription="No correspondence records match the current filters."
        emptyIcon={FileCode2}
        skeletonRows={5}
        urlSync
      />
    </DataTablePage>
  )
}
