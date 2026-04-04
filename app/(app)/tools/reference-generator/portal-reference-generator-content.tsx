"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader, PageWrapper } from "@/components/layout"
import { FileCode2 } from "lucide-react"
import type { CorrespondenceRecord } from "@/types/correspondence"
import { CorrespondenceStats } from "@/components/correspondence/correspondence-stats"
import { CreateReferenceDialog } from "@/components/correspondence/create-reference-dialog"
import { CorrespondenceTable } from "@/components/correspondence/correspondence-table"

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
  isDepartmentLead,
  initialRecords,
  departmentCodes,
}: PortalReferenceGeneratorContentProps) {
  const initialDepartment = departmentCodes.some((d) => d.department_name === currentViewerDepartment)
    ? currentViewerDepartment
    : ""

  const [records, setRecords] = useState<CorrespondenceRecord[]>(initialRecords)
  const [isSaving, setIsSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [dispatchingId, setDispatchingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(initialRecords.length)
  const pendingRef = useRef<HTMLDivElement | null>(null)
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
  })

  const stats = useMemo(
    () => ({
      total: records.length,
      open: records.filter((r) => ["open", "draft", "under_review", "assigned_action_pending"].includes(r.status))
        .length,
      closed: records.filter((r) => ["closed", "sent", "filed"].includes(r.status)).length,
      incoming: records.filter((r) => r.direction === "incoming").length,
    }),
    [records]
  )

  const isLead = Boolean(isDepartmentLead)
  const pendingRecords = useMemo(
    () => records.filter((r) => ["open", "under_review", "assigned_action_pending"].includes(r.status)),
    [records]
  )

  const totalPages = Math.max(1, Math.ceil(total / 50))

  useEffect(() => {
    async function loadRecords() {
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
      })
      if (searchQuery.trim()) params.set("search", searchQuery.trim())
      if (statusFilter !== "all") params.set("status", statusFilter)

      const res = await fetch(`/api/correspondence/records?${params.toString()}`, { cache: "no-store" })
      const json = await res.json()
      setRecords(json.data || [])
      setTotal(Number(json.total || 0))
    }

    void loadRecords()
  }, [page, searchQuery, statusFilter])

  async function createRecord(e: React.FormEvent) {
    e.preventDefault()
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
      const res = await fetch("/api/correspondence/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_name: form.department_name,
          letter_type: form.letter_type,
          category: form.category,
          subject: form.subject,
          recipient_name: form.recipient_name || null,
          sender_name: form.sender_name || null,
          action_required: form.action_required,
          due_date: form.due_date || null,
          metadata,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Failed to create correspondence")
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
      })
      setPage(1)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to create correspondence"))
    } finally {
      setIsSaving(false)
    }
  }

  async function updateStatus(recordId: string, status: string) {
    try {
      const res = await fetch(`/api/correspondence/records/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Failed to update status")
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
      const res = await fetch(`/api/correspondence/records/${recordId}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ final_status: "sent", dispatch_method: "email" }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Failed to dispatch correspondence")
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

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Reference Generator"
        description="Create and manage correspondence references."
        icon={FileCode2}
        backLink={{ href: "/profile", label: "Back to Home" }}
        actions={
          <>
            {isLead && pendingRecords.length > 0 && (
              <Button
                variant="outline"
                onClick={() => pendingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                Pending ({pendingRecords.length})
              </Button>
            )}
            <CreateReferenceDialog
              open={createOpen}
              onOpenChange={setCreateOpen}
              form={form}
              onFormChange={setForm}
              onSubmit={createRecord}
              isSaving={isSaving}
              departmentCodes={departmentCodes}
            />
          </>
        }
      />

      <CorrespondenceStats {...stats} />

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 md:flex-row">
          <input
            value={searchQuery}
            onChange={(event) => {
              setPage(1)
              setSearchQuery(event.target.value)
            }}
            placeholder="Search reference, subject, recipient, or sender"
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground flex h-10 w-full rounded-md border px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(event) => {
              setPage(1)
              setStatusFilter(event.target.value)
            }}
            className="border-input bg-background h-10 rounded-md border px-3 text-sm md:w-56"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="under_review">Under review</option>
            <option value="approved">Approved</option>
            <option value="assigned_action_pending">Assigned action pending</option>
            <option value="open">Open</option>
            <option value="sent">Sent</option>
            <option value="filed">Filed</option>
            <option value="closed">Closed</option>
          </select>
        </CardContent>
      </Card>

      {isLead && pendingRecords.length > 0 && (
        <Card ref={pendingRef}>
          <CardHeader>
            <CardTitle>Pending Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingRecords.map((record) => (
              <div key={record.id} className="flex items-center justify-between rounded border p-3">
                <div>
                  <p className="font-medium">{record.reference_number}</p>
                  <p className="text-muted-foreground text-xs">{record.subject}</p>
                </div>
                <Badge variant="secondary">{record.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <CorrespondenceTable
        records={records}
        dispatchingId={dispatchingId}
        onUpdateStatus={updateStatus}
        onDispatch={dispatchRecord}
      />

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </PageWrapper>
  )
}
