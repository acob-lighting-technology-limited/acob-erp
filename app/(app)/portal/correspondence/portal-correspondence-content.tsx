"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type { CorrespondenceRecord } from "@/types/correspondence"

interface DepartmentCodeOption {
  department_name: string
  department_code: string
}

interface PortalCorrespondenceContentProps {
  userId: string
  currentViewerName: string
  currentViewerDepartment: string
  initialRecords: CorrespondenceRecord[]
  departmentCodes: DepartmentCodeOption[]
}

export function PortalCorrespondenceContent({
  currentViewerName,
  currentViewerDepartment,
  initialRecords,
  departmentCodes,
}: PortalCorrespondenceContentProps) {
  const initialDepartment = departmentCodes.some((d) => d.department_name === currentViewerDepartment)
    ? currentViewerDepartment
    : ""

  const [records, setRecords] = useState<CorrespondenceRecord[]>(initialRecords)
  const [isSaving, setIsSaving] = useState(false)
  const [dispatchingId, setDispatchingId] = useState<string | null>(null)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [linkReference, setLinkReference] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    direction: "outgoing",
    department_name: initialDepartment,
    letter_type: "external",
    category: "notice",
    subject: "",
    recipient_name: "",
    sender_name: currentViewerName,
    source_mode: "email",
    assigned_department_name: initialDepartment,
    action_required: false,
    due_date: "",
    metadata_text: "",
  })

  const stats = useMemo(() => {
    return {
      total: records.length,
      open: records.filter((r) => ["open", "draft", "under_review", "assigned_action_pending"].includes(r.status))
        .length,
      closed: records.filter((r) => ["closed", "sent", "filed"].includes(r.status)).length,
      incoming: records.filter((r) => r.direction === "incoming").length,
    }
  }, [records])

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

    if (form.direction === "outgoing" && !form.department_name) {
      toast.error("Department is required for outgoing correspondence")
      return
    }

    setIsSaving(true)
    try {
      const metadata = form.metadata_text.trim() ? { notes: form.metadata_text.trim() } : null
      const res = await fetch("/api/correspondence/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: form.direction,
          department_name: form.direction === "outgoing" ? form.department_name : null,
          letter_type: form.direction === "outgoing" ? form.letter_type : null,
          category: form.direction === "outgoing" ? form.category : null,
          subject: form.subject,
          recipient_name: form.recipient_name || null,
          sender_name: form.sender_name || null,
          source_mode: form.direction === "incoming" ? form.source_mode : null,
          assigned_department_name: form.direction === "incoming" ? form.assigned_department_name || null : null,
          action_required: form.action_required,
          due_date: form.due_date || null,
          metadata,
        }),
      })

      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || "Failed to create correspondence")
      }

      toast.success("Correspondence created")
      setForm({
        direction: "outgoing",
        department_name: initialDepartment,
        letter_type: "external",
        category: "notice",
        subject: "",
        recipient_name: "",
        sender_name: currentViewerName,
        source_mode: "email",
        assigned_department_name: initialDepartment,
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
      if (!res.ok) {
        throw new Error(body.error || "Failed to update status")
      }

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
        body: JSON.stringify({
          final_status: "sent",
          dispatch_method: "email",
        }),
      })

      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || "Failed to dispatch correspondence")
      }

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
      if (!res.ok) {
        throw new Error(body.error || "Failed to link response")
      }

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
    <div className="space-y-6 p-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.open}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Closed / Finalized</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.closed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Incoming</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.incoming}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Correspondence</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={createRecord}>
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select
                value={form.direction}
                onValueChange={(value) => setForm((prev) => ({ ...prev, direction: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outgoing">Outgoing</SelectItem>
                  <SelectItem value="incoming">Incoming</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.direction === "outgoing" ? (
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={form.department_name}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, department_name: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentCodes.map((dept) => (
                      <SelectItem key={dept.department_name} value={dept.department_name}>
                        {dept.department_name} ({dept.department_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Assign Department</Label>
                <Select
                  value={form.assigned_department_name}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, assigned_department_name: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentCodes.map((dept) => (
                      <SelectItem key={dept.department_name} value={dept.department_name}>
                        {dept.department_name} ({dept.department_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label>Subject</Label>
              <Input value={form.subject} onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Recipient</Label>
              <Input
                value={form.recipient_name}
                onChange={(e) => setForm((prev) => ({ ...prev, recipient_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Sender</Label>
              <Input
                value={form.sender_name}
                onChange={(e) => setForm((prev) => ({ ...prev, sender_name: e.target.value }))}
              />
            </div>

            {form.direction === "outgoing" ? (
              <>
                <div className="space-y-2">
                  <Label>Letter Type</Label>
                  <Select
                    value={form.letter_type}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, letter_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="external">External</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approval">Approval</SelectItem>
                      <SelectItem value="notice">Notice</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="invoice">Invoice</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>Source Mode</Label>
                <Select
                  value={form.source_mode}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, source_mode: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="physical">Physical</SelectItem>
                    <SelectItem value="portal">Portal</SelectItem>
                    <SelectItem value="courier">Courier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Due Date (Optional)</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                rows={3}
                value={form.metadata_text}
                onChange={(e) => setForm((prev) => ({ ...prev, metadata_text: e.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Create Correspondence"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Correspondence</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.reference_number}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{record.direction}</Badge>
                  </TableCell>
                  <TableCell>{record.department_name || record.assigned_department_name || "-"}</TableCell>
                  <TableCell>
                    <Badge>{record.status}</Badge>
                  </TableCell>
                  <TableCell>{record.subject}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      {record.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(record.id, "under_review")}>
                          Send for Review
                        </Button>
                      )}
                      {record.status === "approved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => dispatchRecord(record.id)}
                          disabled={dispatchingId === record.id}
                        >
                          {dispatchingId === record.id ? "Dispatching..." : "Dispatch"}
                        </Button>
                      )}
                      {record.direction === "outgoing" && (
                        <>
                          <Select
                            value={linkReference[record.id] || ""}
                            onValueChange={(value) => setLinkReference((prev) => ({ ...prev, [record.id]: value }))}
                          >
                            <SelectTrigger className="w-[210px]">
                              <SelectValue placeholder="Link incoming reference" />
                            </SelectTrigger>
                            <SelectContent>
                              {incomingOptions.map((incoming) => (
                                <SelectItem key={incoming.id} value={incoming.id}>
                                  {incoming.reference_number}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => linkResponse(record.id)}
                            disabled={linkingId === record.id}
                          >
                            {linkingId === record.id ? "Linking..." : "Link"}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
