"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { apiFetch } from "@/lib/api-client"
import { PROJECTS_QUERY_KEY, fetchProjectRecords } from "@/lib/projects/records"
import type { StarlinkKitListRow, UnmatchedStarlinkAccount } from "@/lib/starlink/kits"

const NO_PROJECT = "__none__"

type KitForm = {
  site_name: string
  state: string
  account_number: string
  kit_number: string
  email: string
  project_id: string
  amount: string
  next_payment_due: string
  is_active: boolean
}

/** Add a kit (optionally from an account seen in email) or edit an existing one. */
export type KitDialogTarget =
  | { mode: "create"; from?: UnmatchedStarlinkAccount }
  | { mode: "edit"; kit: StarlinkKitListRow }

function initialForm(target: KitDialogTarget | null): KitForm {
  if (target?.mode === "edit") {
    const { kit } = target
    return {
      site_name: kit.site_name,
      state: kit.state ?? "",
      account_number: kit.serial_number ?? "",
      kit_number: kit.kit_number ?? "",
      email: kit.email ?? "",
      project_id: kit.project?.id ?? NO_PROJECT,
      amount: kit.payment ? String(kit.payment.amount) : "",
      next_payment_due: kit.payment?.next_payment_due?.slice(0, 10) ?? "",
      is_active: kit.is_active,
    }
  }
  const from = target?.from
  // "oloyan@org.acoblighting.com" suggests the kit's name.
  const guessedName = from?.recipient_email?.split("@")[0] ?? ""
  return {
    site_name: guessedName ? guessedName.charAt(0).toUpperCase() + guessedName.slice(1) : "",
    state: "",
    account_number: from?.account_number ?? "",
    kit_number: "",
    email: from?.recipient_email ?? "",
    project_id: NO_PROJECT,
    amount: from?.amount != null ? String(from.amount) : "",
    next_payment_due: from?.first_period_start ?? "",
    is_active: true,
  }
}

export function KitDialog({
  target,
  onOpenChange,
  onSaved,
}: {
  target: KitDialogTarget | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<KitForm>(() => initialForm(target))
  const [saving, setSaving] = useState(false)
  const isEdit = target?.mode === "edit"

  useEffect(() => {
    setForm(initialForm(target))
  }, [target])

  const { data: projects = [] } = useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: fetchProjectRecords,
    enabled: target !== null,
  })

  const set = <K extends keyof KitForm>(key: K, value: KitForm[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async () => {
    if (!target) return
    setSaving(true)
    try {
      const projectId = form.project_id === NO_PROJECT ? null : form.project_id
      const res =
        target.mode === "edit"
          ? await apiFetch(`/api/starlink/kits/${target.kit.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                site_name: form.site_name,
                state: form.state || null,
                kit_number: form.kit_number || null,
                email: form.email || null,
                project_id: projectId,
                is_active: form.is_active,
              }),
            })
          : await apiFetch("/api/starlink/kits", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                site_name: form.site_name,
                state: form.state || null,
                account_number: form.account_number,
                kit_number: form.kit_number || null,
                email: form.email || null,
                project_id: projectId,
                amount: form.amount,
                next_payment_due: form.next_payment_due,
              }),
            })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(json?.error || "Could not save the kit")
        return
      }
      const filed = json?.data?.synced?.byOutcome?.applied
      toast.success(
        isEdit
          ? "Kit updated"
          : filed
            ? `Kit added and ${filed} of its Starlink emails filed`
            : "Kit added. Its Starlink emails will be filed within the hour"
      )
      onSaved()
      onOpenChange(false)
    } catch {
      toast.error("Could not save the kit")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Starlink Kit" : "Add Starlink Kit"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Change the kit's details or the project it serves. Its payments move with it."
              : "Adds the kit and its monthly payment. Its bills in the ict mailbox are filed straight away."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="kit-name">Kit name</Label>
            <Input
              id="kit-name"
              value={form.site_name}
              onChange={(e) => set("site_name", e.target.value)}
              placeholder="e.g. Oloyan"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Project</Label>
            <Select value={form.project_id} onValueChange={(v) => set("project_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT}>No project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.project_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kit-account">Starlink account</Label>
            <Input
              id="kit-account"
              value={form.account_number}
              onChange={(e) => set("account_number", e.target.value)}
              placeholder="ACC-..."
              disabled={isEdit}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kit-number">Kit number</Label>
            <Input
              id="kit-number"
              value={form.kit_number}
              onChange={(e) => set("kit_number", e.target.value)}
              placeholder="KIT... (optional)"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kit-email">Login email</Label>
            <Input
              id="kit-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="site@org.acoblighting.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kit-state">State</Label>
            <Input id="kit-state" value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="Edo" />
          </div>

          {isEdit ? (
            <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-muted-foreground text-xs">Turn off for a kit whose service has ended.</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="kit-amount">Monthly amount (NGN)</Label>
                <Input
                  id="kit-amount"
                  type="number"
                  min={0}
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  placeholder="57000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kit-due">First billing date</Label>
                <Input
                  id="kit-due"
                  type="date"
                  value={form.next_payment_due}
                  onChange={(e) => set("next_payment_due", e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={saving}>
            {isEdit ? "Save" : "Add Kit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
