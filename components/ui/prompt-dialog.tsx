"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface PromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  label?: string
  placeholder?: string
  /** Use "textarea" for multi-line input (e.g. rejection reasons) */
  inputType?: "text" | "textarea" | "url"
  required?: boolean
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: "default" | "destructive"
  onConfirm: (value: string) => void
  onCancel?: () => void
}

/**
 * A proper modal replacement for window.prompt().
 * Supports single-line and multi-line text input.
 */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  inputType = "text",
  required = true,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "default",
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  // Reset value when dialog opens
  useEffect(() => {
    if (open) {
      setValue("")
      // Focus input on next tick after dialog animation
      const t = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  function handleConfirm() {
    if (required && !value.trim()) return
    onConfirm(value.trim())
    onOpenChange(false)
  }

  function handleCancel() {
    setValue("")
    onCancel?.()
    onOpenChange(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && inputType !== "textarea") {
      e.preventDefault()
      handleConfirm()
    }
    if (e.key === "Escape") {
      handleCancel()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-2 py-2">
          {label && <Label htmlFor="prompt-input">{label}</Label>}
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
              type={inputType}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
            />
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={required && !value.trim()}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
