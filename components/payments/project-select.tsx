"use client"

import { useQuery } from "@tanstack/react-query"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PROJECTS_QUERY_KEY, fetchProjectRecords } from "@/lib/projects/records"

const NO_PROJECT = "__none__"

/** Optional project a payment is charged to. `value` is a project id or "" for none. */
export function ProjectSelect({
  value,
  onChange,
  id = "payment-project",
}: {
  value: string
  onChange: (projectId: string) => void
  id?: string
}) {
  const { data: projects = [], isLoading } = useQuery({ queryKey: PROJECTS_QUERY_KEY, queryFn: fetchProjectRecords })

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Project (Optional)</Label>
      <Select value={value || NO_PROJECT} onValueChange={(v) => onChange(v === NO_PROJECT ? "" : v)}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={isLoading ? "Loading projects..." : "No project"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_PROJECT}>No project</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.project_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
