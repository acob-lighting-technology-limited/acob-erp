"use client"

import { motion } from "framer-motion"
import type { Position } from "@/components/watermark-studio"
import { cn } from "@/lib/utils"

interface PositionGridProps {
  selected: Position
  onSelect: (position: Position) => void
}

const positions: { value: Position; label: string }[] = [
  { value: "top-left", label: "Top Left" },
  { value: "top-center", label: "Top Center" },
  { value: "top-right", label: "Top Right" },
  { value: "middle-left", label: "Middle Left" },
  { value: "center", label: "Center" },
  { value: "center-down-10", label: "Center Down 10%" },
  { value: "center-down-20", label: "Center Down 20%" },
  { value: "center-down-25", label: "Center Down 25%" },
  { value: "middle-right", label: "Middle Right" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "bottom-center", label: "Bottom Center" },
  { value: "bottom-right", label: "Bottom Right" },
]

export function PositionGrid({ selected, onSelect }: PositionGridProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {positions.map(({ value, label }) => (
        <motion.button
          key={value}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(value)}
          className={cn(
            "relative h-16 overflow-hidden rounded-lg border-[0.5px] text-xs font-medium transition-all duration-200",
            selected === value
              ? "border-primary bg-primary/15 text-primary ring-primary/40 shadow-[0_0_0_2px_rgba(0,0,0,0.02)] ring-2"
              : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/50 hover:bg-secondary"
          )}
        >
          {label}
          {selected === value ? <span className="bg-primary/5 pointer-events-none absolute inset-0" /> : null}
        </motion.button>
      ))}
    </div>
  )
}
