"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface CopyButtonProps {
  /** The text written to the clipboard. */
  value: string
  /** What is being copied, for the screen-reader label and the toast, e.g. "account number". */
  label: string
  className?: string
}

/** A small icon button that copies a value to the clipboard, ticks for two seconds and confirms with a toast. */
export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      toast.error(`Could not copy ${label}`)
      return
    }
    setCopied(true)
    toast.success(`Copied ${label}`)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      className={cn(
        "text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring inline-flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors focus-visible:ring-2 focus-visible:outline-none",
        className
      )}
    >
      {copied ? <Check className="text-success h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}
