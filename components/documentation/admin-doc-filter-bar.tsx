"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Building2, Filter, Search, User } from "lucide-react"
import { formatName } from "@/lib/utils"
import type { UserProfile, employeeMember } from "./admin-doc-types"

interface AdminDocFilterBarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  categoryFilter: string
  onCategoryChange: (value: string) => void
  categories: string[]
  statusFilter: string
  onStatusChange: (value: string) => void
  departmentFilter: string
  onDepartmentChange: (value: string) => void
  departments: string[]
  employeeFilter: string
  onEmployeeChange: (value: string) => void
  employees: employeeMember[]
  userProfile: UserProfile
}

export function AdminDocFilterBar({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  categories,
  statusFilter,
  onStatusChange,
  departmentFilter,
  onDepartmentChange,
  departments,
  employeeFilter,
  onEmployeeChange,
  employees,
  userProfile,
}: AdminDocFilterBarProps) {
  return (
    <Card className="border-2">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
            <Input
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-full md:w-48">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!userProfile?.is_department_lead && (
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
          )}
          <SearchableSelect
            value={employeeFilter}
            onValueChange={onEmployeeChange}
            placeholder={
              userProfile?.is_department_lead && userProfile.lead_departments && userProfile.lead_departments.length > 0
                ? `All ${userProfile.lead_departments.length === 1 ? userProfile.lead_departments[0] : "Department"} employee`
                : "All employee"
            }
            searchPlaceholder="Search employee..."
            icon={<User className="h-4 w-4" />}
            className="w-full md:w-48"
            options={[
              {
                value: "all",
                label:
                  userProfile?.is_department_lead &&
                  userProfile.lead_departments &&
                  userProfile.lead_departments.length > 0
                    ? `All ${userProfile.lead_departments.length === 1 ? userProfile.lead_departments[0] : "Department"} employee`
                    : "All employee",
              },
              ...employees.map((member) => ({
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
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
