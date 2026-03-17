"use client"

import { useMemo, useRef, useState } from "react"
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

interface PortalCorrespondenceContentProps {
  userId: string
  currentViewerName: string
  currentViewerDepartment: string
  currentViewerRole?: string
  isDepartmentLead?: boolean
  initialRecords: CorrespondenceRecord[]
  departmentCodes: DepartmentCodeOption[]
}

export function PortalCorrespondenceContent({
  currentViewerName,
  currentViewerDepartment,
  isDepartmentLead,
  initialRecords,
  departmentCodes,
}: PortalCorrespondenceContentProps) {
  const initialDepartment = departmentCodes.some((d) => d.department_name === currentViewerDepartment)
    ? currentViewerDepartment
    : ""

  const [records, setRecords] = useState<CorrespondenceRecord[]>(initialRecords)
  const [isSaving, setIsSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [dispatchingId, setDispatchingId] = useState<string | null>(null)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const pendingRef = useRef<HTMLDivElement | null>(null)
  const [linkReference, setLinkReference] = useState<Record<string, string>>({})
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

  async function refreshRecords() {
    const res = await fetch("/api/correspondence/records", { cache: "no-store" })
    const json = await res.json()
    setRecords(json.data || [])
  }

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
      await refreshRecords()
    } catch (error: any) {
      toast.error(error.message || "Failed to create correspondence")
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
      await refreshRecords()
    } catch (error: any) {
      toast.error(error.message || "Failed to update status")
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
      await refreshRecords()
    } catch (error: any) {
      toast.error(error.message || "Failed to dispatch correspondence")
    } finally {
      setDispatchingId(null)
    }
  }

  async function linkResponse(recordId: string) {
    const incomingReferenceId = linkReference[recordId]
    if (!incomingReferenceId) {
      toast.error("Select an incoming reference first")
      return
    }
    setLinkingId(recordId)
    try {
      const res = await fetch(`/api/correspondence/records/${recordId}/link-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incoming_reference_id: incomingReferenceId }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Failed to link response")
      toast.success("Outgoing reference linked to incoming correspondence")
      await refreshRecords()
    } catch (error: any) {
      toast.error(error.message || "Failed to link response")
    } finally {
      setLinkingId(null)
    }
  }

  const incomingOptions = records.filter((r) => r.direction === "incoming")

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Reference Generator"
        description="Create and manage correspondence references."
        icon={FileCode2}
        backLink={{ href: "/dashboard/profile", label: "Back to Dashboard" }}
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
        incomingOptions={incomingOptions}
        linkReference={linkReference}
        onLinkReferenceChange={(id, value) => setLinkReference((prev) => ({ ...prev, [id]: value }))}
        dispatchingId={dispatchingId}
        linkingId={linkingId}
        onUpdateStatus={updateStatus}
        onDispatch={dispatchRecord}
        onLinkResponse={linkResponse}
      />
    </PageWrapper>
  )
}
