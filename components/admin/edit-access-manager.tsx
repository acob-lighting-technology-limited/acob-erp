"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { KeyRound, Plus } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DataTable } from "@/components/ui/data-table"
import type { DataTableColumn } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { apiFetch } from "@/lib/api-client"
import { editRouteLabel } from "@/lib/admin/edit-route-labels"
import { QUERY_KEYS } from "@/lib/query-keys"
import { formatWATDate } from "@/lib/utils/date"

export interface EditGrantRowView {
  id: string
  user_id: string
  user_name: string
  route_key: string
  source: "grant" | "delegation"
  given_by_name: string
  valid_until: string | null
  created_at: string
  can_revoke: boolean
}

interface Candidate {
  id: string
  name: string
  role: string
  department: string | null
}

interface EditAccessManagerProps {
  /** "grant": developer / super admin gives edit (end date optional). "delegate": hand on your own edit (end date required). */
  mode: "grant" | "delegate"
  /** Route keys that can be chosen in the form. */
  routes: string[]
  /** Shown in the empty state and above the table. */
  emptyText?: string
}

function formatDate(value: string | null) {
  if (!value) return "No end date"
  return formatWATDate(value)
}

/** End of the chosen day in West Africa Time, as an ISO string with offset. */
function endOfDayWat(date: string) {
  return `${date}T23:59:59+01:00`
}

export function EditAccessManager({ mode, routes, emptyText }: EditAccessManagerProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [until, setUntil] = useState("")

  const { data: rows = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.adminAccessGrants(),
    queryFn: async (): Promise<EditGrantRowView[]> => {
      const res = await apiFetch("/api/admin/access/grants", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to load access")
      return json.data as EditGrantRowView[]
    },
  })

  const { data: candidates = [] } = useQuery({
    queryKey: QUERY_KEYS.adminAccessCandidates(),
    enabled: open,
    queryFn: async (): Promise<Candidate[]> => {
      const res = await apiFetch("/api/admin/access/candidates", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to load people")
      return json.data as Candidate[]
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/admin/access/grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          userId,
          routes: selected,
          validUntil: until ? endOfDayWat(until) : null,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Could not save")
    },
    onSuccess: () => {
      toast.success(mode === "grant" ? "Edit access granted" : "Delegation saved")
      setOpen(false)
      setUserId("")
      setSelected([])
      setUntil("")
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminAccessGrants() })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/admin/access/grants?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Could not withdraw")
    },
    onSuccess: () => {
      toast.success("Access withdrawn")
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminAccessGrants() })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const visibleRows = useMemo(
    () => (mode === "delegate" ? rows.filter((row) => row.source === "delegation") : rows),
    [mode, rows]
  )

  const columns: DataTableColumn<EditGrantRowView>[] = [
    {
      key: "user_name",
      label: "Person",
      sortable: true,
      accessor: (row) => row.user_name,
      render: (row) => <span className="font-medium">{row.user_name}</span>,
    },
    {
      key: "route_key",
      label: "Area",
      sortable: true,
      accessor: (row) => editRouteLabel(row.route_key),
      render: (row) => <Badge variant="outline">{editRouteLabel(row.route_key)}</Badge>,
    },
    {
      key: "source",
      label: "Source",
      sortable: true,
      accessor: (row) => row.source,
      render: (row) => (
        <Badge variant={row.source === "delegation" ? "secondary" : "default"}>
          {row.source === "delegation" ? "Delegation" : "Granted"}
        </Badge>
      ),
    },
    {
      key: "given_by_name",
      label: mode === "grant" ? "Given by" : "Delegated by",
      sortable: true,
      accessor: (row) => row.given_by_name,
      hideOnMobile: true,
    },
    {
      key: "valid_until",
      label: "Until",
      sortable: true,
      accessor: (row) => row.valid_until ?? "9999",
      render: (row) => <span className="text-muted-foreground">{formatDate(row.valid_until)}</span>,
    },
  ]

  const canSubmit = Boolean(userId) && selected.length > 0 && (mode === "grant" || Boolean(until))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {mode === "grant"
            ? "Edit access lets someone change things in HR or IT. Everyone with the admin role can still view."
            : "A delegate can change things in your area for the dates you choose. They cannot pass it on."}
        </p>
        <Button onClick={() => setOpen(true)} disabled={routes.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          {mode === "grant" ? "Grant edit access" : "Delegate access"}
        </Button>
      </div>

      <DataTable<EditGrantRowView>
        data={visibleRows}
        columns={columns}
        getRowId={(row) => row.id}
        pagination={{ pageSize: 25 }}
        searchPlaceholder="Search people or areas..."
        searchFn={(row, query) =>
          `${row.user_name} ${editRouteLabel(row.route_key)}`.toLowerCase().includes(query.toLowerCase())
        }
        isLoading={isLoading}
        emptyTitle={emptyText ?? "No edit access has been granted yet"}
        rowActions={[
          {
            label: "Withdraw",
            variant: "destructive",
            hidden: (row) => !row.can_revoke,
            onClick: (row) => revoke.mutate(row.id),
          },
        ]}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              {mode === "grant" ? "Grant edit access" : "Delegate your access"}
            </DialogTitle>
            <DialogDescription>
              {mode === "grant"
                ? "Choose who may change things, and where. They must already have the admin role and view access."
                : "Choose who acts for you, where, and until when. They must already have the admin role and view access."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Person</Label>
              <SearchableSelect
                value={userId}
                onValueChange={setUserId}
                placeholder="Choose a person"
                searchPlaceholder="Search people..."
                options={candidates.map((person) => ({
                  value: person.id,
                  label: `${person.name} (${person.role.replace("_", " ")})`,
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Areas</Label>
              <div className="space-y-2">
                {routes.map((route) => (
                  <label key={route} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selected.includes(route)}
                      onCheckedChange={(checked) =>
                        setSelected((prev) => (checked ? [...prev, route] : prev.filter((key) => key !== route)))
                      }
                    />
                    {editRouteLabel(route)}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-access-until">{mode === "grant" ? "Until (optional)" : "Until"}</Label>
              <Input id="edit-access-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={!canSubmit || save.isPending}>
              {save.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
