"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Building2, User, Search } from "lucide-react"
import { formatName } from "@/lib/utils"

interface Employee {
  id: string
  first_name: string
  last_name: string
  department: string
}

interface FeedbackFilterBarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  selectedType: string
  onTypeChange: (value: string) => void
  selectedStatus: string
  onStatusChange: (value: string) => void
  departmentFilter: string
  onDepartmentChange: (value: string) => void
  employeeFilter: string
  onEmployeeChange: (value: string) => void
  isDepartmentLead: boolean
  departments: string[]
  employees: Employee[]
  filteredCount: number
}

export function FeedbackFilterBar({
  searchQuery,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedStatus,
  onStatusChange,
  departmentFilter,
  onDepartmentChange,
  employeeFilter,
  onEmployeeChange,
  isDepartmentLead,
  departments,
  employees,
  filteredCount,
}: FeedbackFilterBarProps) {
  return (
    <div className="bg-card space-y-4 rounded-lg border p-4">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
        <Input
          placeholder="Search by title or user name..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <div className="space-y-2">
          <label className="text-foreground text-sm font-medium">Feedback Type</label>
          <Select value={selectedType} onValueChange={onTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="concern">Concern</SelectItem>
              <SelectItem value="complaint">Complaint</SelectItem>
              <SelectItem value="suggestion">Suggestion</SelectItem>
              <SelectItem value="required_item">Required Item</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-foreground text-sm font-medium">Status</label>
          <Select value={selectedStatus} onValueChange={onStatusChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!isDepartmentLead && (
          <div className="space-y-2">
            <label className="text-foreground text-sm font-medium">Department</label>
            <SearchableSelect
              value={departmentFilter}
              onValueChange={onDepartmentChange}
              placeholder="All Departments"
              searchPlaceholder="Search departments..."
              icon={<Building2 className="h-4 w-4" />}
              options={[
                { value: "all", label: "All Departments" },
                ...departments.map((dept) => ({
                  value: dept,
                  label: dept,
                  icon: <Building2 className="h-3 w-3" />,
                })),
              ]}
            />
          </div>
        )}

        <div className="space-y-2">
          <label className="text-foreground text-sm font-medium">
            {isDepartmentLead && departments.length > 0 ? `employee (${departments.join(", ")})` : "employee"}
          </label>
          <SearchableSelect
            value={employeeFilter}
            onValueChange={onEmployeeChange}
            placeholder={
              isDepartmentLead && departments.length > 0
                ? `All ${departments.length === 1 ? departments[0] : "Department"} employee`
                : "All employee"
            }
            searchPlaceholder="Search employee..."
            icon={<User className="h-4 w-4" />}
            options={[
              {
                value: "all",
                label:
                  isDepartmentLead && departments.length > 0
                    ? `All ${departments.length === 1 ? departments[0] : "Department"} employee`
                    : "All employee",
              },
              ...employees.map((member) => ({
                value: member.id,
                label: `${formatName(member.first_name)} ${formatName(member.last_name)} - ${member.department}`,
                icon: <User className="h-3 w-3" />,
              })),
            ]}
          />
        </div>

        <div className="space-y-2">
          <label className="text-foreground text-sm font-medium">Results</label>
          <div className="bg-muted rounded-md border px-3 py-2 text-sm font-medium">
            {filteredCount} item{filteredCount !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    </div>
  )
}
