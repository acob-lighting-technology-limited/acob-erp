"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { LeaveRequest } from "@/app/(app)/leave/page"

interface LeaveDeleteConfirmDialogProps {
  request: LeaveRequest | null
  onOpenChange: (open: boolean) => void
  onConfirm: (request: LeaveRequest) => void
}

export function LeaveDeleteConfirmDialog({ request, onOpenChange, onConfirm }: LeaveDeleteConfirmDialogProps) {
  return (
    <AlertDialog
      open={!!request}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Leave Request</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this leave request? This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (request) onConfirm(request)
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
