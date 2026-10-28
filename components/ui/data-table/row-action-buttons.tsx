"use client"

import { Button } from "@/components/ui/button"
import type { RowAction } from "./types"

/** A row's actions as visible buttons, for rows that have only a couple and should not hide them in a menu. */
export function RowActionButtons<TData>({ actions, row }: { actions: RowAction<TData>[]; row: TData }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {actions.map((action) => (
        <Button
          key={action.label}
          size="sm"
          variant={action.variant === "destructive" ? "destructive" : "outline"}
          onClick={() => action.onClick(row)}
          className="h-7 gap-1 px-2 text-xs"
        >
          {action.icon && <action.icon className="h-3.5 w-3.5" />}
          {action.label}
        </Button>
      ))}
    </div>
  )
}
