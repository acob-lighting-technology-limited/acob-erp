"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Department {
  id: string
  name: string
}

interface PaymentsFilterBarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  departmentFilter: string
  onDepartmentChange: (value: string) => void
  categoryFilter: string
  onCategoryChange: (value: string) => void
  statusFilter: string
  onStatusChange: (value: string) => void
  showDepartmentFilter: boolean
  filterableDepartments: Department[]
}

export function PaymentsFilterBar({
  searchQuery,
  onSearchChange,
  departmentFilter,
  onDepartmentChange,
  categoryFilter,
  onCategoryChange,
  statusFilter,
  onStatusChange,
  showDepartmentFilter,
  filterableDepartments,
}: PaymentsFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="relative flex-1">
        <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
        <Input
          placeholder="Search payments..."
          className="pl-9 text-sm"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        {showDepartmentFilter && (
          <Select value={departmentFilter} onValueChange={onDepartmentChange}>
            <SelectTrigger className="flex-1 sm:w-[180px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {filterableDepartments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={categoryFilter} onValueChange={onCategoryChange}>
          <SelectTrigger className="flex-1 sm:w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="one-time">One-time</SelectItem>
            <SelectItem value="recurring">Recurring</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="flex-1 sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="due">Due</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
