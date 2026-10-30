"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const NONE = "none"

/**
 * "Part of": the one place a task is tied to a project or a portfolio. A task
 * is one or the other, never both, so a single picker replaces the two
 * dropdowns that each had to explain why you might want the other one.
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
    return (
      <div>
        <Label className="text-xs font-semibold">Part of</Label>
        <div className="bg-muted/50 text-muted-foreground mt-1 rounded-md border px-3 py-2 text-xs">{lockedLabel}</div>
      </div>
    )
  }

  const value = projectId ? `project:${projectId}` : portfolioId ? `portfolio:${portfolioId}` : NONE
  const hint = projectId
    ? "Rated by the project's manager, and counts toward the project's progress."
    : portfolioId
      ? "Work across the whole portfolio. For one project's work, pick the project."
      : null

  return (
    <div>
      <Label htmlFor="work_link" className="text-xs font-semibold">
        Part of
      </Label>
      <Select
        value={value}
        onValueChange={(val) => {
          const [kind, id = ""] = val.split(":")
          onChange({ project_id: kind === "project" ? id : "", portfolio_id: kind === "portfolio" ? id : "" })
        }}
      >
        <SelectTrigger id="work_link" className="mt-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>
            <span className="text-muted-foreground italic">Nothing (everyday work)</span>
          </SelectItem>
          {projects.length > 0 && (
            <SelectGroup>
              <SelectLabel>Projects</SelectLabel>
              {projects.map((project) => (
                <SelectItem key={project.id} value={`project:${project.id}`}>
                  {project.project_name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {portfolios.length > 0 && (
            <SelectGroup>
              <SelectLabel>Portfolios</SelectLabel>
              {portfolios.map((portfolio) => (
                <SelectItem key={portfolio.id} value={`portfolio:${portfolio.id}`}>
                  {portfolio.label}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </div>
  )
}
