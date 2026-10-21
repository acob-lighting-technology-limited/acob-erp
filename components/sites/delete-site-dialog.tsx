"use client"

import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
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
import { apiJson } from "@/lib/api-client"
import type { SiteRecord } from "@/lib/sites/records"

export function DeleteSiteDialog({
  site,
  onOpenChange,
  onDeleted,
}: {
  site: SiteRecord | null
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}) {
  const remove = useMutation({
    mutationFn: (id: string) => apiJson(`/api/sites/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(`Deleted ${site?.name ?? "site"}`)
      onDeleted()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete the site"),
  })

  const documentCount = site?.documents.length ?? 0

  return (
    <AlertDialog open={site !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this site?</AlertDialogTitle>
          <AlertDialogDescription>
            {`"${site?.name ?? ""}"`}
            {documentCount > 0 ? ` and its ${documentCount} document record${documentCount === 1 ? "" : "s"}` : ""} will
            be permanently removed from the register. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" loading={remove.isPending} onClick={() => site && remove.mutate(site.id)}>
            Delete Site
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
