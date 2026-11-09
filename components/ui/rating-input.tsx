"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface RatingInputProps {
  value: number | null
  onChange: (value: number) => void
  min?: number
  max?: number
  disabled?: boolean
  className?: string
  buttonClassName?: string
}

export function RatingInput({
  value,
  onChange,
  min = 1,
  max = 5,
  disabled = false,
  className,
  buttonClassName,
}: RatingInputProps) {
  const values = React.useMemo(() => {
    return Array.from({ length: max - min + 1 }, (_, i) => min + i)
  }, [min, max])

  return (
    <div className={cn("grid grid-cols-5 gap-1.5", className)}>
      {values.map((v) => (
        <Button
          key={v}
          type="button"
          variant={value === v ? "default" : "outline"}
          size="sm"
          disabled={disabled}
          className={cn("h-10 w-full min-w-0 text-sm font-semibold", buttonClassName)}
          onClick={() => onChange(v)}
        >
          {v}
        </Button>
      ))}
    </div>
  )
}
