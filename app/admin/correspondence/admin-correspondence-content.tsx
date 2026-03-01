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
import type { CorrespondenceRecord } from "@/types/correspondence"

interface EmployeeOption {
  id: string
  first_name: string | null
  last_name: string | null
  department: string | null
  role: string | null
}

interface DepartmentCodeOption {
  department_name: string
  department_code: string
  is_active: boolean
}

interface AdminCorrespondenceContentProps {
  initialRecords: CorrespondenceRecord[]
  employees: EmployeeOption[]
  departmentCodes: DepartmentCodeOption[]
}

export function AdminCorrespondenceContent({
  initialRecords,
  employees,
  departmentCodes,
}: AdminCorrespondenceContentProps) {
  const [records, setRecords] = useState<CorrespondenceRecord[]>(initialRecords)
  const [loadingRecordId, setLoadingRecordId] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [codeForm, setCodeForm] = useState({ department_name: "", department_code: "" })

  const filteredRecords = useMemo(() => {
    if (statusFilter === "all") return records
    return records.filter((record) => record.status === statusFilter)
  }, [records, statusFilter])

  const stats = useMemo(() => {
    return {
      total: records.length,
      underReview: records.filter((r) => r.status === "under_review").length,
      awaitingAction: records.filter((r) => r.status === "assigned_action_pending").length,
      approved: records.filter((r) => r.status === "approved").length,
      finalized: records.filter((r) => ["sent", "filed", "closed"].includes(r.status)).length,
    }
  }, [records])

  async function refresh() {
    const res = await fetch("/api/correspondence/records", { cache: "no-store" })
    const json = await res.json()
    setRecords(json.data || [])
  }

  async function assignOfficer(recordId: string) {
    const responsibleOfficerId = assignments[recordId]
    if (!responsibleOfficerId) {
      toast.error("Select an officer first")
      return
    }

    setLoadingRecordId(recordId)
    try {
      const res = await fetch(`/api/correspondence/records/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responsible_officer_id: responsibleOfficerId,
          status: "assigned_action_pending",
        }),
      })

      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || "Failed to assign officer")
      }

      toast.success("Responsible officer assigned")
      await refresh()
    } catch (error: any) {
      toast.error(error.message || "Failed to assign officer")
    } finally {
      setLoadingRecordId(null)
    }
  }

  async function decide(recordId: string, decision: "approved" | "rejected" | "returned_for_correction") {
    setLoadingRecordId(recordId)
    try {
      const res = await fetch(`/api/correspondence/records/${recordId}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })

      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || "Failed to apply decision")
      }

      toast.success(`Record ${decision.replaceAll("_", " ")}`)
      await refresh()
    } catch (error: any) {
      toast.error(error.message || "Failed to apply decision")
    } finally {
      setLoadingRecordId(null)
    }
  }

  async function dispatch(recordId: string, finalStatus: "sent" | "filed") {
    setLoadingRecordId(recordId)
    try {
      const res = await fetch(`/api/correspondence/records/${recordId}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          final_status: finalStatus,
          dispatch_method: "email",
        }),
      })

      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || "Failed to finalize dispatch")
      }

      toast.success(`Record marked ${finalStatus}`)
      await refresh()
    } catch (error: any) {
      toast.error(error.message || "Failed to finalize dispatch")
    } finally {
      setLoadingRecordId(null)
    }
  }

  async function updateDepartmentCode(e: React.FormEvent) {
    e.preventDefault()
    if (!codeForm.department_name.trim() || !codeForm.department_code.trim()) {
      toast.error("Department name and code are required")
      return
    }

    try {
      const res = await fetch("/api/correspondence/department-codes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_name: codeForm.department_name.trim(),
          department_code: codeForm.department_code.trim().toUpperCase(),
          is_active: true,
        }),
      })

      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || "Failed to update department code")
      }

      toast.success("Department code updated")
      setCodeForm({ department_name: "", department_code: "" })
    } catch (error: any) {
      toast.error(error.message || "Failed to update department code")
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Under Review</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.underReview}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Assigned Action</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.awaitingAction}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Finalized</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.finalized}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Department Code Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={updateDepartmentCode} className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Department Name</Label>
              <Input
                value={codeForm.department_name}
                onChange={(e) => setCodeForm((prev) => ({ ...prev, department_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Department Code</Label>
              <Input
                value={codeForm.department_code}
                onChange={(e) => setCodeForm((prev) => ({ ...prev, department_code: e.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit">Save Code</Button>
            </div>
          </form>

          <div className="text-muted-foreground text-sm">
            Active mappings: {departmentCodes.filter((item) => item.is_active).length}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Correspondence Queue</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="under_review">Under review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="returned_for_correction">Returned for correction</SelectItem>
              <SelectItem value="assigned_action_pending">Assigned action pending</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="filed">Filed</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Officer</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <div className="font-medium">{record.reference_number}</div>
                    <div className="text-muted-foreground text-xs">{record.subject}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{record.direction}</Badge>
                  </TableCell>
                  <TableCell>{record.department_name || record.assigned_department_name || "-"}</TableCell>
                  <TableCell>
                    <Badge>{record.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Select
                        value={assignments[record.id] || ""}
                        onValueChange={(value) => setAssignments((prev) => ({ ...prev, [record.id]: value }))}
                      >
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="Assign officer" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees
                            .filter((employee) => {
                              const dept = record.department_name || record.assigned_department_name
                              if (!dept) return true
                              return !employee.department || employee.department === dept
                            })
                            .map((employee) => (
                              <SelectItem key={employee.id} value={employee.id}>
                                {(employee.first_name || "") + " " + (employee.last_name || "")}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => assignOfficer(record.id)}
                        disabled={loadingRecordId === record.id}
                      >
                        Assign
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {record.status === "under_review" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => decide(record.id, "approved")}
                            disabled={loadingRecordId === record.id}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => decide(record.id, "rejected")}
                            disabled={loadingRecordId === record.id}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => decide(record.id, "returned_for_correction")}
                            disabled={loadingRecordId === record.id}
                          >
                            Return
                          </Button>
                        </>
                      )}
                      {record.status === "approved" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => dispatch(record.id, "sent")}
                            disabled={loadingRecordId === record.id}
                          >
                            Mark Sent
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => dispatch(record.id, "filed")}
                            disabled={loadingRecordId === record.id}
                          >
                            Mark Filed
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
