"use client"

import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { QUERY_KEYS } from "@/lib/query-keys"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatName, cn } from "@/lib/utils"
import {
  ArrowLeft,
  Users,
  Mail,
  Phone,
  Building2,
  MapPin,
  Shield,
  UserCog,
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  FileText,
  Plus,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import type { UserRole, EmploymentStatus } from "@/types/database"
import { getRoleDisplayName, getRoleBadgeColor, canAssignRoles } from "@/lib/permissions"
import { useDepartments } from "@/hooks/use-departments"
import { EmployeeStatusBadge } from "@/components/hr/employee-status-badge"
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
  company_role: string | null
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
  const { departments: DEPARTMENTS } = useDepartments()
  const searchParams = useSearchParams()
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees)
  const [isLoading, setIsLoading] = useState(false)
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
  const [isDeleting, setIsDeleting] = useState(false)
  const [assignedItems, setAssignedItems] = useState<{
    tasks: any[]
    taskAssignments: any[]
    assets: any[]
    projects: any[]
    projectMemberships: any[]
    feedback: any[]
    documentation: any[]
  }>({
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
    Position: true,
    "Phone Number": true,
    "Residential Address": true,
    "Office Location": true,
    "Employment Date": true,
    "Lead Departments": true,
    "Created At": true,
  })
  const [viewEmployeeProfile, setViewEmployeeProfile] = useState<any>(null)
  const [viewEmployeeData, setViewEmployeeData] = useState<{
    tasks: any[]
    assets: any[]
    documentation: any[]
  }>({ tasks: [], assets: [], documentation: [] })
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
    company_role: "",
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

  const supabase = createClient()
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

  // Handle userId from search params (for edit dialog)
  useEffect(() => {
    const userId = searchParams?.get("userId")
    if (userId && employees.length > 0 && !isViewDialogOpen) {
      const user = employees.find((s) => s.id === userId)
      if (user) {
        handleEditEmployee(user)
      }
    }
  }, [searchParams, employees, isViewDialogOpen])

  const loadData = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminEmployees() })
  }

  const handleEditEmployee = async (employee: Employee) => {
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
          company_role: fullProfile.company_role || "",
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
          company_role: employee.company_role || "",
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
      setViewEmployeeProfile(employee as any)
      setModalViewMode("edit")
      setIsViewDialogOpen(true)
    } catch (error: any) {
      log.error({ err: String(error) }, "error loading employees for edit")
      toast.error("Failed to load employees details")
    }
  }

  const handleViewEmployeeSignature = async (employee: Employee) => {
    try {
      setSelectedEmployee(employee)

      setModalViewMode("signature")
      setIsViewDialogOpen(true)
      setViewEmployeeProfile(employee as any)

      // Load full profile data for signature
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", employee.id).single()

      if (profileData) {
        const fullProfile = profileData as any
        setSelectedEmployee(fullProfile)
        // If we're in view dialog, update the viewEmployeeProfile too
        if (isViewDialogOpen) {
          setViewEmployeeProfile(fullProfile)
        }
      }
    } catch (error: any) {
      log.error({ err: String(error) }, "error loading profile for signature")
      toast.error("Failed to load profile data")
    }
  }

  const handleViewEmployeeDetails = async (employee: Employee) => {
    try {
      setSelectedEmployee(employee)
      setModalViewMode("profile") // Always reset to profile when opening fresh
      setIsViewDialogOpen(true)
      setViewEmployeeData({ tasks: [], assets: [], documentation: [] })

      const response = await fetch(`/api/admin/hr/employees/${employee.id}/overview`, { cache: "no-store" })
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        profile?: any
        related?: { tasks?: any[]; assets?: any[]; documentation?: any[] }
      }

      if (!response.ok) throw new Error(payload.error || "Failed to load employee details")
      if (!payload.profile) throw new Error("Employee profile not found")

      setViewEmployeeProfile(payload.profile)
      setViewEmployeeData({
        tasks: payload.related?.tasks || [],
        assets: payload.related?.assets || [],
        documentation: payload.related?.documentation || [],
      })
    } catch (error: any) {
      log.error({ err: String(error) }, "error loading employee details")
      toast.error("Failed to load employees details")
    }
  }

  const checkAssignedItems = async (employee: Employee) => {
    try {
      const [
        tasksResult,
        taskAssignmentsResult,
        assetsResult,
        projectsResult,
        projectMembersResult,
        feedbackResult,
        docsResult,
      ] = await Promise.all([
        // Tasks assigned to this user
        supabase.from("tasks").select("id, title, status").eq("assigned_to", employee.id),
        // Task assignments (multiple user assignments)
        supabase
          .from("task_assignments")
          .select("id, task_id, Task:tasks(id, title, status)")
          .eq("user_id", employee.id),
        // Current asset assignments
        supabase
          .from("asset_assignments")
          .select("id, Asset:assets(id, asset_name, asset_type, unique_code, serial_number)")
          .eq("assigned_to", employee.id)
          .eq("is_current", true),
        // Projects managed or created by this user
        supabase
          .from("projects")
          .select("id, project_name, status")
          .or(`project_manager_id.eq.${employee.id},created_by.eq.${employee.id}`),
        // Active project memberships
        supabase
          .from("project_members")
          .select("id, Project:projects(id, project_name)")
          .eq("user_id", employee.id)
          .eq("is_active", true),
        // Feedback submitted by this user
        supabase.from("feedback").select("id, title, status").eq("user_id", employee.id),
        // User documentation
        supabase.from("user_documentation").select("id, title").eq("user_id", employee.id),
      ])

      const assigned = {
        tasks: tasksResult.data || [],
        taskAssignments: taskAssignmentsResult.data || [],
        assets: assetsResult.data || [],
        projects: projectsResult.data || [],
        projectMemberships: projectMembersResult.data || [],
        feedback: feedbackResult.data || [],
        documentation: docsResult.data || [],
      }

      setAssignedItems(assigned)
      return assigned
    } catch (error: any) {
      log.error({ err: String(error) }, "error checking assigned items")
      toast.error("Failed to check assigned items")
      return null
    }
  }

  const handleDeleteEmployee = async (employee: Employee) => {
    setSelectedEmployee(employee)
    toast.error("User deletion is disabled. Suspend or deactivate the employee instead.")
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

      const trimmedAdditionalEmail = editForm.additional_email.trim()
      if (trimmedAdditionalEmail && !formValidation.isEmail(trimmedAdditionalEmail)) {
        toast.error("Additional email must be a valid email address")
        setIsSaving(false)
        return
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

      const isLead = editForm.is_department_lead

      // Build update object with all fields
      const updateData: any = {
        role: editForm.role,
        admin_domains: editForm.role === "admin" ? editForm.admin_domains : null,
        department: editForm.department,
        office_location: editForm.office_location || null,
        company_role: editForm.company_role || null,
        is_department_lead: isLead,
        lead_departments: isLead ? editForm.lead_departments : [],
        updated_at: new Date().toISOString(),
        // Always include expanded fields if they exist in form state
        first_name: editForm.first_name || null,
        last_name: editForm.last_name || null,
        other_names: editForm.other_names || null,
        additional_email: trimmedAdditionalEmail || null,
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
          setViewEmployeeProfile(updatedProfile as any)
        }
      }

      loadData()
    } catch (error: any) {
      log.error({ err: String(error) }, "error updating employee")
      toast.error(error?.message || "Failed to update employees member")
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
    } catch (error: any) {
      log.error({ err: String(error) }, "error creating user")
      toast.error(error.message || "Failed to create user")
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
        (member.company_role || "").toLowerCase().includes(searchQuery.toLowerCase())

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

  // Helper function to get export data with selected columns
  const getExportData = (employeeList: Employee[]) => {
    return employeeList.map((member, index) => {
      const row: Record<string, any> = {}
      if (selectedColumns["#"]) row["#"] = index + 1
      if (selectedColumns["Employee No."]) row["Employee No."] = member.employee_number || "-"
      if (selectedColumns["Last Name"]) row["Last Name"] = formatName(member.last_name) || "-"
      if (selectedColumns["First Name"]) row["First Name"] = formatName(member.first_name) || "-"
      if (selectedColumns["Other Names"]) row["Other Names"] = member.other_names || "-"
      if (selectedColumns["Email"]) row["Email"] = member.company_email || "-"
      if (selectedColumns["Additional Email"]) row["Additional Email"] = member.additional_email || "-"
      if (selectedColumns["Department"]) row["Department"] = member.department || "-"
      if (selectedColumns["Role"]) row["Role"] = getRoleDisplayName(member.role)
      if (selectedColumns["Position"]) row["Position"] = member.company_role || "-"
      if (selectedColumns["Phone Number"]) row["Phone Number"] = member.phone_number || "-"
      if (selectedColumns["Additional Phone"]) row["Additional Phone"] = member.additional_phone || "-"
      if (selectedColumns["Residential Address"]) row["Residential Address"] = member.residential_address || "-"
      if (selectedColumns["Office Location"]) row["Office Location"] = member.office_location || "-"
      if (selectedColumns["Bank Name"]) row["Bank Name"] = member.bank_name || "-"
      if (selectedColumns["Bank Account Number"]) row["Bank Account Number"] = member.bank_account_number || "-"
      if (selectedColumns["Bank Account Name"]) row["Bank Account Name"] = member.bank_account_name || "-"
      if (selectedColumns["Date of Birth"]) row["Date of Birth"] = member.date_of_birth || "-"
      if (selectedColumns["Employment Date"]) row["Employment Date"] = member.employment_date || "-"
      if (selectedColumns["Is Lead"]) row["Is Lead"] = member.is_department_lead ? "Yes" : "No"
      if (selectedColumns["Lead Departments"])
        row["Lead Departments"] = member.lead_departments?.length ? member.lead_departments.join(", ") : "-"
      if (selectedColumns["Created At"])
        row["Created At"] = member.created_at ? new Date(member.created_at).toLocaleDateString() : "-"
      return row
    })
  }

  // Export functions
  const handleExportClick = (type: "excel" | "pdf" | "word") => {
    setExportType(type)
    setExportEmployeeDialogOpen(true)
  }

  const exportEmployeesToExcel = async () => {
    try {
      if (filteredEmployees.length === 0) {
        toast.error("No employees data to export")
        return
      }

      const XLSX = await import("xlsx")
      const { default: saveAs } = await import("file-saver")

      const dataToExport = getExportData(filteredEmployees)

      const ws = XLSX.utils.json_to_sheet(dataToExport)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Employees")

      const maxWidth = 60
      const cols = Object.keys(dataToExport[0] || {}).map((key) => ({
        wch: Math.min(
          Math.max(key.length, ...dataToExport.map((row) => String(row[key as keyof typeof row]).length)),
          maxWidth
        ),
      }))
      ws["!cols"] = cols

      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" })
      const data = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      saveAs(data, `employees-export-${new Date().toISOString().split("T")[0]}.xlsx`)
      toast.success("Employees exported to Excel successfully")
      setExportEmployeeDialogOpen(false)
    } catch (error: any) {
      log.error({ err: String(error) }, "error exporting to excel")
      toast.error("Failed to export employees to Excel")
    }
  }

  const exportEmployeesToPDF = async () => {
    try {
      if (filteredEmployees.length === 0) {
        toast.error("No employees data to export")
        return
      }

      const jsPDF = (await import("jspdf")).default
      const autoTable = (await import("jspdf-autotable")).default

      const doc = new jsPDF({ orientation: "landscape" })
      doc.setFontSize(16)
      doc.text("ACOB Employee Report", 14, 15)
      doc.setFontSize(10)
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22)
      doc.text(`Total Employees: ${filteredEmployees.length}`, 14, 28)

      // Prepare data with selected columns
      const dataToExport = filteredEmployees.map((member, index) => {
        const row: any[] = []
        const headers: string[] = []

        if (selectedColumns["#"]) {
          row.push(index + 1)
          headers.push("#")
        }
        if (selectedColumns["Last Name"]) {
          row.push(formatName(member.last_name) || "-")
          headers.push("Last Name")
        }
        if (selectedColumns["First Name"]) {
          row.push(formatName(member.first_name) || "-")
          headers.push("First Name")
        }
        if (selectedColumns["Other Names"]) {
          row.push(member.other_names || "-")
          headers.push("Other Names")
        }
        if (selectedColumns["Email"]) {
          row.push(member.company_email || "-")
          headers.push("Email")
        }
        if (selectedColumns["Additional Email"]) {
          row.push(member.additional_email || "-")
          headers.push("Additional Email")
        }
        if (selectedColumns["Department"]) {
          row.push(member.department || "-")
          headers.push("Department")
        }
        if (selectedColumns["Role"]) {
          row.push(getRoleDisplayName(member.role))
          headers.push("Role")
        }
        if (selectedColumns["Position"]) {
          row.push(member.company_role || "-")
          headers.push("Position")
        }
        if (selectedColumns["Phone Number"]) {
          row.push(member.phone_number || "-")
          headers.push("Phone Number")
        }
        if (selectedColumns["Additional Phone"]) {
          row.push(member.additional_phone || "-")
          headers.push("Additional Phone")
        }
        if (selectedColumns["Residential Address"]) {
          row.push(member.residential_address || "-")
          headers.push("Residential Address")
        }
        if (selectedColumns["Office Location"]) {
          row.push(member.office_location || "-")
          headers.push("Office Location")
        }
        if (selectedColumns["Bank Name"]) {
          row.push(member.bank_name || "-")
          headers.push("Bank Name")
        }
        if (selectedColumns["Bank Account Number"]) {
          row.push(member.bank_account_number || "-")
          headers.push("Bank Account Number")
        }
        if (selectedColumns["Bank Account Name"]) {
          row.push(member.bank_account_name || "-")
          headers.push("Bank Account Name")
        }
        if (selectedColumns["Date of Birth"]) {
          row.push(member.date_of_birth || "-")
          headers.push("Date of Birth")
        }
        if (selectedColumns["Employment Date"]) {
          row.push(member.employment_date || "-")
          headers.push("Employment Date")
        }
        if (selectedColumns["Is Lead"]) {
          row.push(member.is_department_lead ? "Yes" : "No")
          headers.push("Is Lead")
        }
        if (selectedColumns["Lead Departments"]) {
          row.push(member.lead_departments?.length ? member.lead_departments.join(", ") : "-")
          headers.push("Lead Departments")
        }
        if (selectedColumns["Created At"]) {
          row.push(member.created_at ? new Date(member.created_at).toLocaleDateString() : "-")
          headers.push("Created At")
        }

        return { row, headers }
      })

      const headers = dataToExport[0]?.headers || []
      const body = dataToExport.map((d) => d.row)

      autoTable(doc, {
        head: [headers],
        body: body,
        startY: 35,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [34, 197, 94], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      })

      doc.save(`acob-employee-report-${new Date().toISOString().split("T")[0]}.pdf`)
      toast.success("Employees exported to PDF successfully")
      setExportEmployeeDialogOpen(false)
    } catch (error: any) {
      log.error({ err: String(error) }, "error exporting to pdf")
      toast.error("Failed to export employees to PDF")
    }
  }

  const exportEmployeesToWord = async () => {
    try {
      if (filteredEmployees.length === 0) {
        toast.error("No employees data to export")
        return
      }

      const {
        Document,
        Packer,
        Paragraph,
        Table,
        TableCell,
        TableRow,
        WidthType,
        AlignmentType,
        HeadingLevel,
        TextRun,
      } = await import("docx")
      const { default: saveAs } = await import("file-saver")

      const dataToExport = getExportData(filteredEmployees)

      // Build header row based on selected columns
      const headerCells: any[] = []
      Object.keys(selectedColumns).forEach((column) => {
        if (selectedColumns[column]) {
          headerCells.push(
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: column, bold: true })] })],
            })
          )
        }
      })

      // Create header row
      const tableRows = [
        new TableRow({ children: headerCells }),
        ...dataToExport.map((row) => {
          const rowCells: any[] = []
          Object.keys(selectedColumns).forEach((column) => {
            if (selectedColumns[column]) {
              rowCells.push(new TableCell({ children: [new Paragraph(String(row[column] || "-"))] }))
            }
          })
          return new TableRow({ children: rowCells })
        }),
      ]

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                text: "ACOB Employee Report",
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                text: `Generated on: ${new Date().toLocaleDateString()}`,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                text: `Total Employees: ${filteredEmployees.length}`,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({ text: "" }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: tableRows,
              }),
            ],
          },
        ],
      })

      const blob = await Packer.toBlob(doc)
      saveAs(blob, `employees-export-${new Date().toISOString().split("T")[0]}.docx`)
      toast.success("Employee exported to Word successfully")
    } catch (error: any) {
      log.error({ err: String(error) }, "error exporting to word")
      toast.error("Failed to export employees to Word")
    }
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold sm:gap-3 sm:text-3xl">
              <Users className="text-primary h-6 w-6 sm:h-8 sm:w-8" />
              Employee Management
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              View and manage employees members, roles, and permissions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/hr">
              <Button variant="outline" className="gap-2" size="sm">
                <ArrowLeft className="h-4 w-4" />
                Back to HR
              </Button>
            </Link>
            {canManageUsers && <PendingApplicationsModal onEmployeeCreated={loadData} />}
            {canManageUsers && (
              <Button onClick={() => setIsCreateUserDialogOpen(true)} className="gap-2" size="sm">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create User</span>
              </Button>
            )}
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

        {/* Export Buttons */}
        <Card className="border-2">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Download className="text-muted-foreground h-4 w-4" />
                <span className="text-foreground text-sm font-medium">Export Filtered Employee:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/admin/hr/employees/offboarding-conflicts">
                  <Button variant="secondary" size="sm" className="gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Offboarding Conflicts
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportClick("excel")}
                  className="flex-1 gap-2 sm:flex-none"
                  disabled={filteredEmployees.length === 0}
                >
                  <FileText className="h-4 w-4" />
                  <span className="text-xs sm:text-sm">Excel (.xlsx)</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportClick("pdf")}
                  className="flex-1 gap-2 sm:flex-none"
                  disabled={filteredEmployees.length === 0}
                >
                  <FileText className="h-4 w-4" />
                  <span className="text-xs sm:text-sm">PDF</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportClick("word")}
                  className="flex-1 gap-2 sm:flex-none"
                  disabled={filteredEmployees.length === 0}
                >
                  <FileText className="h-4 w-4" />
                  <span className="text-xs sm:text-sm">Word (.docx)</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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
        {filteredEmployees.length > 0 ? (
          viewMode === "list" ? (
            <Card className="border-2">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <span>Emp. No.</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setSortConfig((current) => ({
                                key: "employee_number",
                                direction:
                                  current.key === "employee_number" && current.direction === "asc" ? "desc" : "asc",
                              }))
                            }
                            className="h-6 w-6 p-0"
                          >
                            {sortConfig.key === "employee_number" ? (
                              sortConfig.direction === "asc" ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : (
                                <ArrowDown className="h-3 w-3" />
                              )
                            ) : (
                              <ArrowUpDown className="text-muted-foreground/30 h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <span>Name</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setSortConfig((current) => ({
                                key: "last_name",
                                direction: current.key === "last_name" && current.direction === "asc" ? "desc" : "asc",
                              }))
                            }
                            className="h-6 w-6 p-0"
                          >
                            {sortConfig.key === "last_name" ? (
                              sortConfig.direction === "asc" ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : (
                                <ArrowDown className="h-3 w-3" />
                              )
                            ) : (
                              <ArrowUpDown className="text-muted-foreground/30 h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((member, index) => (
                      <TableRow
                        key={member.id}
                        className={cn(
                          member.employment_status === "separated" && "opacity-60",
                          member.is_department_lead && "border-l-2 border-l-amber-500/70"
                        )}
                      >
                        <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <span className="text-muted-foreground font-mono text-sm">
                            {member.employee_number || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="whitespace-nowrap">
                            <span
                              className={cn(
                                "text-foreground font-medium",
                                member.employment_status === "separated" && "text-muted-foreground line-through"
                              )}
                            >
                              {formatName(member.last_name)}, {formatName(member.first_name)}
                            </span>
                            {member.is_department_lead && (
                              <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                                <Shield className="h-3 w-3" />
                                <span>Dept Lead</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-muted-foreground flex flex-col gap-1 text-sm">
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3" />
                              <span className="max-w-[200px] truncate">{member.company_email}</span>
                            </div>
                            {member.additional_email && (
                              <div className="pl-5 text-xs">
                                <span className="text-muted-foreground/80 max-w-[200px] truncate">
                                  {member.additional_email}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-foreground text-sm">{member.department || "-"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge className={getRoleBadgeColor(member.role)}>{getRoleDisplayName(member.role)}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground text-sm">{member.company_role || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <EmployeeStatusBadge status={member.employment_status || "active"} size="sm" />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 sm:gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs sm:h-auto sm:text-sm"
                              onClick={() => handleViewEmployeeDetails(member)}
                            >
                              <span className="hidden sm:inline">View</span>
                              <span className="sm:hidden">👁</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredEmployees.map((member) => (
                <Card
                  key={member.id}
                  className={`border-2 transition-shadow hover:shadow-lg ${member.employment_status === "separated" ? "opacity-60" : ""}`}
                >
                  <CardHeader className="from-primary/5 to-background border-b bg-linear-to-r">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-1 items-start gap-3">
                        <div className="bg-primary/10 rounded-lg p-2">
                          <Users className="text-primary h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle
                            className={cn(
                              "text-lg",
                              member.employment_status === "separated" && "text-muted-foreground line-through"
                            )}
                          >
                            {member.first_name} {member.last_name}
                          </CardTitle>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge className={getRoleBadgeColor(member.role)}>{getRoleDisplayName(member.role)}</Badge>
                            <EmployeeStatusBadge status={member.employment_status || "active"} size="sm" />
                            {member.is_department_lead &&
                              member.lead_departments &&
                              member.lead_departments.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {member.lead_departments.length} Dept
                                  {member.lead_departments.length > 1 ? "s" : ""}
                                </Badge>
                              )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{member.company_email}</span>
                        {member.additional_email && (
                          <span className="text-muted-foreground/80 truncate text-xs">{member.additional_email}</span>
                        )}
                      </div>
                    </div>

                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4" />
                      <span>{member.department || "-"}</span>
                    </div>

                    {member.company_role && (
                      <div className="text-muted-foreground flex items-center gap-2 text-sm">
                        <UserCog className="h-4 w-4" />
                        <span>{member.company_role}</span>
                      </div>
                    )}

                    {member.phone_number && (
                      <div className="text-muted-foreground flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4" />
                        <span>{member.phone_number}</span>
                      </div>
                    )}

                    {member.office_location && (
                      <div className="text-muted-foreground flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4" />
                        <span>{member.office_location}</span>
                      </div>
                    )}

                    {member.is_department_lead && member.lead_departments.length > 0 && (
                      <div className="border-t pt-2">
                        <p className="text-muted-foreground mb-1 text-xs">Leading:</p>
                        <div className="flex flex-wrap gap-1">
                          {member.lead_departments.map((dept, idx) => (
                            <span
                              key={idx}
                              className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                            >
                              {dept}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewEmployeeDetails(member)}
                        className="flex-1"
                      >
                        View Profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : (
          <Card className="border-2">
            <CardContent className="p-12 text-center">
              <Users className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
              <h3 className="text-foreground mb-2 text-xl font-semibold">No Employee Found</h3>
              <p className="text-muted-foreground">
                {searchQuery || departmentFilter.length > 0 || roleFilter.length > 0 || employeeFilter.length > 0
                  ? "No employees matches your filters"
                  : "No employees members found"}
              </p>
            </CardContent>
          </Card>
        )}
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
        onConfirm={() => {
          if (exportType === "excel") {
            exportEmployeesToExcel()
          } else if (exportType === "pdf") {
            exportEmployeesToPDF()
          } else if (exportType === "word") {
            exportEmployeesToWord()
          }
        }}
      />
    </div>
  )
}
