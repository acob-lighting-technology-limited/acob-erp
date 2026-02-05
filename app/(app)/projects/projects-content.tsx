"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FolderKanban, Calendar, MapPin, User, ArrowRight, CheckCircle2, Clock, AlertCircle, Pause } from "lucide-react"
import type { Project } from "./page"
import { AppTablePage } from "@/components/app/app-table-page"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"

interface ProjectsContentProps {
  initialProjects: Project[]
}

export function ProjectsContent({ initialProjects }: ProjectsContentProps) {
  const [projects] = useState<Project[]>(initialProjects)
  const [filteredProjects, setFilteredProjects] = useState<Project[]>(initialProjects)
  const [filterStatus, setFilterStatus] = useState("all")

  useEffect(() => {
    if (filterStatus === "all") {
      setFilteredProjects(projects)
    } else {
      setFilteredProjects(projects.filter((p) => p.status === filterStatus))
    }
  }, [filterStatus, projects])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "planning":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "on_hold":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      case "completed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "planning":
        return <Clock className="h-3 w-3" />
      case "active":
        return <CheckCircle2 className="h-3 w-3" />
      case "on_hold":
        return <Pause className="h-3 w-3" />
      case "completed":
        return <CheckCircle2 className="h-3 w-3" />
      case "cancelled":
        return <AlertCircle className="h-3 w-3" />
      default:
        return <Clock className="h-3 w-3" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const stats = {
    total: projects.length,
    planning: projects.filter((p) => p.status === "planning").length,
    active: projects.filter((p) => p.status === "active").length,
    completed: projects.filter((p) => p.status === "completed").length,
  }

  return (
    <AppTablePage
      title="Projects"
      description="View and track all your assigned projects"
      icon={FolderKanban}
      stats={
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <FolderKanban className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Planning</CardTitle>
              <Clock className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.planning}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
            </CardContent>
          </Card>
        </div>
      }
      filters={
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setFilterStatus("all")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              filterStatus === "all"
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setFilterStatus("planning")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              filterStatus === "planning"
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            Planning ({stats.planning})
          </button>
          <button
            onClick={() => setFilterStatus("active")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              filterStatus === "active"
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            Active ({stats.active})
          </button>
          <button
            onClick={() => setFilterStatus("completed")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              filterStatus === "completed"
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            Completed ({stats.completed})
          </button>
        </div>
      }
      filtersInCard={false}
    >
      {/* Projects List */}
      {filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderKanban className="text-muted-foreground mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-semibold">No projects found</h3>
            <p className="text-muted-foreground text-sm">
              {filterStatus === "all"
                ? "You haven't been assigned to any projects yet."
                : `You don't have any ${filterStatus} projects.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2">
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
                {filteredProjects.map((project, index) => (
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
                      <Badge variant="outline" className="flex items-center gap-1">
                        {getStatusIcon(project.status)}
                        {project.status.replace("_", " ")}
                      </Badge>
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
                      <Link href={`/projects/${project.id}`}>
                        <Button variant="ghost" size="sm" className="gap-2">
                          View
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </AppTablePage>
  )
}
