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
import { formatName } from "@/lib/utils"
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
import type { UserRole } from "@/types/database"
import { getRoleDisplayName, getRoleBadgeColor, canAssignRoles, DEPARTMENTS, OFFICE_LOCATIONS } from "@/lib/permissions"
import { SignatureCreator } from "@/components/signature-creator"
import { ASSET_TYPE_MAP } from "@/lib/asset-types"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Calendar, User as UserIcon } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"

interface Staff {
  id: string
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
  created_at: string
}

interface UserProfile {
  role: UserRole
}

export default function AdminStaffPage() {
  const searchParams = useSearchParams()
  const [staff, setStaff] = useState<Staff[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([])
  const [staffFilter, setStaffFilter] = useState<string[]>([])
  const [roleFilter, setRoleFilter] = useState<string[]>([])
  const [nameSortOrder, setNameSortOrder] = useState<"asc" | "desc">("asc")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false)
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
  
  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportType, setExportType] = useState<"excel" | "pdf" | "word" | null>(null)
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>({
    "#": true,
    "First Name": true,
    "Last Name": true,
    "Other Names": true,
    "Email": true,
    "Department": true,
    "Role": true,
    "Position": true,
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
  const [viewStaffProfile, setViewStaffProfile] = useState<any>(null)
  const [viewStaffData, setViewStaffData] = useState<{
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
    role: "staff" as UserRole,
  })

  // Form states
  const [editForm, setEditForm] = useState({
    role: "staff" as UserRole,
    department: "",
    office_location: "",
    company_role: "",
    lead_departments: [] as string[],
    // Expanded fields
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

  useEffect(() => {
    loadData()
  }, [])

  // Handle userId from search params (for edit dialog)
  useEffect(() => {
    const userId = searchParams?.get("userId")
    if (userId && staff.length > 0 && !isEditDialogOpen) {
      const user = staff.find((s) => s.id === userId)
      if (user) {
        handleEditStaff(user)
      }
    }
  }, [searchParams, staff, isEditDialogOpen])

  const loadData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, lead_departments")
        .eq("id", user.id)
        .single()

      setUserProfile(profile)

      // Fetch staff - leads can only see staff in their departments
      let query = supabase.from("profiles").select("*").order("last_name", { ascending: true })

      // If user is a lead, filter by their lead departments
      if (profile?.role === "lead" && profile.lead_departments && profile.lead_departments.length > 0) {
        query = query.in("department", profile.lead_departments)
      }

      const { data, error } = await query

      if (error) throw error

      setStaff(data || [])
    } catch (error: any) {
      console.error("Error loading staff:", error)
      toast.error("Failed to load staff")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditStaff = async (staffMember: Staff) => {
    try {
      setSelectedStaff(staffMember)
      
      // Load full profile data to get all fields
      const { data: fullProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", staffMember.id)
        .single()

      if (fullProfile) {
        setEditForm({
          role: fullProfile.role || "staff",
          department: fullProfile.department || "",
          office_location: fullProfile.office_location || "",
          company_role: fullProfile.company_role || "",
          lead_departments: fullProfile.lead_departments || [],
          // Expanded fields
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
          role: staffMember.role,
          department: staffMember.department,
          office_location: staffMember.office_location || "",
          company_role: staffMember.company_role || "",
          lead_departments: staffMember.lead_departments || [],
          first_name: staffMember.first_name || "",
          last_name: staffMember.last_name || "",
          other_names: staffMember.other_names || "",
          company_email: staffMember.company_email || "",
          phone_number: staffMember.phone_number || "",
          additional_phone: "",
          residential_address: staffMember.residential_address || "",
          current_work_location: staffMember.current_work_location || "",
          bank_name: "",
          bank_account_number: "",
          bank_account_name: "",
          date_of_birth: "",
          employment_date: "",
          job_description: "",
        })
      }
      
      setShowMoreOptions(false) // Reset expanded state
      setIsEditDialogOpen(true)
    } catch (error: any) {
      console.error("Error loading staff for edit:", error)
      toast.error("Failed to load staff details")
    }
  }

  const handleViewSignature = async (staffMember: Staff) => {
    try {
      setSelectedStaff(staffMember)
      setIsSignatureDialogOpen(true)

      // Load full profile data for signature
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", staffMember.id).single()

      if (profileData) {
        setSelectedStaff(profileData as any)
      }
    } catch (error: any) {
      console.error("Error loading profile for signature:", error)
      toast.error("Failed to load profile data")
    }
  }

  const handleViewDetails = async (staffMember: Staff) => {
    try {
      setSelectedStaff(staffMember)
      setIsViewDialogOpen(true)

      // Load full profile data
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", staffMember.id).single()

      if (profileData) {
        setViewStaffProfile(profileData)

        // Load related data
        const [tasksResult, assetAssignmentsResult, officeAssetsResult, docsResult] = await Promise.all([
          supabase
            .from("tasks")
            .select("*")
            .eq("assigned_to", staffMember.id)
            .order("created_at", { ascending: false })
            .limit(10),
          // Individual asset assignments
          supabase
            .from("asset_assignments")
            .select("id, asset_id, assigned_at, is_current, assignment_type")
            .eq("assigned_to", staffMember.id)
            .eq("is_current", true)
            .limit(10),
          // Office location asset assignments (if user has office_location)
          profileData.office_location
            ? supabase
                .from("asset_assignments")
                .select("id, asset_id, assigned_at, is_current, assignment_type, office_location")
                .eq("office_location", profileData.office_location)
                .eq("is_current", true)
                .eq("assignment_type", "office")
                .limit(10)
            : Promise.resolve({ data: [] }),
          supabase
            .from("user_documentation")
            .select("*")
            .eq("user_id", staffMember.id)
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

        // Fetch asset details separately for office assignments
        const officeAssetsWithDetails = await Promise.all(
          (officeAssetsResult.data || []).map(async (assignment: any) => {
            const { data: assetData } = await supabase
              .from("assets")
              .select("id, asset_name, asset_type, asset_model, serial_number, unique_code, status")
              .eq("id", assignment.asset_id)
              .single()

            return {
              ...assignment,
              Asset: assetData,
              assignmentType: "office" as const,
              officeLocation: assignment.office_location || profileData.office_location,
            }
          })
        )

        // Combine both types of assignments
        const allAssets = [...individualAssetsWithDetails, ...officeAssetsWithDetails]

        setViewStaffData({
          tasks: tasksResult.data || [],
          assets: allAssets || [],
          documentation: docsResult.data || [],
        })
      }
    } catch (error: any) {
      console.error("Error loading staff details:", error)
      toast.error("Failed to load staff details")
    }
  }

  const checkAssignedItems = async (staffMember: Staff) => {
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
        supabase.from("tasks").select("id, title, status").eq("assigned_to", staffMember.id),
        // Task assignments (multiple user assignments)
        supabase.from("task_assignments").select("id, task_id, Task:tasks(id, title, status)").eq("user_id", staffMember.id),
        // Current asset assignments
        supabase
          .from("asset_assignments")
          .select("id, Asset:assets(id, asset_name, asset_type)")
          .eq("assigned_to", staffMember.id)
          .eq("is_current", true),
        // Projects managed or created by this user
        supabase
          .from("projects")
          .select("id, project_name, status")
          .or(`project_manager_id.eq.${staffMember.id},created_by.eq.${staffMember.id}`),
        // Active project memberships
        supabase
          .from("project_members")
          .select("id, Project:projects(id, project_name)")
          .eq("user_id", staffMember.id)
          .eq("is_active", true),
        // Feedback submitted by this user
        supabase.from("feedback").select("id, title, status").eq("user_id", staffMember.id),
        // User documentation
        supabase.from("user_documentation").select("id, title").eq("user_id", staffMember.id),
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

  const handleDeleteStaff = async (staffMember: Staff) => {
    try {
      setSelectedStaff(staffMember)
      const assigned = await checkAssignedItems(staffMember)

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

  const confirmDeleteStaff = async () => {
    if (isDeleting || !selectedStaff) return

    setIsDeleting(true)
    try {
      // Check permissions - only super_admin can delete users
      if (userProfile?.role !== "super_admin") {
        toast.error("Only super admins can delete users")
        setIsDeleting(false)
        return
      }

      // Double-check for assignments before deleting
      const assigned = await checkAssignedItems(selectedStaff)
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
      const { error: profileError } = await supabase.from("profiles").delete().eq("id", selectedStaff.id)

      if (profileError) {
        // If that fails, try using admin API (if available)
        try {
          const { error: authError } = await supabase.auth.admin.deleteUser(selectedStaff.id)
          if (authError) {
            throw authError
          }
        } catch (adminError: any) {
          // Admin API might not be available, throw the original error
          throw profileError
        }
      }

      toast.success("Staff member deleted successfully")
      setIsDeleteDialogOpen(false)
      setSelectedStaff(null)
      loadData()
    } catch (error: any) {
      console.error("Error deleting staff:", error)
      toast.error(error.message || "Failed to delete staff member")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSaveStaff = async () => {
    if (isSaving) return // Prevent duplicate submissions
    setIsSaving(true)
    try {
      if (!selectedStaff) {
        setIsSaving(false)
        return
      }

      // Check if user can assign this role
      if (userProfile && !canAssignRoles(userProfile.role, editForm.role)) {
        toast.error("You don't have permission to assign this role")
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

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", selectedStaff.id)

      if (error) throw error

      toast.success("Staff member updated successfully")
      setIsEditDialogOpen(false)
      loadData()
    } catch (error: any) {
      console.error("Error updating staff:", error)
      toast.error("Failed to update staff member")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateUser = async () => {
    if (isCreatingUser) return
    setIsCreatingUser(true)

    try {
      // Validate required fields
      if (!createUserForm.firstName.trim() || !createUserForm.lastName.trim() || !createUserForm.email.trim() || !createUserForm.department) {
        toast.error("First name, last name, email, and department are required")
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
        role: "staff",
      })
      loadData()
    } catch (error: any) {
      console.error("Error creating user:", error)
      toast.error(error.message || "Failed to create user")
    } finally {
      setIsCreatingUser(false)
    }
  }


  const filteredStaff = staff
    .filter((member) => {
      const matchesSearch =
        member.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.company_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.company_role?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesDepartment = departmentFilter.length === 0 || departmentFilter.includes(member.department)

      const matchesStaff = staffFilter.length === 0 || staffFilter.includes(member.id)

      const matchesRole = roleFilter.length === 0 || roleFilter.includes(member.role)

      return matchesSearch && matchesDepartment && matchesStaff && matchesRole
    })
    .sort((a, b) => {
      const lastNameA = formatName(a.last_name).toLowerCase()
      const lastNameB = formatName(b.last_name).toLowerCase()

      if (nameSortOrder === "asc") {
        return lastNameA.localeCompare(lastNameB)
      } else {
        return lastNameB.localeCompare(lastNameA)
      }
    })

  const departments = Array.from(new Set(staff.map((s) => s.department).filter(Boolean))) as string[]

  const roles: UserRole[] = ["visitor", "staff", "lead", "admin", "super_admin"]

  const stats = {
    total: staff.length,
    admins: staff.filter((s) => ["super_admin", "admin"].includes(s.role)).length,
    leads: staff.filter((s) => s.role === "lead").length,
    staff: staff.filter((s) => s.role === "staff").length,
  }

  // Helper function to get export data with selected columns
  const getExportData = (staffMembers: Staff[]) => {
    return staffMembers.map((member, index) => {
      const row: Record<string, any> = {}
      if (selectedColumns["#"]) row["#"] = index + 1
      if (selectedColumns["First Name"]) row["First Name"] = formatName(member.first_name) || "-"
      if (selectedColumns["Last Name"]) row["Last Name"] = formatName(member.last_name) || "-"
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
      if (selectedColumns["Lead Departments"]) row["Lead Departments"] = member.lead_departments?.length ? member.lead_departments.join(", ") : "-"
      if (selectedColumns["Created At"]) row["Created At"] = member.created_at ? new Date(member.created_at).toLocaleDateString() : "-"
      return row
    })
  }

  // Export functions
  const handleExportClick = (type: "excel" | "pdf" | "word") => {
    setExportType(type)
    setExportDialogOpen(true)
  }

  const exportStaffToExcel = async () => {
    try {
      if (filteredStaff.length === 0) {
        toast.error("No staff data to export")
        return
      }

      const XLSX = await import("xlsx")
      const { default: saveAs } = await import("file-saver")

      const dataToExport = getExportData(filteredStaff)

      const ws = XLSX.utils.json_to_sheet(dataToExport)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Staff")

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
      saveAs(data, `staff-export-${new Date().toISOString().split("T")[0]}.xlsx`)
      toast.success("Staff exported to Excel successfully")
      setExportDialogOpen(false)
    } catch (error: any) {
      console.error("Error exporting staff to Excel:", error)
      toast.error("Failed to export staff to Excel")
    }
  }

  const exportStaffToPDF = async () => {
    try {
      if (filteredStaff.length === 0) {
        toast.error("No staff data to export")
        return
      }

      const jsPDF = (await import("jspdf")).default
      const autoTable = (await import("jspdf-autotable")).default

      const doc = new jsPDF({ orientation: "landscape" })
      doc.setFontSize(16)
      doc.text("Staff Report", 14, 15)
      doc.setFontSize(10)
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22)
      doc.text(`Total Staff: ${filteredStaff.length}`, 14, 28)

      // Prepare data with selected columns
      const dataToExport = filteredStaff.map((member, index) => {
        const row: any[] = []
        const headers: string[] = []
        
        if (selectedColumns["#"]) {
          row.push(index + 1)
          headers.push("#")
        }
        if (selectedColumns["First Name"]) {
          row.push(formatName(member.first_name) || "-")
          headers.push("First Name")
        }
        if (selectedColumns["Last Name"]) {
          row.push(formatName(member.last_name) || "-")
          headers.push("Last Name")
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
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      })

      doc.save(`staff-export-${new Date().toISOString().split("T")[0]}.pdf`)
      toast.success("Staff exported to PDF successfully")
      setExportDialogOpen(false)
    } catch (error: any) {
      console.error("Error exporting staff to PDF:", error)
      toast.error("Failed to export staff to PDF")
    }
  }

  const exportStaffToWord = async () => {
    try {
      if (filteredStaff.length === 0) {
        toast.error("No staff data to export")
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

      const dataToExport = getExportData(filteredStaff)

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
                text: "Staff Report",
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                text: `Generated on: ${new Date().toLocaleDateString()}`,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                text: `Total Staff: ${filteredStaff.length}`,
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
      saveAs(blob, `staff-export-${new Date().toISOString().split("T")[0]}.docx`)
      toast.success("Staff exported to Word successfully")
    } catch (error: any) {
      console.error("Error exporting staff to Word:", error)
      toast.error("Failed to export staff to Word")
    }
  }

  const getAvailableRoles = (): UserRole[] => {
    if (!userProfile) return []

    if (userProfile.role === "super_admin") {
      return ["visitor", "staff", "lead", "admin", "super_admin"]
    } else if (userProfile.role === "admin") {
      return ["visitor", "staff", "lead"]
    }

    return []
  }

  if (isLoading) {
    return (
      <div className="from-background via-background to-muted/20 flex min-h-screen w-full items-center justify-center bg-gradient-to-br">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading staff...</p>
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
              Staff Management
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              View and manage staff members, roles, and permissions
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(userProfile?.role === "admin" || userProfile?.role === "super_admin") && (
              <Button
                onClick={() => setIsCreateUserDialogOpen(true)}
                className="gap-2"
                size="sm"
              >
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
        <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-4 md:gap-4">
          <Card className="border-2">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="xs:text-xs text-muted-foreground truncate text-[10px] font-medium">Total Staff</p>
                  <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">{stats.total}</p>
                </div>
                <div className="ml-1 shrink-0 rounded-lg bg-blue-100 p-1.5 sm:p-2 md:p-3 dark:bg-blue-900/30">
                  <Users className="h-4 w-4 text-blue-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="xs:text-xs text-muted-foreground truncate text-[10px] font-medium">Admins</p>
                  <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">
                    {stats.admins}
                  </p>
                </div>
                <div className="ml-1 flex-shrink-0 rounded-lg bg-red-100 p-1.5 sm:p-2 md:p-3 dark:bg-red-900/30">
                  <Shield className="h-4 w-4 text-red-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="xs:text-xs text-muted-foreground truncate text-[10px] font-medium">Leads</p>
                  <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">{stats.leads}</p>
                </div>
                <div className="ml-1 flex-shrink-0 rounded-lg bg-purple-100 p-1.5 sm:p-2 md:p-3 dark:bg-purple-900/30">
                  <UserCog className="h-4 w-4 text-purple-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="xs:text-xs text-muted-foreground truncate text-[10px] font-medium">Staff Members</p>
                  <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">{stats.staff}</p>
                </div>
                <div className="ml-1 flex-shrink-0 rounded-lg bg-green-100 p-1.5 sm:p-2 md:p-3 dark:bg-green-900/30">
                  <Users className="h-4 w-4 text-green-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Export Buttons */}
        <Card className="border-2">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Download className="text-muted-foreground h-4 w-4" />
                <span className="text-foreground text-sm font-medium">Export Filtered Staff:</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportClick("excel")}
                  className="gap-2"
                  disabled={filteredStaff.length === 0}
                >
                  <FileText className="h-4 w-4" />
                  Excel (.xlsx)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportClick("pdf")}
                  className="gap-2"
                  disabled={filteredStaff.length === 0}
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportClick("word")}
                  className="gap-2"
                  disabled={filteredStaff.length === 0}
                >
                  <FileText className="h-4 w-4" />
                  Word (.docx)
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
                  placeholder="Search staff by name, email, or position..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-12 pl-11 text-base"
                />
              </div>
              
              {/* Filter Buttons */}
              <div className="flex flex-col gap-3 md:flex-row">
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
                placeholder="All Departments"
              />
              <SearchableMultiSelect
                label="Staff Members"
                icon={<User className="h-4 w-4" />}
                values={staffFilter}
                options={staff.map((member) => ({
                  value: member.id,
                  label: `${formatName(member.first_name)} ${formatName(member.last_name)} - ${member.department || "No Dept"}`,
                  icon: <User className="h-3 w-3" />,
                }))}
                onChange={setStaffFilter}
                placeholder="All Staff"
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
                placeholder="All Roles"
              />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Staff List */}
        {filteredStaff.length > 0 ? (
          viewMode === "list" ? (
            <Card className="border-2">
              <div className="table-responsive">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <span>Name</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setNameSortOrder(nameSortOrder === "asc" ? "desc" : "asc")}
                            className="h-6 w-6 p-0"
                          >
                            {nameSortOrder === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.map((member, index) => (
                      <TableRow key={member.id}>
                        <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <Link
                            href={`/admin/staff/${member.id}`}
                            className="hover:text-primary flex items-center gap-2 transition-colors"
                          >
                            <div className="bg-primary/10 rounded-lg p-2">
                              <Users className="text-primary h-4 w-4" />
                            </div>
                            <span className="text-foreground font-medium">
                              {formatName(member.last_name)}, {formatName(member.first_name)}
                            </span>
                          </Link>
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
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 sm:gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 sm:h-auto sm:w-auto sm:p-2"
                              title="View Signature"
                              onClick={() => handleViewSignature(member)}
                            >
                              <FileSignature className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs sm:h-auto sm:text-sm"
                              onClick={() => handleViewDetails(member)}
                            >
                              <span className="hidden sm:inline">View</span>
                              <span className="sm:hidden">👁</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 sm:h-auto sm:w-auto sm:p-2"
                              onClick={() => handleEditStaff(member)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            {userProfile?.role === "super_admin" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 sm:h-auto sm:w-auto sm:p-2"
                                onClick={() => handleDeleteStaff(member)}
                                title="Delete Staff Member"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
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
              {filteredStaff.map((member) => (
                <Card key={member.id} className="border-2 transition-shadow hover:shadow-lg">
                  <CardHeader className="from-primary/5 to-background border-b bg-linear-to-r">
                    <div className="flex items-start justify-between">
                      <Link
                        href={`/admin/staff/${member.id}`}
                        className="hover:text-primary flex flex-1 items-start gap-3 transition-colors"
                      >
                        <div className="bg-primary/10 rounded-lg p-2">
                          <Users className="text-primary h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-lg">
                            {member.first_name} {member.last_name}
                          </CardTitle>
                          <div className="mt-2 flex flex-wrap gap-2">
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
                        </div>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditStaff(member)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
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
                      <Button variant="outline" size="sm" onClick={() => handleViewDetails(member)} className="flex-1">
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewSignature(member)}
                        className="flex-1"
                        title="View Signature"
                      >
                        <FileSignature className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditStaff(member)}
                        className="flex-1 gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                      {userProfile?.role === "super_admin" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteStaff(member)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Delete Staff Member"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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
              <h3 className="text-foreground mb-2 text-xl font-semibold">No Staff Found</h3>
              <p className="text-muted-foreground">
                {searchQuery || departmentFilter.length > 0 || roleFilter.length > 0 || staffFilter.length > 0
                  ? "No staff matches your filters"
                  : "No staff members found"}
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
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Create New User</DialogTitle>
                <DialogDescription className="mt-1">
                  Add a new staff member to the system. Name, email, and department are required.
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
              disabled={isCreatingUser || !createUserForm.firstName.trim() || !createUserForm.lastName.trim() || !createUserForm.email.trim() || !createUserForm.department}
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

      {/* Edit Staff Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open)
          if (!open) {
            setShowMoreOptions(false) // Reset expanded state when dialog closes
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit {selectedStaff?.first_name} {selectedStaff?.last_name}
            </DialogTitle>
            <DialogDescription>Update staff member's role, department, and permissions</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="role">Role *</Label>
              <Select
                value={editForm.role}
                onValueChange={(value: UserRole) => {
                  setEditForm({ ...editForm, role: value })
                  // Clear lead departments when role is not lead
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
                  ? "As Admin, you can assign: Visitor, Staff, and Lead roles"
                  : "As Super Admin, you can assign any role"}
              </p>
              {editForm.role === "lead" && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ Lead role requires selecting at least one department below
                </p>
              )}
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
                searchPlaceholder="Search office locations..."
                icon={<Building2 className="h-4 w-4" />}
                options={OFFICE_LOCATIONS.map((location) => ({
                  value: location,
                  label: location,
                  icon: <Building2 className="h-3 w-3" />,
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
                <div className="bg-primary/10 border-primary/20 rounded-lg border p-3">
                  <p className="text-primary mb-2 text-sm font-medium">Lead Department Selection Required</p>
                  <p className="text-muted-foreground text-xs">
                    Select at least one department that this person will lead
                  </p>
                </div>

                <div>
                  <Label>Lead Departments *</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {DEPARTMENTS.map((dept) => (
                      <div key={dept} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`dept-${dept}`}
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
                        <Label htmlFor={`dept-${dept}`} className="text-sm">
                          {dept}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {editForm.lead_departments.length === 0 && (
                    <p className="text-destructive mt-2 text-xs">Please select at least one department</p>
                  )}
                </div>
              </div>
            )}

            {/* More Options Section */}
            <div className="border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowMoreOptions(!showMoreOptions)}
                className="w-full justify-between"
              >
                <span className="font-medium">More Options</span>
                {showMoreOptions ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>

              {showMoreOptions && (
                <div className="mt-4 space-y-4 animate-in slide-in-from-top-2">
                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-foreground">Personal Information</h4>
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
                    <h4 className="text-sm font-semibold text-foreground">Address Information</h4>
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
                    <h4 className="text-sm font-semibold text-foreground">Banking Information</h4>
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
                    <h4 className="text-sm font-semibold text-foreground">Job Information</h4>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveStaff} loading={isSaving}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signature Dialog */}
      <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Email Signature - {selectedStaff?.first_name} {selectedStaff?.last_name}
            </DialogTitle>
            <DialogDescription>View and manage signature for this staff member</DialogDescription>
          </DialogHeader>
          {selectedStaff && (
            <div className="mt-4">
              <SignatureCreator profile={selectedStaff} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              {viewStaffProfile
                ? `${formatName(viewStaffProfile.first_name)} ${formatName(viewStaffProfile.last_name)}`
                : "Staff Details"}
            </DialogTitle>
            <DialogDescription>View complete profile and related information</DialogDescription>
          </DialogHeader>
          {viewStaffProfile && (
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
                            {formatName(viewStaffProfile.first_name)?.[0]}
                            {formatName(viewStaffProfile.last_name)?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-muted-foreground text-sm">Full Name</p>
                          <p className="font-medium">
                            {formatName(viewStaffProfile.first_name)} {formatName(viewStaffProfile.last_name)}
                          </p>
                          {viewStaffProfile.other_names && (
                            <p className="text-muted-foreground text-xs">({viewStaffProfile.other_names})</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Mail className="text-muted-foreground h-5 w-5" />
                        <div>
                          <p className="text-muted-foreground text-sm">Email</p>
                          <p className="font-medium">{viewStaffProfile.company_email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Building2 className="text-muted-foreground h-5 w-5" />
                        <div>
                          <p className="text-muted-foreground text-sm">Department</p>
                          <p className="font-medium">{viewStaffProfile.department || "N/A"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Shield className="text-muted-foreground h-5 w-5" />
                        <div>
                          <p className="text-muted-foreground text-sm">Role</p>
                          <div className="mt-1 flex gap-2">
                            <Badge className={getRoleBadgeColor(viewStaffProfile.role as UserRole)}>
                              {getRoleDisplayName(viewStaffProfile.role as UserRole)}
                            </Badge>
                            {viewStaffProfile.role === "lead" &&
                              viewStaffProfile.lead_departments &&
                              viewStaffProfile.lead_departments.length > 0 && (
                                <Badge variant="outline">
                                  Leading {viewStaffProfile.lead_departments.length} Dept
                                  {viewStaffProfile.lead_departments.length > 1 ? "s" : ""}
                                </Badge>
                              )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <UserIcon className="text-muted-foreground h-5 w-5" />
                        <div>
                          <p className="text-muted-foreground text-sm">Position</p>
                          <p className="font-medium">{viewStaffProfile.company_role || "N/A"}</p>
                        </div>
                      </div>

                      {viewStaffProfile.phone_number && (
                        <div className="flex items-center gap-3">
                          <Phone className="text-muted-foreground h-5 w-5" />
                          <div>
                            <p className="text-muted-foreground text-sm">Phone</p>
                            <p className="font-medium">{viewStaffProfile.phone_number}</p>
                            {viewStaffProfile.additional_phone && (
                              <p className="text-muted-foreground text-xs">{viewStaffProfile.additional_phone}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {viewStaffProfile.residential_address && (
                        <div className="flex items-center gap-3">
                          <MapPin className="text-muted-foreground h-5 w-5" />
                          <div>
                            <p className="text-muted-foreground text-sm">Address</p>
                            <p className="font-medium">{viewStaffProfile.residential_address}</p>
                          </div>
                        </div>
                      )}

                      {viewStaffProfile.current_work_location && (
                        <div className="flex items-center gap-3">
                          <MapPin className="text-muted-foreground h-5 w-5" />
                          <div>
                            <p className="text-muted-foreground text-sm">Work Location</p>
                            <p className="font-medium">{viewStaffProfile.current_work_location}</p>
                          </div>
                        </div>
                      )}

                      {viewStaffProfile.lead_departments && viewStaffProfile.lead_departments.length > 0 && (
                        <div className="flex items-center gap-3">
                          <Building2 className="text-muted-foreground h-5 w-5" />
                          <div>
                            <p className="text-muted-foreground text-sm">Leading Departments</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {viewStaffProfile.lead_departments.map((dept: string) => (
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
                          <p className="font-medium">{new Date(viewStaffProfile.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Related Data Tabs */}
                <Tabs defaultValue="assets" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="assets">Assets ({viewStaffData.assets.length})</TabsTrigger>
                    <TabsTrigger value="tasks">Tasks ({viewStaffData.tasks.length})</TabsTrigger>
                    <TabsTrigger value="documentation">
                      Documentation ({viewStaffData.documentation.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="assets">
                    <Card>
                      <CardHeader>
                        <CardTitle>Assigned Assets</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {viewStaffData.assets.length > 0 ? (
                          <div className="space-y-3">
                            {viewStaffData.assets.map((assignment: any) => {
                              const asset = assignment.Asset
                              const assetTypeLabel = asset?.asset_type ? (ASSET_TYPE_MAP[asset.asset_type]?.label || asset.asset_type) : "Unknown"
                              const isOfficeAssignment = assignment.assignmentType === "office"
                              
                              return (
                                <div key={assignment.id} className="rounded-lg border p-4">
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold text-base">{assetTypeLabel}</p>
                                      {isOfficeAssignment ? (
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                          Office: {assignment.officeLocation || viewStaffProfile?.office_location || "Office"}
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
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
                                      <span className="text-muted-foreground font-medium min-w-[120px]">Unique Code:</span>
                                      <span className="font-mono">{asset?.unique_code || "-"}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground font-medium min-w-[120px]">Model Number:</span>
                                      <span>{asset?.asset_model || "-"}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground font-medium min-w-[120px]">Serial Number:</span>
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
                        {viewStaffData.tasks.length > 0 ? (
                          <div className="space-y-2">
                            {viewStaffData.tasks.map((task: any) => (
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
                        {viewStaffData.documentation.length > 0 ? (
                          <div className="space-y-2">
                            {viewStaffData.documentation.map((doc: any) => (
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Staff Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Staff Member
            </DialogTitle>
            <DialogDescription>
              {selectedStaff
                ? `Are you sure you want to delete ${formatName(selectedStaff.first_name)} ${formatName(selectedStaff.last_name)}?`
                : "Are you sure you want to delete this staff member?"}
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
                        <h4 className="text-destructive mb-2 font-semibold">Cannot Delete Staff Member</h4>
                        <p className="text-muted-foreground mb-4 text-sm">
                          This staff member has items assigned to them. Please reassign or remove all items before
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
                                  <div key={task.id} className="text-muted-foreground rounded bg-background p-2 text-xs">
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
                                    className="text-muted-foreground rounded bg-background p-2 text-xs"
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
                                    className="text-muted-foreground rounded bg-background p-2 text-xs"
                                  >
                                    • {assignment.Asset?.asset_name || "Unknown Asset"} (
                                    {assignment.Asset?.asset_type || "N/A"})
                                  </div>
                                ))}
                                {assignedItems.assets.length > 5 && (
                                  <p className="text-muted-foreground text-xs">
                                    ...and {assignedItems.assets.length - 5} more
                                  </p>
                                )}
                              </div>
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
                                    className="text-muted-foreground rounded bg-background p-2 text-xs"
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
                                    className="text-muted-foreground rounded bg-background p-2 text-xs"
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
                                  <div key={fb.id} className="text-muted-foreground rounded bg-background p-2 text-xs">
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
                                  <div key={doc.id} className="text-muted-foreground rounded bg-background p-2 text-xs">
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
                        Deleting this staff member will permanently remove their profile and all associated data from
                        the system. This action cannot be reversed.
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
                <Button variant="destructive" onClick={confirmDeleteStaff} disabled={isDeleting}>
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Staff Member
                    </>
                  )}
                </Button>
              )
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Column Selection Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="space-y-3 border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Select Columns to Export</DialogTitle>
                <DialogDescription className="mt-1">
                  Choose which columns you want to include in your{" "}
                  <span className="font-semibold text-primary">{exportType?.toUpperCase()}</span> export
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <div className="mb-3 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
              <span className="text-sm font-medium text-muted-foreground">
                {Object.values(selectedColumns).filter((v) => v).length} of {Object.keys(selectedColumns).length} columns selected
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
            <div className="max-h-96 space-y-1.5 overflow-y-auto rounded-lg border bg-background/50 p-2">
              {Object.keys(selectedColumns).map((column) => (
                <div
                  key={column}
                  className={`group flex items-center space-x-3 rounded-md px-3 py-2.5 transition-colors hover:bg-muted/80 ${
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
                      selectedColumns[column] ? "text-foreground" : "text-muted-foreground group-hover:text-foreground dark:group-hover:text-foreground"
                    }`}
                  >
                    {column}
                  </Label>
                  {selectedColumns[column] && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (exportType === "excel") {
                  exportStaffToExcel()
                } else if (exportType === "pdf") {
                  exportStaffToPDF()
                } else if (exportType === "word") {
                  exportStaffToWord()
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
