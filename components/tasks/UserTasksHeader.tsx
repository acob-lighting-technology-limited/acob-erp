"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ClipboardList } from "lucide-react"

interface UserTasksHeaderProps {
  filterStatus: string
  setFilterStatus: (value: string) => void
}

export function UserTasksHeader({ filterStatus, setFilterStatus }: UserTasksHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold sm:gap-3 sm:text-3xl">
          <ClipboardList className="text-primary h-6 w-6 sm:h-8 sm:w-8" />
          My Tasks
        </h1>
        <p className="text-muted-foreground mt-2">Track and manage your assigned tasks</p>
      </div>
      <Select value={filterStatus} onValueChange={setFilterStatus}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Tasks</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
