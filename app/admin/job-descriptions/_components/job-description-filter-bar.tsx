"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Card, CardContent } from "@/components/ui/card"
import { Building2, User, Search } from "lucide-react"
import { formatName } from "@/lib/utils"

interface Profile {
  id: string
  first_name: string
  last_name: string
  department: string
}

interface JobDescriptionFilterBarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  departmentFilter: string
  onDepartmentChange: (value: string) => void
  employeeFilter: string
  onEmployeeChange: (value: string) => void
  statusFilter: string
  onStatusChange: (value: string) => void
  departments: string[]
  profiles: Profile[]
}

export function JobDescriptionFilterBar({
  searchQuery,
  onSearchChange,
  departmentFilter,
  onDepartmentChange,
  employeeFilter,
  onEmployeeChange,
  statusFilter,
  onStatusChange,
  departments,
  profiles,
}: JobDescriptionFilterBarProps) {
  return (
    <Card className="border-2">
      <CardContent className="p-3 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
            <Input
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <SearchableSelect
            value={departmentFilter}
            onValueChange={onDepartmentChange}
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
          <SearchableSelect
            value={employeeFilter}
            onValueChange={onEmployeeChange}
            placeholder="All employee"
            searchPlaceholder="Search employee..."
            icon={<User className="h-4 w-4" />}
            className="w-full md:w-48"
            options={[
              { value: "all", label: "All employee" },
              ...profiles.map((member) => ({
                value: member.id,
                label: `${formatName(member.first_name)} ${formatName(member.last_name)} - ${member.department}`,
                icon: <User className="h-3 w-3" />,
              })),
            ]}
          />
          <Select value={statusFilter} onValueChange={onStatusChange}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
