"use client"

import { useState } from "react"
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
import { apiFetch } from "@/lib/api-client"
import type { Portfolio } from "./portfolios-content"

export function DeletePortfolioDialog({
  portfolio,
  onOpenChange,
  onDeleted,
  onManageProjects,
}: {
  portfolio: Portfolio | null
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
  onManageProjects: (portfolio: Portfolio) => void
}) {
  const [isDeleting, setIsDeleting] = useState(false)
  const projectCount = portfolio?.projects.length ?? 0
  const label = portfolio ? (portfolio.code ? `${portfolio.code} — ${portfolio.name}` : portfolio.name) : ""

  async function handleDelete() {
    if (!portfolio) return
    setIsDeleting(true)
    try {
      const res = await apiFetch(`/api/portfolios/${portfolio.id}`, { method: "DELETE" })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to delete portfolio")
      toast.success(`Deleted ${portfolio.name}`)
      onDeleted()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete portfolio")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={portfolio !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {projectCount > 0 ? "Portfolio still has projects" : "Delete this portfolio?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {projectCount > 0
              ? `"${label}" still holds ${projectCount} project${projectCount === 1 ? "" : "s"}. Remove or move them to another portfolio before deleting it.`
              : `"${label}" will be permanently deleted. This cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          {projectCount > 0 ? (
            <Button onClick={() => portfolio && onManageProjects(portfolio)}>Manage Projects</Button>
          ) : (
            <Button onClick={handleDelete} loading={isDeleting} variant="destructive">
              Delete Portfolio
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
