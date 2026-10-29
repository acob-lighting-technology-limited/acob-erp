"use client"

import type { Dispatch, SetStateAction } from "react"
import { Button } from "@/components/ui/button"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface CannotCreateNewRequestDialogProps {
  isCreateBlockedOpen: boolean
  setIsCreateBlockedOpen: Dispatch<SetStateAction<boolean>>
}

export function CannotCreateNewRequestDialog({
  isCreateBlockedOpen,
  setIsCreateBlockedOpen,
}: CannotCreateNewRequestDialogProps) {
  return (
    <Dialog open={isCreateBlockedOpen} onOpenChange={setIsCreateBlockedOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cannot Create New Request</DialogTitle>
          <DialogDescription>
            You already have an ongoing leave request. Submit a new one only after the current request is approved,
            rejected, or cancelled.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button onClick={() => setIsCreateBlockedOpen(false)}>Okay</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
