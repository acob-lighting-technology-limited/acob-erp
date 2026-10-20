"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus, Wallet } from "lucide-react"
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/ui/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ExtraTab } from "@/components/requisitions/requisitions-list-page"
import { apiFetch } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import type { RequisitionFundingCategory } from "@/lib/requisitions/types"
import { FundingCategoryDialog } from "./funding-category-dialog"

/** Admin tab: the funding lines a requisition may be charged to (optional on both forms). */
export function useFundingCategoriesTab(): ExtraTab {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RequisitionFundingCategory | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const categoriesQuery = useQuery({
    queryKey: QUERY_KEYS.requisitionFundingCategories(true),
    queryFn: async (): Promise<RequisitionFundingCategory[]> => {
      const res = await apiFetch("/api/requisitions/funding-categories?include_inactive=true")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load funding categories")
      return json.data || []
    },
  })
  const categories = categoriesQuery.data ?? []
  const isLoading = categoriesQuery.isFetching
  const loadError = categoriesQuery.error instanceof Error ? categoriesQuery.error.message : null
  const error = actionError ?? loadError
  const load = () => categoriesQuery.refetch()

  const openEditor = (category: RequisitionFundingCategory | null) => {
    setEditing(category)
    setSaveError(null)
    setIsDialogOpen(true)
  }

  const save = async (payload: { name: string; description: string; sort_order: number }) => {
    setIsSaving(true)
    setSaveError(null)
    try {
      const res = await apiFetch("/api/requisitions/funding-categories", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          name: payload.name,
          description: payload.description || undefined,
          sort_order: payload.sort_order,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to save funding category")
      setIsDialogOpen(false)
      setEditing(null)
      await load()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save funding category")
    } finally {
      setIsSaving(false)
    }
  }

  const toggleActive = async (category: RequisitionFundingCategory) => {
    setActionError(null)
    try {
      const res = await apiFetch("/api/requisitions/funding-categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: category.id, is_active: !category.is_active }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to update funding category")
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update funding category")
    }
  }

  const columns: DataTableColumn<RequisitionFundingCategory>[] = [
    {
      key: "name",
      label: "Funding category",
      sortable: true,
      accessor: (c) => c.name,
      render: (c) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold">{c.name}</span>
          {c.description ? <span className="text-muted-foreground text-[11px]">{c.description}</span> : null}
        </div>
      ),
      initialWidth: 260,
    },
    {
      key: "code",
      label: "Code",
      sortable: true,
      accessor: (c) => c.code,
      render: (c) => <span className="font-mono text-xs">{c.code}</span>,
      initialWidth: 140,
      hideOnMobile: true,
    },
    {
      key: "is_active",
      label: "Status",
      sortable: true,
      accessor: (c) => String(c.is_active),
      render: (c) => <Badge variant={c.is_active ? "default" : "outline"}>{c.is_active ? "Active" : "Inactive"}</Badge>,
      initialWidth: 110,
    },
    {
      key: "sort_order",
      label: "Order",
      sortable: true,
      accessor: (c) => c.sort_order,
      render: (c) => <span className="text-muted-foreground text-xs">{c.sort_order}</span>,
      initialWidth: 90,
      hideOnMobile: true,
    },
  ]

  const filters: DataTableFilter<RequisitionFundingCategory>[] = [
    {
      key: "is_active",
      label: "Status",
      mode: "custom",
      options: [
        { value: "true", label: "Active" },
        { value: "false", label: "Inactive" },
      ],
      filterFn: (row, selected) => selected.includes(String(row.is_active)),
    },
  ]

  return {
    tab: { key: "funding", label: "Funding categories", icon: Wallet },
    actions: (
      <Button size="sm" onClick={() => openEditor(null)} aria-label="New funding category">
        <Plus className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">New funding category</span>
      </Button>
    ),
    content: (
      <>
        <DataTable<RequisitionFundingCategory>
          data={categories}
          columns={columns}
          getRowId={(c) => c.id}
          searchPlaceholder="Search funding categories..."
          searchFn={(row, q) => row.name.toLowerCase().includes(q) || row.code.toLowerCase().includes(q)}
          filters={filters}
          isLoading={isLoading}
          error={error}
          onRetry={load}
          pagination={{ pageSize: 25 }}
          emptyTitle="No funding categories"
          emptyDescription="Add the funding lines requisitions can be charged to."
          emptyIcon={Wallet}
          viewToggle
          contactsView
          stickyToolbar
          defaultViewMode={{ mobile: "contacts", desktop: "list" }}
          mobileRow={{
            title: (c) => c.name,
            subtitle: (c) => `${c.code} · ${c.description || "No description"}`,
            trailing: (c) => (
              <Badge variant={c.is_active ? "default" : "outline"} className="text-[10px]">
                {c.is_active ? "Active" : "Inactive"}
              </Badge>
            ),
            onSelect: (c) => openEditor(c),
          }}
          cardRenderer={(c) => (
            <div className="bg-card space-y-3 rounded-xl border p-4 text-xs">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">{c.name}</p>
                  <span className="text-muted-foreground font-mono text-[10px]">{c.code}</span>
                </div>
                <Badge variant={c.is_active ? "default" : "outline"}>{c.is_active ? "Active" : "Inactive"}</Badge>
              </div>
              <p className="text-muted-foreground text-xs">{c.description || "No description"}</p>
            </div>
          )}
          rowActions={[
            { label: "Edit", onClick: (row) => openEditor(row) },
            { label: "Activate", onClick: (row) => void toggleActive(row), hidden: (row) => row.is_active },
            { label: "Deactivate", onClick: (row) => void toggleActive(row), hidden: (row) => !row.is_active },
          ]}
        />
        <FundingCategoryDialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) setEditing(null)
          }}
          category={editing}
          onSave={save}
          isSaving={isSaving}
          error={saveError}
        />
      </>
    ),
  }
}
