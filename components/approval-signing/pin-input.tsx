"use client"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** A masked 6-digit PIN box. Digits only; never autofilled. */
export function PinInput({
  value,
  onChange,
  id,
  autoFocus,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  id?: string
  autoFocus?: boolean
  disabled?: boolean
  className?: string
  "aria-label"?: string
}) {
  return (
    <Input
      id={id}
      type="password"
      inputMode="numeric"
      autoComplete="off"
      pattern="\d{6}"
      maxLength={6}
      autoFocus={autoFocus}
      disabled={disabled}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      className={cn("max-w-[10rem] text-center font-mono text-lg tracking-[0.5em]", className)}
    />
  )
}
