"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter, DataTableTab } from "@/components/ui/data-table"
import { StaffAvatar } from "@/components/ui/staff-avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CheckCircle2, Clock, Edit2, ShieldAlert, Sparkles, UserCheck, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import type { AttendanceRosterItem } from "@/app/api/reports/general-meeting/attendance/route"
import { AttendanceEditDialog } from "./attendance-edit-dialog"

interface Props {
  items: AttendanceRosterItem[]
  week: number
  year: number
  isLoading: boolean
  onRefresh: () => void
}

type TabKey = "all" | "not_scanned" | "present" | "on_leave" | "not_at_office"

const TABS: DataTableTab[] = [
  { key: "all", label: "All Staff" },
  { key: "not_scanned", label: "⚠️ At Office, Not Scanned" },
  { key: "present", label: "In Meeting (Checked In)" },
  { key: "on_leave", label: "On Leave" },
  { key: "not_at_office", label: "Not in Office" },
]

function formatTime(isoString: string | null): string {
  if (!isoString) return "—"
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
  } catch {
    return isoString
  }
}

export function AttendanceTable({ items, week, year, isLoading, onRefresh }: Props) {
  const [selectedTab, setSelectedTab] = useState<TabKey>("all")
  const [editingItem, setEditingItem] = useState<AttendanceRosterItem | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // 1-Click "Confirm in Room" action
  const handleQuickConfirm = async (item: AttendanceRosterItem) => {
    setConfirmingId(item.id)
    try {
      const res = await fetch("/api/reports/general-meeting/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week,
          year,
          userId: item.id,
          action: "confirm_in_room",
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to confirm attendance")

      toast.success(`Confirmed ${item.full_name} in conference room!`)
      onRefresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error confirming in room")
    } finally {
      setConfirmingId(null)
    }
  }

  // Filter items by active tab
  const filteredData = useMemo(() => {
    switch (selectedTab) {
      case "not_scanned":
        // At office (has entrance punch) but NOT checked into meeting and not on leave
        return items.filter((i) => i.office_clock_in && !i.meeting_clock_in && !i.is_on_leave)
      case "present":
        return items.filter((i) => i.status === "present" || i.status === "late")
      case "on_leave":
        return items.filter((i) => i.is_on_leave)
      case "not_at_office":
        return items.filter((i) => !i.office_clock_in && !i.meeting_clock_in && !i.is_on_leave)
      default:
        return items
    }
  }, [items, selectedTab])

  // Extract departments for filter dropdown
  const departments = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.department).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [items])

  const columns: DataTableColumn<AttendanceRosterItem>[] = [
    {
      key: "employee",
      label: "Employee",
      sortable: true,
      accessor: (r) => r.full_name,
      render: (r) => (
        <div className="flex items-center gap-3 py-1">
          <StaffAvatar name={r.full_name} src={r.avatar_url} size="md" />
          <div className="min-w-0">
            <div className="text-foreground truncate font-medium">{r.full_name}</div>
            <div className="text-muted-foreground truncate text-xs">{r.designation || r.department}</div>
          </div>
        </div>
      ),
      initialWidth: 260,
    },
    {
      key: "department",
      label: "Department",
      sortable: true,
      accessor: (r) => r.department,
      render: (r) => <span className="text-muted-foreground text-xs font-medium">{r.department}</span>,
      initialWidth: 160,
    },
    {
      key: "office_clock_in",
      label: "Office Entrance Punch",
      sortable: true,
      accessor: (r) => r.office_clock_in || "",
      render: (r) => {
        if (!r.office_clock_in) {
          return <span className="text-muted-foreground text-xs italic">No punch</span>
        }
        return (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-foreground text-xs font-semibold">{formatTime(r.office_clock_in)}</span>
            <Badge
              variant="outline"
              className="text-muted-foreground border-muted-foreground/30 px-1 py-0 text-[10px] uppercase"
            >
              {r.office_clock_in_source || "Bio"}
            </Badge>
          </div>
        )
      },
      initialWidth: 180,
    },
    {
      key: "meeting_clock_in",
      label: "Meeting Check-In",
      sortable: true,
      accessor: (r) => r.meeting_clock_in || "",
      render: (r) => {
        if (!r.meeting_clock_in) {
          if (r.office_clock_in && !r.is_on_leave) {
            return (
              <Badge
                variant="outline"
                className="gap-1 border-amber-400/50 bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-400"
              >
                <AlertTriangle className="h-3 w-3" /> Missed scan
              </Badge>
            )
          }
          return <span className="text-muted-foreground text-xs italic">—</span>
        }
        return (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-foreground text-xs font-semibold">{formatTime(r.meeting_clock_in)}</span>
          </div>
        )
      },
      initialWidth: 160,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (r) => r.status,
      render: (r) => {
        if (r.is_on_leave) {
          return (
            <Badge variant="outline" className="border-sky-400/50 bg-sky-500/10 text-sky-700 dark:text-sky-400">
              🏖️ On Leave
            </Badge>
          )
        }
        switch (r.status) {
          case "present":
            return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Present</Badge>
          case "late":
            return <Badge className="bg-amber-600 text-white hover:bg-amber-600">Late</Badge>
          case "excused":
            return <Badge variant="secondary">Excused</Badge>
          case "absent":
            return <Badge variant="destructive">Absent</Badge>
          default:
            return (
              <Badge variant="outline" className="text-muted-foreground">
                Unrecorded
              </Badge>
            )
        }
      },
      initialWidth: 130,
    },
    {
      key: "source",
      label: "Source",
      sortable: true,
      accessor: (r) => r.source || "",
      render: (r) => {
        if (!r.source) return <span className="text-muted-foreground text-xs">—</span>
        switch (r.source) {
          case "qr_scan":
            return (
              <Badge
                variant="outline"
                className="border-indigo-400/50 bg-indigo-500/10 text-[11px] text-indigo-700 dark:text-indigo-400"
              >
                📱 QR Scan
              </Badge>
            )
          case "code_input":
            return (
              <Badge
                variant="outline"
                className="border-violet-400/50 bg-violet-500/10 text-[11px] text-violet-700 dark:text-violet-400"
              >
                🔢 6-Digit Code
              </Badge>
            )
          case "manual":
            return (
              <Badge
                variant="outline"
                className="border-slate-400/50 bg-slate-500/10 text-[11px] text-slate-700 dark:text-slate-300"
              >
                ✍️ Manual
              </Badge>
            )
          case "teams_sync":
            return (
              <Badge
                variant="outline"
                className="border-blue-400/50 bg-blue-500/10 text-[11px] text-blue-700 dark:text-blue-400"
              >
                💻 Teams
              </Badge>
            )
          default:
            return <span className="text-muted-foreground text-xs">{r.source}</span>
        }
      },
      initialWidth: 130,
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          {/* Quick 1-click button if employee clocked into office but forgot to scan */}
          {r.office_clock_in && !r.meeting_clock_in && !r.is_on_leave && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickConfirm(r)}
                  disabled={confirmingId === r.id}
                  className="h-7 border-emerald-500/40 bg-emerald-50 px-2 text-xs text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                  Confirm in Room
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Employee clocked into building today. Confirm they are seated in conference room.
              </TooltipContent>
            </Tooltip>
          )}

          {/* Edit / Override dialog button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditingItem(r)}
            className="text-muted-foreground hover:text-foreground h-7 w-7 p-0"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      initialWidth: 160,
    },
  ]

  const filters: DataTableFilter<AttendanceRosterItem>[] = [
    {
      key: "department",
      label: "Department",
      options: departments.map((d) => ({ value: d, label: d })),
    },
    {
      key: "status",
      label: "Status",
      options: [
        { value: "present", label: "Present" },
        { value: "late", label: "Late" },
        { value: "excused", label: "Excused" },
        { value: "absent", label: "Absent" },
        { value: "on_leave", label: "On Leave" },
        { value: "unrecorded", label: "Unrecorded" },
      ],
    },
  ]

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b pb-2">
        {TABS.map((tab) => (
          <Button
            key={tab.key}
            size="sm"
            variant={selectedTab === tab.key ? "default" : "ghost"}
            onClick={() => setSelectedTab(tab.key as TabKey)}
            className={`h-8 text-xs ${selectedTab === tab.key ? "bg-indigo-600 text-white hover:bg-indigo-700" : "text-muted-foreground"}`}
          >
            {tab.label}
            {tab.key === "not_scanned" && (
              <Badge className="ml-1.5 h-4 bg-amber-500 px-1 text-[10px] text-white hover:bg-amber-500">
                {items.filter((i) => i.office_clock_in && !i.meeting_clock_in && !i.is_on_leave).length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Directory Data Table */}
      <DataTable<AttendanceRosterItem>
        data={filteredData}
        columns={columns}
        getRowId={(r) => r.id}
        searchPlaceholder="Search staff by name or department..."
        searchFn={(row, query) => {
          const q = query.toLowerCase()
          return (
            row.full_name.toLowerCase().includes(q) ||
            row.department.toLowerCase().includes(q) ||
            (row.designation?.toLowerCase().includes(q) ?? false)
          )
        }}
        filters={filters}
        isLoading={isLoading}
        pagination={{ pageSize: 50 }}
      />

      {/* Manual Edit Dialog */}
      <AttendanceEditDialog
        open={Boolean(editingItem)}
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
        week={week}
        year={year}
        onSuccess={onRefresh}
      />
    </div>
  )
}
