"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Loader2, Plus, Settings, TriangleAlert, UserMinus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { RowsSkeleton } from "@/components/skeletons"
import { useStaffOptions } from "@/components/requisitions/use-staff-options"
import { apiFetch } from "@/lib/api-client"
import { FORM_LABELS } from "@/lib/requisitions/limits"
import type { RequisitionFormType } from "@/lib/requisitions/types"
import { useConfirm } from "@/providers/confirm-provider"

interface OfficerRow {
  profile_id: string
  form_type: RequisitionFormType
  created_at: string
  person: { id: string; full_name: string | null; department: string | null; designation: string | null } | null
}

const FORMS: { type: RequisitionFormType; blurb: string }[] = [
  { type: "payment_request", blurb: "Records payment on fully signed Payment Requests." },
  { type: "petty_cash", blurb: "Records payment on fully signed Petty Cash vouchers." },
]

function initials(name: string | null | undefined) {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

/**
 * Requisition settings. For now that is the payment officers, chosen
 * separately for Payment Requests and Petty Cash. Nobody can record payments
 * on a form until they are listed for it here.
 */
function OfficersPanel() {
  const confirm = useConfirm()
  const [rows, setRows] = useState<OfficerRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingFor, setAddingFor] = useState<RequisitionFormType | null>(null)
  const [picked, setPicked] = useState("")
  const [busy, setBusy] = useState(false)
  const staff = useStaffOptions(addingFor !== null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiFetch("/api/requisitions/payment-processors")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load payment officers")
      setRows(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payment officers")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Someone already chosen for this form is not offered again.
  const options = useMemo(() => {
    const taken = new Set(rows.filter((r) => r.form_type === addingFor).map((r) => r.profile_id))
    return staff.filter((option) => !taken.has(option.value))
  }, [staff, rows, addingFor])

  const closeAdd = () => {
    setAddingFor(null)
    setPicked("")
  }

  const add = async () => {
    if (!picked || !addingFor) return
    setBusy(true)
    try {
      const res = await apiFetch("/api/requisitions/payment-processors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: picked, form_type: addingFor }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Could not add")
      toast.success(`Payment officer added for ${FORM_LABELS[addingFor]}`)
      closeAdd()
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row: OfficerRow) => {
    const ok = await confirm({
      title: `Remove ${row.person?.full_name ?? "this person"} as ${FORM_LABELS[row.form_type]} officer?`,
      description: "They will no longer be able to record payments on these requisitions.",
      confirmLabel: "Remove",
      destructive: true,
    })
    if (!ok) return
    try {
      const res = await apiFetch(
        `/api/requisitions/payment-processors?profile_id=${row.profile_id}&form_type=${row.form_type}`,
        { method: "DELETE" }
      )
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Could not remove")
      toast.success("Payment officer removed")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove")
    }
  }

  return (
    <>
      <p className="text-muted-foreground mb-4 text-sm">
        Choose who records payments, separately for each form. Only people listed here can; nobody is allowed by
        default, and nobody can record a payment on a requisition they raised themselves. They are emailed when one is
        due.
      </p>
      {error ? (
        <div className="border-destructive/40 bg-destructive/10 flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={load}>
            Retry
          </Button>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {FORMS.map(({ type, blurb }) => {
          const officers = rows.filter((r) => r.form_type === type)
          return (
            <Card key={type}>
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-base">{FORM_LABELS[type]} officers</CardTitle>
                  <CardDescription>{blurb}</CardDescription>
                </div>
                <Button size="sm" onClick={() => setAddingFor(type)} aria-label={`Add ${FORM_LABELS[type]} officer`}>
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add</span>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoading ? (
                  <RowsSkeleton rows={2} />
                ) : officers.length ? (
                  officers.map((row) => (
                    <div key={row.profile_id} className="flex items-center gap-3 rounded-md border p-2.5">
                      <span className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                        {initials(row.person?.full_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{row.person?.full_name || "—"}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {[row.person?.designation, row.person?.department].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${row.person?.full_name ?? "officer"}`}
                        onClick={() => void remove(row)}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="border-warning/30 bg-warning/10 text-warning flex items-start gap-2 rounded-md border p-3 text-sm">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Nobody is set. Payments on {FORM_LABELS[type]} requisitions cannot be recorded until you add
                      someone.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={addingFor !== null} onOpenChange={(open) => !open && closeAdd()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add {addingFor ? FORM_LABELS[addingFor] : ""} officer</DialogTitle>
            <DialogDescription>
              They will be able to record payments on {addingFor ? FORM_LABELS[addingFor] : ""} requisitions only.
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
            <Button variant="outline" onClick={closeAdd} disabled={busy}>
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
  )
}

/** The Settings button in the page header; the officers open in a dialog. */
export function RequisitionSettingsButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} aria-label="Settings">
        <Settings className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Settings</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Requisition settings</DialogTitle>
            <DialogDescription>Who records payments on each form.</DialogDescription>
          </DialogHeader>
          {open ? <OfficersPanel /> : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
