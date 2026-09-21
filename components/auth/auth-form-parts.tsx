"use client"

import type React from "react"
import { useId, useRef, useState, type ComponentType, type ReactNode } from "react"
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * Form primitives shared by the `/auth/*` pages so every screen gets the same
 * field, message and switcher treatment.
 */

type IconType = ComponentType<{ className?: string }>

type AuthFieldProps = {
  label: string
  icon: IconType
  /** Rendered on the label row, e.g. a "Forgot password?" link. */
  action?: ReactNode
  hint?: string
  id?: string
} & Omit<React.ComponentProps<typeof Input>, "id" | "className">

/** Labelled input with a leading icon. */
export function AuthField({ label, icon: Icon, action, hint, id, ...inputProps }: AuthFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={fieldId} className="text-xs font-medium tracking-wide">
          {label}
        </Label>
        {action}
      </div>
      <div className="relative">
        <Icon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
        <Input id={fieldId} {...inputProps} className="h-12 rounded-xl pl-10.5" />
      </div>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  )
}

type AuthPasswordFieldProps = Omit<AuthFieldProps, "type"> & { revealLabel?: string }

/** Password input with a leading icon and a show/hide toggle. */
export function AuthPasswordField({ revealLabel = "password", ...props }: AuthPasswordFieldProps) {
  const { label, icon: Icon, action, hint, id, ...inputProps } = props
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const [visible, setVisible] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={fieldId} className="text-xs font-medium tracking-wide">
          {label}
        </Label>
        {action}
      </div>
      <div className="relative">
        <Icon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
        <Input
          id={fieldId}
          {...inputProps}
          type={visible ? "text" : "password"}
          className="h-12 rounded-xl pr-11 pl-10.5"
        />
        <button
          type="button"
          aria-label={visible ? `Hide ${revealLabel}` : `Show ${revealLabel}`}
          aria-pressed={visible}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setVisible((current) => !current)}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg transition-colors"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  )
}

/** Inline status message — replaces the old full-width tinted alert boxes. */
export function AuthNotice({
  variant = "error",
  children,
  className,
}: {
  variant?: "error" | "success"
  children: ReactNode
  className?: string
}) {
  const isError = variant === "error"
  const Icon = isError ? AlertCircle : CheckCircle2

  return (
    <p
      role={isError ? "alert" : "status"}
      aria-live="polite"
      className={cn(
        "flex items-start gap-2 text-sm leading-5",
        isError ? "text-destructive" : "text-primary",
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

type AuthMethodOption = { value: string; label: string; icon: IconType }

/** Two-up segmented control with a sliding indicator. */
export function AuthMethodSwitch({
  options,
  value,
  onChange,
  className,
}: {
  options: [AuthMethodOption, AuthMethodOption]
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  )

  return (
    <div role="tablist" className={cn("bg-muted/60 relative grid grid-cols-2 rounded-xl p-1", className)}>
      <span
        aria-hidden="true"
        className="bg-background border-border/60 absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg border shadow-sm transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {options.map((option) => {
        const selected = option.value === value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors",
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Six one-time-code boxes with paste, auto-advance and backspace handling. */
export function AuthOtpInput({
  digits,
  onChange,
  onComplete,
  autoFocus = true,
}: {
  digits: string[]
  onChange: (digits: string[]) => void
  onComplete?: (code: string) => void
  autoFocus?: boolean
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const commit = (next: string[]) => {
    onChange(next)
    if (next.every((digit) => digit !== "")) onComplete?.(next.join(""))
  }

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1)
    const next = [...digits]
    next[index] = digit
    if (digit && index < digits.length - 1) refs.current[index + 1]?.focus()
    commit(next)
  }

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) refs.current[index - 1]?.focus()
    if (event.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus()
    if (event.key === "ArrowRight" && index < digits.length - 1) refs.current[index + 1]?.focus()
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, digits.length)
    if (!pasted) return
    const next = [...digits]
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    const firstEmpty = next.findIndex((digit) => digit === "")
    refs.current[firstEmpty === -1 ? digits.length - 1 : firstEmpty]?.focus()
    commit(next)
  }

  return (
    <div className="flex justify-between gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={`Digit ${index + 1}`}
          maxLength={1}
          value={digit}
          autoFocus={autoFocus && index === 0}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => event.target.select()}
          onPaste={index === 0 ? handlePaste : undefined}
          className={cn(
            "border-input bg-background/60 focus-visible:border-primary focus-visible:ring-primary/30 h-13 w-full rounded-xl border text-center font-mono text-xl font-semibold transition-all focus-visible:ring-2 focus-visible:outline-none",
            digit && "border-primary/50"
          )}
        />
      ))}
    </div>
  )
}
