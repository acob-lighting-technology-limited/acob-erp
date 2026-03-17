"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Project } from "./project-data"

interface ProjectSummaryCardProps {
  project: Project
}

export function ProjectSummaryCard({ project }: ProjectSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Summary</CardTitle>
        <CardDescription>Canonical manager is controlled by Project Manager field from project edit.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <p className="text-muted-foreground text-xs uppercase">Manager</p>
          <p className="font-medium">
            {project.project_manager
              ? `${project.project_manager.first_name} ${project.project_manager.last_name}`
              : "Unassigned"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase">Status</p>
          <p className="font-medium capitalize">{project.status.replace("_", " ")}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase">Location</p>
          <p className="font-medium">{project.location || "—"}</p>
        </div>
      </CardContent>
    </Card>
  )
}
