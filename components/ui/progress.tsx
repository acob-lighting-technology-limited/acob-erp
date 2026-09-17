"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

/**
 * The track is a neutral grey, never a brand colour: a coloured track reads as
 * filled, so an empty bar would look full.
 */
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }
>(({ className, indicatorClassName, value, ...props }, ref) => {
  const pct = Math.min(100, Math.max(0, value || 0))
  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn("bg-muted relative h-2 w-full overflow-hidden rounded-full", className)}
      value={pct}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn("bg-primary h-full rounded-full transition-all", indicatorClassName)}
        style={{ width: `${pct}%` }}
      />
    </ProgressPrimitive.Root>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
