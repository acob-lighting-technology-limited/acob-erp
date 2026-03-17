"use client"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ProjectDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectName?: string
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}

export function ProjectDeleteDialog({
  open,
  onOpenChange,
  projectName,
  onConfirm,
  onCancel,
  isDeleting,
}: ProjectDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the project &quot;{projectName}&quot;. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <Button onClick={onConfirm} disabled={isDeleting} className="bg-red-600 text-white hover:bg-red-700">
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
