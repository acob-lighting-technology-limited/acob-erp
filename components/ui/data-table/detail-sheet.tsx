"use client"
import { useCallback } from "react"
import { toast } from "sonner"
import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { Copy } from "lucide-react"
import type { useDataTableState } from "./use-data-table-state"

export function DataTableDetailSheet<TData>({ state }: { state: ReturnType<typeof useDataTableState<TData>> }) {
  const { detailRow, setDetailRow, detailConfig } = state
  const copyField = useCallback((value: string, label: string) => {
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success(`Copied ${label.toLowerCase()}`, { description: value }))
      .catch(() => toast.error("Clipboard access was blocked"))
  }, [])
  const detailSheet = detailConfig ? (
    <Sheet open={detailRow !== null} onOpenChange={(open) => !open && setDetailRow(null)}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto px-4 sm:px-6">
        {detailRow && (
          <div className="mx-auto w-full max-w-lg space-y-4 py-2">
            <SheetHeader className="items-center text-center">
              {detailConfig.avatar?.(detailRow)}
              <SheetTitle className="mt-1 text-base">{detailConfig.title(detailRow)}</SheetTitle>
              {detailConfig.subtitle && (
                <div className="text-muted-foreground text-sm">{detailConfig.subtitle(detailRow)}</div>
              )}
              {detailConfig.badges && (
                <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                  {detailConfig.badges(detailRow)}
                </div>
              )}
            </SheetHeader>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {detailConfig.fields(detailRow).map((field) => {
                if (!field.value) return null
                const canOpen = Boolean(field.href)
                const canCopy = !canOpen && Boolean(field.copyable)
                const Icon = field.icon
                const strValue = String(field.value)
                const isLong =
                  Boolean(field.fullWidth) ||
                  (field.colSpan != null && field.colSpan > 1) ||
                  strValue.length > 35 ||
                  strValue.includes("\n") ||
                  canOpen
                const spanClass =
                  field.fullWidth || (isLong && !field.colSpan)
                    ? "col-span-2 sm:col-span-3"
                    : field.colSpan === 3
                      ? "col-span-2 sm:col-span-3"
                      : field.colSpan === 2
                        ? "col-span-2"
                        : "col-span-1"

                const tileContent = (
                  <div className="flex h-full min-w-0 flex-col justify-between">
                    <div className="text-muted-foreground flex items-center gap-1.5">
                      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate text-xs font-medium tracking-tight">{field.label}</span>
                      {canOpen && <ExternalLink className="text-primary/70 ml-auto h-3 w-3 shrink-0" />}
                      {canCopy && <Copy className="text-muted-foreground ml-auto h-3 w-3 shrink-0" />}
                    </div>
                    <span
                      className={cn(
                        "mt-1.5 block text-xs leading-snug font-medium break-words",
                        field.muted && "text-muted-foreground font-normal",
                        canOpen && "text-primary font-medium hover:underline",
                        isLong && "text-xs font-normal whitespace-pre-wrap"
                      )}
                    >
                      {field.value}
                    </span>
                  </div>
                )

                if (canOpen) {
                  return (
                    <a
                      key={field.label}
                      href={field.href}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        "hover:bg-muted/40 bg-muted/20 focus-visible:ring-ring rounded-lg border p-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                        spanClass
                      )}
                    >
                      {tileContent}
                    </a>
                  )
                }

                return canCopy ? (
                  <button
                    key={field.label}
                    type="button"
                    onClick={() => copyField(strValue, field.label)}
                    className={cn(
                      "hover:bg-muted/40 bg-muted/20 focus-visible:ring-ring rounded-lg border p-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                      spanClass
                    )}
                  >
                    {tileContent}
                  </button>
                ) : (
                  <div key={field.label} className={cn("bg-muted/20 rounded-lg border p-2.5 text-left", spanClass)}>
                    {tileContent}
                  </div>
                )
              })}
            </div>

            {detailConfig.actions && detailConfig.actions(detailRow).length > 0 && (
              <SheetFooter className="flex-row gap-2 pt-2">
                {detailConfig.actions(detailRow).map((action) => {
                  const Icon = action.icon
                  return action.href ? (
                    <Button
                      key={action.label}
                      asChild
                      variant={action.variant ?? "default"}
                      className={cn("flex-1 gap-2", action.className)}
                    >
                      <a href={action.href} onClick={() => setDetailRow(null)}>
                        {Icon && <Icon className="h-4 w-4" />}
                        {action.label}
                      </a>
                    </Button>
                  ) : (
                    <Button
                      key={action.label}
                      variant={action.variant ?? "default"}
                      className={cn("flex-1 gap-2", action.className)}
                      onClick={() => {
                        setDetailRow(null)
                        action.onClick?.()
                      }}
                    >
                      {Icon && <Icon className="h-4 w-4" />}
                      {action.label}
                    </Button>
                  )
                })}
              </SheetFooter>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  ) : null

  // ─── Render ───────────────────────────────────────────────────────────────

  return detailSheet
}
