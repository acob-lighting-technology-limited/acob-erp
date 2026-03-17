"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { toast } from "sonner"
import { formatName } from "@/lib/utils"
import { writeAuditLogClient } from "@/lib/audit/client"
import { FeedbackFilterBar } from "@/components/feedback/feedback-filter-bar"
import { FeedbackDetailDialog } from "@/components/feedback/feedback-detail-dialog"
import { FeedbackTable } from "@/components/feedback/feedback-table"

interface FeedbackViewerClientProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  feedback: any[]
}

interface FeedbackFilterData {
  isDepartmentLead: boolean
  leadDepartments: string[]
  employees: { id: string; first_name: string; last_name: string; department: string }[]
  departments: string[]
}

async function fetchFeedbackFilterData(): Promise<FeedbackFilterData> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { isDepartmentLead: false, leadDepartments: [], employees: [], departments: [] }

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("role, department, is_department_lead, lead_departments")
    .eq("id", user.id)
    .single()

  const scopedDepartments = userProfile?.lead_departments?.length
    ? userProfile.lead_departments
    : userProfile?.department
      ? [userProfile.department]
      : []

  let employeeQuery = supabase
    .from("profiles")
    .select("id, first_name, last_name, department")
    .order("last_name", { ascending: true })

  if (userProfile?.is_department_lead && scopedDepartments.length > 0) {
    employeeQuery = employeeQuery.in("department", scopedDepartments)
  }

  const { data: employeeData } = await employeeQuery
  const employees = (employeeData || []) as { id: string; first_name: string; last_name: string; department: string }[]

  let uniqueDepartments: string[] = []
  if (userProfile?.is_department_lead && scopedDepartments.length > 0) {
    uniqueDepartments = [...scopedDepartments].sort()
  } else {
    uniqueDepartments = Array.from(new Set(employees.map((s) => s.department).filter(Boolean))) as string[]
    uniqueDepartments.sort()
  }

  return {
    isDepartmentLead: Boolean(userProfile?.is_department_lead),
    leadDepartments: scopedDepartments,
    employees,
    departments: uniqueDepartments,
  }
}

export function FeedbackViewerClient({ feedback }: FeedbackViewerClientProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [employeeFilter, setEmployeeFilter] = useState("all")
  const [nameSortOrder, setNameSortOrder] = useState<"asc" | "desc">("asc")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedFeedback, setSelectedFeedback] = useState<any | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const { data: filterData } = useQuery({
    queryKey: QUERY_KEYS.feedbackViewer(),
    queryFn: fetchFeedbackFilterData,
  })

  const isDepartmentLead = filterData?.isDepartmentLead ?? false
  const employees = filterData?.employees ?? []
  const departments = filterData?.departments ?? []

  const filteredFeedback = useMemo(() => {
    let filtered = feedback

    if (searchQuery) {
      filtered = filtered.filter((item) => {
        const titleMatch = item.title?.toLowerCase().includes(searchQuery.toLowerCase())
        const userMatch =
          item.profiles?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.profiles?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.profiles?.company_email?.toLowerCase().includes(searchQuery.toLowerCase())
        return titleMatch || userMatch
      })
    }

    if (selectedType !== "all") filtered = filtered.filter((item) => item.feedback_type === selectedType)
    if (selectedStatus !== "all") filtered = filtered.filter((item) => item.status === selectedStatus)
    if (departmentFilter !== "all") filtered = filtered.filter((item) => item.profiles?.department === departmentFilter)
    if (employeeFilter !== "all") filtered = filtered.filter((item) => item.user_id === employeeFilter)

    return [...filtered].sort((a, b) => {
      const lastNameA = formatName(a.profiles?.last_name || "").toLowerCase()
      const lastNameB = formatName(b.profiles?.last_name || "").toLowerCase()
      return nameSortOrder === "asc" ? lastNameA.localeCompare(lastNameB) : lastNameB.localeCompare(lastNameA)
    })
  }, [feedback, searchQuery, selectedType, selectedStatus, departmentFilter, employeeFilter, nameSortOrder])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleViewDetails = (item: any) => {
    setSelectedFeedback(item)
    setIsModalOpen(true)
  }

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedFeedback) return
    const supabase = createClient()
    setIsUpdating(true)

    try {
      const { error } = await supabase
        .from("feedback")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", selectedFeedback.id)

      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await writeAuditLogClient(
        supabase as any,
        {
          action: "status_change",
          entityType: "feedback",
          entityId: selectedFeedback.id,
          oldValues: { status: selectedFeedback.status },
          newValues: { status: newStatus },
          metadata: { event: "feedback_status_updated" },
          context: { source: "ui", route: "/admin/feedback" },
        },
        { failOpen: true }
      )

      toast.success("Status updated successfully!")
      setSelectedFeedback({ ...selectedFeedback, status: newStatus })
      window.location.reload()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update status"
      toast.error(message)
    } finally {
      setIsUpdating(false)
    }
  }

  const hasActiveFilters =
    !!searchQuery ||
    selectedType !== "all" ||
    selectedStatus !== "all" ||
    departmentFilter !== "all" ||
    employeeFilter !== "all"

  return (
    <div className="space-y-6">
      <FeedbackFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        departmentFilter={departmentFilter}
        onDepartmentChange={setDepartmentFilter}
        employeeFilter={employeeFilter}
        onEmployeeChange={setEmployeeFilter}
        isDepartmentLead={isDepartmentLead}
        departments={departments}
        employees={employees}
        filteredCount={filteredFeedback.length}
      />

      <FeedbackTable
        items={filteredFeedback}
        nameSortOrder={nameSortOrder}
        onToggleSort={() => setNameSortOrder(nameSortOrder === "asc" ? "desc" : "asc")}
        onView={handleViewDetails}
        hasActiveFilters={hasActiveFilters}
      />

      <FeedbackDetailDialog
        feedback={selectedFeedback}
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        onUpdateStatus={handleUpdateStatus}
        isUpdating={isUpdating}
      />
    </div>
  )
}
