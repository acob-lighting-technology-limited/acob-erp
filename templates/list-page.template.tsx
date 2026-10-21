/**
 * LIST PAGE TEMPLATE — follows AGENTS.md "Table Page Standard".
 *
 * Copy into app/<area>/<page>/ as two files:
 *   page.tsx            → the server part (auth + data, bottom of this file)
 *   <page>-content.tsx  → the client part (DataTablePage + DataTable)
 * and add a loading.tsx that renders <TablePageSkeleton> with the same
 * stats/filters/tabs counts.
 *
 * Never hand-build a list with raw <Table>/<TableHeader>: DataTable already gives
 * search, filters + pills, sorting, column toggle, pagination, mobile list,
 * skeleton, error and empty states.
 */
"use client"

import { Package, Plus, CheckCircle2, Clock } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { StatusBadge } from "@/components/ui/patterns"
import { formatDate } from "@/lib/format"

export interface ItemRow {
  id: string
  name: string
  department: string
  status: "active" | "pending" | "archived"
  created_at: string
}

const columns: DataTableColumn<ItemRow>[] = [
  {
    key: "name",
    label: "Name",
    sortable: true,
    accessor: (row) => row.name,
    render: (row) => <span className="font-medium">{row.name}</span>,
  },
  { key: "department", label: "Department", sortable: true, accessor: (row) => row.department },
  {
    key: "status",
    label: "Status",
    accessor: (row) => row.status,
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: "created_at",
    label: "Created",
    sortable: true,
    hideOnMobile: true,
    accessor: (row) => row.created_at,
    render: (row) => formatDate(row.created_at),
  },
]

function buildFilters(departments: string[]): DataTableFilter<ItemRow>[] {
  return [
    { key: "department", label: "Department", options: departments.map((d) => ({ value: d, label: d })) },
    {
      key: "status",
      label: "Status",
      options: [
        { value: "active", label: "Active" },
        { value: "pending", label: "Pending" },
        { value: "archived", label: "Archived" },
      ],
    },
  ]
}

export function ItemsContent({ items, departments }: { items: ItemRow[]; departments: string[] }) {
  const active = items.filter((item) => item.status === "active").length
  const pending = items.filter((item) => item.status === "pending").length

  return (
    <DataTablePage
      title="Items"
      description="Everything the team tracks, in one list."
      icon={Package}
      backLink={{ href: "/admin", label: "Back to Admin" }}
      actions={
        <Button size="sm" asChild>
          <Link href="/admin/items/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Link>
        </Button>
      }
      stats={
        <StatGrid>
          {/* Put the card people open the page to check among the first three. */}
          <StatCard title="Pending" value={pending} icon={Clock} />
          <StatCard title="Active" value={active} icon={CheckCircle2} />
          <StatCard title="Total" value={items.length} icon={Package} />
        </StatGrid>
      }
    >
      <DataTable<ItemRow>
        data={items}
        columns={columns}
        filters={buildFilters(departments)}
        getRowId={(row) => row.id}
        searchPlaceholder="Search name or department…"
        searchFn={(row, q) => `${row.name} ${row.department}`.toLowerCase().includes(q)}
        pagination={{ pageSize: 50 }}
        urlSync
        emptyTitle="No items yet"
        emptyDescription="Add your first item to get started."
        emptyIcon={Package}
      />
    </DataTablePage>
  )
}

/*
 * page.tsx (server component):
 *
 *   import { redirect } from "next/navigation"
 *   import { createClient } from "@/lib/supabase/server"
 *   import { ItemsContent } from "./items-content"
 *
 *   export default async function ItemsPage() {
 *     const supabase = await createClient()
 *     const { data: { user } } = await supabase.auth.getUser()
 *     if (!user) redirect("/auth/login")
 *     const { data } = await supabase
 *       .from("items")
 *       .select("id, name, department, status, created_at")   // explicit columns
 *       .order("created_at", { ascending: false })
 *       .limit(500)                                            // always bounded
 *     return <ItemsContent items={data ?? []} departments={[]} />
 *   }
 */
