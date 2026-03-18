"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { TablePage } from "@/components/admin/admin-table-page"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { TableSkeleton } from "@/components/ui/query-states"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { REPORT_DOC_MAX_SIZE_BYTES, formatLimitMb } from "@/lib/reports/document-upload-limits"
import { Download, Eye, Loader2, Pencil, Plus, Presentation, Search, Trash2 } from "lucide-react"

type Employee = {
  id: string
  full_name: string
  department: string | null
}

type KssRosterEntry = {
  id: string
  meeting_week: number
  meeting_year: number
  department: string
  presenter_id: string | null
  created_by: string | null
  notes: string | null
  created_at: string
}

type KssDocument = {
  id: string
  meeting_week: number
  meeting_year: number
  document_type: "knowledge_sharing_session"
  department: string | null
  presenter_id: string | null
  file_name: string
  mime_type?: string | null
  signed_url: string | null
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
type UploadPhase = "idle" | "saving" | "converting" | "uploading"

interface Props {
  employees: Employee[]
  backHref: string
  backLabel: string
  title?: string
  readOnly?: boolean
}

function compareWeekYear(aWeek: number, aYear: number, bWeek: number, bYear: number): number {
  if (aYear !== bYear) return aYear - bYear
  return aWeek - bWeek
}

function sanitizeForFileName(value: string): string {
  const sanitized = value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
  return sanitized || "Unknown"
}

function getFileExtension(fileName: string, mimeType?: string | null): string {
  const lower = (fileName || "").toLowerCase()
  if (lower.endsWith(".pdf")) return "pdf"
  if (lower.endsWith(".pptx")) return "pptx"
  if (lower.endsWith(".ppt")) return "ppt"
  if (mimeType === "application/pdf") return "pdf"
  if (mimeType === "application/vnd.ms-powerpoint") return "ppt"
  if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "pptx"
  return "pdf"
}

export function KssRosterTable({
  employees,
  backHref,
  backLabel,
  title = "Knowledge Sharing Session",
  readOnly = false,
}: Props) {
  const currentOfficeWeek = getCurrentOfficeWeek()
  const defaultWeek = currentOfficeWeek.week
  const defaultYear = currentOfficeWeek.year

  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<{
    doc: KssDocument
    row: KssRosterEntry
    presenterName: string
  } | null>(null)
  const [pendingDeleteRow, setPendingDeleteRow] = useState<KssRosterEntry | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const [weekNumber, setWeekNumber] = useState(defaultWeek)
  const [yearNumber, setYearNumber] = useState(defaultYear)
  const [department, setDepartment] = useState("none")
  const [presenterId, setPresenterId] = useState("none")
  const [notes, setNotes] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle")

  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [weekFilter, setWeekFilter] = useState("all")
  const [yearFilter, setYearFilter] = useState("all")
  const [timeTypeFilter, setTimeTypeFilter] = useState<string[]>(["current", "past"])

  const weekOptions = Array.from({ length: 53 }, (_, i) => i + 1)
  const yearOptions = [
    currentOfficeWeek.year - 1,
    currentOfficeWeek.year,
    currentOfficeWeek.year + 1,
    currentOfficeWeek.year + 2,
  ]

  const departments = useMemo(() => {
    return Array.from(new Set(employees.map((e) => e.department).filter(Boolean) as string[])).sort((a, b) =>
      a.localeCompare(b)
    )
  }, [employees])

  const presenterOptions = useMemo(() => {
    if (department === "none") return []
    return employees.filter((e) => e.department === department).sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [department, employees])

  const employeeNameById = useMemo(() => {
    return new Map(employees.map((e) => [e.id, e.full_name]))
  }, [employees])

  const {
    data: roster = [],
    refetch: refetchRoster,
    isLoading: isRosterLoading,
  } = useQuery({
    queryKey: ["kss-roster-table"],
    queryFn: async (): Promise<KssRosterEntry[]> => {
      const res = await fetch("/api/reports/kss-roster")
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to fetch KSS roster")
      return payload.data || []
    },
  })

  const {
    data: docs = [],
    refetch: refetchDocs,
    isLoading: isDocsLoading,
  } = useQuery({
    queryKey: ["kss-documents-table"],
    queryFn: async (): Promise<KssDocument[]> => {
      const res = await fetch(
        "/api/reports/meeting-week-documents?documentType=knowledge_sharing_session&currentOnly=true"
      )
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to fetch KSS documents")
      return payload.data || []
    },
  })

  const docByWeekYear = useMemo(() => {
    const map = new Map<string, KssDocument>()
    docs.forEach((d) => map.set(`${d.meeting_year}-${d.meeting_week}`, d))
    return map
  }, [docs])

  const rows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return roster
      .filter((row) => {
        const compare = compareWeekYear(
          row.meeting_week,
          row.meeting_year,
          currentOfficeWeek.week,
          currentOfficeWeek.year
        )
        const isCurrent = compare === 0
        const isPast = compare < 0
        const isUpcoming = compare > 0
        const includeByTime =
          (isCurrent && timeTypeFilter.includes("current")) ||
          (isPast && timeTypeFilter.includes("past")) ||
          (isUpcoming && timeTypeFilter.includes("upcoming"))
        if (!includeByTime) return false

        if (departmentFilter !== "all" && row.department !== departmentFilter) return false
        if (weekFilter !== "all" && row.meeting_week !== Number(weekFilter)) return false
        if (yearFilter !== "all" && row.meeting_year !== Number(yearFilter)) return false

        if (!q) return true
        const presenterName = row.presenter_id ? (employeeNameById.get(row.presenter_id) || "").toLowerCase() : ""
        return (
          row.department.toLowerCase().includes(q) ||
          presenterName.includes(q) ||
          String(row.meeting_week).includes(q) ||
          String(row.meeting_year).includes(q)
        )
      })
      .sort((a, b) => compareWeekYear(b.meeting_week, b.meeting_year, a.meeting_week, a.meeting_year))
  }, [
    roster,
    timeTypeFilter,
    currentOfficeWeek.week,
    currentOfficeWeek.year,
    departmentFilter,
    weekFilter,
    yearFilter,
    searchQuery,
    employeeNameById,
  ])

  const resetForm = () => {
    setWeekNumber(defaultWeek)
    setYearNumber(defaultYear)
    setDepartment("none")
    setPresenterId("none")
    setNotes("")
    setFile(null)
    setEditingId(null)
    setUploadPhase("idle")
  }

  const openEdit = (row: KssRosterEntry) => {
    setShowCreate(true)
    setEditingId(row.id)
    setWeekNumber(row.meeting_week)
    setYearNumber(row.meeting_year)
    setDepartment(row.department)
    setPresenterId(row.presenter_id || "none")
    setNotes(row.notes || "")
    setFile(null)
  }

  const handleSave = async () => {
    if (readOnly) {
      toast.error("You can only add or edit from Admin Reports.")
      return
    }
    if (file && file.size > REPORT_DOC_MAX_SIZE_BYTES) {
      toast.error(`File exceeds max size of ${formatLimitMb(REPORT_DOC_MAX_SIZE_BYTES)}`)
      return
    }
    if (department === "none") {
      toast.error("Please select department")
      return
    }
    if (presenterId === "none") {
      toast.error("Please select presenter")
      return
    }

    setSaving(true)
    setUploadPhase("saving")
    try {
      const rosterRes = await fetch("/api/reports/kss-roster", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId
            ? {
                id: editingId,
                department,
                presenterId,
                notes: notes || null,
              }
            : {
                meetingWeek: weekNumber,
                meetingYear: yearNumber,
                department,
                presenterId,
                notes: notes || null,
              }
        ),
      })
      const rosterPayload = await rosterRes.json()
      if (!rosterRes.ok) throw new Error(rosterPayload.error || "Failed to save roster")

      if (file) {
        const requiresConversion = [DOCX_MIME, PPTX_MIME].includes(file.type)
        const fd = new FormData()
        fd.append("file", file)
        fd.append("meetingWeek", String(editingId ? rosterPayload.data.meeting_week : weekNumber))
        fd.append("meetingYear", String(editingId ? rosterPayload.data.meeting_year : yearNumber))
        fd.append("documentType", "knowledge_sharing_session")
        fd.append("department", department)
        fd.append("presenterId", presenterId)
        if (notes.trim()) fd.append("notes", notes.trim())

        if (requiresConversion) {
          setUploadPhase("converting")
        } else {
          setUploadPhase("uploading")
        }

        let phaseTimer: ReturnType<typeof setTimeout> | null = null
        if (requiresConversion) {
          phaseTimer = setTimeout(() => {
            setUploadPhase("uploading")
          }, 1200)
        }

        const uploadRes = await fetch("/api/reports/meeting-week-documents", {
          method: "POST",
          body: fd,
        })
        if (phaseTimer) clearTimeout(phaseTimer)
        setUploadPhase("uploading")
        const uploadPayload = await uploadRes.json()
        if (!uploadRes.ok) throw new Error(uploadPayload.error || "Failed to upload KSS file")
        if (uploadPayload?.converted) {
          toast.success("KSS file uploaded and converted to PDF")
        }
      }

      if (!file || !["docx", "pptx"].includes(getFileExtension(file.name, file.type))) {
        toast.success(editingId ? "KSS updated" : "KSS created")
      }
      resetForm()
      setShowCreate(false)
      await Promise.all([refetchRoster(), refetchDocs()])
    } catch (error: any) {
      toast.error(error?.message || "Failed to save KSS")
    } finally {
      setSaving(false)
      setUploadPhase("idle")
    }
  }

  const handleDelete = async (row: KssRosterEntry) => {
    if (readOnly) {
      toast.error("You can only delete from Admin Reports.")
      return
    }
    try {
      const doc = docByWeekYear.get(`${row.meeting_year}-${row.meeting_week}`)
      if (doc) {
        const docRes = await fetch(`/api/reports/meeting-week-documents?id=${doc.id}`, { method: "DELETE" })
        const docPayload = await docRes.json()
        if (!docRes.ok) throw new Error(docPayload.error || "Failed to delete KSS file")
      }

      const res = await fetch(`/api/reports/kss-roster?id=${row.id}`, { method: "DELETE" })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to delete KSS roster")
      toast.success("KSS deleted")
      setPendingDeleteRow(null)
      await Promise.all([refetchRoster(), refetchDocs()])
    } catch (error: any) {
      toast.error(error?.message || "Delete failed")
    }
  }

  const buildDownloadName = (doc: KssDocument, row: KssRosterEntry, presenterName: string): string => {
    const department = sanitizeForFileName(row.department)
    const presenter = sanitizeForFileName(presenterName === "-" ? "Unknown" : presenterName)
    const ext = getFileExtension(doc.file_name, doc.mime_type)
    return `KSS_${department}_${presenter}_Week_${row.meeting_week}_${row.meeting_year}.${ext}`
  }

  const handleDownload = async (doc: KssDocument, row: KssRosterEntry, presenterName: string) => {
    if (!doc.signed_url) return
    setDownloadingId(doc.id)
    try {
      const response = await fetch(doc.signed_url)
      if (!response.ok) throw new Error("Failed to download document")
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = objectUrl
      anchor.download = buildDownloadName(doc, row, presenterName)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (error: any) {
      toast.error(error?.message || "Failed to download file")
    } finally {
      setDownloadingId((current) => (current === doc.id ? null : current))
    }
  }

  const saveLabel =
    uploadPhase === "converting"
      ? "Converting..."
      : uploadPhase === "uploading"
        ? "Uploading..."
        : uploadPhase === "saving"
          ? "Saving..."
          : editingId
            ? "Save Changes"
            : "Add KSS"

  return (
    <TablePage
      title={title}
      description="Manage KSS roster and uploaded files by week."
      icon={Presentation}
      backLinkHref={backHref}
      backLinkLabel={backLabel}
      actions={
        readOnly ? null : (
          <Button
            onClick={() => {
              setEditingId(null)
              resetForm()
              setShowCreate(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add KSS
          </Button>
        )
      }
      filters={
        <div className="space-y-4">
          <div className="relative w-full">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search by department, presenter, week, or year..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Week</Label>
              <Select value={weekFilter} onValueChange={setWeekFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All weeks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All weeks</SelectItem>
                  {weekOptions.map((w) => (
                    <SelectItem key={w} value={String(w)}>
                      Week {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All years</SelectItem>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-2 md:col-span-1 lg:col-span-2">
              <Label>Time Type</Label>
              <SearchableMultiSelect
                label="Time Type"
                values={timeTypeFilter}
                options={[
                  { value: "current", label: "Current" },
                  { value: "past", label: "Past" },
                  { value: "upcoming", label: "Upcoming" },
                ]}
                onChange={setTimeTypeFilter}
                placeholder="Time Type"
                searchPlaceholder="Search time type..."
              />
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <AlertDialog open={pendingDeleteRow !== null} onOpenChange={(open) => !open && setPendingDeleteRow(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete KSS entry?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDeleteRow
                  ? `This will delete the KSS entry for Week ${pendingDeleteRow.meeting_week}, ${pendingDeleteRow.meeting_year} and its linked document (if uploaded). This action cannot be undone.`
                  : "This action cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingDeleteRow) handleDelete(pendingDeleteRow)
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog
          open={Boolean(previewDoc)}
          onOpenChange={(open) => {
            if (!open) setPreviewDoc(null)
          }}
        >
          <DialogContent className="max-h-[90vh] w-[95vw] max-w-5xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>KSS Document Preview</DialogTitle>
              <DialogDescription>
                {previewDoc
                  ? `Week ${previewDoc.row.meeting_week}, ${previewDoc.row.meeting_year} • ${previewDoc.row.department} • ${previewDoc.presenterName}`
                  : "Preview uploaded KSS file"}
              </DialogDescription>
            </DialogHeader>
            {previewDoc?.doc.signed_url ? (
              <>
                {getFileExtension(previewDoc.doc.file_name, previewDoc.doc.mime_type) === "pdf" ? (
                  previewDoc ? (
                    <iframe
                      src={`/api/reports/meeting-week-documents?id=${previewDoc.doc.id}&mode=preview`}
                      title="KSS document preview"
                      className="h-[65vh] w-full rounded-md border"
                    />
                  ) : (
                    <div className="text-muted-foreground rounded-md border p-4 text-sm">
                      Preview could not be loaded here. Use Open or Download.
                    </div>
                  )
                ) : (
                  <div className="text-muted-foreground rounded-md border p-4 text-sm">
                    Preview is not supported for this file type. Use Open or Download.
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" asChild>
                    <a href={previewDoc.doc.signed_url} target="_blank" rel="noreferrer">
                      Open in New Tab
                    </a>
                  </Button>
                  <Button onClick={() => handleDownload(previewDoc.doc, previewDoc.row, previewDoc.presenterName)}>
                    Download
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground rounded-md border p-4 text-sm">Document URL unavailable.</div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={showCreate}
          onOpenChange={(open) => {
            setShowCreate(open)
            if (!open) resetForm()
          }}
        >
          <DialogContent className="max-h-[90vh] w-[95vw] max-w-xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit KSS" : "Add KSS"}</DialogTitle>
              <DialogDescription>
                Create upcoming KSS rows to auto-populate meeting reminder mail. Upload file now or later.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Week</Label>
                <Select
                  value={String(weekNumber)}
                  onValueChange={(v) => setWeekNumber(Number(v))}
                  disabled={Boolean(editingId)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {weekOptions.map((w) => (
                      <SelectItem key={w} value={String(w)}>
                        Week {w}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Year</Label>
                <Select
                  value={String(yearNumber)}
                  onValueChange={(v) => setYearNumber(Number(v))}
                  disabled={Boolean(editingId)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select department</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Presenter</Label>
                <Select value={presenterId} onValueChange={setPresenterId} disabled={department === "none"}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select presenter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select presenter</SelectItem>
                    {presenterOptions.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
              </div>

              <div className="space-y-2">
                <Label>Upload PDF, PPTX, or DOCX</Label>
                <Input
                  type="file"
                  accept=".pdf,.pptx,.docx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => {
                    const selected = e.target.files?.[0] || null
                    if (selected && selected.size > REPORT_DOC_MAX_SIZE_BYTES) {
                      toast.error(`File exceeds max size of ${formatLimitMb(REPORT_DOC_MAX_SIZE_BYTES)}`)
                      e.currentTarget.value = ""
                      setFile(null)
                      return
                    }
                    if (selected?.type === PPTX_MIME || selected?.type === DOCX_MIME) {
                      toast.info("This file will be converted to PDF before it is stored.")
                    }
                    setFile(selected)
                  }}
                />
                <p className="text-muted-foreground text-xs">
                  Accepted: PDF, PPTX, DOCX. PPTX and DOCX uploads are converted to PDF before storage. Max file size:{" "}
                  {formatLimitMb(REPORT_DOC_MAX_SIZE_BYTES)}
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {saveLabel}
                  </>
                ) : (
                  saveLabel
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  resetForm()
                  setShowCreate(false)
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              {readOnly ? (
                <Button variant="secondary" asChild>
                  <Link href="/admin/reports/kss">Open Admin KSS</Link>
                </Button>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>S/N</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Presenter</TableHead>
                  <TableHead>Week</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Submitted Date</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isRosterLoading || isDocsLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="p-4">
                      <TableSkeleton rows={4} cols={7} />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, index) => {
                    const doc = docByWeekYear.get(`${row.meeting_year}-${row.meeting_week}`)
                    const presenterName = row.presenter_id ? employeeNameById.get(row.presenter_id) || "Unknown" : "-"
                    const submittedBy = row.created_by ? employeeNameById.get(row.created_by) || "Unknown" : "-"
                    const submittedDate = row.created_at
                      ? new Date(row.created_at).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"

                    return (
                      <TableRow key={row.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{row.department}</TableCell>
                        <TableCell>{presenterName}</TableCell>
                        <TableCell className="font-medium">{`W${row.meeting_week}, ${row.meeting_year}`}</TableCell>
                        <TableCell>{submittedBy}</TableCell>
                        <TableCell>{submittedDate}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {!readOnly ? (
                              <Button variant="ghost" size="icon" onClick={() => openEdit(row)} title="Edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            ) : null}
                            {!readOnly ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setPendingDeleteRow(row)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            ) : null}
                            {doc?.signed_url ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="View"
                                onClick={() => setPreviewDoc({ doc, row, presenterName })}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="icon" disabled title="View">
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {doc?.signed_url ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Download"
                                onClick={() => handleDownload(doc, row, presenterName)}
                                disabled={downloadingId === doc.id}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="icon" disabled title="Download">
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}

                {!isRosterLoading && !isDocsLoading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                      No rows found for current filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </TablePage>
  )
}
