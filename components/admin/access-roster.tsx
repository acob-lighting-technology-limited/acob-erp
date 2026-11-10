"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Ban, Crown, Layers, Lock, ShieldAlert, UserCheck, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import type { DataTableColumn } from "@/components/ui/data-table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiFetch } from "@/lib/api-client"
import { getRoleBadgeColor, getRoleDisplayName } from "@/lib/permissions"
import { QUERY_KEYS } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/types/database"

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

/** Where an Edit comes from, as a small coloured tag under the choice. */
const SOURCE_TAG: Record<NonNullable<AccessCell["via"]>, { label: string; icon: LucideIcon; className: string }> = {
  owner: { label: "Owner", icon: Crown, className: "border-info/30 bg-info/10 text-info" },
  override: { label: "Override", icon: ShieldAlert, className: "border-warning/30 bg-warning/10 text-warning" },
  delegation: { label: "Delegate", icon: UserCheck, className: "border-purple/30 bg-purple/10 text-purple" },
  some: { label: "Some areas", icon: Layers, className: "border-border bg-muted/50 text-muted-foreground" },
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
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
        <span
          className="text-muted-foreground/70 inline-flex items-center gap-1.5 text-xs"
          title="Give view in Settings → Users first"
        >
          <Ban className="h-3.5 w-3.5" /> No access
        </span>
      )
    }

    const notOwner = !canChange[group]
    const locked = notOwner || person.is_self || cell.via === "owner" || cell.via === "delegation"
    const value = cell.level === "edit" && cell.via !== "some" ? "edit" : "view"
    const tag = cell.via ? SOURCE_TAG[cell.via] : null
    const lockReason = person.is_self
      ? "You cannot change your own access"
      : cell.via === "owner" || cell.via === "delegation"
        ? `${cell.note ?? "Comes from their role"}: change it where it is set, not here`
        : notOwner
          ? `Only an owner of ${GROUP_LABEL[group]} can change this`
          : null

    return (
      <div className="flex flex-col items-start gap-1.5" title={lockReason ?? cell.note ?? undefined}>
        <Select
          value={value}
          disabled={locked || setLevel.isPending}
          onValueChange={(next) => setLevel.mutate({ person, group, level: next as "view" | "edit" })}
        >
          <SelectTrigger
            className={cn(
              "h-8 w-28 font-medium",
              value === "edit" && "border-success/40 bg-success/10 text-success",
              locked && "disabled:opacity-80"
            )}
          >
            <span className="flex items-center gap-1.5">
              {locked ? <Lock className="h-3 w-3 shrink-0 opacity-70" /> : null}
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="view">View</SelectItem>
            <SelectItem value="edit">Edit</SelectItem>
          </SelectContent>
        </Select>
        {person.is_self ? (
          <span className="text-muted-foreground text-xs">Your own access</span>
        ) : tag ? (
          <Badge variant="outline" className={cn("gap-1 px-1.5 py-0 text-xs font-medium", tag.className)}>
            <tag.icon className="h-3 w-3" />
            {tag.label}
          </Badge>
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
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
            {initials(row.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name}</p>
            {row.department ? (
              <p className="text-muted-foreground truncate text-xs md:hidden">{row.department}</p>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      sortable: true,
      accessor: (row) => row.role,
      render: (row) => (
        <Badge
          className={cn("border-transparent text-xs font-medium shadow-none", getRoleBadgeColor(row.role as UserRole))}
        >
          {getRoleDisplayName(row.role as UserRole)}
        </Badge>
      ),
    },
    {
      key: "department",
      label: "Department",
      sortable: true,
      accessor: (row) => row.department ?? "",
      render: (row) => <span className="text-muted-foreground text-sm">{row.department ?? "—"}</span>,
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
