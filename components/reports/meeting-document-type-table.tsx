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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TableSkeleton } from "@/components/ui/query-states"
import { createClient } from "@/lib/supabase/client"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { buildMeetingDocumentFileName } from "@/lib/reports/meeting-date"
import { REPORT_DOC_MAX_SIZE_BYTES, formatLimitMb } from "@/lib/reports/document-upload-limits"
import { Download, FileText, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react"

type DocumentType = "minutes"

type MeetingDocument = {
  id: string
  meeting_week: number
  meeting_year: number
  meeting_date?: string | null
  document_type: DocumentType
  file_name: string
  signed_url: string | null
  created_at: string
  uploaded_by?: string | null
  is_locked?: boolean
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
type UploadPhase = "idle" | "converting" | "uploading"

interface Props {
  documentType: DocumentType
  title: string
  description: string
  backHref: string
  backLabel: string
  readOnly?: boolean
}

function compareWeekYear(aWeek: number, aYear: number, bWeek: number, bYear: number): number {
  if (aYear !== bYear) return aYear - bYear
  return aWeek - bWeek
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

export function MeetingDocumentTypeTable({
  documentType,
  title,
  description,
  backHref,
  backLabel,
  readOnly = false,
}: Props) {
  const supabase = createClient()
  const officeWeek = getCurrentOfficeWeek()
  const [showCreate, setShowCreate] = useState(false)
  const [editingDoc, setEditingDoc] = useState<MeetingDocument | null>(null)
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState<MeetingDocument | null>(null)
  const [weekNumber, setWeekNumber] = useState(officeWeek.week)
  const [yearNumber, setYearNumber] = useState(officeWeek.year)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle")

  const [searchQuery, setSearchQuery] = useState("")
  const [weekFilter, setWeekFilter] = useState("all")
  const [yearFilter, setYearFilter] = useState("all")

  const weekOptions = Array.from({ length: 53 }, (_, i) => i + 1)
  const yearOptions = [officeWeek.year - 1, officeWeek.year, officeWeek.year + 1, officeWeek.year + 2]

  const {
    data: rows = [],
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ["meeting-doc-table", documentType],
    queryFn: async (): Promise<MeetingDocument[]> => {
      const res = await fetch(`/api/reports/meeting-week-documents?documentType=${documentType}&currentOnly=true`)
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to fetch documents")
      return payload.data || []
    },
  })

  const { data: selectedWeekLockState } = useQuery({
    queryKey: ["meeting-doc-selected-week-lock", documentType, weekNumber, yearNumber],
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

  const uploadedByIds = useMemo(
    () => Array.from(new Set(rows.map((row) => row.uploaded_by).filter((value): value is string => Boolean(value)))),
    [rows]
  )

  const { data: uploadedByNameMap = new Map<string, string>() } = useQuery({
    queryKey: ["meeting-doc-uploaded-by", uploadedByIds],
    enabled: uploadedByIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", uploadedByIds)
      if (error) throw new Error(error.message)
      return new Map((data || []).map((row) => [String(row.id), String(row.full_name || "Unknown")]))
    },
  })

  const isSelectedWeekLocked = Boolean(selectedWeekLockState)
  const selectedWeekExistingRow = useMemo(
    () => rows.find((row) => row.meeting_week === weekNumber && row.meeting_year === yearNumber) || null,
    [rows, weekNumber, yearNumber]
  )
  const isCreateBlockedForSelectedWeek = !editingDoc && isSelectedWeekLocked && Boolean(selectedWeekExistingRow)

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return rows
      .filter((row) => {
        // no upcoming rows
        if (compareWeekYear(row.meeting_week, row.meeting_year, officeWeek.week, officeWeek.year) > 0) return false
        if (weekFilter !== "all" && row.meeting_week !== Number(weekFilter)) return false
        if (yearFilter !== "all" && row.meeting_year !== Number(yearFilter)) return false
        if (!q) return true
        return (
          row.file_name.toLowerCase().includes(q) ||
          String(row.meeting_week).includes(q) ||
          String(row.meeting_year).includes(q)
        )
      })
      .sort((a, b) => {
        if (a.meeting_year !== b.meeting_year) return b.meeting_year - a.meeting_year
        return b.meeting_week - a.meeting_week
      })
  }, [rows, searchQuery, weekFilter, yearFilter, officeWeek.week, officeWeek.year])

  const upload = async () => {
    if (readOnly) {
      toast.error("You can only upload from Admin Reports.")
      return
    }
    if (!file) {
      toast.error("Please select a PDF or DOCX file")
      return
    }
    if (file.size > REPORT_DOC_MAX_SIZE_BYTES) {
      toast.error(`File exceeds max size of ${formatLimitMb(REPORT_DOC_MAX_SIZE_BYTES)}`)
      return
    }
    if (editingDoc ? isSelectedWeekLocked : isCreateBlockedForSelectedWeek) {
      toast.error(`Week ${weekNumber}, ${yearNumber} is locked and can no longer be changed`)
      return
    }

    setSaving(true)
    try {
      const requiresConversion = file.type === DOCX_MIME
      const fd = new FormData()
      fd.append("file", file)
      fd.append("meetingWeek", String(weekNumber))
      fd.append("meetingYear", String(yearNumber))
      fd.append("documentType", documentType)

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

      const res = await fetch("/api/reports/meeting-week-documents", { method: "POST", body: fd })
      if (phaseTimer) clearTimeout(phaseTimer)
      setUploadPhase("uploading")
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Upload failed")

      toast.success(payload?.converted ? "Document uploaded and converted to PDF" : "Document uploaded")
      setShowCreate(false)
      setEditingDoc(null)
      setFile(null)
      await refetch()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setSaving(false)
      setUploadPhase("idle")
    }
  }

  const uploadLabel =
    uploadPhase === "converting" ? "Converting..." : uploadPhase === "uploading" ? "Uploading..." : "Upload"

  const remove = async (id: string) => {
    if (readOnly) {
      toast.error("You can only delete from Admin Reports.")
      return
    }
    const target = rows.find((row) => row.id === id)
    const isPastRow = target
      ? compareWeekYear(target.meeting_week, target.meeting_year, officeWeek.week, officeWeek.year) < 0
      : false
    if (target?.is_locked || isPastRow) {
      toast.error(
        `Week ${target?.meeting_week ?? weekNumber}, ${target?.meeting_year ?? yearNumber} is locked and can no longer be changed`
      )
      return
    }
    try {
      const res = await fetch(`/api/reports/meeting-week-documents?id=${id}`, { method: "DELETE" })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Delete failed")
      toast.success("Document deleted")
      setPendingDeleteDoc(null)
      await refetch()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Delete failed")
    }
  }

  const handleDownload = async (row: MeetingDocument) => {
    if (!row.signed_url) return
    const toastId = toast.loading("Preparing download...")
    try {
      const anchor = document.createElement("a")
      anchor.href = row.signed_url
      anchor.download = buildMeetingDocumentFileName({
        documentType: row.document_type,
        meetingDate: row.meeting_date || `${row.meeting_year}-01-01`,
        meetingWeek: row.meeting_week,
        extension: "pdf",
      })
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => {
        toast.dismiss(toastId)
      }, 6000)
    } catch (error: unknown) {
      toast.dismiss(toastId)
      toast.error(error instanceof Error ? error.message : "Download failed")
    }
  }

  const openEdit = (row: MeetingDocument) => {
    const isPastRow = compareWeekYear(row.meeting_week, row.meeting_year, officeWeek.week, officeWeek.year) < 0
    if (row.is_locked || isPastRow) {
      toast.error(`Week ${row.meeting_week}, ${row.meeting_year} is locked and can no longer be edited`)
      return
    }
    setEditingDoc(row)
    setWeekNumber(row.meeting_week)
    setYearNumber(row.meeting_year)
    setFile(null)
    setUploadPhase("idle")
    setShowCreate(true)
  }

  return (
    <TablePage
      title={title}
      description={description}
      icon={FileText}
      backLinkHref={backHref}
      backLinkLabel={backLabel}
      actions={
        readOnly ? null : (
          <Button
            onClick={() => {
              setEditingDoc(null)
              setWeekNumber(officeWeek.week)
              setYearNumber(officeWeek.year)
              setFile(null)
              setUploadPhase("idle")
              setShowCreate(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add
          </Button>
        )
      }
      filters={
        <div className="space-y-4">
          <div className="relative w-full">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search by file name, week, or year..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Week</Label>
              <Select value={weekFilter} onValueChange={setWeekFilter}>
                <SelectTrigger className="w-[140px]">
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
                <SelectTrigger className="w-[120px]">
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
          </div>
        </div>
      }
    >
      <AlertDialog open={pendingDeleteDoc !== null} onOpenChange={(open) => !open && setPendingDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteDoc
                ? `Delete ${pendingDeleteDoc.document_type.replace("_", " ")} for Week ${pendingDeleteDoc.meeting_week}, ${pendingDeleteDoc.meeting_year}. This action cannot be undone.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteDoc) remove(pendingDeleteDoc.id)
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
          if (!open) {
            setEditingDoc(null)
            setWeekNumber(officeWeek.week)
            setYearNumber(officeWeek.year)
            setFile(null)
            setUploadPhase("idle")
          }
        }}
      >
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDoc ? `Edit ${title}` : title}</DialogTitle>
            <DialogDescription>Upload a PDF or DOCX. DOCX files are converted to PDF before storage.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Week</Label>
              <Select
                value={String(weekNumber)}
                onValueChange={(v) => setWeekNumber(Number(v))}
                disabled={Boolean(editingDoc)}
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
                disabled={Boolean(editingDoc)}
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
            <div className="space-y-2 md:col-span-2">
              <Label>Upload PDF or DOCX</Label>
              <Input
                type="file"
                accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => {
                  const selected = e.target.files?.[0] || null
                  if (selected && selected.size > REPORT_DOC_MAX_SIZE_BYTES) {
                    toast.error(`File exceeds max size of ${formatLimitMb(REPORT_DOC_MAX_SIZE_BYTES)}`)
                    e.currentTarget.value = ""
                    setFile(null)
                    return
                  }
                  if (selected?.type === DOCX_MIME) {
                    toast.info("This DOCX file will be converted to PDF before it is stored.")
                  }
                  setFile(selected)
                }}
                disabled={editingDoc ? isSelectedWeekLocked : isCreateBlockedForSelectedWeek}
              />
              <p className="text-muted-foreground text-xs">
                Accepted: PDF, DOCX. DOCX uploads are converted to PDF before storage. Max file size:{" "}
                {formatLimitMb(REPORT_DOC_MAX_SIZE_BYTES)}
              </p>
              {editingDoc && isSelectedWeekLocked ? (
                <p className="text-muted-foreground text-xs">
                  This week is locked after the meeting grace window, so past records are read-only.
                </p>
              ) : null}
              {!editingDoc && isCreateBlockedForSelectedWeek ? (
                <p className="text-muted-foreground text-xs">
                  This week is locked and already has a document, so only download is allowed.
                </p>
              ) : null}
              {!editingDoc && isSelectedWeekLocked && !selectedWeekExistingRow ? (
                <p className="text-muted-foreground text-xs">
                  This week is locked, but first-time upload is still allowed because no document exists yet.
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              onClick={upload}
              disabled={saving || (editingDoc ? isSelectedWeekLocked : isCreateBlockedForSelectedWeek)}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploadLabel}
                </>
              ) : (
                uploadLabel
              )}
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={saving}>
              Cancel
            </Button>
            {readOnly ? (
              <Button variant="secondary" asChild>
                <Link href="/admin/reports/general-meeting/minutes-of-meeting">Open Admin Reports</Link>
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
                <TableHead>Meeting Date</TableHead>
                <TableHead>Week</TableHead>
                <TableHead>Submitted By</TableHead>
                <TableHead>Submitted Date</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-4">
                    <TableSkeleton rows={4} cols={6} />
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row, index) => {
                  const isPastRow =
                    compareWeekYear(row.meeting_week, row.meeting_year, officeWeek.week, officeWeek.year) < 0
                  const isActionLocked = isPastRow || Boolean(row.is_locked)
                  const submittedDate = row.created_at
                    ? new Date(row.created_at).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-"
                  const submittedBy =
                    row.uploaded_by && uploadedByNameMap.has(row.uploaded_by)
                      ? uploadedByNameMap.get(row.uploaded_by)
                      : "-"

                  return (
                    <TableRow key={row.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{formatMeetingDate(row.meeting_date)}</TableCell>
                      <TableCell className="font-medium">{`W${row.meeting_week}`}</TableCell>
                      <TableCell>{submittedBy}</TableCell>
                      <TableCell>{submittedDate}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {!readOnly && !isActionLocked ? (
                            <Button variant="ghost" size="icon" onClick={() => openEdit(row)} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {!readOnly && !isActionLocked ? (
                            <Button variant="ghost" size="icon" onClick={() => setPendingDeleteDoc(row)} title="Delete">
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          ) : null}
                          {row.signed_url ? (
                            <Button variant="ghost" size="icon" title="Download" onClick={() => handleDownload(row)}>
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

              {!isLoading && filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                    No documents found for current filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TablePage>
  )
}
