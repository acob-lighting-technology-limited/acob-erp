"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Search, Building2, User } from "lucide-react"
import { formatName } from "@/lib/utils"
import type { employee, UserProfile } from "@/app/admin/tasks/management/admin-tasks-content"

interface TaskFilterBarProps {
  searchQuery: string
  setSearchQuery: (v: string) => void
  statusFilter: string
  setStatusFilter: (v: string) => void
  priorityFilter: string
  setPriorityFilter: (v: string) => void
  departmentFilter: string
  setDepartmentFilter: (v: string) => void
  employeeFilter: string
  setEmployeeFilter: (v: string) => void
  goalFilter: string
  setGoalFilter: (v: string) => void
  departments: string[]
  goals: { id: string; title: string }[]
  activeEmployees: employee[]
  userProfile: UserProfile
}

export function TaskFilterBar({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  departmentFilter,
  setDepartmentFilter,
  employeeFilter,
  setEmployeeFilter,
  goalFilter,
  setGoalFilter,
  departments,
  goals,
  activeEmployees,
  userProfile,
}: TaskFilterBarProps) {
  return (
    <Card className="border-2">
      <CardContent className="p-3 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <SearchableSelect
            value={goalFilter}
            onValueChange={setGoalFilter}
            placeholder="All Goals"
            searchPlaceholder="Search goals..."
            className="w-full md:w-56"
            options={[
              { value: "all", label: "All Goals" },
              ...goals.map((goal) => ({
                value: goal.id,
                label: goal.title,
              })),
            ]}
          />
          {!userProfile?.is_department_lead && (
            <SearchableSelect
              value={departmentFilter}
              onValueChange={setDepartmentFilter}
              placeholder="All Departments"
              searchPlaceholder="Search departments..."
              icon={<Building2 className="h-4 w-4" />}
              className="w-full md:w-48"
              options={[
                { value: "all", label: "All Departments" },
                ...departments.map((dept) => ({
                  value: dept,
                  label: dept,
                  icon: <Building2 className="h-3 w-3" />,
                })),
              ]}
            />
          )}
          <SearchableSelect
            value={employeeFilter}
            onValueChange={setEmployeeFilter}
            placeholder={
              userProfile?.is_department_lead && departments.length > 0
                ? `All ${departments.length === 1 ? departments[0] : "Department"} employee`
                : "All employee"
            }
            searchPlaceholder="Search employee..."
            icon={<User className="h-4 w-4" />}
            className="w-full md:w-48"
            options={[
              {
                value: "all",
                label:
                  userProfile?.is_department_lead && departments.length > 0
                    ? `All ${departments.length === 1 ? departments[0] : "Department"} employee`
                    : "All employee",
              },
              ...activeEmployees.map((member) => ({
                value: member.id,
                label: `${formatName(member.first_name)} ${formatName(member.last_name)} - ${member.department}`,
                icon: <User className="h-3 w-3" />,
              })),
            ]}
          />
        </div>
      </CardContent>
    </Card>
  )
}
