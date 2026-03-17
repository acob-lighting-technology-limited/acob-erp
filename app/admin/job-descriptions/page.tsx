"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { StatCard } from "@/components/ui/stat-card"
import { Briefcase, User, Calendar, CheckCircle, XCircle, List, LayoutGrid } from "lucide-react"
import type { UserRole } from "@/types/database"
import { formatName } from "@/lib/utils"
import { EmptyState } from "@/components/ui/patterns"
import { JobDescriptionFilterBar } from "./_components/job-description-filter-bar"
import { JobDescriptionListView } from "./_components/job-description-list-view"
import { JobDescriptionCardView } from "./_components/job-description-card-view"
import { JobDescriptionDialog } from "./_components/job-description-dialog"

interface JobDescriptionsData {
  profiles: Profile[]
  userProfile: UserProfile | null
}

async function fetchJobDescriptionsData(): Promise<JobDescriptionsData> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { profiles: [], userProfile: null }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_department_lead, lead_departments")
    .eq("id", user.id)
    .single()

  let query = supabase.from("profiles").select("*").order("last_name", { ascending: true })

  if (profile?.is_department_lead && profile.lead_departments) {
    query = query.in("department", profile.lead_departments)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return { profiles: data || [], userProfile: profile }
}

interface Profile {
  id: string
  first_name: string
  last_name: string
  company_email: string
  department: string
  company_role: string | null
  phone_number: string | null
  role: UserRole
  job_description: string | null
  job_description_updated_at: string | null
  created_at: string
}

interface UserProfile {
  role: UserRole
  is_department_lead?: boolean
  lead_departments?: string[]
}

export default function AdminJobDescriptionsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [employeeFilter, setEmployeeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [nameSortOrder, setNameSortOrder] = useState<"asc" | "desc">("asc")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)

  const { data } = useQuery({
    queryKey: QUERY_KEYS.adminJobDescriptions(),
    queryFn: fetchJobDescriptionsData,
  })

  const profiles = data?.profiles ?? []

  const handleViewJobDescription = (profile: Profile) => {
    setSelectedProfile(profile)
    setIsViewDialogOpen(true)
  }

  const filteredProfiles = profiles
    .filter((profile) => {
      const matchesSearch =
        profile.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.company_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.company_role?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesDepartment = departmentFilter === "all" || profile.department === departmentFilter
      const matchesEmployee = employeeFilter === "all" || profile.id === employeeFilter
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "completed" && profile.job_description) ||
        (statusFilter === "pending" && !profile.job_description)

      return matchesSearch && matchesDepartment && matchesEmployee && matchesStatus
    })
    .sort((a, b) => {
      const lastNameA = formatName(a.last_name).toLowerCase()
      const lastNameB = formatName(b.last_name).toLowerCase()
      return nameSortOrder === "asc" ? lastNameA.localeCompare(lastNameB) : lastNameB.localeCompare(lastNameA)
    })

  const departments = Array.from(new Set(profiles.map((p) => p.department).filter(Boolean))) as string[]

  const stats = {
    total: profiles.length,
    completed: profiles.filter((p) => p.job_description).length,
    pending: profiles.filter((p) => !p.job_description).length,
    thisMonth: profiles.filter(
      (p) =>
        p.job_description_updated_at &&
        new Date(p.job_description_updated_at).getMonth() === new Date().getMonth() &&
        new Date(p.job_description_updated_at).getFullYear() === new Date().getFullYear()
    ).length,
  }

  return (
    <AdminTablePage
      title="Job Descriptions"
      description="View and manage employee job descriptions"
      icon={Briefcase}
      actions={
        <div className="flex items-center rounded-lg border p-1">
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="gap-2"
          >
            <List className="h-4 w-4" />
            List
          </Button>
          <Button
            variant={viewMode === "card" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("card")}
            className="gap-2"
          >
            <LayoutGrid className="h-4 w-4" />
            Card
          </Button>
        </div>
      }
      stats={
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 md:gap-4">
          <StatCard title="Total employee" value={stats.total} icon={User} />
          <StatCard
            title="Completed"
            value={stats.completed}
            icon={CheckCircle}
            iconBgColor="bg-green-100 dark:bg-green-900/30"
            iconColor="text-green-600 dark:text-green-400"
          />
          <StatCard
            title="Pending"
            value={stats.pending}
            icon={XCircle}
            iconBgColor="bg-orange-100 dark:bg-orange-900/30"
            iconColor="text-orange-600 dark:text-orange-400"
          />
          <StatCard
            title="Updated This Month"
            value={stats.thisMonth}
            icon={Calendar}
            iconBgColor="bg-purple-100 dark:bg-purple-900/30"
            iconColor="text-purple-600 dark:text-purple-400"
          />
        </div>
      }
      filters={
        <JobDescriptionFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          departmentFilter={departmentFilter}
          onDepartmentChange={setDepartmentFilter}
          employeeFilter={employeeFilter}
          onEmployeeChange={setEmployeeFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          departments={departments}
          profiles={profiles}
        />
      }
      filtersInCard={false}
    >
      {filteredProfiles.length > 0 ? (
        viewMode === "list" ? (
          <JobDescriptionListView
            profiles={filteredProfiles}
            nameSortOrder={nameSortOrder}
            onToggleSort={() => setNameSortOrder(nameSortOrder === "asc" ? "desc" : "asc")}
            onView={handleViewJobDescription}
          />
        ) : (
          <JobDescriptionCardView profiles={filteredProfiles} onView={handleViewJobDescription} />
        )
      ) : (
        <Card className="border-2">
          <CardContent className="p-12 text-center">
            <EmptyState
              icon={Briefcase}
              title="No employee found"
              description={
                searchQuery || departmentFilter !== "all" || employeeFilter !== "all" || statusFilter !== "all"
                  ? "No employee matches your filters."
                  : "No employee members found."
              }
            />
          </CardContent>
        </Card>
      )}

      <JobDescriptionDialog profile={selectedProfile} isOpen={isViewDialogOpen} onOpenChange={setIsViewDialogOpen} />
    </AdminTablePage>
  )
}
