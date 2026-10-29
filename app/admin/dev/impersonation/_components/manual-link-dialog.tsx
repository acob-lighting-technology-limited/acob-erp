"use client"

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

interface ManualLinkDialogProps {
  link: string | null
  onClose: () => void
}

/** Shown when the browser blocks clipboard access, so the link can still be copied by hand. */
export function ManualLinkDialog({ link, onClose }: ManualLinkDialogProps) {
  return (
    <Dialog open={link !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Copy login link</DialogTitle>
          <DialogDescription>The browser blocked clipboard access. Select the link and copy it.</DialogDescription>
        </DialogHeader>
        <Input readOnly value={link ?? ""} onFocus={(event) => event.currentTarget.select()} aria-label="Login link" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
