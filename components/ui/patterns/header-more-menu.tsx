"use client"

import type { LucideIcon } from "lucide-react"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export interface HeaderMoreItem {
  label: string
  icon?: LucideIcon
  onSelect: () => void
  disabled?: boolean
  /** Hide the item without removing it from the call site's condition. */
  hidden?: boolean
}

/**
 * The "More" menu for a page header: secondary actions live here so the header
 * shows one main button. Pass `PageHeader`'s primary action beside it, not in it.
 */
export function HeaderMoreMenu({ items }: { items: HeaderMoreItem[] }) {
  const visible = items.filter((item) => !item.hidden)
  if (!visible.length) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2">
          <MoreHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">More</span>
          <span className="sr-only sm:hidden">More actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {visible.map(({ label, icon: Icon, onSelect, disabled }) => (
          <DropdownMenuItem key={label} disabled={disabled} onSelect={onSelect}>
            {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
