"use client"
import { ChevronRight } from "lucide-react"
import type { useDataTableState } from "./use-data-table-state"

export function DataTableContactsView<TData>({ state }: { state: ReturnType<typeof useDataTableState<TData>> }) {
  const {
    getRowId,
    expandable,
    mobileRow,
    showRowNumbers,
    setDetailRow,
    detailConfig,
    expandedRows,
    toggleExpand,
    snByRowId,
    mobileGroups,
  } = state
  const mobileList = mobileRow ? (
    <div>
      {mobileGroups.map((group, groupIdx) => (
        <div key={group.heading ?? groupIdx}>
          {group.heading && (
            <div
              className="bg-muted text-muted-foreground sticky z-[5] flex items-center justify-between gap-3 border-b px-3 py-1.5 text-xs"
              style={{ top: "var(--dt-sticky-offset, 0px)" }}
            >
              <span className="font-bold">{group.heading}</span>
              {group.summary != null && <span className="font-medium tabular-nums">{group.summary}</span>}
            </div>
          )}
          <div className="divide-y">
            {group.rows.map((row) => {
              const rowId = getRowId(row)
              const canExpand = expandable && (!expandable.canExpand || expandable.canExpand(row))
              const isExpanded = expandedRows.has(rowId)
              const sn = snByRowId.get(rowId) ?? 1

              const handleSelect = () => {
                if (detailConfig) setDetailRow(row)
                else if (mobileRow.onSelect) mobileRow.onSelect(row)
                else if (canExpand) toggleExpand(rowId)
              }

              const leadingContent = mobileRow.leading ? (
                mobileRow.leading(row, sn)
              ) : showRowNumbers ? (
                <span className="bg-muted text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-medium">
                  {sn}
                </span>
              ) : null

              return (
                <div key={rowId}>
                  <button
                    type="button"
                    onClick={handleSelect}
                    className="hover:bg-muted/40 active:bg-muted relative flex w-full items-center gap-3 py-2.5 pr-3.5 pl-3 text-left transition-colors"
                  >
                    {leadingContent && <span className="shrink-0">{leadingContent}</span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{mobileRow.title(row)}</span>
                      {mobileRow.subtitle && (
                        <span className="text-muted-foreground block truncate text-xs">{mobileRow.subtitle(row)}</span>
                      )}
                      {mobileRow.metrics && (
                        <span className="mt-1 flex gap-x-3">
                          {mobileRow.metrics(row).map((metric) => (
                            <span key={metric.label} className="flex w-16 min-w-0 flex-col">
                              <span className="text-muted-foreground text-xs leading-tight">{metric.label}</span>
                              <span className="truncate text-xs leading-tight font-semibold tabular-nums">
                                {metric.value}
                              </span>
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    {mobileRow.trailing && (
                      <span className="flex shrink-0 flex-col items-end gap-1 text-right">
                        {mobileRow.trailing(row)}
                      </span>
                    )}
                    <ChevronRight className="text-muted-foreground/50 h-4 w-4 shrink-0" />
                  </button>
                  {expandable && isExpanded && canExpand && (
                    <div className="bg-muted/30 border-t p-3">{expandable.render(row)}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  ) : null

  // ─── Standard mobile detail sheet ─────────────────────────────────────────
  // One sheet anatomy for the whole app: avatar, title, badges, tap-to-copy
  // fields, footer actions. Pages supply values, never markup.

  return mobileList
}
