import { ChevronRight } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export function SidebarSubmenuToggle({ name, open, onToggle }: { name: string; open: boolean; onToggle: () => void }) {
  const label = `${open ? "Collapse" : "Expand"} ${name}`
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center px-1.5 py-1.5"
          aria-expanded={open}
          aria-label={label}
        >
          <ChevronRight className={cn("h-3 w-3 shrink-0 transition-transform duration-200", open && "rotate-90")} />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
