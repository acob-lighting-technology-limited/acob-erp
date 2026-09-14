"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { EventOptions } from "@/lib/events/types"
import { saveDelegate } from "./use-md-desk"

export function AddDelegateDialog({
  open,
  onOpenChange,
  staff,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff: EventOptions["staff"]
  onSaved: () => void | Promise<unknown>
}) {
  const [profileId, setProfileId] = useState("")
  const [canEdit, setCanEdit] = useState(true)
  const [saving, setSaving] = useState(false)

  const close = (next: boolean) => {
    if (!next) {
      setProfileId("")
      setCanEdit(true)
    }
    onOpenChange(next)
  }

  const submit = async () => {
    if (!profileId) {
      toast.error("Pick a staff member")
      return
    }
    setSaving(true)
    try {
      await saveDelegate(profileId, canEdit)
      toast.success("Delegate added")
      await onSaved()
      close(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add delegate")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add delegate</DialogTitle>
          <DialogDescription>
            Delegates see the MD&apos;s private events and the approvals waiting on the MD. Give edit access only to
            people who manage the MD&apos;s schedule.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Staff member</Label>
            <SearchableSelect
              value={profileId}
              onValueChange={setProfileId}
              options={staff.map((s) => ({
                value: s.id,
                label: s.department ? `${s.name} · ${s.department}` : s.name,
              }))}
              placeholder="Select a person"
              searchPlaceholder="Search staff…"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="delegate-can-edit" className="cursor-pointer">
                Can edit the MD&apos;s schedule
              </Label>
              <p className="text-muted-foreground text-xs">Create, change and cancel MD events.</p>
            </div>
            <Switch id="delegate-can-edit" checked={canEdit} onCheckedChange={setCanEdit} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => close(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !profileId}>
            {saving ? "Adding…" : "Add delegate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
