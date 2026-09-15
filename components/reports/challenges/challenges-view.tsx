"use client"

import { useCallback, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Flame,
  Pencil,
  ShieldAlert,
  Sparkles,
} from "lucide-react"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { isSameDepartment } from "@/shared/departments"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"

export interface ChallengeItem {
  id: string
  title: string
  description?: string | null
  department: string
  week_number: number
  year: number
  status: "open" | "mitigating" | "resolved" | "closed"
  resolution_note?: string | null
  report_id?: string | null
  owner_id?: string | null
  created_by?: string | null
  position?: number
  created_at: string
  updated_at: string
  created_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null
  owner_profile?: { id: string; first_name: string | null; last_name: string | null } | null
}

interface ChallengesViewProps {
  isAdminContext?: boolean
  backHref: string
  backLabel: string
  userRole?: string
  userDepartment?: string | null
  isDepartmentLead?: boolean
  leadDepartments?: string[]
  departments: string[]
}

function getStatusBadge(status: ChallengeItem["status"]) {
  switch (status) {
    case "resolved":
    case "closed":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Resolved</Badge>
      )
    case "mitigating":
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Mitigating</Badge>
    case "open":
    default:
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Open</Badge>
  }
}

export function ChallengesView({
  isAdminContext = false,
  backHref,
  backLabel,
  userRole = "",
  userDepartment = null,
  isDepartmentLead = false,
  leadDepartments = [],
  departments = [],
}: ChallengesViewProps) {
  const currentOfficeWeek = getCurrentOfficeWeek()
  const queryClient = useQueryClient()
  const queryKey = ["general-meeting-challenges"]

  const [editingChallenge, setEditingChallenge] = useState<ChallengeItem | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editStatus, setEditStatus] = useState<ChallengeItem["status"]>("open")
  const [editResolutionNote, setEditResolutionNote] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const {
    data: challenges = [],
    isLoading,
    error,
    refetch,
  } = useQuery<ChallengeItem[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiFetch("/api/reports/general-meeting/challenges", { cache: "no-store" })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to load challenges")
      return payload.data || []
    },
  })

  const isGlobalAdmin = ["developer", "super_admin", "admin"].includes(userRole.toLowerCase())

  const canEditChallenge = useCallback(
    (challenge: ChallengeItem): boolean => {
      if (!isAdminContext) return false
      if (isGlobalAdmin) return true
      if (!isDepartmentLead) return false
      if (isSameDepartment(userDepartment, challenge.department)) return true
      return leadDepartments.some((d) => isSameDepartment(d, challenge.department))
    },
    [isAdminContext, isGlobalAdmin, isDepartmentLead, userDepartment, leadDepartments]
  )

  const handleOpenEdit = (challenge: ChallengeItem) => {
    setEditingChallenge(challenge)
    setEditStatus(challenge.status || "open")
    setEditResolutionNote(challenge.resolution_note || "")
    setIsEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingChallenge) return
    setIsSaving(true)
    try {
      const res = await apiFetch("/api/reports/general-meeting/challenges", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingChallenge.id,
          status: editStatus,
          resolution_note: editResolutionNote.trim() || null,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to update challenge")

      toast.success("Challenge updated successfully")
      setIsEditDialogOpen(false)
      setEditingChallenge(null)
      void queryClient.invalidateQueries({ queryKey })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update challenge")
    } finally {
      setIsSaving(false)
    }
  }

  // Stats
  const totalCount = challenges.length
  const openCount = challenges.filter((c) => c.status === "open").length
  const mitigatingCount = challenges.filter((c) => c.status === "mitigating").length
  const resolvedCount = challenges.filter((c) => c.status === "resolved" || c.status === "closed").length

  const departmentOptions = useMemo(() => departments.map((d) => ({ value: d, label: d })), [departments])

  const weekOptions = useMemo(() => {
    const weeks = Array.from(new Set(challenges.map((c) => c.week_number))).sort((a, b) => b - a)
    if (weeks.length === 0) return [{ value: String(currentOfficeWeek.week), label: `Week ${currentOfficeWeek.week}` }]
    return weeks.map((w) => ({ value: String(w), label: `Week ${w}` }))
  }, [challenges, currentOfficeWeek.week])

  const yearOptions = useMemo(() => {
    const years = Array.from(new Set(challenges.map((c) => c.year))).sort((a, b) => b - a)
    if (years.length === 0) return [{ value: String(currentOfficeWeek.year), label: String(currentOfficeWeek.year) }]
    return years.map((y) => ({ value: String(y), label: String(y) }))
  }, [challenges, currentOfficeWeek.year])

  const columns = useMemo<DataTableColumn<ChallengeItem>[]>(
    () => [
      {
        key: "department",
        label: "Department",
        sortable: true,
        accessor: (row) => row.department,
        resizable: true,
        initialWidth: 180,
      },
      {
        key: "title",
        label: "Challenge",
        sortable: true,
        accessor: (row) => row.title,
        render: (row) => (
          <div className="min-w-[260px] space-y-1">
            <p className="text-foreground text-sm font-medium">{row.title}</p>
            {row.resolution_note && (
              <p className="text-muted-foreground bg-muted/30 border-border/40 rounded border p-1.5 text-xs">
                <span className="text-foreground/80 font-semibold">Resolution / Mitigation: </span>
                {row.resolution_note}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        accessor: (row) => row.status,
        render: (row) => getStatusBadge(row.status),
      },
      {
        key: "week_number",
        label: "Week",
        sortable: true,
        hideOnMobile: true,
        accessor: (row) => row.week_number,
        render: (row) => <span className="font-medium">{`W${row.week_number}`}</span>,
      },
      {
        key: "year",
        label: "Year",
        sortable: true,
        hideOnMobile: true,
        accessor: (row) => row.year,
      },
      {
        key: "actions",
        label: "Action",
        align: "right",
        render: (row) => {
          const editable = canEditChallenge(row)
          if (!isAdminContext) {
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block cursor-not-allowed">
                    <Button variant="ghost" size="sm" disabled className="h-7 px-2 text-xs opacity-50">
                      View Only
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">Challenges are updated in the Admin Console by department leads</p>
                </TooltipContent>
              </Tooltip>
            )
          }

          if (editable) {
            return (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => handleOpenEdit(row)}
              >
                <Pencil className="h-3 w-3" />
                <span>Update</span>
              </Button>
            )
          }

          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block cursor-not-allowed">
                  <Button variant="ghost" size="sm" disabled className="h-7 px-2 text-xs opacity-50">
                    Locked
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">Only leads of {row.department} or administrators can update this challenge</p>
              </TooltipContent>
            </Tooltip>
          )
        },
      },
    ],
    [isAdminContext, canEditChallenge]
  )

  const filters = useMemo<DataTableFilter<ChallengeItem>[]>(
    () => [
      {
        key: "status",
        label: "Status",
        options: [
          { value: "open", label: "Open" },
          { value: "mitigating", label: "Mitigating" },
          { value: "resolved", label: "Resolved" },
          { value: "closed", label: "Closed" },
        ],
      },
      {
        key: "department",
        label: "Department",
        options: departmentOptions,
      },
      {
        key: "week_number",
        label: "Week",
        options: weekOptions,
      },
      {
        key: "year",
        label: "Year",
        options: yearOptions,
      },
    ],
    [departmentOptions, weekOptions, yearOptions]
  )

  return (
    <DataTablePage
      title="Departmental Challenges"
      description={
        isAdminContext
          ? "Manage and track resolution notes for departmental operational challenges raised during general meetings."
          : "View weekly departmental challenges and their resolution progress."
      }
      icon={AlertTriangle}
      backLink={{ href: backHref, label: backLabel }}
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Total Challenges"
            value={totalCount}
            icon={AlertTriangle}
            iconBgColor="bg-slate-500/10"
            iconColor="text-slate-600 dark:text-slate-400"
          />
          <StatCard
            variant="compact"
            title="Open"
            value={openCount}
            icon={Flame}
            iconBgColor="bg-amber-500/10"
            iconColor="text-amber-600 dark:text-amber-400"
          />
          <StatCard
            variant="compact"
            title="Mitigating"
            value={mitigatingCount}
            icon={Clock}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-600 dark:text-blue-400"
          />
          <StatCard
            variant="compact"
            title="Resolved"
            value={resolvedCount}
            icon={CheckCircle2}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-600 dark:text-emerald-400"
          />
        </StatGrid>
      }
    >
      <DataTable<ChallengeItem>
        data={challenges}
        columns={columns}
        filters={filters}
        getRowId={(row) => row.id}
        searchPlaceholder="Search challenge, department, resolution..."
        searchFn={(row, query) => {
          const q = query.toLowerCase()
          return (
            row.title.toLowerCase().includes(q) ||
            row.department.toLowerCase().includes(q) ||
            (row.resolution_note || "").toLowerCase().includes(q)
          )
        }}
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        onRetry={() => {
          void refetch()
        }}
        pagination={{ pageSize: 25 }}
        stickyToolbar
        viewToggle
      />

      {/* Edit Challenge Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Challenge</DialogTitle>
            <DialogDescription>
              Update resolution progress and notes for {editingChallenge?.department} (Week{" "}
              {editingChallenge?.week_number}, {editingChallenge?.year}).
            </DialogDescription>
          </DialogHeader>

          {editingChallenge && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/20 space-y-1 rounded-lg border p-3">
                <span className="text-muted-foreground text-xs font-semibold uppercase">Challenge</span>
                <p className="text-foreground text-sm font-medium">{editingChallenge.title}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="challenge-status">Status</Label>
                <Select value={editStatus} onValueChange={(val) => setEditStatus(val as ChallengeItem["status"])}>
                  <SelectTrigger id="challenge-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="mitigating">Mitigating</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resolution-note">Resolution / Mitigation Note</Label>
                <Textarea
                  id="resolution-note"
                  rows={4}
                  placeholder="Describe actions taken, mitigation steps, or resolution details..."
                  value={editResolutionNote}
                  onChange={(e) => setEditResolutionNote(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DataTablePage>
  )
}
