"use client"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const NONE = "__none__"

/**
 * Project and Portfolio on one row. A task is one or the other, never both,
 * so picking one clears the other - both stay visible so neither is hidden
 * behind the other's choice.
 */
export function TaskWorkLinkField({
  projectId,
  portfolioId,
  projects,
  portfolios,
  onChange,
  lockedLabel,
}: {
  projectId: string
  portfolioId: string
  projects: Array<{ id: string; project_name: string }>
  portfolios: Array<{ id: string; label: string }>
  onChange: (link: { project_id: string; portfolio_id: string }) => void
  /** Set when the screen the form was opened from fixes the project or portfolio. */
  lockedLabel?: string | null
}) {
  if (lockedLabel) {
    return <div className="bg-muted/50 text-muted-foreground rounded-md border px-3 py-2 text-xs">{lockedLabel}</div>
  }

  const hint = projectId
    ? "Rated by the project's manager, and counts toward the project's progress."
    : portfolioId
      ? "Work across the whole portfolio, not one project."
      : null

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <Label htmlFor="project_id" className="text-xs font-semibold">
            Project
          </Label>
          <Select
            value={projectId || NONE}
            onValueChange={(val) => onChange({ project_id: val === NONE ? "" : val, portfolio_id: "" })}
          >
            <SelectTrigger id="project_id" className="mt-1 w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>
                <span className="text-muted-foreground italic">None</span>
              </SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.project_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0">
          <Label htmlFor="portfolio_id" className="text-xs font-semibold">
            Portfolio
          </Label>
          <Select
            value={portfolioId || NONE}
            onValueChange={(val) => onChange({ project_id: "", portfolio_id: val === NONE ? "" : val })}
          >
            <SelectTrigger id="portfolio_id" className="mt-1 w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>
                <span className="text-muted-foreground italic">None</span>
              </SelectItem>
              {portfolios.map((portfolio) => (
                <SelectItem key={portfolio.id} value={portfolio.id}>
                  {portfolio.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-muted-foreground mt-1 text-xs">
        {hint ?? "Optional. A task is part of a project or a portfolio, not both."}
      </p>
    </div>
  )
}
