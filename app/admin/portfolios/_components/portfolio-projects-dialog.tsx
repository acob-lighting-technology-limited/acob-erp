"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Plus, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { apiFetch } from "@/lib/api-client"
import type { Portfolio, ProjectHealthRow } from "./portfolios-content"

type Candidate = ProjectHealthRow & { currentPortfolio: { name: string; code: string | null } | null }

function portfolioLabel(portfolio: { name: string; code: string | null }) {
  return portfolio.code || portfolio.name
}

export function PortfolioProjectsDialog({
  open,
  onOpenChange,
  portfolio,
  portfolios,
  unassignedProjects,
  onChanged,
  onCreateProject,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  portfolio: Portfolio | null
  portfolios: Portfolio[]
  unassignedProjects: ProjectHealthRow[]
  onChanged: () => Promise<unknown> | void
  onCreateProject: () => void
}) {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSearch("")
    setSelected(new Set())
  }, [open, portfolio?.id])

  // Every project outside this portfolio can be added. Unassigned ones come
  // first, since they are the usual target; the rest would be moved.
  const candidates = useMemo<Candidate[]>(() => {
    if (!portfolio) return []
    const fromOthers = portfolios
      .filter((other) => other.id !== portfolio.id)
      .flatMap((other) =>
        other.projects.map((project) => ({ ...project, currentPortfolio: { name: other.name, code: other.code } }))
      )
    const unassigned = unassignedProjects.map((project) => ({ ...project, currentPortfolio: null }))
    return [...unassigned, ...fromOthers.sort((a, b) => a.project_name.localeCompare(b.project_name))]
  }, [portfolio, portfolios, unassignedProjects])

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter(
      (project) =>
        project.project_name.toLowerCase().includes(q) ||
        (project.currentPortfolio?.name || "").toLowerCase().includes(q) ||
        (project.currentPortfolio?.code || "").toLowerCase().includes(q)
    )
  }, [candidates, search])

  const movingCount = candidates.filter((project) => selected.has(project.id) && project.currentPortfolio).length

  async function updateMembership(body: { add?: string[]; remove?: string[] }, busyKey: string) {
    if (!portfolio) return false
    setBusy(busyKey)
    try {
      const res = await apiFetch(`/api/portfolios/${portfolio.id}/projects`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to update portfolio projects")
      await onChanged()
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update portfolio projects")
      return false
    } finally {
      setBusy(null)
    }
  }

  async function handleAdd() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    if (await updateMembership({ add: ids }, "add")) {
      toast.success(`Added ${ids.length} project${ids.length === 1 ? "" : "s"} to ${portfolio?.name}`)
      setSelected(new Set())
    }
  }

  async function handleRemove(project: ProjectHealthRow) {
    if (await updateMembership({ remove: [project.id] }, project.id)) {
      toast.success(`Removed ${project.project_name} from ${portfolio?.name}`)
    }
  }

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const members = portfolio?.projects ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Manage Projects</DialogTitle>
          <DialogDescription>
            {portfolio
              ? `Choose which projects sit under ${portfolio.code ? `${portfolio.code} — ${portfolio.name}` : portfolio.name}.`
              : "Choose which projects sit under this portfolio."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto py-1 pr-1">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold">
              In this portfolio <span className="text-muted-foreground font-normal">({members.length})</span>
            </h3>
            {members.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed py-4 text-center text-sm">
                No projects in this portfolio yet.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {members.map((project) => (
                  <li key={project.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{project.project_name}</p>
                      <p className="text-muted-foreground text-xs">
                        {project.taskCount} task{project.taskCount === 1 ? "" : "s"}
                        {project.lifecycle_status ? ` · ${project.lifecycle_status.replaceAll("_", " ")}` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => handleRemove(project)}
                      disabled={busy !== null}
                      aria-label={`Remove ${project.project_name} from portfolio`}
                    >
                      <X className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">{busy === project.id ? "Removing..." : "Remove"}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold">Add existing projects</h3>
              {selected.size > 0 && <span className="text-muted-foreground text-xs">{selected.size} selected</span>}
            </div>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="pl-9"
                aria-label="Search projects to add"
              />
            </div>
            {candidates.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed py-4 text-center text-sm">
                Every project is already in this portfolio.
              </p>
            ) : filteredCandidates.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed py-4 text-center text-sm">
                No projects match &ldquo;{search}&rdquo;.
              </p>
            ) : (
              <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border">
                {filteredCandidates.map((project) => {
                  const checkboxId = `portfolio-candidate-${project.id}`
                  return (
                    <li key={project.id}>
                      <label
                        htmlFor={checkboxId}
                        className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 px-3 py-2"
                      >
                        <Checkbox
                          id={checkboxId}
                          checked={selected.has(project.id)}
                          onCheckedChange={(checked) => toggle(project.id, checked === true)}
                          disabled={busy !== null}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">{project.project_name}</span>
                        {project.currentPortfolio ? (
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            In {portfolioLabel(project.currentPortfolio)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground shrink-0 text-[11px]">Unassigned</span>
                        )}
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
            {movingCount > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {movingCount} selected project{movingCount === 1 ? " is" : "s are"} in another portfolio and will be
                moved here.
              </p>
            )}
          </section>
        </div>

        <DialogFooter className="gap-2 border-t pt-4 sm:justify-between">
          <Button type="button" variant="outline" onClick={onCreateProject} disabled={busy !== null}>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy !== null}>
              Done
            </Button>
            <Button type="button" onClick={handleAdd} disabled={selected.size === 0 || busy !== null}>
              {busy === "add"
                ? "Adding..."
                : selected.size > 0
                  ? `Add ${selected.size} Project${selected.size === 1 ? "" : "s"}`
                  : "Add Projects"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
