"use client"

import { CircleHelp } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * A help icon beside a column header, explaining what the column's figure
 * means. Clicks stop here so a sortable header does not re-sort when the
 * reader only wanted the explanation.
 */
export function ColumnHelp({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`What does ${label} mean?`}
          className="text-muted-foreground/60 hover:text-foreground focus-visible:ring-ring inline-flex shrink-0 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-left font-normal normal-case">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}
