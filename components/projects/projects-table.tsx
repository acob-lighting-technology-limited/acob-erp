"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FolderKanban, Plus, MapPin, User, ArrowRight, Edit, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import type { Project } from "@/app/admin/projects/page"

interface ProjectsTableProps {
  projects: Project[]
  searchQuery: string
  statusFilter: string
  formatDate: (dateString: string) => string
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
  onCreateNew: () => void
}

export function ProjectsTable({
  projects,
  searchQuery,
  statusFilter,
  formatDate,
  onEdit,
  onDelete,
  onCreateNew,
}: ProjectsTableProps) {
  const router = useRouter()

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FolderKanban className="text-muted-foreground mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-semibold">No projects found</h3>
          <p className="text-muted-foreground mb-4 text-sm">
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your search or filters"
              : "Get started by creating your first project"}
          </p>
          {!searchQuery && statusFilter === "all" && (
            <Button onClick={onCreateNew}>
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Timeline</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project, index) => (
              <TableRow key={project.id} className="hover:bg-muted/50">
                <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="text-foreground font-medium">{project.project_name}</div>
                    {project.description && (
                      <div className="text-muted-foreground line-clamp-1 text-xs">{project.description}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{project.status.replace("_", " ")}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="text-muted-foreground h-3.5 w-3.5" />
                    <span>{project.location}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div className="text-foreground">{formatDate(project.deployment_start_date)}</div>
                    <div className="text-muted-foreground">{formatDate(project.deployment_end_date)}</div>
                  </div>
                </TableCell>
                <TableCell>
                  {project.project_manager ? (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="text-muted-foreground h-3.5 w-3.5" />
                      <span>
                        {project.project_manager.first_name} {project.project_manager.last_name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => router.push(`/admin/projects/${project.id}`)}
                    >
                      Manage
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" aria-label="Edit project" onClick={() => onEdit(project)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" aria-label="Delete project" onClick={() => onDelete(project)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
