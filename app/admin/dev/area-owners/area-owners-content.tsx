"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { KeyRound, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn } from "@/components/ui/data-table"
import { apiFetch } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { formatWATDate } from "@/lib/utils/date"
import { AddOwnerDialog } from "./_components/add-owner-dialog"

interface OwnerRow {
  id: string
  area: string
  area_label: string
  user_id: string
  owner_name: string
  added_by_name: string
  created_at: string
}

interface OwnersData {
  owners: OwnerRow[]
  candidates: Array<{ id: string; name: string; role: string; department: string | null }>
  areas: Array<{ value: string; label: string }>
}

async function readError(res: Response, fallback: string) {
  const json = await res.json().catch(() => null)
  return new Error(json?.error || fallback)
}

/**
 * Who owns each guarded /admin area. The owner decides who may change things there: they lend it to
 * delegates and give the override. Lives in the developer area, so only developers can change it.
 */
export function AreaOwnersContent() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.devAreaOwners(),
    queryFn: async (): Promise<OwnersData> => {
      const res = await apiFetch("/api/admin/dev/area-owners", { cache: "no-store" })
      if (!res.ok) throw await readError(res, "Could not load owners")
      return ((await res.json()) as { data: OwnersData }).data
    },
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.devAreaOwners() })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/admin/dev/area-owners?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      if (!res.ok) throw await readError(res, "Could not remove the owner")
    },
    onSuccess: () => {
      toast.success("Owner removed")
      void refresh()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns: DataTableColumn<OwnerRow>[] = [
    {
      key: "area_label",
      label: "Area",
      sortable: true,
      accessor: (row) => row.area_label,
    },
    {
      key: "owner_name",
      label: "Owner",
      sortable: true,
      accessor: (row) => row.owner_name,
      render: (row) => <span className="font-medium">{row.owner_name}</span>,
    },
    {
      key: "added_by_name",
      label: "Named by",
      sortable: true,
      accessor: (row) => row.added_by_name,
      hideOnMobile: true,
    },
    {
      key: "created_at",
      label: "Since",
      sortable: true,
      accessor: (row) => row.created_at,
      render: (row) => <span className="text-muted-foreground">{formatWATDate(row.created_at)}</span>,
      hideOnMobile: true,
    },
  ]

  return (
    <DataTablePage
      title="Area owners"
      description="Who owns HR, IT and Corporate Services. An owner decides who may change things in their area: they lend it to delegates and give the override. Changing a department's lead does not change this."
      icon={KeyRound}
      actions={
        <Button size="sm" className="h-8 gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Add owner
        </Button>
      }
    >
      <DataTable<OwnerRow>
        data={data?.owners ?? []}
        columns={columns}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        searchPlaceholder="Search owners..."
        searchFn={(row, query) => `${row.area_label} ${row.owner_name}`.toLowerCase().includes(query.toLowerCase())}
        emptyTitle="No owners yet"
        rowActions={[
          {
            label: "Remove owner",
            variant: "destructive",
            onClick: (row) => remove.mutate(row.id),
          },
        ]}
      />

      <AddOwnerDialog open={open} onOpenChange={setOpen} options={data} onAdded={() => void refresh()} />
    </DataTablePage>
  )
}
