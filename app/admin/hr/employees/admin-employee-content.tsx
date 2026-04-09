"use client"

import { useCallback, useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { QUERY_KEYS } from "@/lib/query-keys"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatName } from "@/lib/utils"
import { ArrowLeft, Users, Shield, UserCog, LayoutGrid, List, Download, Plus, Loader2 } from "lucide-react"
import type { UserRole, EmploymentStatus } from "@/types/database"
import { getRoleDisplayName, getRoleBadgeColor, canAssignRoles } from "@/lib/permissions"
import { PendingApplicationsModal } from "./pending-applications-modal"
import { formValidation } from "@/lib/validation"
import {
  canManageDeveloperAccounts,
  canManageSuperAdminAccounts,
  getAssignableRolesForActor,
} from "@/lib/role-management"
import { logger } from "@/lib/logger"
import { CreateUserDialog } from "@/components/employees/CreateUserDialog"
import { EmployeeViewModal } from "@/components/employees/EmployeeViewModal"
import { EmployeeDeletionDialog } from "@/components/employees/EmployeeDeletionDialog"
import { EmployeeExportDialog } from "@/components/employees/EmployeeExportDialog"
import { EmployeeFilterBar } from "@/components/employees/EmployeeFilterBar"
import {
  buildEmployeeExportRows,
  exportEmployeesToExcel,
  exportEmployeesToPDF,
  exportEmployeesToWord,
} from "@/lib/employees/employee-export"
import { EmployeeListView } from "@/components/employees/EmployeeListView"
import type { Database } from "@/types/database"
import type { EmployeeAssignedItems, EmployeeProfile, EmployeeViewData } from "@/components/employees/types"
import { ExportOptionsDialog } from "@/components/admin/export-options-dialog"

const log = logger("hr-employees-admin-employee-content")

async function fetchAllEmployees(): Promise<Employee[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("profiles").select("*").order("last_name", { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}

export interface Employee {
  id: string
  employee_number: string | null
  first_name: string
  last_name: string
  other_names: string | null
  company_email: string
  additional_email: string | null
  department: string
  designation: string | null
  role: UserRole
  admin_domains?: string[] | null
  phone_number: string | null
  additional_phone: string | null
  residential_address: string | null
  office_location: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_account_name: string | null
  date_of_birth: string | null
  employment_date: string | null
  is_admin: boolean
  is_department_lead: boolean
  lead_departments: string[]
  employment_status: EmploymentStatus
  created_at: string
}

export interface UserProfile {
  role: UserRole
  is_department_lead?: boolean
  managed_departments?: string[]
}

interface AdminEmployeeContentProps {
  initialEmployees: Employee[]
  userProfile: UserProfile
}

export function AdminEmployeeContent({ initialEmployees, userProfile }: AdminEmployeeContentProps) {
  const searchParams = useSearchParams()
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees)
  const [isLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([])
  const [employeeFilter, setEmployeeFilter] = useState<string[]>([])
  const [roleFilter, setRoleFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>(["active", "suspended", "on_leave"])
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "last_name",
    direction: "asc",
  })
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting] = useState(false)
  const [assignedItems] = useState<EmployeeAssignedItems>({
    tasks: [],
    taskAssignments: [],
    assets: [],
    projects: [],
    projectMemberships: [],
    feedback: [],
    documentation: [],
  })
  const [modalViewMode, setModalViewMode] = useState<"profile" | "employment" | "edit" | "signature" | "status">(
    "profile"
  )

  // Export dialog state
  const [exportOptionsOpen, setExportOptionsOpen] = useState(false)
  const [exportEmployeeDialogOpen, setExportEmployeeDialogOpen] = useState(false)
  const [exportType, setExportType] = useState<"excel" | "pdf" | "word" | null>(null)
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>({
    "#": true,
    "Employee No.": true,
    "Last Name": true,
    "First Name": true,
    "Other Names": true,
    Email: true,
    "Additional Email": true,
    Department: true,
    Role: true,
    Designation: true,
    "Phone Number": true,
    "Residential Address": true,
    "Office Location": true,
    "Employment Date": true,
    "Lead Departments": true,
    "Created At": true,
  })
  const [viewEmployeeProfile, setViewEmployeeProfile] = useState<EmployeeProfile | null>(null)
  const [viewEmployeeData, setViewEmployeeData] = useState<EmployeeViewData>({
    tasks: [],
    assets: [],
    documentation: [],
  })
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [createUserForm, setCreateUserForm] = useState({
    firstName: "",
    lastName: "",
    otherNames: "",
    email: "",
    department: "",
    companyRole: "",
    phoneNumber: "",
    role: "employee" as UserRole,
    admin_domains: [] as string[],
    employeeNumber: "",
  })

  // Form states
  const [editForm, setEditForm] = useState({
    role: "employee" as UserRole,
    admin_domains: [] as string[],
    is_department_lead: false,
    department: "",
    office_location: "",
    designation: "",
    lead_departments: [] as string[],
    // Expanded fields
    employee_number: "",
    first_name: "",
    last_name: "",
    other_names: "",
    company_email: "",
    additional_email: "",
    phone_number: "",
    additional_phone: "",
    residential_address: "",
    bank_name: "",
    bank_account_number: "",
    bank_account_name: "",
    date_of_birth: "",
    employment_date: "",
    job_description: "",
  })
  const [showMoreOptions, setShowMoreOptions] = useState(false)

  const [supabase] = useState(() => createClient())
  const queryClient = useQueryClient()
  const canManageUsers = ["developer", "super_admin", "admin"].includes(userProfile?.role || "")

  const { data: fetchedEmployees } = useQuery({
    queryKey: QUERY_KEYS.adminEmployees(),
    queryFn: fetchAllEmployees,
    initialData: initialEmployees,
  })

  // Keep employees state in sync with query result
  useEffect(() => {
    if (fetchedEmployees) setEmployees(fetchedEmployees)
  }, [fetchedEmployees])

  const loadData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminEmployees() })
  }, [queryClient])

  const handleEditEmployee = useCallback(
    async (employee: Employee) => {
      if (!canManageUsers) {
        toast.error("You can view users but cannot edit them")
        return
      }

      try {
        setSelectedEmployee(employee)

        // Load full profile data to get all fields
        const { data: fullProfile } = await supabase.from("profiles").select("*").eq("id", employee.id).single()

        if (fullProfile) {
          setEditForm({
            role: fullProfile.role || "employee",
            admin_domains: Array.isArray(fullProfile.admin_domains) ? fullProfile.admin_domains : [],
            is_department_lead: Boolean(fullProfile.is_department_lead),
            department: fullProfile.department || "",
            office_location: fullProfile.office_location || "",
            designation: fullProfile.designation || "",
            lead_departments: fullProfile.lead_departments || [],
            // Expanded fields
            employee_number: fullProfile.employee_number || "",
            first_name: fullProfile.first_name || "",
            last_name: fullProfile.last_name || "",
            other_names: fullProfile.other_names || "",
            company_email: fullProfile.company_email || "",
            additional_email: fullProfile.additional_email || "",
            phone_number: fullProfile.phone_number || "",
            additional_phone: fullProfile.additional_phone || "",
            residential_address: fullProfile.residential_address || "",
            bank_name: fullProfile.bank_name || "",
            bank_account_number: fullProfile.bank_account_number || "",
            bank_account_name: fullProfile.bank_account_name || "",
            date_of_birth: fullProfile.date_of_birth || "",
            employment_date: fullProfile.employment_date || "",
            job_description: fullProfile.job_description || "",
          })
        } else {
          // Fallback to basic fields if full profile not found
          setEditForm({
            role: employee.role,
            admin_domains: Array.isArray(employee.admin_domains) ? employee.admin_domains : [],
            is_department_lead: Boolean(employee.is_department_lead),
            department: employee.department,
            office_location: employee.office_location || "",
            designation: employee.designation || "",
            lead_departments: employee.lead_departments || [],
            employee_number: employee.employee_number || "",
            first_name: employee.first_name || "",
            last_name: employee.last_name || "",
            other_names: employee.other_names || "",
            company_email: employee.company_email || "",
            additional_email: employee.additional_email || "",
            phone_number: employee.phone_number || "",
            additional_phone: "",
            residential_address: employee.residential_address || "",
            bank_name: "",
            bank_account_number: "",
            bank_account_name: "",
            date_of_birth: "",
            employment_date: "",
            job_description: "",
          })
        }

        setShowMoreOptions(false) // Reset expanded state

        // Set profile states so the unified modal has data
        setSelectedEmployee(employee)
        setViewEmployeeProfile(employee)
        setModalViewMode("edit")
        setIsViewDialogOpen(true)
      } catch (error: unknown) {
        log.error({ err: String(error) }, "error loading employees for edit")
        toast.error("Failed to load employees details")
      }
    },
    [canManageUsers, supabase]
  )

  // Handle userId from search params (for edit dialog)
  useEffect(() => {
    const userId = searchParams?.get("userId")
    if (userId && employees.length > 0 && !isViewDialogOpen) {
      const user = employees.find((employeeRecord) => employeeRecord.id === userId)
      if (user) {
        void handleEditEmployee(user)
      }
    }
  }, [searchParams, employees, isViewDialogOpen, handleEditEmployee])

  const handleViewEmployeeSignature = async (employee: Employee) => {
    try {
      setSelectedEmployee(employee)

      setModalViewMode("signature")
      setIsViewDialogOpen(true)
      setViewEmployeeProfile(employee)

      // Load full profile data for signature
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", employee.id).single()

      if (profileData) {
        const fullProfile = profileData as EmployeeProfile
        setSelectedEmployee(fullProfile)
        // If we're in view dialog, update the viewEmployeeProfile too
        if (isViewDialogOpen) {
          setViewEmployeeProfile(fullProfile)
        }
      }
    } catch (error: unknown) {
      log.error({ err: String(error) }, "error loading profile for signature")
      toast.error("Failed to load profile data")
    }
  }

  const handleViewEmployeeDetails = async (employee: Employee) => {
    try {
      setSelectedEmployee(employee)
      setModalViewMode("profile") // Always reset to profile when opening fresh
      // Clear stale profile immediately so the modal never shows the previous
      // employee's data while the new fetch is in flight.
      setViewEmployeeProfile(null)
      setViewEmployeeData({ tasks: [], assets: [], documentation: [] })
      setIsViewDialogOpen(true)

      const response = await fetch(`/api/admin/hr/employees/${employee.id}/overview`, { cache: "no-store" })
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        profile?: EmployeeProfile
        related?: EmployeeViewData
      }

      if (!response.ok) throw new Error(payload.error || "Failed to load employee details")
      if (!payload.profile) throw new Error("Employee profile not found")

      setViewEmployeeProfile(payload.profile)
      setViewEmployeeData({
        tasks: payload.related?.tasks || [],
        assets: payload.related?.assets || [],
        documentation: payload.related?.documentation || [],
      })
    } catch (error: unknown) {
      log.error({ err: String(error) }, "error loading employee details")
      toast.error("Failed to load employees details")
    }
  }

  const confirmDeleteEmployee = async () => {
    if (!selectedEmployee) return
    toast.error("User deletion is disabled. Suspend or deactivate the employee instead.")
    setIsDeleteDialogOpen(false)
  }

  const handleSaveEmployee = async () => {
    if (isSaving) return // Prevent duplicate submissions
    setIsSaving(true)
    try {
      if (!canManageUsers) {
        toast.error("You can view users but cannot edit them")
        setIsSaving(false)
        return
      }

      if (!selectedEmployee) {
        setIsSaving(false)
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user && selectedEmployee.id === user.id && editForm.role !== selectedEmployee.role) {
        toast.error("You cannot change your own role from the HR employee editor")
        setIsSaving(false)
        return
      }

      // Check if user can assign this role
      if (userProfile && !canAssignRoles(userProfile.role, editForm.role)) {
        toast.error("You don't have permission to assign this role")
        setIsSaving(false)
        return
      }

      if (editForm.role === "developer" && !canManageDeveloperAccounts(userProfile?.role || "")) {
        toast.error("Only super admin or developer can assign the developer role")
        setIsSaving(false)
        return
      }

      if (selectedEmployee.role === "developer" && !canManageDeveloperAccounts(userProfile?.role || "")) {
        toast.error("Only super admin or developer can modify a developer account")
        setIsSaving(false)
        return
      }

      if (selectedEmployee.role === "developer" && editForm.role !== "developer") {
        const { count, error: developerCountError } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "developer")

        if (developerCountError) throw developerCountError

        if ((count || 0) <= 1) {
          toast.error("Cannot downgrade the last developer account")
          setIsSaving(false)
          return
        }
      }

      if (
        (selectedEmployee.role === "super_admin" || editForm.role === "super_admin") &&
        !canManageSuperAdminAccounts(userProfile?.role || "")
      ) {
        toast.error("Only super admin can manage super admin accounts")
        setIsSaving(false)
        return
      }

      if (selectedEmployee.role === "super_admin" && editForm.role !== "super_admin") {
        const { count, error: superAdminCountError } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "super_admin")

        if (superAdminCountError) throw superAdminCountError

        if ((count || 0) <= 1) {
          toast.error("Cannot downgrade the last super admin account")
          setIsSaving(false)
          return
        }
      }

      if (editForm.is_department_lead && editForm.lead_departments.length !== 1) {
        toast.error("A department lead must have exactly one lead department")
        setIsSaving(false)
        return
      }

      if (editForm.is_department_lead && editForm.lead_departments[0] !== editForm.department) {
        toast.error("A department lead can only lead their own department")
        setIsSaving(false)
        return
      }
      if (editForm.role === "admin" && editForm.admin_domains.length === 0) {
        toast.error("Admin role requires at least one admin domain")
        setIsSaving(false)
        return
      }

      const companyEmail = editForm.company_email.trim().toLowerCase()
      const additionalEmail = editForm.additional_email.trim().toLowerCase()

      if (!companyEmail) {
        toast.error("Company email is required")
        setIsSaving(false)
        return
      }

      if (!formValidation.isCompanyEmail(companyEmail)) {
        toast.error("Only @acoblighting.com and @org.acoblighting.com emails are allowed")
        setIsSaving(false)
        return
      }

      if (additionalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(additionalEmail)) {
        toast.error("Additional email must be a valid email address")
        setIsSaving(false)
        return
      }

      const isLead = editForm.is_department_lead

      // Build update object with all fields
      const updateData: Database["public"]["Tables"]["profiles"]["Update"] = {
        role: editForm.role,
        admin_domains: editForm.role === "admin" ? editForm.admin_domains : null,
        department: editForm.department,
        office_location: editForm.office_location || null,
        designation: editForm.designation || null,
        is_department_lead: isLead,
        lead_departments: isLead ? editForm.lead_departments : [],
        updated_at: new Date().toISOString(),
        // Always include expanded fields if they exist in form state
        first_name: editForm.first_name || "",
        last_name: editForm.last_name || "",
        other_names: editForm.other_names || null,
        company_email: companyEmail,
        additional_email: additionalEmail || null,
        phone_number: editForm.phone_number || null,
        additional_phone: editForm.additional_phone || null,
        residential_address: editForm.residential_address || null,
        bank_name: editForm.bank_name || null,
        bank_account_number: editForm.bank_account_number || null,
        bank_account_name: editForm.bank_account_name || null,
        date_of_birth: editForm.date_of_birth || null,
        employment_date: editForm.employment_date || null,
        job_description: editForm.job_description || null,
      }

      const emailSyncResponse = await fetch(`/api/admin/hr/employees/${selectedEmployee.id}/email`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyEmail, additionalEmail: additionalEmail || null }),
      })
      const emailSyncResult = (await emailSyncResponse.json().catch(() => ({}))) as { error?: string }
      if (!emailSyncResponse.ok) {
        throw new Error(emailSyncResult.error || "Failed to sync employee login email")
      }

      const { error } = await supabase.from("profiles").update(updateData).eq("id", selectedEmployee.id)

      if (error) throw error

      toast.success("Employee updated successfully")

      // If we're in the unified view modal, switch back to profile mode and refresh data
      if (isViewDialogOpen) {
        setModalViewMode("profile")
        // Refresh the viewEmployeeProfile to show updated data immediately
        const { data: updatedProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", selectedEmployee.id)
          .single()

        if (updatedProfile) {
          setViewEmployeeProfile(updatedProfile as EmployeeProfile)
        }
      }

      loadData()
    } catch (error: unknown) {
      log.error({ err: String(error) }, "error updating employee")
      toast.error(error instanceof Error ? error.message : "Failed to update employees member")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateUser = async () => {
    if (isCreatingUser) return
    setIsCreatingUser(true)

    try {
      if (!canManageUsers) {
        toast.error("You can view users but cannot create users")
        setIsCreatingUser(false)
        return
      }

      // Validate required fields
      if (!createUserForm.firstName.trim() || !createUserForm.lastName.trim() || !createUserForm.email.trim()) {
        toast.error("First name, last name, and email are required")
        setIsCreatingUser(false)
        return
      }

      // Validate email domain
      if (!formValidation.isCompanyEmail(createUserForm.email)) {
        toast.error("Only @acoblighting.com and @org.acoblighting.com emails are allowed")
        setIsCreatingUser(false)
        return
      }

      // Validate employee number (required and format check)
      if (!createUserForm.employeeNumber.trim()) {
        toast.error("Employee number is required")
        setIsCreatingUser(false)
        return
      }

      // Validate employee number format: ACOB/YEAR/NUMBER (e.g., ACOB/2026/058)
      const empNumPattern = /^ACOB\/[0-9]{4}\/[0-9]{3}$/
      if (!empNumPattern.test(createUserForm.employeeNumber.trim())) {
        toast.error("Employee number must be in format: ACOB/YEAR/NUMBER (e.g., ACOB/2026/058)")
        setIsCreatingUser(false)
        return
      }

      // Check if user can assign this role
      if (userProfile && !canAssignRoles(userProfile.role, createUserForm.role)) {
        toast.error("You don't have permission to assign this role")
        setIsCreatingUser(false)
        return
      }
      if (createUserForm.role === "admin" && createUserForm.admin_domains.length === 0) {
        toast.error("Admin role requires at least one admin domain")
        setIsCreatingUser(false)
        return
      }

      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createUserForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create user")
      }

      toast.success("User created successfully! They can now login with their email and receive an OTP.")
      setIsCreateUserDialogOpen(false)
      setCreateUserForm({
        firstName: "",
        lastName: "",
        otherNames: "",
        email: "",
        department: "",
        companyRole: "",
        phoneNumber: "",
        role: "employee",
        admin_domains: [],
        employeeNumber: "",
      })
      loadData()
    } catch (error: unknown) {
      log.error({ err: String(error) }, "error creating user")
      toast.error(error instanceof Error ? error.message : "Failed to create user")
    } finally {
      setIsCreatingUser(false)
    }
  }

  const filteredEmployees = employees
    .filter((member) => {
      const matchesSearch =
        (member.first_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (member.last_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (member.company_email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (member.additional_email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (member.designation || "").toLowerCase().includes(searchQuery.toLowerCase())

      const matchesDepartment = departmentFilter.length === 0 || departmentFilter.includes(member.department)

      const matchesEmployee = employeeFilter.length === 0 || employeeFilter.includes(member.id)

      const matchesRole = roleFilter.length === 0 || roleFilter.includes(member.role)

      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(member.employment_status || "active")

      return matchesSearch && matchesDepartment && matchesEmployee && matchesRole && matchesStatus
    })
    .sort((a, b) => {
      const { key, direction } = sortConfig

      if (key === "employee_number") {
        const empNoA = (a.employee_number || "").toLowerCase()
        const empNoB = (b.employee_number || "").toLowerCase()
        return direction === "asc" ? empNoA.localeCompare(empNoB) : empNoB.localeCompare(empNoA)
      }

      const lastNameA = formatName(a.last_name).toLowerCase()
      const lastNameB = formatName(b.last_name).toLowerCase()

      if (direction === "asc") {
        return lastNameA.localeCompare(lastNameB)
      } else {
        return lastNameB.localeCompare(lastNameA)
      }
    })

  const departments = Array.from(new Set(employees.map((s) => s.department).filter(Boolean))) as string[]

  const roles: UserRole[] = ["visitor", "employee", "admin", "super_admin", "developer"]

  const stats = {
    total: employees.length,
    admins: employees.filter((s) => ["developer", "super_admin", "admin"].includes(s.role)).length,
    leads: employees.filter((s) => s.is_department_lead).length,
    employees: employees.filter((s) => s.role === "employee").length,
  }

  // Export functions
  const handleExportClick = (type: "excel" | "pdf" | "word") => {
    setExportType(type)
    setExportEmployeeDialogOpen(true)
  }

  const getAvailableRoles = (): UserRole[] => {
    if (!userProfile) return []
    return getAssignableRolesForActor(userProfile.role) as UserRole[]
  }

  if (isLoading) {
    return (
      <div className="from-background via-background to-muted/20 flex min-h-screen w-full items-center justify-center bg-gradient-to-br">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading employees...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="from-background via-background to-muted/20 min-h-screen w-full overflow-x-hidden bg-gradient-to-br">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/admin/hr"
              className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-2 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to HR
            </Link>
            <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold sm:gap-3 sm:text-3xl">
              <Users className="text-primary h-6 w-6 sm:h-8 sm:w-8" />
              Employee Management
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              View and manage employees members, roles, and permissions
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canManageUsers && <PendingApplicationsModal onEmployeeCreated={loadData} />}
            {canManageUsers && (
              <Button onClick={() => setIsCreateUserDialogOpen(true)} className="gap-2" size="sm">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create User</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOptionsOpen(true)}
              className="gap-2"
              disabled={filteredEmployees.length === 0}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <div className="flex items-center rounded-lg border p-1">
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="gap-1 sm:gap-2"
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">List</span>
              </Button>
              <Button
                variant={viewMode === "card" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("card")}
                className="gap-1 sm:gap-2"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Card</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
          <Card className="border-2">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground truncate text-[10px] font-medium">Total Employee</p>
                  <p className="text-foreground mt-0.5 text-base font-bold md:text-2xl">{stats.total}</p>
                </div>
                <div className="ml-1 shrink-0 rounded-lg bg-blue-100 p-1.5 dark:bg-blue-900/30">
                  <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground truncate text-[10px] font-medium">Admins</p>
                  <p className="text-foreground mt-0.5 text-base font-bold md:text-2xl">{stats.admins}</p>
                </div>
                <div className="ml-1 flex-shrink-0 rounded-lg bg-red-100 p-1.5 dark:bg-red-900/30">
                  <Shield className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground truncate text-[10px] font-medium">Leads</p>
                  <p className="text-foreground mt-0.5 text-base font-bold md:text-2xl">{stats.leads}</p>
                </div>
                <div className="ml-1 flex-shrink-0 rounded-lg bg-purple-100 p-1.5 dark:bg-purple-900/30">
                  <UserCog className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground truncate text-[10px] font-medium">Employee Members</p>
                  <p className="text-foreground mt-0.5 text-base font-bold md:text-2xl">{stats.employees}</p>
                </div>
                <div className="ml-1 flex-shrink-0 rounded-lg bg-green-100 p-1.5 dark:bg-green-900/30">
                  <Users className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <EmployeeFilterBar
          filters={{ searchQuery, departmentFilter, employeeFilter, roleFilter, statusFilter }}
          onFilterChange={(updated) => {
            if (updated.searchQuery !== undefined) setSearchQuery(updated.searchQuery)
            if (updated.departmentFilter !== undefined) setDepartmentFilter(updated.departmentFilter)
            if (updated.employeeFilter !== undefined) setEmployeeFilter(updated.employeeFilter)
            if (updated.roleFilter !== undefined) setRoleFilter(updated.roleFilter)
            if (updated.statusFilter !== undefined) setStatusFilter(updated.statusFilter)
          }}
          departments={departments}
          employees={employees}
          roles={roles}
        />

        {/* Employee List */}
        <EmployeeListView
          employees={filteredEmployees}
          viewMode={viewMode}
          sortConfig={sortConfig}
          onSortChange={setSortConfig}
          onViewDetails={handleViewEmployeeDetails}
          hasActiveFilters={
            Boolean(searchQuery) || departmentFilter.length > 0 || roleFilter.length > 0 || employeeFilter.length > 0
          }
          getRoleBadgeColor={getRoleBadgeColor}
          getRoleDisplayName={getRoleDisplayName}
        />
      </div>

      {/* Create User Dialog */}
      <CreateUserDialog
        isOpen={isCreateUserDialogOpen}
        onOpenChange={setIsCreateUserDialogOpen}
        form={createUserForm}
        setForm={setCreateUserForm}
        onCreate={handleCreateUser}
        isCreating={isCreatingUser}
        canManageUsers={canManageUsers}
        userProfile={userProfile}
      />

      {/* View Details Dialog */}
      <EmployeeViewModal
        isOpen={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        employee={viewEmployeeProfile}
        assignedItems={assignedItems}
        modalViewMode={modalViewMode}
        setModalViewMode={setModalViewMode}
        onSave={handleSaveEmployee}
        isSaving={isSaving}
        editForm={editForm}
        setEditForm={setEditForm}
        showMoreOptions={showMoreOptions}
        setShowMoreOptions={setShowMoreOptions}
        userProfile={userProfile}
        viewEmployeeData={viewEmployeeData}
        onEditEmployee={handleEditEmployee}
        onSignature={handleViewEmployeeSignature}
        loadData={loadData}
        setViewEmployeeProfile={setViewEmployeeProfile}
        canManageUsers={canManageUsers}
        getAvailableRoles={getAvailableRoles}
      />

      {/* Deletion Disabled Dialog */}
      <EmployeeDeletionDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        employee={selectedEmployee}
        assignedItems={assignedItems}
        onDelete={confirmDeleteEmployee}
        isDeleting={isDeleting}
      />

      {/* Export Column Selection Dialog */}
      <EmployeeExportDialog
        isOpen={exportEmployeeDialogOpen}
        onOpenChange={setExportEmployeeDialogOpen}
        exportType={exportType}
        setExportType={setExportType}
        selectedColumns={selectedColumns}
        setSelectedColumns={setSelectedColumns}
        onConfirm={async () => {
          const rows = buildEmployeeExportRows(filteredEmployees, { selectedColumns })
          const filename = `employees-export-${new Date().toISOString().split("T")[0]}`
          if (exportType === "excel") await exportEmployeesToExcel(rows, filename)
          else if (exportType === "pdf") await exportEmployeesToPDF(filteredEmployees, { selectedColumns }, filename)
          else if (exportType === "word") await exportEmployeesToWord(rows, filename)
          setExportEmployeeDialogOpen(false)
        }}
      />

      <ExportOptionsDialog
        open={exportOptionsOpen}
        onOpenChange={setExportOptionsOpen}
        title="Export Employees"
        options={[
          { id: "excel", label: "Excel (.xlsx)", icon: "excel" },
          { id: "pdf", label: "PDF", icon: "pdf" },
          { id: "word", label: "Word (.docx)", icon: "word" },
        ]}
        onSelect={(id) => {
          handleExportClick(id as "excel" | "pdf" | "word")
        }}
      />
    </div>
  )
}
