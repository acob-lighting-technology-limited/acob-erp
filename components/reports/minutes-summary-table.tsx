"use client"

import { useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertCircle, CalendarDays, Eye, FileText, Pencil, Plus, ScrollText, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter, DataTableTab } from "@/components/ui/data-table"
import { RichTextEditor, type RichTextEditorHandle } from "@/components/ui/rich-text-editor"
import { StaffNameWithAvatar } from "@/components/ui/staff-avatar"
import { useStaffAvatars } from "@/hooks/use-staff-avatars"
import { apiFetch } from "@/lib/api-client"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { QUERY_KEYS } from "@/lib/query-keys"
import { cleanSlideTextHtml, sanitizeSlideTextHtml } from "@/lib/rich-text"
import { SlideTextPreview } from "@/components/reports/slide-text-preview"
import { createClient } from "@/lib/supabase/client"
import { formatWATDate, formatWATTimeDate } from "@/lib/utils/date"
import { getDefaultMeetingDateIso } from "@/lib/weekly-report-lock"

export type MinutesSummary = {
  id: string
  meeting_week: number
  meeting_year: number
  content_html: string
  updated_by: string | null
  updated_at: string
}

interface Props {
  backHref: string
  backLabel: string
  readOnly?: boolean
  pageTabs?: { tabs: DataTableTab[]; activeTab: string; onTabChange: (tab: string) => void }
}

function formatMeetingMonday(week: number, year: number) {
  return formatWATDate(new Date(`${getDefaultMeetingDateIso(week, year)}T00:00:00`), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

/** Plain text of a summary, for search and the row preview. */
function summaryText(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Summary of minutes: a short rich-text summary per meeting week, shown in the
 * agenda deck in place of the full minutes. Not part of the meeting mail.
 */
export function MinutesSummaryTable({ backHref, backLabel, readOnly = false, pageTabs }: Props) {
  const supabase = createClient()
  const officeWeek = getCurrentOfficeWeek()
  const editorRef = useRef<RichTextEditorHandle | null>(null)
  const staffAvatars = useStaffAvatars()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<MinutesSummary | null>(null)
  const [viewing, setViewing] = useState<MinutesSummary | null>(null)
  const [pendingDelete, setPendingDelete] = useState<MinutesSummary | null>(null)
  const [weekNumber, setWeekNumber] = useState(officeWeek.week)
  const [yearNumber, setYearNumber] = useState(officeWeek.year)
  const [contentHtml, setContentHtml] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const weekOptions = useMemo(() => Array.from({ length: 53 }, (_, i) => i + 1), [])
  const yearOptions = useMemo(() => [officeWeek.year - 1, officeWeek.year, officeWeek.year + 1], [officeWeek.year])

  const {
    data: rows = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEYS.meetingMinutesSummaries(),
    queryFn: async (): Promise<MinutesSummary[]> => {
      const response = await apiFetch("/api/reports/meeting-minutes-summaries", { cache: "no-store" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Failed to load summaries")
      return payload?.data || []
    },
  })

  const editorIds = useMemo(
    () => Array.from(new Set(rows.map((row) => row.updated_by).filter((id): id is string => Boolean(id)))),
    [rows]
  )
  const { data: nameMap = new Map<string, string>() } = useQuery({
    queryKey: QUERY_KEYS.meetingDocUploadedBy(editorIds),
    enabled: editorIds.length > 0,
    queryFn: async () => {
      // staff_directory, not profiles: profiles RLS hides other people from a plain employee.
      const { data, error: namesError } = await supabase
        .from("staff_directory")
        .select("id, full_name")
        .in("id", editorIds)
      if (namesError) throw new Error(namesError.message)
      return new Map((data || []).map((row) => [String(row.id), String(row.full_name || "Unknown")]))
    },
  })

  const stats = useMemo(
    () => ({
      total: rows.length,
      thisYear: rows.filter((row) => row.meeting_year === officeWeek.year).length,
    }),
    [officeWeek.year, rows]
  )

  const openCreate = () => {
    setEditing(null)
    setWeekNumber(officeWeek.week)
    setYearNumber(officeWeek.year)
    setContentHtml("")
    setEditorOpen(true)
  }

  const openEdit = (row: MinutesSummary) => {
    setEditing(row)
    setWeekNumber(row.meeting_week)
    setYearNumber(row.meeting_year)
    setContentHtml(sanitizeSlideTextHtml(row.content_html))
    setEditorOpen(true)
  }

  const existingForSelectedWeek = rows.find(
    (row) => row.meeting_week === weekNumber && row.meeting_year === yearNumber && row.id !== editing?.id
  )

  const save = async () => {
    const cleaned = cleanSlideTextHtml(contentHtml)
    if (!summaryText(cleaned)) {
      toast.error("Paste or type the summary first")
      return
    }
    setSaving(true)
    try {
      const response = await apiFetch("/api/reports/meeting-minutes-summaries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingWeek: weekNumber, meetingYear: yearNumber, contentHtml: cleaned }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Failed to save the summary")
      toast.success("Summary saved")
      setEditorOpen(false)
      await refetch()
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Failed to save the summary")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (row: MinutesSummary) => {
    setDeleting(true)
    try {
      const response = await apiFetch(`/api/reports/meeting-minutes-summaries?id=${row.id}`, { method: "DELETE" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Failed to delete the summary")
      toast.success("Summary deleted")
      setPendingDelete(null)
      await refetch()
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Failed to delete the summary")
    } finally {
      setDeleting(false)
    }
  }

  const columns = useMemo<DataTableColumn<MinutesSummary>[]>(
    () => [
      {
        key: "meeting_date",
        label: "Meeting Date",
        sortable: true,
        accessor: (row) => getDefaultMeetingDateIso(row.meeting_week, row.meeting_year),
        render: (row) => formatMeetingMonday(row.meeting_week, row.meeting_year),
      },
      {
        key: "meeting_week",
        label: "Week",
        sortable: true,
        hideOnMobile: true,
        accessor: (row) => row.meeting_week,
        render: (row) => <span className="font-medium">{`W${row.meeting_week}`}</span>,
      },
      {
        key: "meeting_year",
        label: "Year",
        sortable: true,
        hideOnMobile: true,
        accessor: (row) => row.meeting_year,
      },
      {
        key: "preview",
        label: "Summary",
        accessor: (row) => summaryText(row.content_html),
        render: (row) => (
          <span className="text-muted-foreground line-clamp-1 max-w-md">{summaryText(row.content_html)}</span>
        ),
      },
      {
        key: "updated_by",
        label: "Updated By",
        hideOnMobile: true,
        accessor: (row) => (row.updated_by ? nameMap.get(row.updated_by) || "-" : "-"),
        render: (row) =>
          row.updated_by ? (
            <StaffNameWithAvatar
              name={nameMap.get(row.updated_by) || "Unknown"}
              profileId={row.updated_by}
              src={staffAvatars[row.updated_by]}
            />
          ) : (
            "-"
          ),
      },
      {
        key: "updated_at",
        label: "Updated",
        sortable: true,
        hideOnMobile: true,
        accessor: (row) => row.updated_at,
        render: (row) => formatWATTimeDate(row.updated_at),
      },
    ],
    [nameMap, staffAvatars]
  )

  const filters = useMemo<DataTableFilter<MinutesSummary>[]>(
    () => [
      {
        key: "meeting_week",
        label: "Week",
        options: weekOptions.map((w) => ({ value: String(w), label: `Week ${w}` })),
      },
      { key: "meeting_year", label: "Year", options: yearOptions.map((y) => ({ value: String(y), label: String(y) })) },
    ],
    [weekOptions, yearOptions]
  )

  const rowActions = useMemo(() => {
    const actions = [{ label: "View", icon: Eye, onClick: (row: MinutesSummary) => setViewing(row) }]
    if (!readOnly) {
      actions.push({ label: "Edit", icon: Pencil, onClick: (row: MinutesSummary) => openEdit(row) })
      actions.push({ label: "Delete", icon: Trash2, onClick: (row: MinutesSummary) => setPendingDelete(row) })
    }
    return actions
  }, [readOnly])

  return (
    <DataTablePage
      title="Minutes of Meeting"
      description="A short summary of each meeting's minutes. The agenda deck shows it instead of the full minutes."
      icon={ScrollText}
      backLink={{ href: backHref, label: backLabel }}
      {...pageTabs}
      spacing="tight"
      actionsPlacement="inline-always"
      actions={
        readOnly ? null : (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Summary</span>
          </Button>
        )
      }
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Summaries"
            value={stats.total}
            icon={FileText}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            variant="compact"
            title="This Year"
            value={stats.thisYear}
            icon={CalendarDays}
            iconBgColor="bg-amber-500/10"
            iconColor="text-amber-500"
          />
        </StatGrid>
      }
    >
      <Dialog open={editorOpen} onOpenChange={(open) => !saving && setEditorOpen(open)}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Summary of Minutes" : "Add Summary of Minutes"}</DialogTitle>
            <DialogDescription>
              Paste the summary from Word or type it. Headings, bullet and numbered lists, bold and italic are kept;
              other formatting is removed so the slides match what you see.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Week</Label>
              <Select
                value={String(weekNumber)}
                onValueChange={(value) => setWeekNumber(Number(value))}
                disabled={Boolean(editing)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weekOptions.map((week) => (
                    <SelectItem key={week} value={String(week)}>
                      {`Week ${week} · ${formatMeetingMonday(week, yearNumber)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Select
                value={String(yearNumber)}
                onValueChange={(value) => setYearNumber(Number(value))}
                disabled={Boolean(editing)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {existingForSelectedWeek ? (
            <p className="text-warning text-sm">
              Week {weekNumber}, {yearNumber} already has a summary. Saving replaces it.
            </p>
          ) : null}
          <RichTextEditor
            ref={editorRef}
            value={contentHtml}
            onChange={setContentHtml}
            pasteMode="slide-text"
            underline={false}
            headings
            placeholder="Paste or type the summary of the minutes..."
            aria-label="Summary of minutes"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={saving}>
              Save Summary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewing ? `Summary of Minutes — Week ${viewing.meeting_week}, ${viewing.meeting_year}` : "Summary"}
            </DialogTitle>
            <DialogDescription>
              {viewing ? formatMeetingMonday(viewing.meeting_week, viewing.meeting_year) : null}
            </DialogDescription>
          </DialogHeader>
          {viewing ? <SlideTextPreview html={viewing.content_html} /> : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete summary?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `Delete the summary for Week ${pendingDelete.meeting_week}, ${pendingDelete.meeting_year}. The agenda deck will show only the Minutes of the Last Meeting title slide. This cannot be undone.`
                : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              loading={deleting}
              onClick={() => pendingDelete && void remove(pendingDelete)}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DataTable<MinutesSummary>
        data={rows}
        columns={columns}
        filters={filters}
        getRowId={(row) => row.id}
        searchPlaceholder="Search summaries, week or year..."
        searchFn={(row, query) => {
          const q = query.toLowerCase()
          return (
            summaryText(row.content_html).toLowerCase().includes(q) ||
            String(row.meeting_week).includes(q) ||
            String(row.meeting_year).includes(q)
          )
        }}
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        onRetry={() => void refetch()}
        rowActions={rowActions}
        cards
        cardRenderer={(row) => {
          const editorName = row.updated_by ? nameMap.get(row.updated_by) || "Unknown" : "Not recorded"
          return (
            <Card className="border-border/80 bg-card hover:border-primary/40 h-full transition-colors">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-foreground text-sm font-semibold">
                      {formatMeetingMonday(row.meeting_week, row.meeting_year)}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">Summary of minutes</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">{`Week ${row.meeting_week}`}</Badge>
                </div>
                <p className="text-muted-foreground line-clamp-3 text-sm leading-6">{summaryText(row.content_html)}</p>
                <div className="border-border/60 flex items-center justify-between gap-3 border-t pt-3 text-xs">
                  <span className="text-muted-foreground truncate">{editorName}</span>
                  <span className="text-muted-foreground shrink-0">
                    {formatWATDate(row.updated_at, { day: "numeric", month: "short" })}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        }}
        expandable={{
          render: (row) => {
            const editorName = row.updated_by ? nameMap.get(row.updated_by) || "Unknown" : "Not recorded"
            return (
              <div className="border-border/80 bg-card overflow-hidden rounded-xl border">
                <div className="border-border bg-muted/40 flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-foreground text-sm font-semibold">
                      {formatMeetingMonday(row.meeting_week, row.meeting_year)}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">Summary of minutes</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{`Week ${row.meeting_week}`}</Badge>
                    <span className="text-muted-foreground text-xs">Updated by {editorName}</span>
                  </div>
                </div>
                <SlideTextPreview html={row.content_html} className="px-4 py-5 sm:px-5" />
              </div>
            )
          },
        }}
        mobileRow={{
          title: (row) => `Week ${row.meeting_week}, ${row.meeting_year}`,
          subtitle: (row) => formatMeetingMonday(row.meeting_week, row.meeting_year),
          meta: (row) => (
            <span className="text-muted-foreground line-clamp-2 text-xs">{summaryText(row.content_html)}</span>
          ),
        }}
        emptyTitle="No summaries yet"
        emptyDescription={
          readOnly
            ? "No summary of minutes has been added yet."
            : "Add a summary for a meeting week. Weeks without one use the full minutes in the agenda deck."
        }
        emptyIcon={AlertCircle}
        skeletonRows={5}
      />
    </DataTablePage>
  )
}
