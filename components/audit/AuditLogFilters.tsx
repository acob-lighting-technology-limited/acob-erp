"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Building2, Search, Calendar, User } from "lucide-react"
import { formatName } from "@/lib/utils"
import type { AuditLogFiltersState, EmployeeMember, UserProfile } from "@/app/admin/audit-logs/types"

interface AuditLogFiltersProps {
  filters: AuditLogFiltersState
  onFilterChange: <K extends keyof AuditLogFiltersState>(key: K, value: AuditLogFiltersState[K]) => void
  employee: EmployeeMember[]
  departments: string[]
  userProfile: UserProfile
  scopedDepartments: string[]
}

export function AuditLogFilters({
  filters,
  onFilterChange,
  employee,
  departments,
  userProfile,
  scopedDepartments,
}: AuditLogFiltersProps) {
  const {
    searchQuery,
    actionFilter,
    entityFilter,
    dateFilter,
    departmentFilter,
    employeeFilter,
    customStartDate,
    customEndDate,
  } = filters

  return (
    <Card className="border-2">
      <CardContent className="p-3 sm:p-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => onFilterChange("searchQuery", e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={actionFilter} onValueChange={(v) => onFilterChange("actionFilter", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="assign">Assign</SelectItem>
              <SelectItem value="unassign">Unassign</SelectItem>
              <SelectItem value="approve">Approve</SelectItem>
              <SelectItem value="reject">Reject</SelectItem>
              <SelectItem value="dispatch">Dispatch</SelectItem>
              <SelectItem value="send">Send</SelectItem>
              <SelectItem value="status_change">Status Change</SelectItem>
            </SelectContent>
          </Select>

          <Select value={entityFilter} onValueChange={(v) => onFilterChange("entityFilter", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Entity Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              <SelectItem value="device">Devices</SelectItem>
              <SelectItem value="task">Tasks</SelectItem>
              <SelectItem value="job_description">Job Descriptions</SelectItem>
              <SelectItem value="user_documentation">Documentation</SelectItem>
              <SelectItem value="profile">Profiles</SelectItem>
              <SelectItem value="feedback">Feedback</SelectItem>
              <SelectItem value="department_payments">Payments</SelectItem>
              <SelectItem value="payment_documents">Documents</SelectItem>
              <SelectItem value="departments">Departments</SelectItem>
              <SelectItem value="payment_categories">Payment Categories</SelectItem>
              <SelectItem value="leave_requests">Leave Requests</SelectItem>
              <SelectItem value="leave_approvals">Leave Approvals</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={dateFilter}
            onValueChange={(value) => {
              onFilterChange("dateFilter", value)
              if (value !== "custom") {
                onFilterChange("customStartDate", "")
                onFilterChange("customEndDate", "")
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Time Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {!userProfile?.is_department_lead && (
            <SearchableSelect
              value={departmentFilter}
              onValueChange={(v) => onFilterChange("departmentFilter", v)}
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
          )}
          <SearchableSelect
            value={employeeFilter}
            onValueChange={(v) => onFilterChange("employeeFilter", v)}
            placeholder={
              userProfile?.is_department_lead && scopedDepartments.length > 0
                ? `All ${scopedDepartments.length === 1 ? scopedDepartments[0] : "Department"} employee`
                : "All employee"
            }
            searchPlaceholder="Search employee..."
            icon={<User className="h-4 w-4" />}
            options={[
              {
                value: "all",
                label:
                  userProfile?.is_department_lead && scopedDepartments.length > 0
                    ? `All ${scopedDepartments.length === 1 ? scopedDepartments[0] : "Department"} employee`
                    : "All employee",
              },
              ...employee.map((member) => ({
                value: member.id,
                label: `${formatName(member.first_name)} ${formatName(member.last_name)} - ${member.department}`,
                icon: <User className="h-3 w-3" />,
              })),
            ]}
          />
        </div>

        {dateFilter === "custom" && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-foreground text-sm font-medium">Start Date</label>
              <div className="relative">
                <Calendar className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => onFilterChange("customStartDate", e.target.value)}
                  className="pl-10"
                  placeholder="Select start date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-foreground text-sm font-medium">End Date</label>
              <div className="relative">
                <Calendar className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => onFilterChange("customEndDate", e.target.value)}
                  className="pl-10"
                  placeholder="Select end date"
                  min={customStartDate}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
