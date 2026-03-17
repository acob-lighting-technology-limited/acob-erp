"use client"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { Task } from "@/app/admin/tasks/management/admin-tasks-content"

interface TaskDeleteDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  taskToDelete: Task | null
  onConfirm: () => void
  isDeleting: boolean
}

export function TaskDeleteDialog({ isOpen, onOpenChange, taskToDelete, onConfirm, isDeleting }: TaskDeleteDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the task &quot;{taskToDelete?.title}&quot;. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button onClick={onConfirm} loading={isDeleting} className="bg-red-600 text-white hover:bg-red-700">
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
