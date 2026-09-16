"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Eye, Pencil, Trash2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter, RowAction } from "@/components/ui/data-table"
import { QUERY_KEYS } from "@/lib/query-keys"
import { formatWATDate } from "@/lib/utils/date"
import type { MdDeskDelegate } from "@/lib/md-desk/types"
import { useEventOptions } from "@/components/events/use-events"
import { AddDelegateDialog } from "./add-delegate-dialog"
import { removeDelegate, saveDelegate, useMdDeskDelegates } from "./use-md-desk"

export function MdDeskDelegates() {
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch } = useMdDeskDelegates()
  const optionsQuery = useEventOptions()
  const [addOpen, setAddOpen] = useState(false)

  const delegates = useMemo(() => data?.delegates ?? [], [data])
  const canManage = data?.access.canManageDelegates === true

  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.mdDeskDelegates() })

  const toggleEdit = async (d: MdDeskDelegate) => {
    try {
      await saveDelegate(d.profile_id, !d.can_edit)
      toast.success(d.can_edit ? `${d.name} can now only view` : `${d.name} can now edit`)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update delegate")
    }
  }

  const remove = async (d: MdDeskDelegate) => {
    try {
      await removeDelegate(d.profile_id)
      toast.success(`${d.name} removed from MD's Desk`)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove delegate")
    }
  }

  const columns: DataTableColumn<MdDeskDelegate>[] = [
    { key: "name", label: "Delegate", sortable: true, accessor: (d) => d.name },
    { key: "department", label: "Department", sortable: true, accessor: (d) => d.department ?? "—" },
    {
      key: "access",
      label: "Access",
      accessor: (d) => (d.can_edit ? "edit" : "view"),
      render: (d) => (
        <Badge variant={d.can_edit ? "default" : "secondary"}>{d.can_edit ? "Can edit" : "View only"}</Badge>
      ),
    },
    { key: "granted_by", label: "Added by", accessor: (d) => d.granted_by_name ?? "—", hideOnMobile: true },
    {
      key: "created_at",
      label: "Added",
      sortable: true,
      accessor: (d) => formatWATDate(d.created_at),
      hideOnMobile: true,
    },
  ]

  const departments = Array.from(new Set(delegates.map((d) => d.department).filter((v): v is string => Boolean(v))))
  const filters: DataTableFilter<MdDeskDelegate>[] = [
    {
      key: "access",
      label: "Access",
      options: [
        { value: "edit", label: "Can edit" },
        { value: "view", label: "View only" },
      ],
    },
    { key: "department", label: "Department", options: departments.map((d) => ({ value: d, label: d })) },
  ]

  const rowActions: RowAction<MdDeskDelegate>[] = canManage
    ? [
        { label: "Toggle edit access", icon: Pencil, onClick: (d) => void toggleEdit(d) },
        { label: "Remove", icon: Trash2, variant: "destructive", onClick: (d) => void remove(d) },
      ]
    : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Delegates</h2>
          <p className="text-muted-foreground text-sm">
            People who share MD&apos;s Desk — they see the MD&apos;s private events and the approvals queue.
            {!canManage && " Only the MD can change this list."}
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="mr-1.5 h-4 w-4" aria-hidden />
            Add delegate
          </Button>
        )}
      </div>

      <DataTable<MdDeskDelegate>
        data={delegates}
        columns={columns}
        getRowId={(d) => d.profile_id}
        searchPlaceholder="Search delegates…"
        searchFn={(d, q) => [d.name, d.department].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))}
        filters={filters}
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        onRetry={() => refetch()}
        rowActions={rowActions}
        viewToggle
        contactsView
        stickyToolbar
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        cardRenderer={(d) => (
          <div className="bg-card flex h-full flex-col gap-3 rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{d.name}</p>
                <p className="text-muted-foreground truncate text-sm">{d.department || "General"}</p>
              </div>
              <Badge variant={d.can_edit ? "default" : "secondary"}>{d.can_edit ? "Can edit" : "View only"}</Badge>
            </div>
            <div className="grid gap-1 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Added by</span>
                <span className="truncate">{d.granted_by_name || "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Added</span>
                <span>{formatWATDate(d.created_at)}</span>
              </div>
            </div>
            {canManage && (
              <div className="mt-auto flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => void toggleEdit(d)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  {d.can_edit ? "Make view only" : "Allow edit"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => void remove(d)}
                  aria-label={`Remove ${d.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            )}
          </div>
        )}
        mobileRow={{
          title: (d) => d.name,
          subtitle: (d) => `${d.department || "General"} · Added ${formatWATDate(d.created_at)}`,
          trailing: (d) => (
            <Badge variant={d.can_edit ? "default" : "secondary"} className="text-[10px]">
              {d.can_edit ? "Can edit" : "View only"}
            </Badge>
          ),
          detail: {
            title: (d) => d.name,
            subtitle: (d) => d.department || "General",
            badges: (d) => (
              <Badge variant={d.can_edit ? "default" : "secondary"}>{d.can_edit ? "Can edit" : "View only"}</Badge>
            ),
            fields: (d) => [
              { label: "Department", value: d.department || "—" },
              { label: "Access Level", value: d.can_edit ? "Can edit schedule & approvals" : "View only" },
              { label: "Added By", value: d.granted_by_name || "—" },
              { label: "Added On", value: formatWATDate(d.created_at) },
            ],
          },
        }}
      />

      {!canManage && delegates.length > 0 && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Eye className="h-3.5 w-3.5" aria-hidden />
          You&apos;re viewing this list as a delegate.
        </p>
      )}

      <AddDelegateDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        staff={(optionsQuery.data?.staff ?? []).filter((s) => !delegates.some((d) => d.profile_id === s.id))}
        onSaved={refresh}
      />
    </div>
  )
}
