"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  FolderKanban,
  Calendar,
  MapPin,
  User,
  Zap,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Pause,
} from "lucide-react"
import Link from "next/link"
import type { Project } from "./page"

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
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">View and track all your assigned projects</p>
        </div>
      </div>

      {/* Statistics Cards */}
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

      {/* Filter Tabs */}
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
        <div className="grid gap-4">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl">{project.project_name}</CardTitle>
                      <Badge className={`${getStatusColor(project.status)} flex items-center gap-1`}>
                        {getStatusIcon(project.status)}
                        {project.status.replace("_", " ")}
                      </Badge>
                    </div>
                    {project.description && (
                      <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                    )}
                  </div>
                  <Link href={`/projects/${project.id}`}>
                    <Button variant="outline" size="sm">
                      View Details
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="text-muted-foreground h-4 w-4" />
                    <div>
                      <p className="text-muted-foreground text-xs">Location</p>
                      <p className="font-medium">{project.location}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="text-muted-foreground h-4 w-4" />
                    <div>
                      <p className="text-muted-foreground text-xs">Start Date</p>
                      <p className="font-medium">{formatDate(project.deployment_start_date)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="text-muted-foreground h-4 w-4" />
                    <div>
                      <p className="text-muted-foreground text-xs">End Date</p>
                      <p className="font-medium">{formatDate(project.deployment_end_date)}</p>
                    </div>
                  </div>

                  {project.project_manager && (
                    <div className="flex items-center gap-2">
                      <User className="text-muted-foreground h-4 w-4" />
                      <div>
                        <p className="text-muted-foreground text-xs">Project Manager</p>
                        <p className="font-medium">
                          {project.project_manager.first_name} {project.project_manager.last_name}
                        </p>
                      </div>
                    </div>
                  )}

                  {project.capacity_w && (
                    <div className="flex items-center gap-2">
                      <Zap className="text-muted-foreground h-4 w-4" />
                      <div>
                        <p className="text-muted-foreground text-xs">Capacity</p>
                        <p className="font-medium">{project.capacity_w.toLocaleString()} W</p>
                      </div>
                    </div>
                  )}

                  {project.technology_type && (
                    <div className="flex items-center gap-2">
                      <FolderKanban className="text-muted-foreground h-4 w-4" />
                      <div>
                        <p className="text-muted-foreground text-xs">Technology</p>
                        <p className="font-medium">{project.technology_type}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
