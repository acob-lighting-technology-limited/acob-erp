import * as React from "react"

import { Button, type ButtonProps } from "@/components/ui/button"

/**
 * A square icon-only button. `label` is required: it becomes the accessible name
 * (screen readers) and the hover title, so an icon button can never ship unnamed.
 */
export interface IconButtonProps extends Omit<ButtonProps, "size" | "children" | "aria-label"> {
  label: string
  children: React.ReactNode
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(({ label, children, ...props }, ref) => (
  <Button ref={ref} size="icon" aria-label={label} title={label} {...props}>
    {children}
  </Button>
))
IconButton.displayName = "IconButton"
