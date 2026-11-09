"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { setOverrideConfirmer } from "@/lib/override-confirm"

/** "all": may change everything in the section. Otherwise the route keys the person may change. */
type Editable = "all" | string[]

const EditAccessContext = createContext<Editable>("all")

interface EditAccessProviderProps {
  editable: Editable
  /** The person is changing things here as an override, not as an owner or for one. */
  override?: boolean
  children: React.ReactNode
}

/**
 * Set by the guarded layouts (see EditAccessBoundary) so client screens can hide the buttons a
 * view-only person cannot use. Outside those layouts (staff screens, the department console)
 * nothing is provided and everything stays available: the server is what refuses a change, this
 * only stops us offering one that will be refused.
 *
 * For an override holder it also asks "are you sure" before anything that cannot be undone.
 */
export function EditAccessProvider({ editable, override = false, children }: EditAccessProviderProps) {
  const [open, setOpen] = useState(false)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const ask = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve
        setOpen(true)
      }),
    []
  )

  useEffect(() => {
    if (!override) return
    setOverrideConfirmer(ask)
    return () => setOverrideConfirmer(null)
  }, [override, ask])

  function settle(ok: boolean) {
    setOpen(false)
    resolver.current?.(ok)
    resolver.current = null
  }

  return (
    <EditAccessContext.Provider value={editable}>
      {children}
      {override && (
        <AlertDialog open={open} onOpenChange={(next) => !next && settle(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>You are acting as an override</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone, and it will be recorded as an override and shown to the area&apos;s owners.
                Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => settle(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => settle(true)}>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </EditAccessContext.Provider>
  )
}

/** Whether the current person may change things on `route` (an admin route key such as "hr.attendance"). */
export function useCanEdit(route: string): boolean {
  const editable = useContext(EditAccessContext)
  return editable === "all" || editable.includes(route)
}
