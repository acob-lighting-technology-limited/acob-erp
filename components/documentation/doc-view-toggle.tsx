"use client"

import { Button } from "@/components/ui/button"
import { LayoutGrid, List } from "lucide-react"

interface DocViewToggleProps {
  viewMode: "list" | "card"
  onViewModeChange: (mode: "list" | "card") => void
}

export function DocViewToggle({ viewMode, onViewModeChange }: DocViewToggleProps) {
  return (
    <div className="flex items-center rounded-lg border p-1">
      <Button
        variant={viewMode === "list" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewModeChange("list")}
        className="gap-1 sm:gap-2"
      >
        <List className="h-4 w-4" />
        <span className="hidden sm:inline">List</span>
      </Button>
      <Button
        variant={viewMode === "card" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewModeChange("card")}
        className="gap-1 sm:gap-2"
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden sm:inline">Card</span>
      </Button>
    </div>
  )
}
