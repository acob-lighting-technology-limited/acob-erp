import type React from "react"
import { cn } from "@/lib/utils"

interface ContainerProps {
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

export function Container({ children, className, noPadding }: ContainerProps) {
  return (
    <div className={cn("relative mx-auto max-w-7xl px-4 2xl:container", !noPadding && "py-16", className)}>
      {children}
    </div>
  )
}
