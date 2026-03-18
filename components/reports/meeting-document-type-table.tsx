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
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { REPORT_DOC_MAX_SIZE_BYTES, formatLimitMb } from "@/lib/reports/document-upload-limits"
import { Download, Eye, FileText, Loader2, Plus, Search, Trash2 } from "lucide-react"

type DocumentType = "minutes" | "action_points"

type MeetingDocument = {
  id: string
  meeting_week: number
  meeting_year: number
  document_type: DocumentType
  file_name: string
  signed_url: string | null
  created_at: string
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

function getAdminReportsHref(documentType: DocumentType): string {
  if (documentType === "minutes") return "/admin/reports/minutes-of-meeting"
  return "/admin/reports/action-points-manual"
}

function compareWeekYear(aWeek: number, aYear: number, bWeek: number, bYear: number): number {
  if (aYear !== bYear) return aYear - bYear
  return aWeek - bWeek
}

export function MeetingDocumentTypeTable({
  documentType,
  title,
  description,
  backHref,
  backLabel,
  readOnly = false,
}: Props) {
  const officeWeek = getCurrentOfficeWeek()
  const [showCreate, setShowCreate] = useState(false)
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
      setFile(null)
      await refetch()
    } catch (error: any) {
      toast.error(error?.message || "Upload failed")
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
    try {
      const res = await fetch(`/api/reports/meeting-week-documents?id=${id}`, { method: "DELETE" })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Delete failed")
      toast.success("Document deleted")
      setPendingDeleteDoc(null)
      await refetch()
    } catch (error: any) {
      toast.error(error?.message || "Delete failed")
    }
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
          <Button onClick={() => setShowCreate(true)}>
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
            setWeekNumber(officeWeek.week)
            setYearNumber(officeWeek.year)
            setFile(null)
            setUploadPhase("idle")
          }
        }}
      >
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Upload a PDF or DOCX. DOCX files are converted to PDF before storage.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Week</Label>
              <Select value={String(weekNumber)} onValueChange={(v) => setWeekNumber(Number(v))}>
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
              <Select value={String(yearNumber)} onValueChange={(v) => setYearNumber(Number(v))}>
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
              />
              <p className="text-muted-foreground text-xs">
                Accepted: PDF, DOCX. DOCX uploads are converted to PDF before storage. Max file size:{" "}
                {formatLimitMb(REPORT_DOC_MAX_SIZE_BYTES)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={upload} disabled={saving}>
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
                <Link href={getAdminReportsHref(documentType)}>Open Admin Reports</Link>
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
                <TableHead>Week</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Submitted Date</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-4">
                    <TableSkeleton rows={4} cols={5} />
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => {
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
                      <TableCell>{row.meeting_week}</TableCell>
                      <TableCell>{row.meeting_year}</TableCell>
                      <TableCell>{submittedDate}</TableCell>
                      <TableCell>{row.file_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {row.signed_url ? (
                            <Button variant="ghost" size="icon" asChild title="View">
                              <a href={row.signed_url} target="_blank" rel="noreferrer">
                                <Eye className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" disabled title="View">
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {row.signed_url ? (
                            <Button variant="ghost" size="icon" asChild title="Download">
                              <a href={row.signed_url} download={row.file_name}>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" disabled title="Download">
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          {!readOnly ? (
                            <Button variant="ghost" size="icon" onClick={() => setPendingDeleteDoc(row)} title="Delete">
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}

              {!isLoading && filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
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
