"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClipboardList, Search } from "lucide-react"

type TaskAssignmentTab = "individual" | "department"

interface UserTasksHeaderProps {
  searchQuery: string
  setSearchQuery: (value: string) => void
  filterStatus: string
  setFilterStatus: (value: string) => void
  assignmentFilter: TaskAssignmentTab
  setAssignmentFilter: (value: TaskAssignmentTab) => void
  taskView: "ongoing" | "history"
  setTaskView: (value: "ongoing" | "history") => void
}

export function UserTasksHeader({
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus,
  assignmentFilter,
  setAssignmentFilter,
  taskView,
  setTaskView,
}: UserTasksHeaderProps) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold sm:gap-3 sm:text-3xl">
          <ClipboardList className="text-primary h-6 w-6 sm:h-8 sm:w-8" />
          My Tasks
        </h1>
        <p className="text-muted-foreground mt-2">Track and manage your assigned tasks</p>
      </div>

      <Tabs value={taskView} onValueChange={(value) => setTaskView(value as "ongoing" | "history")}>
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="ongoing">Ongoing</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
      </Tabs>

      <Tabs value={assignmentFilter} onValueChange={(value) => setAssignmentFilter(value as TaskAssignmentTab)}>
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="individual">Individual</TabsTrigger>
          <TabsTrigger value="department">Dept</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-3 xl:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by task or work item"
            className="pl-10"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
