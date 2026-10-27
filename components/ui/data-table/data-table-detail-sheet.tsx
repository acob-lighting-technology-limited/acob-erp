"use client"

import type { ReactNode } from "react"
import { Copy, ExternalLink, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { isLongField, splitSheetActions } from "./detail-sheet-model"
import type { DataTableDetailConfig } from "./types"

interface DataTableDetailSheetProps<TData> {
  /** The row being shown; the sheet is closed while this is null. */
  row: TData | null
  config: DataTableDetailConfig<TData>
  /** The row's `expandable` panel, rendered under the fields. */
  expanded?: ReactNode
  onClose: () => void
  onCopy: (value: string, label: string) => void
}

/**
 * The phone's surface for one row: title block, badges, a flat list of fields (tap to copy or open), the
 * row's expandable panel, and footer actions. Pages supply values, never markup. Which fields and actions
 * appear is decided in detail-sheet-model.ts.
 */
export function DataTableDetailSheet<TData>({
  row,
  config,
  expanded,
  onClose,
  onCopy,
}: DataTableDetailSheetProps<TData>) {
  const fields = row ? config.fields(row).filter((field) => field.value || field.node) : []
  const actions = row && config.actions ? config.actions(row) : []
  const { visible: buttons, overflow } = splitSheetActions(actions)

  return (
    <Sheet open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col gap-0 p-0">
        {row && (
          <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col">
            <SheetHeader className="space-y-1 border-b px-4 py-3 pr-12 text-left sm:px-6">
              <div className="flex items-center gap-3">
                {config.avatar?.(row)}
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-base leading-snug">{config.title(row)}</SheetTitle>
                  {config.subtitle && <div className="text-muted-foreground text-xs">{config.subtitle(row)}</div>}
                </div>
              </div>
              {config.badges && <div className="flex flex-wrap items-center gap-1.5 pt-1">{config.badges(row)}</div>}
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
              {fields.length > 0 && (
                <ul className="divide-y">
                  {fields.map((field) => {
                    const Icon = field.icon
                    const canOpen = Boolean(field.href)
                    const canCopy = !canOpen && Boolean(field.copyable)
                    const long = isLongField(field)

                    const label = (
                      <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
                        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                        <span className="truncate">{field.label}</span>
                      </span>
                    )
                    const value = (
                      <span
                        className={cn(
                          "min-w-0 text-sm break-words",
                          !long && "text-right",
                          long && "whitespace-pre-wrap",
                          field.muted && "text-muted-foreground",
                          canOpen && "text-primary"
                        )}
                      >
                        {field.node ?? field.value}
                      </span>
                    )
                    const trailing = canOpen ? (
                      <ExternalLink className="text-primary/70 h-3.5 w-3.5 shrink-0" aria-hidden />
                    ) : canCopy ? (
                      <Copy className="text-muted-foreground/60 h-3.5 w-3.5 shrink-0" aria-hidden />
                    ) : null
                    const body = long ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          {label}
                          {trailing}
                        </div>
                        {value}
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        {label}
                        <div className="flex min-w-0 items-start gap-1.5">
                          {value}
                          {trailing}
                        </div>
                      </div>
                    )
                    const rowClass = "block w-full py-2.5 text-left"
                    const interactiveClass =
                      "hover:bg-muted/40 focus-visible:ring-ring -mx-2 w-[calc(100%+1rem)] rounded-md px-2 focus-visible:ring-2 focus-visible:outline-none"

                    return (
                      <li key={field.label}>
                        {canOpen ? (
                          <a
                            href={field.href}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(rowClass, interactiveClass)}
                          >
                            {body}
                          </a>
                        ) : canCopy && field.value ? (
                          <button
                            type="button"
                            onClick={() => onCopy(String(field.value), field.label)}
                            className={cn(rowClass, interactiveClass)}
                          >
                            {body}
                          </button>
                        ) : (
                          <div className={rowClass}>{body}</div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              {expanded && <section className="border-t py-3 text-xs">{expanded}</section>}
            </div>

            {actions.length > 0 && (
              <SheetFooter className="flex-row flex-wrap gap-2 border-t px-4 py-3 sm:px-6">
                {buttons.map((action) => {
                  const ActionIcon = action.icon
                  return action.href ? (
                    <Button
                      key={action.label}
                      asChild
                      variant={action.variant ?? "default"}
                      className={cn("min-w-0 flex-1 gap-2", action.className)}
                    >
                      <a href={action.href} onClick={onClose}>
                        {ActionIcon && <ActionIcon className="h-4 w-4" />}
                        {action.label}
                      </a>
                    </Button>
                  ) : (
                    <Button
                      key={action.label}
                      variant={action.variant ?? "default"}
                      className={cn("min-w-0 flex-1 gap-2", action.className)}
                      onClick={() => {
                        onClose()
                        action.onClick?.()
                      }}
                    >
                      {ActionIcon && <ActionIcon className="h-4 w-4" />}
                      {action.label}
                    </Button>
                  )
                })}
                {overflow.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <MoreHorizontal className="h-4 w-4" aria-hidden />
                        More
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="top">
                      {overflow.map((action) => {
                        const ActionIcon = action.icon
                        const itemClass = cn(
                          action.variant === "destructive" && "text-destructive focus:text-destructive"
                        )
                        return action.href ? (
                          <DropdownMenuItem key={action.label} asChild className={itemClass}>
                            <a href={action.href} onClick={onClose}>
                              {ActionIcon && <ActionIcon className="h-4 w-4" />}
                              {action.label}
                            </a>
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            key={action.label}
                            className={itemClass}
                            onSelect={() => {
                              onClose()
                              action.onClick?.()
                            }}
                          >
                            {ActionIcon && <ActionIcon className="h-4 w-4" />}
                            {action.label}
                          </DropdownMenuItem>
                        )
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </SheetFooter>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
