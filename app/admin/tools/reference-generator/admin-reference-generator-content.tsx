"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PromptDialog } from "@/components/ui/prompt-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChevronDown, ChevronUp } from "lucide-react"
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

interface AdminReferenceGeneratorContentProps {
  initialRecords: CorrespondenceRecord[]
  employees: EmployeeOption[]
  departmentCodes: DepartmentCodeOption[]
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

const DepartmentCodeFormSchema = z.object({
  department_name: z.string().min(1, "Department name is required"),
  department_code: z.string().min(1, "Department code is required"),
})

type DepartmentCodeFormValues = z.infer<typeof DepartmentCodeFormSchema>

export function AdminReferenceGeneratorContent({
  initialRecords,
  employees,
  departmentCodes,
}: AdminReferenceGeneratorContentProps) {
  const [records, setRecords] = useState<CorrespondenceRecord[]>(initialRecords)
  const [loadingRecordId, setLoadingRecordId] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(initialRecords.length)
  const codeForm = useForm<DepartmentCodeFormValues>({
    resolver: zodResolver(DepartmentCodeFormSchema),
    defaultValues: { department_name: "", department_code: "" },
  })
  const [showMappings, setShowMappings] = useState(false)
  const [decisionPrompt, setDecisionPrompt] = useState<{
    recordId: string
    decision: "approved" | "rejected" | "returned_for_correction"
  } | null>(null)

  const filteredRecords = useMemo(() => {
    return records
  }, [records])

  const stats = useMemo(() => {
    return {
      total: records.length,
      underReview: records.filter((r) => r.status === "under_review").length,
      awaitingAction: records.filter((r) => r.status === "assigned_action_pending").length,
      approved: records.filter((r) => r.status === "approved").length,
      finalized: records.filter((r) => ["sent", "filed", "closed"].includes(r.status)).length,
    }
  }, [records])

  useEffect(() => {
    async function loadRecords() {
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
      })
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (searchQuery.trim()) params.set("search", searchQuery.trim())

      const res = await fetch(`/api/correspondence/records?${params.toString()}`, { cache: "no-store" })
      const json = await res.json()
      setRecords(json.data || [])
      setTotal(Number(json.total || 0))
    }

    void loadRecords()
  }, [page, searchQuery, statusFilter])

  const totalPages = Math.max(1, Math.ceil(total / 50))

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
      setRecords((current) =>
        current.map((record) =>
          record.id === recordId
            ? { ...record, responsible_officer_id: responsibleOfficerId, status: "assigned_action_pending" }
            : record
        )
      )
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to assign officer"))
    } finally {
      setLoadingRecordId(null)
    }
  }

  async function decide(recordId: string, decision: "approved" | "rejected" | "returned_for_correction") {
    setDecisionPrompt({ recordId, decision })
  }

  async function submitDecisionNote(comments: string) {
    if (!decisionPrompt) return

    const { recordId, decision } = decisionPrompt
    setLoadingRecordId(recordId)
    try {
      const res = await fetch(`/api/correspondence/records/${recordId}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comments: comments || null }),
      })

      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || "Failed to apply decision")
      }

      toast.success(`Record ${decision.replaceAll("_", " ")}`)
      setRecords((current) =>
        current.map((record) => (record.id === recordId ? { ...record, status: decision } : record))
      )
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to apply decision"))
    } finally {
      setLoadingRecordId(null)
      setDecisionPrompt(null)
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
      setRecords((current) =>
        current.map((record) => (record.id === recordId ? { ...record, status: finalStatus } : record))
      )
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to finalize dispatch"))
    } finally {
      setLoadingRecordId(null)
    }
  }

  const updateDepartmentCode = codeForm.handleSubmit(async (data) => {
    try {
      const res = await fetch("/api/correspondence/department-codes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_name: data.department_name.trim(),
          department_code: data.department_code.trim().toUpperCase(),
          is_active: true,
        }),
      })

      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || "Failed to update department code")
      }

      toast.success("Department code updated")
      codeForm.reset({ department_name: "", department_code: "" })
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to update department code"))
    }
  })

  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-5 md:gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold sm:text-2xl">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Under Review</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold sm:text-2xl">{stats.underReview}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Assigned Action</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold sm:text-2xl">{stats.awaitingAction}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold sm:text-2xl">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Finalized</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold sm:text-2xl">{stats.finalized}</p>
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
              <Input {...codeForm.register("department_name")} />
              {codeForm.formState.errors.department_name && (
                <p className="text-destructive text-sm">{codeForm.formState.errors.department_name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Department Code</Label>
              <Input {...codeForm.register("department_code")} />
              {codeForm.formState.errors.department_code && (
                <p className="text-destructive text-sm">{codeForm.formState.errors.department_code.message}</p>
              )}
            </div>
            <div className="flex items-end">
              <Button type="submit">Save Code</Button>
            </div>
          </form>

          <div className="space-y-3">
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground h-8 px-0 text-sm"
              onClick={() => setShowMappings((prev) => !prev)}
            >
              Active mappings: {departmentCodes.filter((item) => item.is_active).length}
              {showMappings ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
            </Button>

            {showMappings && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departmentCodes.map((item) => (
                      <TableRow key={item.department_name}>
                        <TableCell className="font-medium">{item.department_name}</TableCell>
                        <TableCell>{item.department_code}</TableCell>
                        <TableCell>
                          <Badge variant={item.is_active ? "default" : "outline"}>
                            {item.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Reference Generator Queue</CardTitle>
          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              value={searchQuery}
              onChange={(event) => {
                setPage(1)
                setSearchQuery(event.target.value)
              }}
              placeholder="Search reference, subject, recipient, or sender"
              className="md:w-[280px]"
            />
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setPage(1)
                setStatusFilter(value)
              }}
            >
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
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-foreground w-14 font-bold">#</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Officer</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((record, index) => (
                <TableRow key={record.id}>
                  <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
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
    </div>
  )
}
