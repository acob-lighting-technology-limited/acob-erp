"use client"

import { createContext, useContext } from "react"

/** "all": may change everything in the section. Otherwise the route keys the person may change. */
type Editable = "all" | string[]

const EditAccessContext = createContext<Editable>("all")

/**
 * Set by the HR, PMS and IT layouts (see EditAccessBoundary) so client screens can hide
 * the buttons a view-only person cannot use. Outside those layouts (staff screens, the
 * department console) nothing is provided and everything stays available: the server
 * is what refuses a change, this only stops us offering one that will be refused.
 */
export function EditAccessProvider({ editable, children }: { editable: Editable; children: React.ReactNode }) {
  return <EditAccessContext.Provider value={editable}>{children}</EditAccessContext.Provider>
}

/** Whether the current person may change things on `route` (an admin route key such as "hr.attendance"). */
export function useCanEdit(route: string): boolean {
  const editable = useContext(EditAccessContext)
  return editable === "all" || editable.includes(route)
}
