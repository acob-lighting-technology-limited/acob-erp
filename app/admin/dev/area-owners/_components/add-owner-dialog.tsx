"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
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
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiFetch } from "@/lib/api-client"

export interface OwnerCandidates {
  candidates: Array<{ id: string; name: string; role: string; department: string | null }>
  areas: Array<{ value: string; label: string }>
}

interface AddOwnerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  options: OwnerCandidates | undefined
  onAdded: () => void
}

/** Name an owner of a guarded area. They must be an active admin, super admin or developer. */
export function AddOwnerDialog({ open, onOpenChange, options, onAdded }: AddOwnerDialogProps) {
  const [area, setArea] = useState("")
  const [userId, setUserId] = useState("")

  const add = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/admin/dev/area-owners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, userId }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error || "Could not add the owner")
      }
    },
    onSuccess: () => {
      toast.success("Owner added")
      onOpenChange(false)
      setArea("")
      setUserId("")
      onAdded()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add an owner</DialogTitle>
          <DialogDescription>
            The person must be an active admin, super admin or developer. An area can have more than one owner.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Area</Label>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an area" />
              </SelectTrigger>
              <SelectContent>
                {(options?.areas ?? []).map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Owner</Label>
            <SearchableSelect
              value={userId}
              onValueChange={setUserId}
              placeholder="Choose a person"
              searchPlaceholder="Search people..."
              options={(options?.candidates ?? []).map((person) => ({
                value: person.id,
                label: `${person.name} (${person.role.replace("_", " ")})`,
              }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => add.mutate()} disabled={!area || !userId || add.isPending}>
            {add.isPending ? "Saving..." : "Add owner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
