"use client"

import { useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export interface PromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string | React.ReactNode
  label?: string
  placeholder?: string
  inputType?: "text" | "textarea" | "url"
  required?: boolean
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  onConfirm: (value: string) => void
  onCancel?: () => void
}

/**
 * Accessible Dialog-based replacement for window.prompt().
 * Supports text, textarea, and URL input types.
 * Auto-focuses the input on open; Ctrl/Cmd+Enter confirms.
 */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  inputType = "text",
  required = false,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "default",
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  // Reset value whenever dialog opens
  useEffect(() => {
    if (open) setValue("")
  }, [open])

  // Auto-focus input when dialog opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  function handleConfirm() {
    if (required && !value.trim()) return
    onConfirm(value)
    setValue("")
  }

  function handleCancel() {
    setValue("")
    onCancel?.()
    onOpenChange(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (inputType !== "textarea" || e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleConfirm()
    }
    if (e.key === "Escape") {
      handleCancel()
    }
  }

  const isDisabled = required && !value.trim()

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-2 py-2">
          {label && <Label htmlFor="prompt-input">{label}{required && <span className="text-destructive ml-1">*</span>}</Label>}

          {inputType === "textarea" ? (
            <Textarea
              id="prompt-input"
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={4}
              className="resize-none"
            />
          ) : (
            <Input
              id="prompt-input"
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={inputType === "url" ? "url" : "text"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
            />
          )}
          {inputType === "textarea" && (
            <p className="text-muted-foreground text-xs">Press Ctrl+Enter to confirm</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={handleConfirm} disabled={isDisabled}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
