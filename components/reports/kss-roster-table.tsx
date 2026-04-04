"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { TablePage } from "@/components/admin/admin-table-page"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { createClient } from "@/lib/supabase/client"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { isAssignableEmploymentStatus } from "@/lib/workforce/assignment-policy"
import { REPORT_DOC_MAX_SIZE_BYTES, formatLimitMb } from "@/lib/reports/document-upload-limits"
import { buildMeetingDocumentFileName } from "@/lib/reports/meeting-date"
import { Download, Loader2, Pencil, Plus, Presentation, Search, Trash2 } from "lucide-react"

type Employee = {
  id: string
  full_name: string
  department: string | null
  employment_status?: string | null
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
  meeting_date?: string | null
  is_locked?: boolean
}

type KssDocument = {
  id: string
  meeting_week: number
  meeting_year: number
  meeting_date?: string | null
  document_type: "knowledge_sharing_session"
  department: string | null
  presenter_id: string | null
  file_name: string
  mime_type?: string | null
  signed_url: string | null
  is_locked?: boolean
}

type KssResult = {
  id: string
  roster_id: string
  presenter_id: string
  evaluator_id: string
  score: number
  feedback: string | null
  meeting_week: number
  meeting_year: number
  created_at: string
  updated_at: string
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
  currentUserId?: string
  enableScoring?: boolean
}

function compareWeekYear(aWeek: number, aYear: number, bWeek: number, bYear: number): number {
  if (aYear !== bYear) return aYear - bYear
  return aWeek - bWeek
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

function formatMeetingDate(value?: string | null): string {
  if (!value) return "-"
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function KssRosterTable({
  employees,
  backHref,
  backLabel,
  title = "Knowledge Sharing Session",
  readOnly = false,
  currentUserId,
  enableScoring = false,
}: Props) {
  const supabase = createClient()
  const currentOfficeWeek = getCurrentOfficeWeek()
  const defaultWeek = currentOfficeWeek.week
  const defaultYear = currentOfficeWeek.year

  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDeleteRow, setPendingDeleteRow] = useState<KssRosterEntry | null>(null)
  const [scoringRow, setScoringRow] = useState<KssRosterEntry | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const [weekNumber, setWeekNumber] = useState(defaultWeek)
  const [yearNumber, setYearNumber] = useState(defaultYear)
  const [department, setDepartment] = useState("none")
  const [presenterId, setPresenterId] = useState("none")
  const [notes, setNotes] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingScore, setSavingScore] = useState(false)
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle")
  const [scoreValue, setScoreValue] = useState("")
  const [scoreFeedback, setScoreFeedback] = useState("")

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

  const { data: kssResults = [], refetch: refetchKssResults } = useQuery({
    queryKey: ["kss-results-table"],
    enabled: enableScoring && Boolean(currentUserId),
    queryFn: async (): Promise<KssResult[]> => {
      const res = await fetch("/api/reports/kss-results")
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to fetch KSS scores")
      return payload.data || []
    },
  })

  const { data: selectedWeekLockState } = useQuery({
    queryKey: ["kss-selected-week-lock", weekNumber, yearNumber],
    enabled: !readOnly,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("weekly_report_lock_state", {
        p_week: weekNumber,
        p_year: yearNumber,
      })
      if (error) throw new Error(error.message)
      return Array.isArray(data) && data[0] ? Boolean(data[0].is_locked) : false
    },
  })

  const isSelectedWeekLocked = Boolean(selectedWeekLockState)
  const isHistoricalSelection =
    compareWeekYear(weekNumber, yearNumber, currentOfficeWeek.week, currentOfficeWeek.year) < 0
  const allowInactivePresentersForSelection = isHistoricalSelection || isSelectedWeekLocked
  const presenterOptions = useMemo(() => {
    if (department === "none") return []
    return employees
      .filter((e) => e.department === department)
      .filter(
        (e) =>
          allowInactivePresentersForSelection ||
          isAssignableEmploymentStatus(e.employment_status, { allowLegacyNullStatus: false })
      )
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [allowInactivePresentersForSelection, department, employees])

  const selectedWeekExistingRow = useMemo(
    () => roster.find((row) => row.meeting_week === weekNumber && row.meeting_year === yearNumber) || null,
    [roster, weekNumber, yearNumber]
  )

  const docByWeekYear = useMemo(() => {
    const map = new Map<string, KssDocument>()
    docs.forEach((d) => map.set(`${d.meeting_year}-${d.meeting_week}`, d))
    return map
  }, [docs])
  const selectedWeekDoc = docByWeekYear.get(`${yearNumber}-${weekNumber}`) || null
  const canUploadMissingForLockedWeek =
    isSelectedWeekLocked && Boolean(selectedWeekExistingRow) && !selectedWeekDoc && !readOnly
  const isFormLocked = Boolean(editingId)
    ? isSelectedWeekLocked && Boolean(selectedWeekDoc)
    : isSelectedWeekLocked && Boolean(selectedWeekExistingRow) && Boolean(selectedWeekDoc)

  useEffect(() => {
    if (!canUploadMissingForLockedWeek || !selectedWeekExistingRow || editingId) return
    setDepartment(selectedWeekExistingRow.department || "none")
    setPresenterId(selectedWeekExistingRow.presenter_id || "none")
    setNotes(selectedWeekExistingRow.notes || "")
  }, [canUploadMissingForLockedWeek, selectedWeekExistingRow, editingId])

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

  const myScoresByRosterId = useMemo(() => {
    const map = new Map<string, KssResult>()
    if (!currentUserId) return map
    kssResults
      .filter((result) => result.evaluator_id === currentUserId)
      .forEach((result) => map.set(result.roster_id, result))
    return map
  }, [currentUserId, kssResults])

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

  const resetScoreForm = () => {
    setScoringRow(null)
    setScoreValue("")
    setScoreFeedback("")
  }

  const openScoreDialog = (row: KssRosterEntry) => {
    const existingScore = myScoresByRosterId.get(row.id)
    setScoringRow(row)
    setScoreValue(existingScore ? String(existingScore.score) : "")
    setScoreFeedback(existingScore?.feedback || "")
  }

  const openEdit = (row: KssRosterEntry) => {
    const doc = docByWeekYear.get(`${row.meeting_year}-${row.meeting_week}`)
    if (row.is_locked && doc) {
      toast.error(`Week ${row.meeting_week}, ${row.meeting_year} is locked and can no longer be edited`)
      return
    }
    if (row.is_locked && !doc) {
      toast.info("This week is locked. You can only upload the missing KSS file.")
    }
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
    if (isFormLocked) {
      toast.error(`Week ${weekNumber}, ${yearNumber} is locked and can no longer be changed`)
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
      let savedRoster: {
        meeting_week: number
        meeting_year: number
        department?: string | null
        presenter_id?: string | null
      } | null = null

      const skipRosterWrite =
        isSelectedWeekLocked && !selectedWeekDoc && (Boolean(editingId) || canUploadMissingForLockedWeek)

      if (skipRosterWrite) {
        if (!selectedWeekExistingRow) {
          throw new Error("Unable to resolve existing roster row for locked week")
        }
        savedRoster = selectedWeekExistingRow
      } else {
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
        savedRoster = rosterPayload.data
      }

      if (file) {
        const requiresConversion = [DOCX_MIME, PPTX_MIME].includes(file.type)
        const fd = new FormData()
        fd.append("file", file)
        fd.append("meetingWeek", String(savedRoster?.meeting_week || weekNumber))
        fd.append("meetingYear", String(savedRoster?.meeting_year || yearNumber))
        fd.append("documentType", "knowledge_sharing_session")
        fd.append("department", String(savedRoster?.department || department))
        fd.append("presenterId", String(savedRoster?.presenter_id || presenterId))
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
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save KSS")
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
    if (row.is_locked) {
      toast.error(`Week ${row.meeting_week}, ${row.meeting_year} is locked and can no longer be changed`)
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
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Delete failed")
    }
  }

  const handleSaveScore = async () => {
    if (!scoringRow) return

    const numericScore = Number(scoreValue)
    if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100) {
      toast.error("Score must be a number between 0 and 100")
      return
    }

    setSavingScore(true)
    try {
      const res = await fetch("/api/reports/kss-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roster_id: scoringRow.id,
          score: numericScore,
          feedback: scoreFeedback.trim() || null,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to save KSS score")

      toast.success("KSS score submitted")
      resetScoreForm()
      await refetchKssResults()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save KSS score")
    } finally {
      setSavingScore(false)
    }
  }

  const buildDownloadName = (doc: KssDocument, row: KssRosterEntry, presenterName: string): string => {
    const ext = getFileExtension(doc.file_name, doc.mime_type)
    return buildMeetingDocumentFileName({
      documentType: "knowledge_sharing_session",
      meetingDate: doc.meeting_date || `${row.meeting_year}-01-01`,
      meetingWeek: row.meeting_week,
      extension: ext,
      department: row.department,
      presenterName: presenterName === "-" ? "Unknown Presenter" : presenterName,
    })
  }

  const handleDownload = async (doc: KssDocument, row: KssRosterEntry, presenterName: string) => {
    if (!doc.signed_url) return
    setDownloadingId(doc.id)
    const toastId = toast.loading("Preparing download...")
    try {
      const anchor = document.createElement("a")
      anchor.href = doc.signed_url
      anchor.download = buildDownloadName(doc, row, presenterName)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => {
        toast.dismiss(toastId)
      }, 6000)
    } catch (error: unknown) {
      toast.dismiss(toastId)
      toast.error(error instanceof Error ? error.message : "Failed to download file")
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
            disabled={false}
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
                  disabled={Boolean(editingId) || isFormLocked}
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
                  disabled={Boolean(editingId) || isFormLocked}
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
                <Select
                  value={department}
                  onValueChange={setDepartment}
                  disabled={isFormLocked || canUploadMissingForLockedWeek}
                >
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
                <Select
                  value={presenterId}
                  onValueChange={setPresenterId}
                  disabled={isFormLocked || canUploadMissingForLockedWeek || department === "none"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select presenter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select presenter</SelectItem>
                    {presenterOptions.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name}
                        {!isAssignableEmploymentStatus(emp.employment_status, { allowLegacyNullStatus: false })
                          ? " (separated)"
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                  disabled={isFormLocked || canUploadMissingForLockedWeek}
                />
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
                  disabled={isFormLocked}
                />
                <p className="text-muted-foreground text-xs">
                  Accepted: PDF, PPTX, DOCX. PPTX and DOCX uploads are converted to PDF before storage. Max file size:{" "}
                  {formatLimitMb(REPORT_DOC_MAX_SIZE_BYTES)}
                </p>
                {isFormLocked ? (
                  <p className="text-muted-foreground text-xs">
                    This week is locked after the meeting grace window, so past KSS records are read-only.
                  </p>
                ) : null}
                {canUploadMissingForLockedWeek ? (
                  <p className="text-muted-foreground text-xs">
                    This week is locked. You can only upload the missing KSS file for the existing roster entry.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button onClick={handleSave} disabled={saving || isFormLocked}>
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
                  <Link href="/admin/reports/general-meeting/kss">Open Admin KSS</Link>
                </Button>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={scoringRow !== null}
          onOpenChange={(open) => {
            if (!open) resetScoreForm()
          }}
        >
          <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Score Presenter</DialogTitle>
              <DialogDescription>
                Submit your KSS evaluation for{" "}
                {scoringRow?.presenter_id
                  ? employeeNameById.get(scoringRow.presenter_id) || "this presenter"
                  : "this presenter"}
                .
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Week</Label>
                  <Input
                    value={scoringRow ? `Week ${scoringRow.meeting_week}, ${scoringRow.meeting_year}` : ""}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input value={scoringRow?.department || ""} disabled />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="kss-score">Score (0 - 100)</Label>
                <Input
                  id="kss-score"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={scoreValue}
                  onChange={(e) => setScoreValue(e.target.value)}
                  placeholder="Enter score"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="kss-feedback">Feedback</Label>
                <Textarea
                  id="kss-feedback"
                  value={scoreFeedback}
                  onChange={(e) => setScoreFeedback(e.target.value)}
                  placeholder="Optional feedback for the presenter"
                  maxLength={5000}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveScore} disabled={savingScore}>
                  {savingScore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Submit Score"
                  )}
                </Button>
                <Button variant="outline" onClick={resetScoreForm} disabled={savingScore}>
                  Cancel
                </Button>
              </div>
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
                  <TableHead>Meeting Date</TableHead>
                  <TableHead>Week</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Submitted Date</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isRosterLoading || isDocsLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="p-4">
                      <TableSkeleton rows={4} cols={8} />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, index) => {
                    const doc = docByWeekYear.get(`${row.meeting_year}-${row.meeting_week}`)
                    const presenterName = row.presenter_id ? employeeNameById.get(row.presenter_id) || "Unknown" : "-"
                    const isActionLocked = Boolean(row.is_locked)
                    const canUploadMissing = isActionLocked && !doc
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
                        <TableCell>{formatMeetingDate(row.meeting_date || doc?.meeting_date)}</TableCell>
                        <TableCell className="font-medium">{`W${row.meeting_week}`}</TableCell>
                        <TableCell>{submittedBy}</TableCell>
                        <TableCell>{submittedDate}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {enableScoring &&
                            currentUserId &&
                            row.presenter_id &&
                            row.presenter_id !== currentUserId ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openScoreDialog(row)}
                                  title="Score presenter"
                                  className="h-8 px-2"
                                >
                                  {myScoresByRosterId.has(row.id) ? "Update score" : "Score"}
                                </Button>
                                {myScoresByRosterId.has(row.id) ? (
                                  <Badge variant="outline">{`My score: ${myScoresByRosterId.get(row.id)?.score ?? 0}`}</Badge>
                                ) : null}
                              </>
                            ) : null}
                            {!readOnly && (!isActionLocked || canUploadMissing) ? (
                              <Button variant="ghost" size="icon" onClick={() => openEdit(row)} title="Edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            ) : null}
                            {!readOnly && !isActionLocked ? (
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
                    <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
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
