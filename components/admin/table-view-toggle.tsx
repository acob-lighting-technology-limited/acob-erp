import { LayoutGrid, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface TableViewToggleProps {
  viewMode: "list" | "card"
  onChange: (view: "list" | "card") => void
  className?: string
}

export function TableViewToggle({ viewMode, onChange, className }: TableViewToggleProps) {
  return (
    <div className={cn("flex items-center rounded-lg border p-1", className)}>
      <Button
        variant={viewMode === "list" ? "default" : "ghost"}
        size="icon"
        onClick={() => onChange("list")}
        aria-label="List view"
        className="h-8 w-8"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant={viewMode === "card" ? "default" : "ghost"}
        size="icon"
        onClick={() => onChange("card")}
        aria-label="Card view"
        className="h-8 w-8"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  )
}
