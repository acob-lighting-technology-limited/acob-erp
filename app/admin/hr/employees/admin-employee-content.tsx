"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select"
import { User } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatName, cn } from "@/lib/utils"
import {
  Users,
  Search,
  Filter,
  Edit,
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
  FileSignature,
  Download,
  FileText,
  Plus,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertTriangle,
} from "lucide-react"
import type { UserRole, EmploymentStatus } from "@/types/database"
import { getRoleDisplayName, getRoleBadgeColor, canAssignRoles, DEPARTMENTS, OFFICE_LOCATIONS } from "@/lib/permissions"
import { SignatureCreator } from "@/components/signature-creator"
import { ASSET_TYPE_MAP } from "@/lib/asset-types"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Calendar, User as UserIcon, UserCircle } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { EmployeeStatusBadge } from "@/components/hr/employee-status-badge"
import { ChangeStatusDialog, ChangeStatusContent } from "@/components/hr/change-status-dialog"
import { PendingApplicationsModal } from "./pending-applications-modal"
import { formValidation } from "@/lib/validation"

export interface Employee {
  id: string
  employee_number: string | null
  first_name: string
  last_name: string
  other_names: string | null
  company_email: string
  department: string
  company_role: string | null
  role: UserRole
  phone_number: string | null
  additional_phone: string | null
  residential_address: string | null
  current_work_location: string | null
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
}

interface AdminEmployeeContentProps {
  initialEmployees: Employee[]
  userProfile: UserProfile
}

export function AdminEmployeeContent({ initialEmployees, userProfile }: AdminEmployeeContentProps) {
  const searchParams = useSearchParams()
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([])
  const [employeeFilter, setEmployeeFilter] = useState<string[]>([])
  const [roleFilter, setRoleFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
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
    Department: true,
    Role: true,
    Position: true,
    "Phone Number": true,
    "Additional Phone": true,
    "Residential Address": true,
    "Work Location": true,
    "Office Location": true,
    "Bank Name": true,
    "Bank Account Number": true,
    "Bank Account Name": true,
    "Date of Birth": true,
    "Employment Date": true,
    "Is Lead": true,
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
    employeeNumber: "",
  })

  // Form states
  const [editForm, setEditForm] = useState({
    role: "employee" as UserRole,
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
    phone_number: "",
    additional_phone: "",
    residential_address: "",
    current_work_location: "",
    bank_name: "",
    bank_account_number: "",
    bank_account_name: "",
    date_of_birth: "",
    employment_date: "",
    job_description: "",
  })
  const [showMoreOptions, setShowMoreOptions] = useState(false)

  const supabase = createClient()

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

  const loadData = async () => {
    setIsLoading(true)
    try {
      // Fetch employees - leads can only see employees in their departments
      let query = supabase.from("profiles").select("*").order("last_name", { ascending: true })

      if (userProfile?.role === "lead") {
        // Leads see their departments (filtered server-side, but keep for refresh)
      }

      const { data, error } = await query

      if (error) throw error

      setEmployees(data || [])
    } catch (error: any) {
      console.error("Error loading employees:", error)
      toast.error("Failed to load employees")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditEmployee = async (employee: Employee) => {
    try {
      setSelectedEmployee(employee)

      // Load full profile data to get all fields
      const { data: fullProfile } = await supabase.from("profiles").select("*").eq("id", employee.id).single()

      if (fullProfile) {
        setEditForm({
          role: fullProfile.role || "employees",
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
          phone_number: fullProfile.phone_number || "",
          additional_phone: fullProfile.additional_phone || "",
          residential_address: fullProfile.residential_address || "",
          current_work_location: fullProfile.current_work_location || "",
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
          department: employee.department,
          office_location: employee.office_location || "",
          company_role: employee.company_role || "",
          lead_departments: employee.lead_departments || [],
          employee_number: employee.employee_number || "",
          first_name: employee.first_name || "",
          last_name: employee.last_name || "",
          other_names: employee.other_names || "",
          company_email: employee.company_email || "",
          phone_number: employee.phone_number || "",
          additional_phone: "",
          residential_address: employee.residential_address || "",
          current_work_location: employee.current_work_location || "",
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
      console.error("Error loading employees for edit:", error)
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
      console.error("Error loading profile for signature:", error)
      toast.error("Failed to load profile data")
    }
  }

  const handleViewEmployeeDetails = async (employee: Employee) => {
    try {
      setSelectedEmployee(employee)
      setModalViewMode("profile") // Always reset to profile when opening fresh
      setIsViewDialogOpen(true)

      // Load full profile data
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", employee.id).single()

      if (profileData) {
        setViewEmployeeProfile(profileData)

        // Load related data
        const [tasksResult, assetAssignmentsResult, deptAssetsResult, officeAssetsResult, docsResult] =
          await Promise.all([
            supabase
              .from("tasks")
              .select("*")
              .eq("assigned_to", employee.id)
              .order("created_at", { ascending: false })
              .limit(10),
            // Individual asset assignments
            supabase
              .from("asset_assignments")
              .select("id, asset_id, assigned_at, is_current, assignment_type")
              .eq("assigned_to", employee.id)
              .eq("is_current", true)
              .limit(10),
            // Department assets (if user has department)
            profileData.department
              ? supabase
                  .from("assets")
                  .select(
                    "id, asset_name, asset_type, asset_model, serial_number, unique_code, status, assignment_type, department, created_at"
                  )
                  .eq("assignment_type", "department")
                  .eq("department", profileData.department)
                  .eq("status", "assigned")
                  .limit(10)
              : Promise.resolve({ data: [] }),
            // Office location assets (if user has office_location)
            profileData.office_location
              ? supabase
                  .from("assets")
                  .select(
                    "id, asset_name, asset_type, asset_model, serial_number, unique_code, status, assignment_type, office_location, created_at"
                  )
                  .eq("assignment_type", "office")
                  .eq("office_location", profileData.office_location)
                  .eq("status", "assigned")
                  .limit(10)
              : Promise.resolve({ data: [] }),
            supabase
              .from("user_documentation")
              .select("*")
              .eq("user_id", employee.id)
              .order("created_at", { ascending: false })
              .limit(10),
          ])

        // Fetch asset details separately for individual assignments
        const individualAssetsWithDetails = await Promise.all(
          (assetAssignmentsResult.data || []).map(async (assignment: any) => {
            const { data: assetData } = await supabase
              .from("assets")
              .select("id, asset_name, asset_type, asset_model, serial_number, unique_code, status")
              .eq("id", assignment.asset_id)
              .single()

            return {
              ...assignment,
              Asset: assetData,
              assignmentType: "individual" as const,
            }
          })
        )

        // Convert department assets to assignment format
        const deptAssetsWithDetails = (deptAssetsResult.data || []).map((asset: any) => ({
          id: `dept-${asset.id}`,
          asset_id: asset.id,
          assigned_at: asset.created_at, // Use the asset's creation date
          is_current: true,
          assignment_type: "department",
          Asset: asset,
          assignmentType: "department" as const,
          department: asset.department,
        }))

        // Convert office assets to assignment format
        const officeAssetsWithDetails = (officeAssetsResult.data || []).map((asset: any) => ({
          id: `office-${asset.id}`,
          asset_id: asset.id,
          assigned_at: asset.created_at, // Use the asset's creation date
          is_current: true,
          assignment_type: "office",
          Asset: asset,
          assignmentType: "office" as const,
          officeLocation: asset.office_location || profileData.office_location,
        }))

        // Combine all types of assignments
        const allAssets = [...individualAssetsWithDetails, ...deptAssetsWithDetails, ...officeAssetsWithDetails]

        setViewEmployeeData({
          tasks: tasksResult.data || [],
          assets: allAssets || [],
          documentation: docsResult.data || [],
        })
      }
    } catch (error: any) {
      console.error("Error loading employees details:", error)
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
      console.error("Error checking assigned items:", error)
      toast.error("Failed to check assigned items")
      return null
    }
  }

  const handleDeleteEmployee = async (employee: Employee) => {
    try {
      setSelectedEmployee(employee)
      const assigned = await checkAssignedItems(employee)

      if (!assigned) {
        return
      }

      // Check if user has any assigned items
      const hasAssignments =
        assigned.tasks.length > 0 ||
        assigned.taskAssignments.length > 0 ||
        assigned.assets.length > 0 ||
        assigned.projects.length > 0 ||
        assigned.projectMemberships.length > 0 ||
        assigned.feedback.length > 0 ||
        assigned.documentation.length > 0

      if (hasAssignments) {
        setIsDeleteDialogOpen(true)
        return
      }

      // If no assignments, proceed with deletion confirmation
      setIsDeleteDialogOpen(true)
    } catch (error: any) {
      console.error("Error preparing delete:", error)
      toast.error("Failed to prepare deletion")
    }
  }

  const confirmDeleteEmployee = async () => {
    if (isDeleting || !selectedEmployee) return

    setIsDeleting(true)
    try {
      // Check permissions - only super_admin can delete users
      if (userProfile?.role !== "super_admin") {
        toast.error("Only super admins can delete users")
        setIsDeleting(false)
        return
      }

      // Double-check for assignments before deleting
      const assigned = await checkAssignedItems(selectedEmployee)
      if (!assigned) {
        setIsDeleting(false)
        return
      }

      const hasAssignments =
        assigned.tasks.length > 0 ||
        assigned.taskAssignments.length > 0 ||
        assigned.assets.length > 0 ||
        assigned.projects.length > 0 ||
        assigned.projectMemberships.length > 0 ||
        assigned.feedback.length > 0 ||
        assigned.documentation.length > 0

      if (hasAssignments) {
        toast.error("Cannot delete user with assigned items. Please reassign items first.")
        setIsDeleting(false)
        return
      }

      // Try to delete from profiles first (this is safer and will cascade)
      // Note: Deleting from auth.users requires admin API which may not be available
      const { error: profileError } = await supabase.from("profiles").delete().eq("id", selectedEmployee.id)

      if (profileError) {
        // If that fails, try using admin API (if available)
        try {
          const { error: authError } = await supabase.auth.admin.deleteUser(selectedEmployee.id)
          if (authError) {
            throw authError
          }
        } catch (adminError: any) {
          // Admin API might not be available, throw the original error
          throw profileError
        }
      }

      toast.success("Employee deleted successfully")
      setIsDeleteDialogOpen(false)
      setSelectedEmployee(null)
      loadData()
    } catch (error: any) {
      console.error("Error deleting employees:", error)
      toast.error(error.message || "Failed to delete employees member")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSaveEmployee = async () => {
    if (isSaving) return // Prevent duplicate submissions
    setIsSaving(true)
    try {
      if (!selectedEmployee) {
        setIsSaving(false)
        return
      }

      // Check if user can assign this role
      if (userProfile && !canAssignRoles(userProfile.role, editForm.role)) {
        toast.error("You don't have permission to assign this role")
        setIsSaving(false)
        return
      }

      // Validate email domain
      if (editForm.company_email && !formValidation.isCompanyEmail(editForm.company_email)) {
        toast.error("Only @acoblighting.com and @org.acoblighting.com emails are allowed")
        setIsSaving(false)
        return
      }

      // Validate: If role is lead, at least one department must be selected
      if (editForm.role === "lead" && editForm.lead_departments.length === 0) {
        toast.error("Please select at least one department for this lead")
        setIsSaving(false)
        return
      }

      // If role is lead, automatically set is_department_lead to true
      const isLead = editForm.role === "lead"

      // Build update object with all fields
      const updateData: any = {
        role: editForm.role,
        department: editForm.department,
        office_location: editForm.office_location || null,
        company_role: editForm.company_role || null,
        is_department_lead: isLead,
        lead_departments: isLead ? editForm.lead_departments : [],
        is_admin: ["super_admin", "admin"].includes(editForm.role),
        updated_at: new Date().toISOString(),
        // Always include expanded fields if they exist in form state
        employee_number: editForm.employee_number || null,
        first_name: editForm.first_name || null,
        last_name: editForm.last_name || null,
        other_names: editForm.other_names || null,
        company_email: editForm.company_email || null,
        phone_number: editForm.phone_number || null,
        additional_phone: editForm.additional_phone || null,
        residential_address: editForm.residential_address || null,
        current_work_location: editForm.current_work_location || null,
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
      console.error("Error updating employees:", error)
      toast.error("Failed to update employees member")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateUser = async () => {
    if (isCreatingUser) return
    setIsCreatingUser(true)

    try {
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
        employeeNumber: "",
      })
      loadData()
    } catch (error: any) {
      console.error("Error creating user:", error)
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

  const roles: UserRole[] = ["visitor", "employee", "lead", "admin", "super_admin"]

  const stats = {
    total: employees.length,
    admins: employees.filter((s) => ["super_admin", "admin"].includes(s.role)).length,
    leads: employees.filter((s) => s.role === "lead").length,
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
      if (selectedColumns["Department"]) row["Department"] = member.department || "-"
      if (selectedColumns["Role"]) row["Role"] = getRoleDisplayName(member.role)
      if (selectedColumns["Position"]) row["Position"] = member.company_role || "-"
      if (selectedColumns["Phone Number"]) row["Phone Number"] = member.phone_number || "-"
      if (selectedColumns["Additional Phone"]) row["Additional Phone"] = member.additional_phone || "-"
      if (selectedColumns["Residential Address"]) row["Residential Address"] = member.residential_address || "-"
      if (selectedColumns["Work Location"]) row["Work Location"] = member.current_work_location || "-"
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
      console.error("Error exporting employees to Excel:", error)
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
        if (selectedColumns["Work Location"]) {
          row.push(member.current_work_location || "-")
          headers.push("Work Location")
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
      console.error("Error exporting employees to PDF:", error)
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
      console.error("Error exporting employees to Word:", error)
      toast.error("Failed to export employees to Word")
    }
  }

  const getAvailableRoles = (): UserRole[] => {
    if (!userProfile) return []

    if (userProfile.role === "super_admin") {
      return ["visitor", "employee", "lead", "admin", "super_admin"]
    } else if (userProfile.role === "admin") {
      return ["visitor", "employee", "lead"]
    }

    return []
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
            <PendingApplicationsModal onEmployeeCreated={loadData} />
            {(userProfile?.role === "admin" || userProfile?.role === "super_admin") && (
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
              <div className="flex gap-2">
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
        <Card className="border-2">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative w-full">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform" />
                <Input
                  placeholder="Search employees by name, email, or position..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-12 pl-11 text-base"
                />
              </div>

              {/* Filter Buttons */}
              <div className="flex gap-3 overflow-hidden">
                <SearchableMultiSelect
                  label="Departments"
                  icon={<Building2 className="h-4 w-4" />}
                  values={departmentFilter}
                  options={DEPARTMENTS.map((dept) => ({
                    value: dept,
                    label: dept,
                    icon: <Building2 className="h-3 w-3" />,
                  }))}
                  onChange={setDepartmentFilter}
                  placeholder="Department"
                />
                <SearchableMultiSelect
                  label="Employee Members"
                  icon={<User className="h-4 w-4" />}
                  values={employeeFilter}
                  options={employees.map((member) => ({
                    value: member.id,
                    label: `${formatName(member.first_name)} ${formatName(member.last_name)} - ${member.department || "No Dept"}`,
                    icon: <User className="h-3 w-3" />,
                  }))}
                  onChange={setEmployeeFilter}
                  placeholder="Employee"
                />
                <SearchableMultiSelect
                  label="Roles"
                  icon={<Shield className="h-4 w-4" />}
                  values={roleFilter}
                  options={roles.map((role) => ({
                    value: role,
                    label: getRoleDisplayName(role),
                  }))}
                  onChange={setRoleFilter}
                  placeholder="Role"
                />
                <SearchableMultiSelect
                  label="Status"
                  icon={<UserCircle className="h-4 w-4" />}
                  values={statusFilter}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "suspended", label: "Suspended" },
                    { value: "terminated", label: "Terminated" },
                    { value: "on_leave", label: "On Leave" },
                  ]}
                  onChange={setStatusFilter}
                  placeholder="Status"
                />
              </div>
            </div>
          </CardContent>
        </Card>

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
                        className={member.employment_status === "terminated" ? "opacity-60" : ""}
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
                                member.employment_status === "terminated" && "text-muted-foreground line-through"
                              )}
                            >
                              {formatName(member.last_name)}, {formatName(member.first_name)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-muted-foreground flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3" />
                            <span className="max-w-[200px] truncate">{member.company_email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-foreground text-sm">{member.department || "-"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge className={getRoleBadgeColor(member.role)}>{getRoleDisplayName(member.role)}</Badge>
                            {member.role === "lead" &&
                              member.lead_departments &&
                              member.lead_departments.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {member.lead_departments.length} Dept
                                  {member.lead_departments.length > 1 ? "s" : ""}
                                </Badge>
                              )}
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
                  className={`border-2 transition-shadow hover:shadow-lg ${member.employment_status === "terminated" ? "opacity-60" : ""}`}
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
                              member.employment_status === "terminated" && "text-muted-foreground line-through"
                            )}
                          >
                            {member.first_name} {member.last_name}
                          </CardTitle>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge className={getRoleBadgeColor(member.role)}>{getRoleDisplayName(member.role)}</Badge>
                            <EmployeeStatusBadge status={member.employment_status || "active"} size="sm" />
                            {member.role === "lead" &&
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
                      <span className="truncate">{member.company_email}</span>
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

                    {member.current_work_location && (
                      <div className="text-muted-foreground flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4" />
                        <span>{member.current_work_location}</span>
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
      <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="space-y-3 border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                <Plus className="text-primary h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl">Create New User</DialogTitle>
                <DialogDescription className="mt-1">
                  Add a new employees member to the system. Name, email, and department are required.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="create_first_name">
                  First Name * <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="create_first_name"
                  value={createUserForm.firstName}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, firstName: e.target.value })}
                  placeholder="John"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="create_last_name">
                  Last Name * <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="create_last_name"
                  value={createUserForm.lastName}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, lastName: e.target.value })}
                  placeholder="Doe"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="create_other_names">Other Names</Label>
              <Input
                id="create_other_names"
                value={createUserForm.otherNames}
                onChange={(e) => setCreateUserForm({ ...createUserForm, otherNames: e.target.value })}
                placeholder="Middle name or other names (optional)"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="create_employee_number">
                Employee Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="create_employee_number"
                value={createUserForm.employeeNumber}
                onChange={(e) => setCreateUserForm({ ...createUserForm, employeeNumber: e.target.value.toUpperCase() })}
                placeholder="e.g., ACOB/2026/058"
                className="mt-1.5 font-mono"
                required
              />
              <p className="text-muted-foreground mt-1 text-xs">Format: ACOB/YEAR/NUMBER (e.g., ACOB/2026/058)</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="create_email">
                  Email * <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="create_email"
                  type="email"
                  value={createUserForm.email}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })}
                  placeholder="john.doe@company.com"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="create_phone">Phone Number</Label>
                <Input
                  id="create_phone"
                  type="tel"
                  value={createUserForm.phoneNumber}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, phoneNumber: e.target.value })}
                  placeholder="+234 800 000 0000"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="create_department">
                  Department * <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={createUserForm.department}
                  onValueChange={(value) => setCreateUserForm({ ...createUserForm, department: value })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="create_role">Role</Label>
                <Select
                  value={createUserForm.role}
                  onValueChange={(value: UserRole) => setCreateUserForm({ ...createUserForm, role: value })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableRoles().map((role) => (
                      <SelectItem key={role} value={role}>
                        {getRoleDisplayName(role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="create_company_role">Position/Title</Label>
              <Input
                id="create_company_role"
                value={createUserForm.companyRole}
                onChange={(e) => setCreateUserForm({ ...createUserForm, companyRole: e.target.value })}
                placeholder="e.g., Senior Developer, Manager"
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsCreateUserDialogOpen(false)} disabled={isCreatingUser}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={
                isCreatingUser ||
                !createUserForm.firstName.trim() ||
                !createUserForm.lastName.trim() ||
                !createUserForm.email.trim() ||
                !createUserForm.department
              }
              className="gap-2"
            >
              {isCreatingUser ? (
                "Creating..."
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              {modalViewMode === "edit"
                ? "Edit Employee Profile"
                : modalViewMode === "signature"
                  ? "Email Signature"
                  : modalViewMode === "status"
                    ? "Change Employment Status"
                    : viewEmployeeProfile
                      ? `${formatName(viewEmployeeProfile.first_name)} ${formatName(viewEmployeeProfile.last_name)}`
                      : "Employee Details"}
            </DialogTitle>
            <DialogDescription>
              {modalViewMode === "edit"
                ? "Update employees member's role, department, and permissions"
                : modalViewMode === "signature"
                  ? "View and manage email signature"
                  : modalViewMode === "status"
                    ? "Update employment status and handle offboarding"
                    : "View complete profile and related information"}
            </DialogDescription>
          </DialogHeader>
          {viewEmployeeProfile && modalViewMode === "profile" && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-4">
                {/* Profile Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserIcon className="h-5 w-5" />
                      Profile Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {formatName(viewEmployeeProfile.first_name)?.[0]}
                            {formatName(viewEmployeeProfile.last_name)?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-muted-foreground text-sm">Full Name</p>
                          <p className="font-medium">
                            {formatName(viewEmployeeProfile.first_name)} {formatName(viewEmployeeProfile.last_name)}
                          </p>
                          {viewEmployeeProfile.other_names && (
                            <p className="text-muted-foreground text-xs">({viewEmployeeProfile.other_names})</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Mail className="text-muted-foreground h-5 w-5" />
                        <div>
                          <p className="text-muted-foreground text-sm">Email</p>
                          <p className="font-medium">{viewEmployeeProfile.company_email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Building2 className="text-muted-foreground h-5 w-5" />
                        <div>
                          <p className="text-muted-foreground text-sm">Department</p>
                          <p className="font-medium">{viewEmployeeProfile.department || "N/A"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Shield className="text-muted-foreground h-5 w-5" />
                        <div>
                          <p className="text-muted-foreground text-sm">Role</p>
                          <div className="mt-1 flex gap-2">
                            <Badge className={getRoleBadgeColor(viewEmployeeProfile.role as UserRole)}>
                              {getRoleDisplayName(viewEmployeeProfile.role as UserRole)}
                            </Badge>
                            {viewEmployeeProfile.role === "lead" &&
                              viewEmployeeProfile.lead_departments &&
                              viewEmployeeProfile.lead_departments.length > 0 && (
                                <Badge variant="outline">
                                  Leading {viewEmployeeProfile.lead_departments.length} Dept
                                  {viewEmployeeProfile.lead_departments.length > 1 ? "s" : ""}
                                </Badge>
                              )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <UserIcon className="text-muted-foreground h-5 w-5" />
                        <div>
                          <p className="text-muted-foreground text-sm">Position</p>
                          <p className="font-medium">{viewEmployeeProfile.company_role || "N/A"}</p>
                        </div>
                      </div>

                      {viewEmployeeProfile.phone_number && (
                        <div className="flex items-center gap-3">
                          <Phone className="text-muted-foreground h-5 w-5" />
                          <div>
                            <p className="text-muted-foreground text-sm">Phone</p>
                            <p className="font-medium">{viewEmployeeProfile.phone_number}</p>
                            {viewEmployeeProfile.additional_phone && (
                              <p className="text-muted-foreground text-xs">{viewEmployeeProfile.additional_phone}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {viewEmployeeProfile.residential_address && (
                        <div className="flex items-center gap-3">
                          <MapPin className="text-muted-foreground h-5 w-5" />
                          <div>
                            <p className="text-muted-foreground text-sm">Address</p>
                            <p className="font-medium">{viewEmployeeProfile.residential_address}</p>
                          </div>
                        </div>
                      )}

                      {viewEmployeeProfile.current_work_location && (
                        <div className="flex items-center gap-3">
                          <MapPin className="text-muted-foreground h-5 w-5" />
                          <div>
                            <p className="text-muted-foreground text-sm">Work Location</p>
                            <p className="font-medium">{viewEmployeeProfile.current_work_location}</p>
                          </div>
                        </div>
                      )}

                      {viewEmployeeProfile.lead_departments && viewEmployeeProfile.lead_departments.length > 0 && (
                        <div className="flex items-center gap-3">
                          <Building2 className="text-muted-foreground h-5 w-5" />
                          <div>
                            <p className="text-muted-foreground text-sm">Leading Departments</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {viewEmployeeProfile.lead_departments.map((dept: string) => (
                                <Badge key={dept} variant="outline">
                                  {dept}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <Calendar className="text-muted-foreground h-5 w-5" />
                        <div>
                          <p className="text-muted-foreground text-sm">Member Since</p>
                          <p className="font-medium">{new Date(viewEmployeeProfile.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Related Data Tabs */}
                <Tabs defaultValue="assets" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="assets">Assets ({viewEmployeeData.assets.length})</TabsTrigger>
                    <TabsTrigger value="tasks">Tasks ({viewEmployeeData.tasks.length})</TabsTrigger>
                    <TabsTrigger value="documentation">
                      Documentation ({viewEmployeeData.documentation.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="assets">
                    <Card>
                      <CardHeader>
                        <CardTitle>Assigned Assets</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {viewEmployeeData.assets.length > 0 ? (
                          <div className="space-y-3">
                            {viewEmployeeData.assets.map((assignment: any) => {
                              const asset = assignment.Asset
                              const assetTypeLabel = asset?.asset_type
                                ? ASSET_TYPE_MAP[asset.asset_type]?.label || asset.asset_type
                                : "Unknown"
                              const isOfficeAssignment = assignment.assignmentType === "office"

                              return (
                                <div key={assignment.id} className="rounded-lg border p-4">
                                  <div className="mb-3 flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                      <p className="text-base font-semibold">{assetTypeLabel}</p>
                                      {isOfficeAssignment ? (
                                        <Badge
                                          variant="outline"
                                          className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                        >
                                          Office:{" "}
                                          {assignment.officeLocation ||
                                            viewEmployeeProfile?.office_location ||
                                            "Office"}
                                        </Badge>
                                      ) : (
                                        <Badge
                                          variant="outline"
                                          className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                        >
                                          Personal Assignment
                                        </Badge>
                                      )}
                                    </div>
                                    {asset?.status && (
                                      <Badge variant={asset.status === "assigned" ? "default" : "secondary"}>
                                        {asset.status}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground min-w-[120px] font-medium">
                                        Unique Code:
                                      </span>
                                      <span className="font-mono">{asset?.unique_code || "-"}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground min-w-[120px] font-medium">
                                        Model Number:
                                      </span>
                                      <span>{asset?.asset_model || "-"}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground min-w-[120px] font-medium">
                                        Serial Number:
                                      </span>
                                      <span className="font-mono">{asset?.serial_number || "-"}</span>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">No assets assigned</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="tasks">
                    <Card>
                      <CardHeader>
                        <CardTitle>Assigned Tasks</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {viewEmployeeData.tasks.length > 0 ? (
                          <div className="space-y-2">
                            {viewEmployeeData.tasks.map((task: any) => (
                              <div key={task.id} className="rounded-lg border p-3">
                                <p className="font-medium">{task.title}</p>
                                <p className="text-muted-foreground text-sm">{task.status}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">No tasks assigned</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="documentation">
                    <Card>
                      <CardHeader>
                        <CardTitle>Documentation</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {viewEmployeeData.documentation.length > 0 ? (
                          <div className="space-y-2">
                            {viewEmployeeData.documentation.map((doc: any) => (
                              <div key={doc.id} className="rounded-lg border p-3">
                                <p className="font-medium">{doc.title || "Untitled"}</p>
                                <p className="text-muted-foreground text-sm">
                                  {new Date(doc.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">No documentation</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>
          )}

          {viewEmployeeProfile && modalViewMode === "employment" && (
            <div className="space-y-6 pt-4">
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCircle className="h-5 w-5" />
                    Employment Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-sm font-medium">Current Status</p>
                      <EmployeeStatusBadge status={viewEmployeeProfile.employment_status || "active"} size="lg" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-sm font-medium">Hire Date</p>
                      <div className="text-foreground flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span className="font-medium">
                          {viewEmployeeProfile.employment_date
                            ? new Date(viewEmployeeProfile.employment_date).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })
                            : "Not recorded"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {viewEmployeeProfile.employment_status === "terminated" && (
                    <div className="rounded-lg border border-red-100 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-950/20">
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-red-700 dark:text-red-400">Termination Date</p>
                          <p className="text-foreground font-medium">
                            {viewEmployeeProfile.termination_date
                              ? new Date(viewEmployeeProfile.termination_date).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })
                              : "Not recorded"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-red-700 dark:text-red-400">Termination Reason</p>
                          <p className="text-foreground font-medium italic">
                            {viewEmployeeProfile.termination_reason || "No reason specified"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {viewEmployeeProfile.employment_status === "suspended" && (
                    <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Suspension Note</p>
                      <p className="text-foreground mt-1 text-sm italic">
                        Contact IT / Admin for active suspension period details.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <Button onClick={() => setModalViewMode("status")} className="gap-2">
                      <UserCircle className="h-4 w-4" />
                      Edit Employment Status
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Note: Changes to employment status are logged for audit purposes. Terminating an employee will
                  automatically revoke their system access and clear their assigned roles.
                </p>
              </div>
            </div>
          )}

          {viewEmployeeProfile && modalViewMode === "signature" && (
            <div className="mt-4">
              <SignatureCreator profile={viewEmployeeProfile as any} />
            </div>
          )}

          {viewEmployeeProfile && modalViewMode === "status" && (
            <div className="mx-auto max-w-md">
              <ChangeStatusContent
                employee={{
                  id: viewEmployeeProfile.id,
                  first_name: viewEmployeeProfile.first_name,
                  last_name: viewEmployeeProfile.last_name,
                  employment_status: (viewEmployeeProfile.employment_status as any) || "active",
                }}
                onSuccess={() => {
                  setModalViewMode("profile")
                  loadData()
                  // Refresh profile data
                  supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", viewEmployeeProfile.id)
                    .single()
                    .then(({ data }) => {
                      if (data) setViewEmployeeProfile(data as any)
                    })
                }}
              />
            </div>
          )}

          {viewEmployeeProfile && modalViewMode === "edit" && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={editForm.role}
                    onValueChange={(value: UserRole) => {
                      setEditForm({ ...editForm, role: value })
                      if (value !== "lead") {
                        setEditForm((prev) => ({
                          ...prev,
                          role: value,
                          lead_departments: [],
                        }))
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableRoles().map((role) => (
                        <SelectItem key={role} value={role}>
                          {getRoleDisplayName(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {userProfile?.role === "admin"
                      ? "As Admin, you can assign: Visitor, Employee, and Lead roles"
                      : "As Super Admin, you can assign any role"}
                  </p>
                </div>

                <div>
                  <Label htmlFor="department">Department *</Label>
                  <Select
                    value={editForm.department}
                    onValueChange={(value) => setEditForm({ ...editForm, department: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="office_location">Office Location</Label>
                  <SearchableSelect
                    value={editForm.office_location}
                    onValueChange={(value) => setEditForm({ ...editForm, office_location: value })}
                    placeholder="Select office location"
                    options={OFFICE_LOCATIONS.map((location) => ({
                      value: location,
                      label: location,
                    }))}
                  />
                </div>

                <div>
                  <Label htmlFor="company_role">Position/Title</Label>
                  <Input
                    id="company_role"
                    value={editForm.company_role}
                    onChange={(e) => setEditForm({ ...editForm, company_role: e.target.value })}
                    placeholder="e.g., Senior Developer"
                  />
                </div>

                {editForm.role === "lead" && (
                  <div className="space-y-2">
                    <Label>Lead Departments *</Label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {DEPARTMENTS.map((dept) => (
                        <div key={dept} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`dept-edit-${dept}`}
                            checked={editForm.lead_departments.includes(dept)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditForm({
                                  ...editForm,
                                  lead_departments: [...editForm.lead_departments, dept],
                                })
                              } else {
                                setEditForm({
                                  ...editForm,
                                  lead_departments: editForm.lead_departments.filter((d) => d !== dept),
                                })
                              }
                            }}
                            className="rounded"
                          />
                          <Label htmlFor={`dept-edit-${dept}`} className="text-sm">
                            {dept}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* More Options */}
                <div className="border-t pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowMoreOptions(!showMoreOptions)}
                    className="w-full justify-between"
                  >
                    <span className="font-medium">More Personal Options</span>
                    {showMoreOptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>

                  {showMoreOptions && (
                    <div className="animate-in slide-in-from-top-2 mt-4 space-y-4">
                      {/* Personal Information */}
                      <div className="space-y-4">
                        <h4 className="text-foreground text-sm font-semibold">Personal Information</h4>
                        <div>
                          <Label htmlFor="edit_employee_number">Employee Number</Label>
                          <Input
                            id="edit_employee_number"
                            value={editForm.employee_number}
                            onChange={(e) => setEditForm({ ...editForm, employee_number: e.target.value })}
                            placeholder="e.g., ACOB/2026/058"
                            className="font-mono"
                          />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <Label htmlFor="edit_first_name">First Name</Label>
                            <Input
                              id="edit_first_name"
                              value={editForm.first_name}
                              onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                              placeholder="First name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit_last_name">Last Name</Label>
                            <Input
                              id="edit_last_name"
                              value={editForm.last_name}
                              onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                              placeholder="Last name"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="edit_other_names">Other Names</Label>
                          <Input
                            id="edit_other_names"
                            value={editForm.other_names}
                            onChange={(e) => setEditForm({ ...editForm, other_names: e.target.value })}
                            placeholder="Middle name or other names"
                          />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <Label htmlFor="edit_company_email">Company Email</Label>
                            <Input
                              id="edit_company_email"
                              type="email"
                              value={editForm.company_email}
                              onChange={(e) => setEditForm({ ...editForm, company_email: e.target.value })}
                              placeholder="email@company.com"
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit_phone_number">Phone Number</Label>
                            <Input
                              id="edit_phone_number"
                              type="tel"
                              value={editForm.phone_number}
                              onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                              placeholder="+234 800 000 0000"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="edit_additional_phone">Additional Phone</Label>
                          <Input
                            id="edit_additional_phone"
                            type="tel"
                            value={editForm.additional_phone}
                            onChange={(e) => setEditForm({ ...editForm, additional_phone: e.target.value })}
                            placeholder="Alternative phone number"
                          />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <Label htmlFor="edit_date_of_birth">Date of Birth</Label>
                            <Input
                              id="edit_date_of_birth"
                              type="date"
                              value={editForm.date_of_birth}
                              onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit_employment_date">Employment Date</Label>
                            <Input
                              id="edit_employment_date"
                              type="date"
                              value={editForm.employment_date}
                              onChange={(e) => setEditForm({ ...editForm, employment_date: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Address Information */}
                      <div className="space-y-4 border-t pt-4">
                        <h4 className="text-foreground text-sm font-semibold">Address Information</h4>
                        <div>
                          <Label htmlFor="edit_residential_address">Residential Address</Label>
                          <Textarea
                            id="edit_residential_address"
                            value={editForm.residential_address}
                            onChange={(e) => setEditForm({ ...editForm, residential_address: e.target.value })}
                            placeholder="Full residential address"
                            rows={2}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit_current_work_location">Current Work Location</Label>
                          <Input
                            id="edit_current_work_location"
                            value={editForm.current_work_location}
                            onChange={(e) => setEditForm({ ...editForm, current_work_location: e.target.value })}
                            placeholder="Office location or site"
                          />
                        </div>
                      </div>

                      {/* Banking Information */}
                      <div className="space-y-4 border-t pt-4">
                        <h4 className="text-foreground text-sm font-semibold">Banking Information</h4>
                        <div>
                          <Label htmlFor="edit_bank_name">Bank Name</Label>
                          <Input
                            id="edit_bank_name"
                            value={editForm.bank_name}
                            onChange={(e) => setEditForm({ ...editForm, bank_name: e.target.value })}
                            placeholder="Bank name"
                          />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <Label htmlFor="edit_bank_account_number">Account Number</Label>
                            <Input
                              id="edit_bank_account_number"
                              value={editForm.bank_account_number}
                              onChange={(e) => setEditForm({ ...editForm, bank_account_number: e.target.value })}
                              placeholder="Account number"
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit_bank_account_name">Account Name</Label>
                            <Input
                              id="edit_bank_account_name"
                              value={editForm.bank_account_name}
                              onChange={(e) => setEditForm({ ...editForm, bank_account_name: e.target.value })}
                              placeholder="Account holder name"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Job Description */}
                      <div className="space-y-4 border-t pt-4">
                        <h4 className="text-foreground text-sm font-semibold">Job Information</h4>
                        <div>
                          <Label htmlFor="edit_job_description">Job Description</Label>
                          <Textarea
                            id="edit_job_description"
                            value={editForm.job_description}
                            onChange={(e) => setEditForm({ ...editForm, job_description: e.target.value })}
                            placeholder="Job description or responsibilities"
                            rows={4}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:gap-0">
            <div className="flex flex-wrap gap-2">
              {modalViewMode === "edit" ? (
                <>
                  <Button variant="outline" onClick={() => setModalViewMode("profile")} disabled={isSaving}>
                    Back to Profile
                  </Button>
                  <Button onClick={handleSaveEmployee} loading={isSaving}>
                    Save Changes
                  </Button>
                </>
              ) : modalViewMode === "signature" || modalViewMode === "status" ? (
                <Button variant="outline" onClick={() => setModalViewMode("profile")}>
                  Back to Profile
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleViewEmployeeSignature(viewEmployeeProfile as any)}
                    className="gap-2"
                  >
                    <FileSignature className="h-4 w-4" />
                    Signature
                  </Button>
                  <Button
                    variant={modalViewMode === "employment" ? "secondary" : "outline"}
                    onClick={() => setModalViewMode(modalViewMode === "profile" ? "employment" : "profile")}
                    className="gap-2"
                  >
                    <UserCircle className="h-4 w-4" />
                    Employment
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleEditEmployee(viewEmployeeProfile as any)}
                    className="gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit Profile
                  </Button>
                  {userProfile?.role === "super_admin" && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        handleDeleteEmployee(viewEmployeeProfile as any)
                        setIsViewDialogOpen(false)
                      }}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </>
              )}
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setIsViewDialogOpen(false)
                setModalViewMode("profile")
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Employee Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Delete Employee Member
            </DialogTitle>
            <DialogDescription>
              {selectedEmployee
                ? `Are you sure you want to delete ${formatName(selectedEmployee.first_name)} ${formatName(selectedEmployee.last_name)}?`
                : "Are you sure you want to delete this employees member?"}
            </DialogDescription>
          </DialogHeader>

          {/* Check for assigned items */}
          {(() => {
            const hasAssignments =
              assignedItems.tasks.length > 0 ||
              assignedItems.taskAssignments.length > 0 ||
              assignedItems.assets.length > 0 ||
              assignedItems.projects.length > 0 ||
              assignedItems.projectMemberships.length > 0 ||
              assignedItems.feedback.length > 0 ||
              assignedItems.documentation.length > 0

            if (hasAssignments) {
              return (
                <div className="space-y-4 py-4">
                  <div className="bg-destructive/10 border-destructive/20 rounded-lg border p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
                      <div className="flex-1">
                        <h4 className="text-destructive mb-2 font-semibold">Cannot Delete Employee Member</h4>
                        <p className="text-muted-foreground mb-4 text-sm">
                          This employees member has items assigned to them. Please reassign or remove all items before
                          deleting.
                        </p>

                        <div className="space-y-3">
                          {assignedItems.tasks.length > 0 && (
                            <div>
                              <p className="text-foreground mb-1 text-sm font-medium">
                                Tasks ({assignedItems.tasks.length})
                              </p>
                              <div className="max-h-32 space-y-1 overflow-y-auto">
                                {assignedItems.tasks.slice(0, 5).map((task: any) => (
                                  <div
                                    key={task.id}
                                    className="text-muted-foreground bg-background rounded p-2 text-xs"
                                  >
                                    • {task.title} ({task.status})
                                  </div>
                                ))}
                                {assignedItems.tasks.length > 5 && (
                                  <p className="text-muted-foreground text-xs">
                                    ...and {assignedItems.tasks.length - 5} more
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {assignedItems.taskAssignments.length > 0 && (
                            <div>
                              <p className="text-foreground mb-1 text-sm font-medium">
                                Task Assignments ({assignedItems.taskAssignments.length})
                              </p>
                              <div className="max-h-32 space-y-1 overflow-y-auto">
                                {assignedItems.taskAssignments.slice(0, 5).map((assignment: any) => (
                                  <div
                                    key={assignment.id}
                                    className="text-muted-foreground bg-background rounded p-2 text-xs"
                                  >
                                    • {assignment.Task?.title || "Unknown Task"} ({assignment.Task?.status || "N/A"})
                                  </div>
                                ))}
                                {assignedItems.taskAssignments.length > 5 && (
                                  <p className="text-muted-foreground text-xs">
                                    ...and {assignedItems.taskAssignments.length - 5} more
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {assignedItems.assets.length > 0 && (
                            <div>
                              <p className="text-foreground mb-1 text-sm font-medium">
                                Assets ({assignedItems.assets.length})
                              </p>
                              <div className="max-h-32 space-y-1 overflow-y-auto">
                                {assignedItems.assets.slice(0, 5).map((assignment: any) => (
                                  <div
                                    key={assignment.id}
                                    className="text-muted-foreground bg-background rounded p-2 text-xs"
                                  >
                                    •{" "}
                                    {assignment.Asset?.asset_name === "Unknown Asset" || !assignment.Asset?.asset_name
                                      ? `Unknown Asset (${assignment.Asset?.unique_code || "No Code"})`
                                      : assignment.Asset.asset_name}
                                    ({assignment.Asset?.asset_type || "N/A"})
                                  </div>
                                ))}
                              </div>
                              {assignedItems.assets.length > 5 && (
                                <p className="text-muted-foreground text-xs">
                                  ...and {assignedItems.assets.length - 5} more
                                </p>
                              )}
                            </div>
                          )}

                          {assignedItems.projects.length > 0 && (
                            <div>
                              <p className="text-foreground mb-1 text-sm font-medium">
                                Projects ({assignedItems.projects.length})
                              </p>
                              <div className="max-h-32 space-y-1 overflow-y-auto">
                                {assignedItems.projects.slice(0, 5).map((project: any) => (
                                  <div
                                    key={project.id}
                                    className="text-muted-foreground bg-background rounded p-2 text-xs"
                                  >
                                    • {project.project_name} ({project.status})
                                  </div>
                                ))}
                                {assignedItems.projects.length > 5 && (
                                  <p className="text-muted-foreground text-xs">
                                    ...and {assignedItems.projects.length - 5} more
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {assignedItems.projectMemberships.length > 0 && (
                            <div>
                              <p className="text-foreground mb-1 text-sm font-medium">
                                Project Memberships ({assignedItems.projectMemberships.length})
                              </p>
                              <div className="max-h-32 space-y-1 overflow-y-auto">
                                {assignedItems.projectMemberships.slice(0, 5).map((membership: any) => (
                                  <div
                                    key={membership.id}
                                    className="text-muted-foreground bg-background rounded p-2 text-xs"
                                  >
                                    • {membership.Project?.project_name || "Unknown Project"}
                                  </div>
                                ))}
                                {assignedItems.projectMemberships.length > 5 && (
                                  <p className="text-muted-foreground text-xs">
                                    ...and {assignedItems.projectMemberships.length - 5} more
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {assignedItems.feedback.length > 0 && (
                            <div>
                              <p className="text-foreground mb-1 text-sm font-medium">
                                Feedback ({assignedItems.feedback.length})
                              </p>
                              <div className="max-h-32 space-y-1 overflow-y-auto">
                                {assignedItems.feedback.slice(0, 5).map((fb: any) => (
                                  <div key={fb.id} className="text-muted-foreground bg-background rounded p-2 text-xs">
                                    • {fb.title} ({fb.status})
                                  </div>
                                ))}
                                {assignedItems.feedback.length > 5 && (
                                  <p className="text-muted-foreground text-xs">
                                    ...and {assignedItems.feedback.length - 5} more
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {assignedItems.documentation.length > 0 && (
                            <div>
                              <p className="text-foreground mb-1 text-sm font-medium">
                                Documentation ({assignedItems.documentation.length})
                              </p>
                              <div className="max-h-32 space-y-1 overflow-y-auto">
                                {assignedItems.documentation.slice(0, 5).map((doc: any) => (
                                  <div key={doc.id} className="text-muted-foreground bg-background rounded p-2 text-xs">
                                    • {doc.title}
                                  </div>
                                ))}
                                {assignedItems.documentation.length > 5 && (
                                  <p className="text-muted-foreground text-xs">
                                    ...and {assignedItems.documentation.length - 5} more
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div className="space-y-4 py-4">
                <div className="bg-destructive/10 border-destructive/20 rounded-lg border p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
                    <div className="flex-1">
                      <h4 className="text-destructive mb-2 font-semibold">Warning: This action cannot be undone</h4>
                      <p className="text-muted-foreground text-sm">
                        Deleting this employees member will permanently remove their profile and all associated data
                        from the system. This action cannot be reversed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            {(() => {
              const hasAssignments =
                assignedItems.tasks.length > 0 ||
                assignedItems.taskAssignments.length > 0 ||
                assignedItems.assets.length > 0 ||
                assignedItems.projects.length > 0 ||
                assignedItems.projectMemberships.length > 0 ||
                assignedItems.feedback.length > 0 ||
                assignedItems.documentation.length > 0

              if (hasAssignments) {
                return (
                  <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                    Close
                  </Button>
                )
              }

              return (
                <Button variant="destructive" onClick={confirmDeleteEmployee} disabled={isDeleting}>
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Employee Member
                    </>
                  )}
                </Button>
              )
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Column Selection Dialog */}
      <Dialog open={exportEmployeeDialogOpen} onOpenChange={setExportEmployeeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="space-y-3 border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                <Download className="text-primary h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl">Select Columns to Export</DialogTitle>
                <DialogDescription className="mt-1">
                  Choose which columns you want to include in your{" "}
                  <span className="text-primary font-semibold">{exportType?.toUpperCase()}</span> export
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <div className="bg-muted/50 mb-3 flex items-center justify-between rounded-lg px-3 py-2">
              <span className="text-muted-foreground text-sm font-medium">
                {Object.values(selectedColumns).filter((v) => v).length} of {Object.keys(selectedColumns).length}{" "}
                columns selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const allSelected = Object.values(selectedColumns).every((v) => v)
                  setSelectedColumns(
                    Object.keys(selectedColumns).reduce(
                      (acc, key) => ({ ...acc, [key]: !allSelected }),
                      {} as Record<string, boolean>
                    )
                  )
                }}
                className="h-7 text-xs"
              >
                {Object.values(selectedColumns).every((v) => v) ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <div className="bg-background/50 max-h-96 space-y-1.5 overflow-y-auto rounded-lg border p-2">
              {Object.keys(selectedColumns).map((column) => (
                <div
                  key={column}
                  className={`group hover:bg-muted/80 flex items-center space-x-3 rounded-md px-3 py-2.5 transition-colors ${
                    selectedColumns[column] ? "bg-primary/5 hover:bg-primary/10" : ""
                  }`}
                >
                  <Checkbox
                    id={column}
                    checked={selectedColumns[column]}
                    onCheckedChange={(checked) => {
                      setSelectedColumns((prev) => ({
                        ...prev,
                        [column]: checked === true,
                      }))
                    }}
                    className="data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                  />
                  <Label
                    htmlFor={column}
                    className={`flex-1 cursor-pointer text-sm font-medium transition-colors ${
                      selectedColumns[column]
                        ? "text-foreground"
                        : "text-muted-foreground group-hover:text-foreground dark:group-hover:text-foreground"
                    }`}
                  >
                    {column}
                  </Label>
                  {selectedColumns[column] && <CheckCircle2 className="text-primary h-4 w-4" />}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setExportEmployeeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (exportType === "excel") {
                  exportEmployeesToExcel()
                } else if (exportType === "pdf") {
                  exportEmployeesToPDF()
                } else if (exportType === "word") {
                  exportEmployeesToWord()
                }
              }}
              disabled={Object.values(selectedColumns).filter((v) => v).length === 0}
            >
              Export to {exportType?.toUpperCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
