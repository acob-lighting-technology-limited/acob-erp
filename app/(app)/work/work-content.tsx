"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Briefcase } from "lucide-react"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type WorkItem = {
  id: string
  title: string
  work_item_number?: string | null
  source_type?: string | null
  status: string
  priority?: string | null
  department?: string | null
  due_date?: string | null
  assigned_by_name?: string
  source_id?: string | null
  project_id?: string | null
  created_at: string
}

function renderSourceBadge(sourceType?: string | null) {
  switch (sourceType) {
    case "manual":
      return <Badge className="bg-blue-100 text-blue-800">Manual</Badge>
    case "help_desk":
      return <Badge className="bg-fuchsia-100 text-fuchsia-800">Help Desk</Badge>
    case "project_task":
      return <Badge className="bg-green-100 text-green-800">Project</Badge>
    default:
      return <Badge variant="outline">Work</Badge>
  }
}

export function WorkContent({ initialItems }: { initialItems: WorkItem[] }) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return initialItems.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.title.toLowerCase().includes(normalizedSearch) ||
        String(item.work_item_number || "")
          .toLowerCase()
          .includes(normalizedSearch)
      const matchesStatus = statusFilter === "all" || item.status === statusFilter
      const matchesSource = sourceFilter === "all" || item.source_type === sourceFilter
      const matchesPriority = priorityFilter === "all" || item.priority === priorityFilter
      return matchesSearch && matchesStatus && matchesSource && matchesPriority
    })
  }, [initialItems, priorityFilter, search, sourceFilter, statusFilter])

  const stats = {
    total: initialItems.length,
    pending: initialItems.filter((item) => item.status === "pending").length,
    inProgress: initialItems.filter((item) => item.status === "in_progress").length,
    overdue: initialItems.filter(
      (item) => item.due_date && new Date(item.due_date) < new Date() && item.status !== "completed"
    ).length,
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="My Work"
        description="Everything assigned to you in one place"
        icon={Briefcase}
        backLink={{ href: "/profile", label: "Back to Dashboard" }}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total</CardTitle>
          </CardHeader>
          <CardContent>{stats.total}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending</CardTitle>
          </CardHeader>
          <CardContent>{stats.pending}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>In Progress</CardTitle>
          </CardHeader>
          <CardContent>{stats.inProgress}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Overdue</CardTitle>
          </CardHeader>
          <CardContent>{stats.overdue}</CardContent>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search work items"
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="help_desk">Help Desk</SelectItem>
            <SelectItem value="project_task">Project</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 space-y-3">
        {filteredItems.map((item) => {
          const overdue = item.due_date && new Date(item.due_date) < new Date() && item.status !== "completed"
          return (
            <Card key={item.id}>
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => item.work_item_number && navigator.clipboard.writeText(item.work_item_number)}
                    className="font-mono text-xs font-semibold text-slate-600 hover:underline"
                  >
                    {item.work_item_number || "Work item"}
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    {renderSourceBadge(item.source_type)}
                    <Badge variant="outline">{item.status.replaceAll("_", " ")}</Badge>
                    {item.priority ? <Badge variant="outline">{item.priority}</Badge> : null}
                  </div>
                  <div className="text-lg font-semibold">{item.title}</div>
                  <div className="text-sm text-slate-500">
                    {item.department || "No department"} • Assigned by {item.assigned_by_name || "Unknown"}
                  </div>
                  {item.due_date ? (
                    <div className={`text-sm ${overdue ? "font-semibold text-red-600" : "text-slate-500"}`}>
                      Due {new Date(item.due_date).toLocaleDateString()}
                    </div>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (item.source_type === "help_desk" && item.source_id) router.push(`/help-desk/${item.source_id}`)
                    else if (item.source_type === "project_task" && item.project_id)
                      router.push(`/projects/${item.project_id}`)
                    else router.push("/tasks/management")
                  }}
                >
                  Open
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </PageWrapper>
  )
}
