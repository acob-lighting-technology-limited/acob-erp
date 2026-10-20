import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        // Status tones — theme tokens from globals.css, correct in light and dark.
        success: "border-success/25 bg-success-muted text-success-foreground",
        warning: "border-warning/30 bg-warning-muted text-warning-foreground",
        info: "border-info/25 bg-info-muted text-info-foreground",
        danger: "border-danger/25 bg-danger-muted text-danger-foreground",
        neutral: "border-neutral/25 bg-neutral-muted text-neutral-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

// A <span>, not a <div>: badges sit inside paragraphs and table cells, where a
// block element is invalid HTML and causes hydration warnings.
function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
