"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Plus, Wallet } from "lucide-react"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/ui/searchable-select"
import type { ExtraTab } from "@/components/requisitions/requisitions-list-page"
import { useStaffOptions } from "@/components/requisitions/use-staff-options"
import { apiFetch } from "@/lib/api-client"
import { useConfirm } from "@/providers/confirm-provider"

interface ProcessorRow {
  profile_id: string
  created_at: string
  person: { id: string; full_name: string | null; department: string | null; designation: string | null } | null
}

/** Admin tab: who records payments (Processed By). The Accounts lead always can and is not listed. */
export function usePaymentProcessorsTab(): ExtraTab {
  const confirm = useConfirm()
  const [rows, setRows] = useState<ProcessorRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [picked, setPicked] = useState("")
  const [busy, setBusy] = useState(false)
  const options = useStaffOptions(isAddOpen)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiFetch("/api/requisitions/payment-processors")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load payment processors")
      setRows(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payment processors")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const add = async () => {
    if (!picked) return
    setBusy(true)
    try {
      const res = await apiFetch("/api/requisitions/payment-processors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: picked }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Could not add")
      setIsAddOpen(false)
      setPicked("")
      toast.success("Payment processor added")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row: ProcessorRow) => {
    const ok = await confirm({
      title: "Remove this payment processor?",
      description: row.person?.full_name ?? undefined,
      confirmLabel: "Remove",
      destructive: true,
    })
    if (!ok) return
    try {
      const res = await apiFetch(`/api/requisitions/payment-processors?profile_id=${row.profile_id}`, {
        method: "DELETE",
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Could not remove")
      toast.success("Payment processor removed")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove")
    }
  }

  const columns: DataTableColumn<ProcessorRow>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      accessor: (r) => r.person?.full_name || "",
      render: (r) => <span className="text-xs font-semibold">{r.person?.full_name || "—"}</span>,
      initialWidth: 220,
    },
    {
      key: "department",
      label: "Department",
      sortable: true,
      accessor: (r) => r.person?.department || "",
      render: (r) => <span className="text-xs">{r.person?.department || "—"}</span>,
      initialWidth: 180,
    },
    {
      key: "designation",
      label: "Role",
      accessor: (r) => r.person?.designation || "",
      render: (r) => <span className="text-muted-foreground text-xs">{r.person?.designation || "—"}</span>,
      initialWidth: 200,
      hideOnMobile: true,
    },
  ]

  return {
    tab: { key: "processors", label: "Payment processors", icon: Wallet },
    actions: (
      <Button size="sm" onClick={() => setIsAddOpen(true)} aria-label="Add payment processor">
        <Plus className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Add processor</span>
      </Button>
    ),
    content: (
      <>
        <p className="text-muted-foreground mb-3 text-sm">
          These people record payments on fully signed requisitions. The Accounts lead can always record payments as
          well.
        </p>
        <DataTable<ProcessorRow>
          data={rows}
          columns={columns}
          getRowId={(r) => r.profile_id}
          searchPlaceholder="Search processors..."
          searchFn={(r, q) => (r.person?.full_name || "").toLowerCase().includes(q)}
          isLoading={isLoading}
          error={error}
          onRetry={load}
          emptyTitle="No payment processors yet"
          emptyDescription="Add the accounts payable officer. Until then only the Accounts lead can record payments."
          emptyIcon={Wallet}
          mobileRow={{
            title: (r) => r.person?.full_name || "—",
            subtitle: (r) => r.person?.department || "",
          }}
          rowActions={[{ label: "Remove", variant: "destructive", onClick: (row) => void remove(row) }]}
        />
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add payment processor</DialogTitle>
              <DialogDescription>
                They will be able to record payments and will be emailed when one is due.
              </DialogDescription>
            </DialogHeader>
            <SearchableSelect
              value={picked}
              onValueChange={setPicked}
              options={options}
              placeholder="Pick a member of staff"
              searchPlaceholder="Search staff"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={add} disabled={busy || !picked}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    ),
  }
}
