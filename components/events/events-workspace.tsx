"use client"

import { useMemo, useState } from "react"
import {
  CalendarDays,
  CalendarRange,
  Clock,
  Eye,
  Inbox,
  Pencil,
  Plus,
  Presentation,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter, DataTableTab, RowAction } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { formatWATDateTimeRange, formatWATDate, toLocalISODate } from "@/lib/utils/date"
import {
  EVENT_LOCATION_LABELS,
  EVENT_RSVP_LABELS,
  EVENT_STATUSES,
  EVENT_STATUS_LABELS,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  EVENT_VISIBILITIES,
  EVENT_VISIBILITY_LABELS,
  MD_INVOLVEMENT_LABELS,
  type CalendarEvent,
} from "@/lib/events/types"
import { DeleteEventDialog } from "./delete-event-dialog"
import { EventStatusBadge, EventTypeBadge, MdInvolvementBadge } from "./event-badges"
import { EventDetailSheet } from "./event-detail-sheet"
import { EventFormDialog } from "./event-form-dialog"
import { EventMonthCalendar } from "./event-month-calendar"
import { monthGridRange, useEventOptions, useEvents } from "./use-events"

const DAY_MS = 86_400_000
/** List tabs look this far ahead / back; get_md_busy_blocks caps a window at 93 days. */
const LIST_WINDOW_DAYS = 92

type TabKey = "calendar" | "upcoming" | "invitations" | "past"

export type EventsWorkspaceProps = {
  title: string
  description: string
  icon?: LucideIcon
  backLink?: { href: string; label: string }
  /** "md" limits every view to events on the MD's schedule (MD's Desk). */
  scope?: "all" | "md"
  tabs: TabKey[]
  /** Management surfaces show drafts and the MD-involvement filter. */
  variant: "staff" | "manage"
}

const TAB_LABELS: Record<TabKey, { label: string; icon: LucideIcon }> = {
  calendar: { label: "Calendar", icon: CalendarDays },
  upcoming: { label: "Upcoming", icon: CalendarRange },
  invitations: { label: "My invitations", icon: Inbox },
  past: { label: "Past", icon: Clock },
}

function whenLabel(e: CalendarEvent) {
  if (!e.all_day) return formatWATDateTimeRange(e.start_at, e.end_at)
  const start = formatWATDate(e.start_at)
  const end = formatWATDate(new Date(new Date(e.end_at).getTime() - 1))
  return start === end ? `${start} · all day` : `${start} – ${end} · all day`
}

function locationLabel(e: CalendarEvent) {
  const place = [e.room_name, e.venue].filter(Boolean).join(" · ")
  return place ? `${EVENT_LOCATION_LABELS[e.location_type]} · ${place}` : EVENT_LOCATION_LABELS[e.location_type]
}

export function EventsWorkspace({
  title,
  description,
  icon = CalendarDays,
  backLink,
  scope = "all",
  tabs,
  variant,
}: EventsWorkspaceProps) {
  const [tab, setTab] = useState<TabKey>(tabs[0])
  const [nowMs] = useState(() => Date.now())
  const [month, setMonth] = useState(() => {
    const [y, m] = toLocalISODate().split("-").map(Number)
    return { year: y, monthIndex: m - 1 }
  })

  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null)

  const range = useMemo(() => {
    if (tab === "calendar") return monthGridRange(month.year, month.monthIndex)
    if (tab === "past") return { from: new Date(nowMs - LIST_WINDOW_DAYS * DAY_MS), to: new Date(nowMs) }
    return { from: new Date(nowMs), to: new Date(nowMs + LIST_WINDOW_DAYS * DAY_MS) }
  }, [tab, month.year, month.monthIndex, nowMs])

  const eventsQuery = useEvents(range, scope)
  const optionsQuery = useEventOptions()
  const canCreate = optionsQuery.data?.capabilities.canCreate === true

  const allEvents = useMemo(() => eventsQuery.data?.events ?? [], [eventsQuery.data])
  const rows = useMemo(() => {
    let list = allEvents
    if (variant === "staff") list = list.filter((e) => e.status !== "draft" || e.can_manage)
    if (tab === "invitations") list = list.filter((e) => e.my_rsvp !== null)
    if (tab === "past") list = [...list].reverse()
    return list
  }, [allEvents, tab, variant])

  const stats = useMemo(() => {
    const weekEnd = nowMs + 7 * DAY_MS
    const live = allEvents.filter((e) => e.status !== "cancelled")
    return {
      thisWeek: live.filter((e) => {
        const start = new Date(e.start_at).getTime()
        return start >= nowMs && start < weekEnd
      }).length,
      awaiting: live.filter((e) => e.my_rsvp === "pending" && new Date(e.end_at).getTime() > nowMs).length,
      learning: live.filter((e) => e.type === "workshop" || e.type === "webinar" || e.type === "training").length,
      drafts: allEvents.filter((e) => e.status === "draft").length,
      total: allEvents.length,
    }
  }, [allEvents, nowMs])

  const openEvent = (event: CalendarEvent) => {
    setSelected(event)
    setSheetOpen(true)
  }
  const openEdit = (event: CalendarEvent) => {
    setSheetOpen(false)
    setEditing(event)
    setFormOpen(true)
  }
  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openDelete = (event: CalendarEvent) => {
    setSheetOpen(false)
    setDeleting(event)
  }

  const columns: DataTableColumn<CalendarEvent>[] = [
    {
      key: "title",
      label: "Event",
      sortable: true,
      accessor: (e) => e.title,
      resizable: true,
      initialWidth: 280,
      render: (e) => (
        <div className="min-w-0 space-y-1">
          <p className={e.status === "cancelled" ? "truncate font-medium line-through" : "truncate font-medium"}>
            {e.title}
          </p>
          <div className="flex flex-wrap gap-1">
            <MdInvolvementBadge value={e.md_involvement} />
          </div>
        </div>
      ),
    },
    {
      key: "when",
      label: "When",
      sortable: true,
      accessor: (e) => e.start_at,
      render: (e) => <span className="text-sm whitespace-nowrap">{whenLabel(e)}</span>,
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      accessor: (e) => e.type,
      render: (e) => <EventTypeBadge type={e.type} />,
    },
    {
      key: "location",
      label: "Where",
      accessor: (e) => locationLabel(e),
      hideOnMobile: true,
    },
    {
      key: "visibility",
      label: "Audience",
      accessor: (e) => e.visibility,
      render: (e) => (
        <span className="text-sm">
          {e.visibility === "department" && e.department_name
            ? e.department_name
            : EVENT_VISIBILITY_LABELS[e.visibility]}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "invitees",
      label: tab === "invitations" ? "Your reply" : "Going",
      accessor: (e) =>
        tab === "invitations"
          ? EVENT_RSVP_LABELS[e.my_rsvp ?? "pending"]
          : `${e.attendees.filter((a) => a.rsvp === "yes").length}/${e.attendees.length}`,
      hideOnMobile: true,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (e) => e.status,
      render: (e) => <EventStatusBadge status={e.status} />,
    },
  ]

  const filters: DataTableFilter<CalendarEvent>[] = [
    { key: "type", label: "Type", options: EVENT_TYPES.map((t) => ({ value: t, label: EVENT_TYPE_LABELS[t] })) },
    {
      key: "status",
      label: "Status",
      options: EVENT_STATUSES.filter((s) => variant === "manage" || s !== "draft").map((s) => ({
        value: s,
        label: EVENT_STATUS_LABELS[s],
      })),
    },
    {
      key: "visibility",
      label: "Audience",
      options: EVENT_VISIBILITIES.map((v) => ({ value: v, label: EVENT_VISIBILITY_LABELS[v] })),
    },
    ...(variant === "manage"
      ? [
          {
            key: "md_involvement",
            label: "MD schedule",
            mode: "custom" as const,
            options: (["host", "attending", "none"] as const).map((m) => ({
              value: m,
              label: MD_INVOLVEMENT_LABELS[m],
            })),
            filterFn: (e: CalendarEvent, values: string[]) => values.includes(e.md_involvement),
          },
        ]
      : []),
  ]

  const rowActions: RowAction<CalendarEvent>[] = [
    { label: "View", icon: Eye, onClick: openEvent },
    { label: "Edit", icon: Pencil, onClick: openEdit, hidden: (e) => !e.can_manage },
    { label: "Delete", icon: Trash2, onClick: openDelete, variant: "destructive", hidden: (e) => !e.can_manage },
  ]

  const statCards =
    variant === "manage" ? (
      <StatGrid>
        <StatCard
          title="Next 7 days"
          value={stats.thisWeek}
          icon={CalendarRange}
          iconBgColor="bg-blue-500/10"
          iconColor="text-blue-500"
        />
        <StatCard
          title="Drafts"
          value={stats.drafts}
          icon={Pencil}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-500"
        />
        <StatCard
          title="Workshops & trainings"
          value={stats.learning}
          icon={Presentation}
          iconBgColor="bg-violet-500/10"
          iconColor="text-violet-500"
        />
        <StatCard
          title="In view"
          value={stats.total}
          icon={CalendarDays}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-500"
        />
      </StatGrid>
    ) : (
      <StatGrid>
        <StatCard
          title="Awaiting your reply"
          value={stats.awaiting}
          icon={Inbox}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-500"
        />
        <StatCard
          title="Next 7 days"
          value={stats.thisWeek}
          icon={CalendarRange}
          iconBgColor="bg-blue-500/10"
          iconColor="text-blue-500"
        />
        <StatCard
          title="Workshops & trainings"
          value={stats.learning}
          icon={Presentation}
          iconBgColor="bg-violet-500/10"
          iconColor="text-violet-500"
        />
      </StatGrid>
    )

  const tabDefs: DataTableTab[] = tabs.map((key) => ({ key, label: TAB_LABELS[key].label, icon: TAB_LABELS[key].icon }))
  const error = eventsQuery.error instanceof Error ? eventsQuery.error.message : null

  return (
    <DataTablePage
      title={title}
      description={description}
      icon={icon}
      backLink={backLink}
      tabs={tabDefs}
      activeTab={tab}
      onTabChange={(key) => setTab(key as TabKey)}
      stats={statCards}
      actions={
        canCreate ? (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            New event
          </Button>
        ) : undefined
      }
    >
      {tab === "calendar" ? (
        <div className="space-y-2">
          {error && (
            <div className="border-destructive/40 text-destructive flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={() => eventsQuery.refetch()}>
                Retry
              </Button>
            </div>
          )}
          <EventMonthCalendar
            year={month.year}
            monthIndex={month.monthIndex}
            onMonthChange={(year, monthIndex) => setMonth({ year, monthIndex })}
            events={rows}
            busy={eventsQuery.data?.busy ?? []}
            isLoading={eventsQuery.isLoading}
            onSelectEvent={openEvent}
          />
        </div>
      ) : (
        <DataTable<CalendarEvent>
          data={rows}
          columns={columns}
          getRowId={(e) => e.id}
          searchPlaceholder="Search events, venues, organisers…"
          searchFn={(e, q) =>
            [e.title, e.venue, e.room_name, e.organizer_name, e.department_name, e.description]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q))
          }
          filters={filters}
          isLoading={eventsQuery.isLoading}
          error={error}
          onRetry={() => eventsQuery.refetch()}
          rowActions={rowActions}
          pagination={{ pageSize: 25 }}
        />
      )}

      <EventDetailSheet
        event={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onEdit={openEdit}
        onDelete={openDelete}
      />
      <EventFormDialog open={formOpen} onOpenChange={setFormOpen} event={editing} options={optionsQuery.data} />
      <DeleteEventDialog event={deleting} onOpenChange={(open) => !open && setDeleting(null)} />
    </DataTablePage>
  )
}
