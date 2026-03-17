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

interface DeleteReportDialogProps {
  pendingDeleteId: string | null
  onOpenChange: (open: boolean) => void
  onConfirm: (id: string) => void
}

export function DeleteReportDialog({ pendingDeleteId, onOpenChange, onConfirm }: DeleteReportDialogProps) {
  return (
    <AlertDialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && onOpenChange(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Report</AlertDialogTitle>
          <AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (pendingDeleteId) onConfirm(pendingDeleteId)
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
