"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { TablePageLayout } from "./types"

const TablePageLayoutContext = createContext<TablePageLayout | undefined>(undefined)

/**
 * Hands a route's `_layout.ts` to the `DataTablePage` rendered somewhere below
 * it, for routes whose table page lives in a shared component (one component,
 * several routes, each with its own skeleton). Pages that render
 * `DataTablePage` themselves pass `layout` directly instead.
 */
export function TablePageLayoutProvider({ value, children }: { value: TablePageLayout; children: ReactNode }) {
  return <TablePageLayoutContext.Provider value={value}>{children}</TablePageLayoutContext.Provider>
}

export function useTablePageLayout(): TablePageLayout | undefined {
  return useContext(TablePageLayoutContext)
}
