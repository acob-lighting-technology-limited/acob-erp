"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import type { DataTableColumn } from "@/components/ui/data-table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiFetch } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"

type Group = "hr" | "it" | "cs" | "md"

interface AccessCell {
  level: "edit" | "view" | "none"
  via: "owner" | "override" | "delegation" | "some" | null
  grantIds: string[]
  note: string | null
}

interface AccessPerson {
  id: string
  name: string
  role: string
  department: string | null
  is_self: boolean
  hr: AccessCell
  it: AccessCell
  cs: AccessCell
  md: AccessCell
}

const UMBRELLA: Record<Group, string> = { hr: "hr.main", it: "it.main", cs: "scorecard.main", md: "mddesk.main" }
const GROUP_LABEL: Record<Group, string> = { hr: "HR", it: "IT", cs: "Corporate Services", md: "MD's Desk" }

function roleLabel(role: string) {
  return role.replace("_", " ").replace(/^\w/, (char) => char.toUpperCase())
}

async function readError(res: Response, fallback: string) {
  const json = await res.json().catch(() => null)
  return new Error(json?.error || fallback)
}

/**
 * Everyone with the admin, super admin or developer role, and for HR and IT a single
 * choice: View or Edit. Edit is an explicit grant; View withdraws it. Leads of the
 * owning departments (and people acting on a delegation) are shown as Edit and locked,
 * because that comes from who they are, not from a grant you can turn off here.
 */
export function AccessRoster() {
  const queryClient = useQueryClient()

  const { data: roster, isLoading } = useQuery({
    queryKey: QUERY_KEYS.adminAccessPeople(),
    queryFn: async (): Promise<{ data: AccessPerson[]; can_change: Record<Group, boolean> }> => {
      const res = await apiFetch("/api/admin/access/people", { cache: "no-store" })
      if (!res.ok) throw await readError(res, "Failed to load people")
      return (await res.json()) as { data: AccessPerson[]; can_change: Record<Group, boolean> }
    },
  })
  const people = roster?.data ?? []
  const canChange = roster?.can_change ?? { hr: false, it: false, cs: false, md: false }

  const setLevel = useMutation({
    mutationFn: async ({ person, group, level }: { person: AccessPerson; group: Group; level: "view" | "edit" }) => {
      if (level === "edit") {
        const res = await apiFetch("/api/admin/access/grants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "grant", userId: person.id, routes: [UMBRELLA[group]], validUntil: null }),
        })
        if (!res.ok) throw await readError(res, "Could not save")
        return
      }
      for (const id of person[group].grantIds) {
        const res = await apiFetch(`/api/admin/access/grants?id=${encodeURIComponent(id)}`, { method: "DELETE" })
        if (!res.ok) throw await readError(res, "Could not save")
      }
    },
    onSuccess: (_data, { person, group, level }) => {
      toast.success(`${person.name}: ${GROUP_LABEL[group]} set to ${level === "edit" ? "Edit" : "View"}`)
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminAccessPeople() })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminAccessGrants() })
    },
  })

  function levelCell(person: AccessPerson, group: Group) {
    const cell = person[group]
    if (cell.level === "none") {
      return (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-sm">No access</span>
          <span className="text-muted-foreground text-xs">Give view in Settings → Users first</span>
        </div>
      )
    }

    const notOwner = !canChange[group]
    const locked = notOwner || person.is_self || cell.via === "owner" || cell.via === "delegation"
    const value = cell.level === "edit" && cell.via !== "some" ? "edit" : "view"

    return (
      <div className="flex flex-col gap-1">
        <Select
          value={value}
          disabled={locked || setLevel.isPending}
          onValueChange={(next) => setLevel.mutate({ person, group, level: next as "view" | "edit" })}
        >
          <SelectTrigger className="h-8 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="view">View</SelectItem>
            <SelectItem value="edit">Edit</SelectItem>
          </SelectContent>
        </Select>
        {person.is_self ? (
          <span className="text-muted-foreground text-xs">You cannot change your own access</span>
        ) : cell.note ? (
          <span className="text-muted-foreground text-xs">{cell.note}</span>
        ) : notOwner ? (
          <span className="text-muted-foreground text-xs">Only an owner of {GROUP_LABEL[group]} can change this</span>
        ) : null}
      </div>
    )
  }

  const columns: DataTableColumn<AccessPerson>[] = [
    {
      key: "name",
      label: "Person",
      sortable: true,
      accessor: (row) => row.name,
      render: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "role",
      label: "Role",
      sortable: true,
      accessor: (row) => row.role,
      render: (row) => <Badge variant="outline">{roleLabel(row.role)}</Badge>,
    },
    {
      key: "department",
      label: "Department",
      sortable: true,
      accessor: (row) => row.department ?? "",
      hideOnMobile: true,
    },
    {
      key: "hr",
      label: "HR",
      accessor: (row) => row.hr.level,
      render: (row) => levelCell(row, "hr"),
    },
    {
      key: "it",
      label: "IT",
      accessor: (row) => row.it.level,
      render: (row) => levelCell(row, "it"),
    },
    {
      key: "cs",
      label: "Corporate Services",
      accessor: (row) => row.cs.level,
      render: (row) => levelCell(row, "cs"),
    },
    {
      key: "md",
      label: "MD's Desk",
      accessor: (row) => row.md.level,
      render: (row) => levelCell(row, "md"),
    },
  ]

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Edit here is an <span className="text-foreground font-medium">override</span>: the person can change things in
        that area, but every change is marked as an override and shown to the area&apos;s owners. Only an owner of an
        area can give it. Owners are set in the developer area.
      </p>
      <DataTable<AccessPerson>
        data={people}
        columns={columns}
        getRowId={(row) => row.id}
        pagination={{ pageSize: 25 }}
        searchPlaceholder="Search people..."
        searchFn={(row, query) =>
          `${row.name} ${row.role} ${row.department ?? ""}`.toLowerCase().includes(query.toLowerCase())
        }
        isLoading={isLoading}
        emptyTitle="No admins found"
      />
    </div>
  )
}
