"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * Shows an abbreviation's expansion on hover — "KSS", "SOPs", "KPI" and the
 * like carry no meaning for someone new, and the sidebar has no room to spell
 * them out. Renders the child untouched when there is nothing to explain.
 */
export function NavLabelTooltip({ description, children }: { description?: string; children: React.ReactNode }) {
  if (!description) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{description}</TooltipContent>
    </Tooltip>
  )
}
