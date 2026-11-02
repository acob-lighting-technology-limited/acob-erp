"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { formatName } from "@/lib/utils"
import { apiFetch } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { describeExitBlockers, type ExitBlockers } from "@/lib/hr/exit-blockers"
import type { Employee } from "@/app/admin/hr/employees/admin-employee-content"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: Pick<Employee, "id" | "first_name" | "last_name">[]
  isExiting: boolean
  onConfirm: (notifyAllStaff: boolean) => Promise<void>
}

/** One exit confirmation that states every consequence, emails included. */
export function ExitConfirmDialog({ open, onOpenChange, employees, isExiting, onConfirm }: Props) {
  const [notifyAllStaff, setNotifyAllStaff] = useState(false)
  // Each opening starts with the all-staff announcement off.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setNotifyAllStaff(false)
  }

  // What the exit will release for each person, so the dialog can say exactly
  // what happens (and which emails go out) before anything is done.
  const ids = employees.map((e) => e.id).sort()
  const { data: blockersById = {}, isLoading } = useQuery({
    queryKey: QUERY_KEYS.exitBlockers(ids),
    enabled: open && ids.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          const res = await apiFetch(`/api/v1/hr/employees/${id}/status`)
          const body = (await res.json().catch(() => ({}))) as { blockers?: ExitBlockers }
          return [id, body.blockers ?? null] as const
        })
      )
      return Object.fromEntries(entries) as Record<string, ExitBlockers | null>
    },
  })
  const assetCount = Object.values(blockersById).reduce((sum, b) => sum + (b?.assets ?? 0), 0)

  return (
    <AlertDialog open={open} onOpenChange={(v) => !isExiting && onOpenChange(v)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Exit {employees.length} employee{employees.length > 1 ? "s" : ""}?
          </AlertDialogTitle>
          <AlertDialogDescription>Here is exactly what happens when you confirm.</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 text-sm">
          <ul className="divide-border divide-y rounded-lg border">
            {employees.map((emp) => {
              const blockers = blockersById[emp.id]
              const summary = blockers ? describeExitBlockers(blockers) : ""
              return (
                <li key={emp.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="truncate font-medium">
                    {formatName(emp.first_name)} {formatName(emp.last_name)}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {isLoading ? "Checking…" : summary ? `Releases ${summary}` : "Nothing to release"}
                  </span>
                </li>
              )
            })}
          </ul>

          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-xs">
            <li>Their access is removed right away and any suspension is closed.</li>
            {assetCount > 0 && (
              <li>
                Each returned asset sends the employee a return receipt email ({assetCount} in total). No one else is
                emailed about assets.
              </li>
            )}
            <li>{notifyAllStaff ? "All staff will be emailed about this exit." : "No one else is emailed."}</li>
          </ul>

          <label className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3">
            <Checkbox
              checked={notifyAllStaff}
              onCheckedChange={(v) => setNotifyAllStaff(v === true)}
              disabled={isExiting}
              className="mt-0.5"
            />
            <span>
              <span className="block font-medium">Announce to all staff</span>
              <span className="text-muted-foreground block text-xs">
                Sends an all-staff email and an in-app notice that{" "}
                {employees.length === 1 ? "this person has" : "these people have"} left.
              </span>
            </span>
          </label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isExiting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            loading={isExiting}
            onClick={async () => {
              await onConfirm(notifyAllStaff)
            }}
          >
            {notifyAllStaff ? "Exit and notify staff" : "Exit"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
