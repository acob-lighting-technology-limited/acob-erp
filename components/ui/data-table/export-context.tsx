"use client"

import { createContext } from "react"
import type { TableExportOptions } from "@/lib/export/table-export"

/** Header destination lets a table export its own state without lifting that state into pages. */
export const TableExportContext = createContext<{
  config?: TableExportOptions | false
  slot: HTMLDivElement | null
} | null>(null)
