/**
 * Breadcrumb Navigation Component
 * Navigation for OneDrive folder paths
 */

"use client"

import { ChevronRight, Home } from "lucide-react"

interface BreadcrumbNavProps {
  path: string
  onNavigate: (path: string) => void
  rootLabel?: string
}

export function BreadcrumbNav({ path, onNavigate, rootLabel = "OneDrive" }: BreadcrumbNavProps) {
  const parts = path.split("/").filter(Boolean)

  const breadcrumbs = [
    { label: rootLabel, path: "/" },
    ...parts.map((part, index) => ({
      label: part,
      path: "/" + parts.slice(0, index + 1).join("/"),
    })),
  ]

  return (
    <nav className="flex items-center gap-1 overflow-x-auto pb-1 text-sm">
      {breadcrumbs.map((crumb, index) => (
        <span key={crumb.path} className="flex shrink-0 items-center">
          {index > 0 && <ChevronRight className="text-muted-foreground mx-1 h-4 w-4" />}
          {index === breadcrumbs.length - 1 ? (
            <span className="text-foreground flex items-center gap-1 font-medium">
              {index === 0 && <Home className="h-4 w-4" />}
              {crumb.label}
            </span>
          ) : (
            <button
              onClick={() => onNavigate(crumb.path)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors hover:underline"
            >
              {index === 0 && <Home className="h-4 w-4" />}
              {crumb.label}
            </button>
          )}
        </span>
      ))}
    </nav>
  )
}
