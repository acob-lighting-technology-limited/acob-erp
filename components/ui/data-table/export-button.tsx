"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { logger } from "@/lib/logger"
import {
  exportTable,
  type TableExportColumn,
  type TableExportFormat,
  type TableExportOptions,
} from "@/lib/export/table-export"

const log = logger("table-export")

export function TableExportButton<T>({
  rows,
  columns,
  config,
  slot,
  disabled,
}: {
  rows: readonly T[]
  columns: readonly TableExportColumn<T>[]
  config: TableExportOptions
  slot?: HTMLDivElement | null
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const formats = Array.from(new Set<TableExportFormat>(config.formats ?? ["csv", "xlsx", "pdf"]))
  const handleExport = async (format: TableExportFormat) => {
    setBusy(true)
    try {
      await exportTable(rows, columns, config, format)
      toast.success("Export downloaded")
    } catch (error) {
      log.error({ err: String(error) }, "Table export failed")
      toast.error("Could not export these records. Please try again.")
    } finally {
      setBusy(false)
    }
  }
  if (!formats.length) return null
  const button = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy || disabled || !columns.some((c) => c.accessor)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formats.map((format) => (
          <DropdownMenuItem
            key={format}
            onSelect={() => {
              void handleExport(format)
            }}
          >
            Download {format.toUpperCase()}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
  return slot ? createPortal(button, slot) : <div className="flex justify-end">{button}</div>
}
