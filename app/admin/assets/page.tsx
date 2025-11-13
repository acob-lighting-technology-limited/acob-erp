"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatName } from "@/lib/utils"
import { ASSET_TYPES, ASSET_TYPE_MAP, generateUniqueCodePreview } from "@/lib/asset-types"
import { DEPARTMENTS, OFFICE_LOCATIONS } from "@/lib/permissions"
import { assignmentValidation } from "@/lib/validation"
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  UserPlus,
  Filter,
  LayoutGrid,
  List,
  User,
  Building2,
  Eye,
  History,
  Calendar,
  FileText,
  Building,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react"

interface Asset {
  id: string
  unique_code: string
  asset_type: string
  acquisition_year: number
  asset_model?: string
  serial_number?: string
  status: string
  notes?: string
  created_at: string
  created_by: string
  assignment_type?: "individual" | "department" | "office"
  department?: string
  office_location?: string
  current_assignment?: {
    assigned_to?: string
    department?: string
    office_location?: string
    user?: {
      first_name: string
      last_name: string
    }
  }
  issues?: AssetIssue[]
  unresolved_issues_count?: number
}

interface AssetIssue {
  id: string
  asset_id: string
  description: string
  resolved: boolean
  created_at: string
  resolved_at?: string
  resolved_by?: string
  created_by: string
}

interface Staff {
  id: string
  first_name: string
  last_name: string
  company_email: string
  department: string
}

interface AssetAssignment {
  id: string
  assigned_to?: string
  department?: string
  assigned_at: string
  is_current: boolean
  user?: {
    first_name: string
    last_name: string
  }
}

interface AssignmentHistory {
  id: string
  assigned_at: string
  handed_over_at?: string
  assignment_notes?: string
  handover_notes?: string
  department?: string
  assigned_from_user?: {
    first_name: string
    last_name: string
  }
  assigned_by_user?: {
    first_name: string
    last_name: string
  }
  assigned_to_user?: {
    first_name: string
    last_name: string
  }
}

const currentYear = new Date().getFullYear()

export default function AdminAssetsPage() {
  const router = useRouter()
  const [assets, setAssets] = useState<Asset[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [userProfile, setUserProfile] = useState<{ role?: string; lead_departments?: string[] } | null>(null)
  const [, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [userFilter, setUserFilter] = useState("all")
  const [yearFilter, setYearFilter] = useState("all")
  const [officeLocationFilter, setOfficeLocationFilter] = useState("all")
  const [assetTypeFilter, setAssetTypeFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)

  // Dialog states
  const [isAssetDialogOpen, setIsAssetDialogOpen] = useState(false)
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isIssuesDialogOpen, setIsIssuesDialogOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [assetHistory, setAssetHistory] = useState<AssignmentHistory[]>([])

  // Issue tracking states
  const [assetIssues, setAssetIssues] = useState<AssetIssue[]>([])
  const [newIssueDescription, setNewIssueDescription] = useState("")
  const [issueStatusFilter, setIssueStatusFilter] = useState("all")
  const [isAddingIssue, setIsAddingIssue] = useState(false)

  // Track original form values for change detection
  const [originalAssetForm, setOriginalAssetForm] = useState({
    asset_type: "",
    acquisition_year: currentYear,
    asset_model: "",
    serial_number: "",
    unique_code: "",
    status: "available",
    notes: "",
  })

  // Form states
  const [assetForm, setAssetForm] = useState({
    asset_type: "",
    acquisition_year: currentYear,
    asset_model: "",
    serial_number: "",
    unique_code: "",
    status: "available",
    notes: "",
    // Assignment fields
    assignment_type: "individual" as "individual" | "department" | "office",
    assigned_to: "",
    assignment_department: "",
    office_location: "",
    assignment_notes: "",
  })

  const [assignForm, setAssignForm] = useState({
    assignment_type: "individual" as "individual" | "department" | "office",
    assigned_to: "",
    department: "",
    office_location: "",
    assignment_notes: "",
  })

  const [currentAssignment, setCurrentAssignment] = useState<AssetAssignment | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Get current user profile to check if they're a lead
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("role, lead_departments")
        .eq("id", user.id)
        .single()

      // Fetch assets - RLS will handle filtering for leads
      const { data: AssetsData, error: AssetsError } = await supabase
        .from("assets")
        .select("*")
        .order("created_at", { ascending: false })

      if (AssetsError) throw AssetsError

      // Fetch current assignments for all assets
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("asset_assignments")
        .select("asset_id, assigned_to, department, office_location")
        .eq("is_current", true)

      if (assignmentsError) throw assignmentsError

      // Fetch user details for assignments
      const assignmentsWithUsers = await Promise.all(
        (assignmentsData || []).map(async (assignment: any) => {
          if (assignment.assigned_to) {
            const { data: userProfile } = await supabase
              .from("profiles")
              .select("first_name, last_name, department")
              .eq("id", assignment.assigned_to)
              .single()

            return {
              ...assignment,
              user: userProfile,
            }
          }
          return assignment
        })
      )

      // Fetch staff - leads can only see staff in their departments
      let staffQuery = supabase
        .from("profiles")
        .select("id, first_name, last_name, company_email, department")
        .order("last_name", { ascending: true })

      // If user is a lead, filter by their lead departments
      if (userProfile?.role === "lead" && userProfile.lead_departments && userProfile.lead_departments.length > 0) {
        staffQuery = staffQuery.in("department", userProfile.lead_departments)
      }

      const { data: staffData, error: staffError } = await staffQuery

      if (staffError) throw staffError

      // Filter assets for leads - only show assets assigned to their department staff or department
      let filteredAssets = AssetsData || []
      if (userProfile?.role === "lead" && userProfile.lead_departments && userProfile.lead_departments.length > 0) {
        const deptUserIds = (staffData || []).map((s: any) => s.id)
        filteredAssets = filteredAssets.filter((asset) => {
          const assignment = (assignmentsWithUsers || []).find((a: any) => a.asset_id === asset.id)
          if (!assignment) return false

          // Check if assigned to individual in department
          if (assignment.assigned_to && deptUserIds.includes(assignment.assigned_to)) {
            return true
          }

          // Check if assigned to department
          if (assignment.department && userProfile.lead_departments.includes(assignment.department)) {
            return true
          }

          return false
        })
      }

      // Fetch unresolved issue counts for all assets
      const { data: issuesData, error: issuesError } = await supabase.from("asset_issues").select("asset_id, resolved")

      if (issuesError) console.error("Error fetching issues:", issuesError)

      // Count unresolved issues per asset
      const issueCountsByAsset: Record<string, number> = {}
      ;(issuesData || []).forEach((issue: any) => {
        if (!issue.resolved) {
          issueCountsByAsset[issue.asset_id] = (issueCountsByAsset[issue.asset_id] || 0) + 1
        }
      })

      // Combine assets with their current assignments and issue counts
      const assetsWithAssignments = filteredAssets.map((asset) => {
        const assignment = (assignmentsWithUsers || []).find((a: any) => a.asset_id === asset.id)
        return {
          ...asset,
          current_assignment: assignment
            ? {
                assigned_to: assignment.assigned_to,
                department: assignment.department,
                office_location: assignment.office_location,
                user: assignment.user || null,
              }
            : undefined,
          unresolved_issues_count: issueCountsByAsset[asset.id] || 0,
        }
      })

      // Get unique departments - for leads, only show their lead departments
      let uniqueDepartments: string[] = []
      if (userProfile?.role === "lead" && userProfile.lead_departments && userProfile.lead_departments.length > 0) {
        uniqueDepartments = userProfile.lead_departments.filter((dept: string) => DEPARTMENTS.includes(dept as any))
      } else {
        uniqueDepartments = [...DEPARTMENTS]
      }
      setDepartments(uniqueDepartments)
      setUserProfile(userProfile || null)

      setAssets(assetsWithAssignments)
      setStaff(staffData || [])
    } catch (error: any) {
      console.error("Error loading data:", error)
      const errorMessage = error?.message || error?.toString() || "Failed to load data"
      toast.error(`Failed to load data: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const loadCurrentAssignment = async (assetId: string) => {
    try {
      // Get asset to check assignment type and status
      const { data: assetData } = await supabase
        .from("assets")
        .select("assignment_type, department, status")
        .eq("id", assetId)
        .single()

      // If asset status is not "assigned" or "retired", don't load any assignment
      if (assetData?.status !== "assigned" && assetData?.status !== "retired") {
        setCurrentAssignment(null)
        return
      }

      const { data, error } = await supabase
        .from("asset_assignments")
        .select("id, assigned_to, assigned_at, is_current, department")
        .eq("asset_id", assetId)
        .eq("is_current", true)
        .single()

      if (error && error.code !== "PGRST116") throw error

      if (data) {
        if (data.assigned_to) {
          // Fetch user details separately
          const { data: userProfile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", data.assigned_to)
            .single()

          setCurrentAssignment({
            ...data,
            user: userProfile,
          } as any)
        } else if (data.department) {
          setCurrentAssignment({
            ...data,
            department: data.department,
          } as any)
        }
      } else {
        setCurrentAssignment(null)
      }
    } catch (error) {
      console.error("Error loading assignment:", error)
      setCurrentAssignment(null)
    }
  }

  const loadAssetHistory = async (asset: Asset) => {
    try {
      const { data, error } = await supabase
        .from("asset_assignments")
        .select(
          "id, assigned_at, handed_over_at, assignment_notes, handover_notes, assigned_from, assigned_by, assigned_to, department"
        )
        .eq("asset_id", asset.id)
        .order("assigned_at", { ascending: false })

      if (error) throw error

      // Fetch user details separately for each assignment
      const historyWithUsers = await Promise.all(
        (data || []).map(async (assignment: any) => {
          const [assignedFromResult, assignedByResult, assignedToResult] = await Promise.all([
            assignment.assigned_from
              ? supabase.from("profiles").select("first_name, last_name").eq("id", assignment.assigned_from).single()
              : Promise.resolve({ data: null }),
            assignment.assigned_by
              ? supabase.from("profiles").select("first_name, last_name").eq("id", assignment.assigned_by).single()
              : Promise.resolve({ data: null }),
            assignment.assigned_to
              ? supabase.from("profiles").select("first_name, last_name").eq("id", assignment.assigned_to).single()
              : Promise.resolve({ data: null }),
          ])

          return {
            ...assignment,
            assigned_from_user: assignedFromResult.data,
            assigned_by_user: assignedByResult.data,
            assigned_to_user: assignedToResult.data,
          }
        })
      )

      setAssetHistory((historyWithUsers as any) || [])
      setSelectedAsset(asset)
      setIsHistoryOpen(true)
    } catch (error: any) {
      console.error("Error loading asset history:", error)
      const errorMessage = error?.message || error?.toString() || "Failed to load asset history"
      toast.error(`Failed to load asset history: ${errorMessage}`)
    }
  }

  const loadAssetIssues = async (assetId: string) => {
    try {
      const { data, error } = await supabase
        .from("asset_issues")
        .select("*")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setAssetIssues(data || [])
    } catch (error: any) {
      console.error("Error loading asset issues:", error)
      toast.error("Failed to load asset issues")
    }
  }

  const handleAddIssue = async () => {
    if (!newIssueDescription.trim() || !selectedAsset || isAddingIssue) return

    setIsAddingIssue(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setIsAddingIssue(false)
        return
      }

      const { error } = await supabase.from("asset_issues").insert({
        asset_id: selectedAsset.id,
        description: newIssueDescription.trim(),
        created_by: user.id,
      })

      if (error) throw error

      toast.success("Issue added")
      setNewIssueDescription("")
      await loadAssetIssues(selectedAsset.id)
      await loadData() // Refresh to update issue counts
    } catch (error: any) {
      console.error("Error adding issue:", error)
      toast.error("Failed to add issue")
    } finally {
      setIsAddingIssue(false)
    }
  }

  const handleToggleIssue = async (issue: AssetIssue) => {
    try {
      const { error } = await supabase.from("asset_issues").update({ resolved: !issue.resolved }).eq("id", issue.id)

      if (error) throw error

      toast.success(issue.resolved ? "Issue marked as unresolved" : "Issue marked as resolved")
      if (selectedAsset) {
        await loadAssetIssues(selectedAsset.id)
      }
      await loadData() // Refresh to update issue counts
    } catch (error: any) {
      console.error("Error toggling issue:", error)
      toast.error("Failed to update issue")
    }
  }

  const handleDeleteIssue = async (issueId: string) => {
    try {
      const { error } = await supabase.from("asset_issues").delete().eq("id", issueId)

      if (error) throw error

      toast.success("Issue deleted")
      if (selectedAsset) {
        await loadAssetIssues(selectedAsset.id)
      }
      await loadData() // Refresh to update issue counts
    } catch (error: any) {
      console.error("Error deleting issue:", error)
      toast.error("Failed to delete issue")
    }
  }

  const handleOpenAssetDialog = async (asset?: Asset) => {
    if (asset) {
      setSelectedAsset(asset)
      const formData = {
        asset_type: asset.asset_type,
        acquisition_year: asset.acquisition_year,
        asset_model: asset.asset_model || "",
        serial_number: asset.serial_number || "",
        unique_code: asset.unique_code,
        status: asset.status,
        notes: asset.notes || "",
        assignment_type: "individual" as "individual" | "department" | "office",
        assigned_to: "",
        assignment_department: "",
        office_location: "",
        assignment_notes: "",
      }
      setAssetForm(formData)
      // Store original values for change detection
      setOriginalAssetForm({
        asset_type: asset.asset_type,
        acquisition_year: asset.acquisition_year,
        asset_model: asset.asset_model || "",
        serial_number: asset.serial_number || "",
        unique_code: asset.unique_code,
        status: asset.status,
        notes: asset.notes || "",
      })
    } else {
      setSelectedAsset(null)
      setAssetForm({
        asset_type: "",
        acquisition_year: currentYear,
        asset_model: "",
        serial_number: "",
        unique_code: "",
        status: "available",
        notes: "",
        assignment_type: "individual",
        assigned_to: "",
        assignment_department: "",
        office_location: "",
        assignment_notes: "",
      })
      setOriginalAssetForm({
        asset_type: "",
        acquisition_year: currentYear,
        asset_model: "",
        serial_number: "",
        unique_code: "",
        status: "available",
        notes: "",
      })
    }
    setIsAssetDialogOpen(true)
  }

  const handleOpenIssuesDialog = async (asset: Asset) => {
    setSelectedAsset(asset)
    await loadAssetIssues(asset.id)
    setNewIssueDescription("")
    setIsIssuesDialogOpen(true)
  }

  const handleOpenAssignDialog = async (asset: Asset) => {
    setSelectedAsset(asset)
    await loadCurrentAssignment(asset.id)
    setAssignForm({
      assignment_type: asset.assignment_type || "individual",
      assigned_to: asset.current_assignment?.assigned_to || "",
      department: asset.current_assignment?.department || asset.department || "",
      office_location: asset.current_assignment?.office_location || asset.office_location || "",
      assignment_notes: "",
    })
    setIsAssignDialogOpen(true)
  }

  const handleSaveAsset = async () => {
    if (isSaving) return // Prevent duplicate submissions
    setIsSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setIsSaving(false)
        return
      }

      // Validate required fields
      if (!assetForm.asset_type) {
        toast.error("Please select an asset type")
        setIsSaving(false)
        return
      }

      // Note: Asset model and serial number are optional and can be added later

      if (selectedAsset) {
        // Update existing asset
        const updateData: any = {
          asset_type: assetForm.asset_type,
          acquisition_year: assetForm.acquisition_year,
          status: assetForm.status,
          notes: assetForm.notes || null,
          asset_model: assetForm.asset_model || null,
          serial_number: assetForm.serial_number || null,
        }

        // If status is changing from "assigned" to something else (except "retired" or "maintenance")
        // End active assignments. For "retired" and "maintenance", we keep the assignment to show who had it last.
        if (
          selectedAsset.status === "assigned" &&
          assetForm.status !== "assigned" &&
          assetForm.status !== "retired" &&
          assetForm.status !== "maintenance"
        ) {
          const { error: endAssignmentError } = await supabase
            .from("asset_assignments")
            .update({
              is_current: false,
              handed_over_at: new Date().toISOString(),
              handover_notes: `Asset status changed to ${assetForm.status}`,
            })
            .eq("asset_id", selectedAsset.id)
            .eq("is_current", true)

          if (endAssignmentError) throw endAssignmentError

          // Clear assignment fields
          updateData.assignment_type = null
          updateData.department = null
          updateData.office_location = null
        }

        const { error } = await supabase.from("assets").update(updateData).eq("id", selectedAsset.id)

        if (error) throw error

        // Log audit
        await supabase.rpc("log_audit", {
          p_action: "update",
          p_entity_type: "asset",
          p_entity_id: selectedAsset.id,
          p_old_values: { ...selectedAsset },
          p_new_values: { ...updateData, unique_code: selectedAsset.unique_code },
        })

        toast.success("Asset updated successfully")
      } else {
        // Validate acquisition year - cannot go backwards in time for this asset type
        const { data: latestAsset, error: yearCheckError } = await supabase
          .from("assets")
          .select("acquisition_year")
          .eq("asset_type", assetForm.asset_type)
          .order("acquisition_year", { ascending: false })
          .limit(1)
          .single()

        if (yearCheckError && yearCheckError.code !== "PGRST116") {
          // PGRST116 is "no rows returned" which is fine for first asset of this type
          throw yearCheckError
        }

        if (latestAsset && assetForm.acquisition_year < latestAsset.acquisition_year) {
          const assetTypeName = ASSET_TYPE_MAP[assetForm.asset_type]?.label || assetForm.asset_type
          toast.error(
            `Cannot create ${assetTypeName} with year ${assetForm.acquisition_year}. ` +
              `Latest ${assetTypeName} was acquired in ${latestAsset.acquisition_year}. ` +
              `New assets must be from year ${latestAsset.acquisition_year} or later.`
          )
          setIsSaving(false)
          return
        }

        // Create new asset - get next serial number
        const { data: uniqueCodeData, error: serialError } = await supabase.rpc("get_next_asset_serial", {
          asset_code: assetForm.asset_type,
          year: assetForm.acquisition_year,
        })

        if (serialError) throw serialError

        const insertData: any = {
          asset_type: assetForm.asset_type,
          acquisition_year: assetForm.acquisition_year,
          unique_code: uniqueCodeData,
          status: assetForm.status,
          notes: assetForm.notes || null,
          asset_model: assetForm.asset_model || null,
          serial_number: assetForm.serial_number || null,
          created_by: user.id,
        }

        const { data: newAsset, error } = await supabase.from("assets").insert(insertData).select().single()

        if (error) throw error

        // Log audit
        await supabase.rpc("log_audit", {
          p_action: "create",
          p_entity_type: "asset",
          p_entity_id: newAsset?.id || null,
          p_new_values: { ...insertData, unique_code: uniqueCodeData },
        })

        // Handle assignment if status is 'assigned'
        if (assetForm.status === "assigned" && newAsset) {
          // Validate assignment fields
          if (assetForm.assignment_type === "individual" && !assetForm.assigned_to) {
            toast.error("Please select a user to assign to")
            return
          }
          if (assetForm.assignment_type === "department" && !assetForm.assignment_department) {
            toast.error("Please select a department")
            return
          }
          if (assetForm.assignment_type === "office" && !assetForm.office_location) {
            toast.error("Please select an office location")
            return
          }

          const assignmentData: any = {
            asset_id: newAsset.id,
            assigned_by: user.id,
            assigned_at: new Date().toISOString(),
            is_current: true,
            assignment_notes: assetForm.assignment_notes || null,
          }

          if (assetForm.assignment_type === "individual") {
            assignmentData.assigned_to = assetForm.assigned_to
          } else if (assetForm.assignment_type === "department") {
            assignmentData.department = assetForm.assignment_department
          } else if (assetForm.assignment_type === "office") {
            assignmentData.office_location = assetForm.office_location
          }

          const { error: assignError } = await supabase.from("asset_assignments").insert(assignmentData)

          if (assignError) throw assignError

          // Update asset with assignment info
          const assetUpdate: any = {
            assignment_type: assetForm.assignment_type,
            status: "assigned",
          }

          if (assetForm.assignment_type === "department") {
            assetUpdate.department = assetForm.assignment_department
          } else if (assetForm.assignment_type === "office") {
            assetUpdate.office_location = assetForm.office_location
          } else {
            assetUpdate.department = null
            assetUpdate.office_location = null
          }

          const { error: assetError } = await supabase.from("assets").update(assetUpdate).eq("id", newAsset.id)

          if (assetError) throw assetError

          toast.success(`Asset created and assigned successfully with code: ${uniqueCodeData}`)
        } else {
          toast.success(`Asset created successfully with code: ${uniqueCodeData}`)
        }
      }

      setIsAssetDialogOpen(false)
      loadData()
    } catch (error: any) {
      console.error("Error saving asset:", error)
      const errorMessage = error?.message || error?.toString() || "Failed to save asset"
      toast.error(`Failed to save asset: ${errorMessage}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAssignAsset = async () => {
    if (isAssigning) return // Prevent duplicate submissions

    try {
      if (!selectedAsset) return

      // Validate assignment using centralized validation utility
      const assignmentError = assignmentValidation.validateAssignment(
        assignForm.assignment_type,
        assignForm.assigned_to,
        assignForm.department,
        assignForm.office_location
      )
      if (assignmentError) {
        toast.error(assignmentError)
        return
      }

      setIsAssigning(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Mark all existing assignments as not current
      await supabase
        .from("asset_assignments")
        .update({ is_current: false, handed_over_at: new Date().toISOString(), handover_notes: "Reassigned" })
        .eq("asset_id", selectedAsset.id)
        .eq("is_current", true)

      // Get previous assignment for audit log
      const previousAssignedTo = currentAssignment?.assigned_to || null
      const previousDepartment = currentAssignment?.department || null

      // Create new assignment
      const assignmentData: any = {
        asset_id: selectedAsset.id,
        assigned_by: user.id,
        assignment_notes: assignForm.assignment_notes || null,
        is_current: true,
      }

      if (assignForm.assignment_type === "individual") {
        assignmentData.assigned_to = assignForm.assigned_to
        assignmentData.assigned_from = previousAssignedTo
      } else if (assignForm.assignment_type === "department") {
        assignmentData.department = assignForm.department
      } else if (assignForm.assignment_type === "office") {
        assignmentData.office_location = assignForm.office_location
      }

      const { error: assignError } = await supabase.from("asset_assignments").insert(assignmentData)

      if (assignError) throw assignError

      // Update asset with assignment type and related fields
      const assetUpdate: any = {
        assignment_type: assignForm.assignment_type,
        status: "assigned",
      }

      if (assignForm.assignment_type === "department") {
        assetUpdate.department = assignForm.department
        assetUpdate.office_location = null
      } else if (assignForm.assignment_type === "office") {
        assetUpdate.office_location = assignForm.office_location
        assetUpdate.department = null
      } else {
        assetUpdate.department = null
        assetUpdate.office_location = null
      }

      const { error: assetError } = await supabase.from("assets").update(assetUpdate).eq("id", selectedAsset.id)

      if (assetError) throw assetError

      // Log audit
      const oldValues = previousAssignedTo
        ? { assigned_to: previousAssignedTo }
        : previousDepartment
          ? { department: previousDepartment }
          : null

      const newValues: any = { assignment_type: assignForm.assignment_type, notes: assignForm.assignment_notes }
      if (assignForm.assignment_type === "individual") {
        newValues.assigned_to = assignForm.assigned_to
      } else if (assignForm.assignment_type === "department") {
        newValues.department = assignForm.department
      } else if (assignForm.assignment_type === "office") {
        newValues.office_location = assignForm.office_location
      }

      await supabase.rpc("log_audit", {
        p_action: currentAssignment ? "reassign" : "assign",
        p_entity_type: "asset",
        p_entity_id: selectedAsset.id,
        p_old_values: { ...oldValues, unique_code: selectedAsset.unique_code },
        p_new_values: { ...newValues, unique_code: selectedAsset.unique_code },
      })

      toast.success(`Asset ${currentAssignment ? "reassigned" : "assigned"} successfully`)
      setIsAssignDialogOpen(false)
      setCurrentAssignment(null)
      loadData()
    } catch (error: any) {
      console.error("Error assigning asset:", error)
      const errorMessage = error?.message || error?.toString() || "Failed to assign asset"
      toast.error(`Failed to assign asset: ${errorMessage}`)
    } finally {
      setIsAssigning(false)
    }
  }

  const handleDeleteAsset = async () => {
    if (isDeleting) return // Prevent duplicate submissions
    setIsDeleting(true)
    try {
      if (!assetToDelete) {
        setIsDeleting(false)
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setIsDeleting(false)
        return
      }

      // Only check for active assignments if the asset status is "assigned"
      if (assetToDelete.status === "assigned") {
        const { data: assignments } = await supabase
          .from("asset_assignments")
          .select("*")
          .eq("asset_id", assetToDelete.id)
          .eq("is_current", true)

        if (assignments && assignments.length > 0) {
          toast.error("Cannot delete asset with active assignments. Please change the status first.")
          setIsDeleting(false)
          return
        }
      }

      // Check for sequential numbering - cannot delete if higher-numbered asset exists
      // Extract serial number from unique_code (e.g., "014" from "ACOB/HQ/CHAIR/2023/014")
      // Year doesn't matter - only asset type and serial number
      const uniqueCodeParts = assetToDelete.unique_code?.split("/")
      if (uniqueCodeParts && uniqueCodeParts.length >= 5) {
        const currentSerialNumber = parseInt(uniqueCodeParts[4], 10)
        const assetType = assetToDelete.asset_type

        if (!isNaN(currentSerialNumber)) {
          // Check if any asset with same type (regardless of year) has a higher serial number
          const { data: allAssetsOfType, error: checkError } = await supabase
            .from("assets")
            .select("id, unique_code")
            .eq("asset_type", assetType)
            .neq("id", assetToDelete.id)

          if (checkError) throw checkError

          // Check each asset to see if it has a higher serial number
          const hasHigherNumber = allAssetsOfType?.some((asset) => {
            const parts = asset.unique_code?.split("/")
            if (parts && parts.length >= 5) {
              const serialNum = parseInt(parts[4], 10)
              return !isNaN(serialNum) && serialNum > currentSerialNumber
            }
            return false
          })

          if (hasHigherNumber) {
            const assetTypeName = ASSET_TYPE_MAP[assetType]?.label || assetType
            toast.error(
              `Cannot delete ${assetToDelete.unique_code}. ` +
                `Higher-numbered ${assetTypeName} assets exist (serial number ${currentSerialNumber + 1} or higher). ` +
                `Delete assets in reverse order (highest number first) to maintain sequential numbering.`
            )
            setIsDeleting(false)
            return
          }
        }
      }

      const { error } = await supabase.from("assets").delete().eq("id", assetToDelete.id)

      if (error) throw error

      // Log audit
      await supabase.rpc("log_audit", {
        p_action: "delete",
        p_entity_type: "asset",
        p_entity_id: assetToDelete.id,
        p_old_values: assetToDelete,
      })

      toast.success("Asset deleted successfully")
      setIsDeleteDialogOpen(false)
      setAssetToDelete(null)
      loadData()
    } catch (error: any) {
      console.error("Error deleting asset:", error)
      const errorMessage = error?.message || error?.toString() || "Failed to delete asset"
      toast.error(`Failed to delete asset: ${errorMessage}`)
    } finally {
      setIsDeleting(false)
    }
  }

  // Sorting function
  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  const getSortedAssets = (assetsToSort: Asset[]) => {
    if (!sortConfig) return assetsToSort

    const sorted = [...assetsToSort].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortConfig.key) {
        case "unique_code":
          aValue = a.unique_code
          bValue = b.unique_code
          break
        case "asset_type":
          aValue = ASSET_TYPE_MAP[a.asset_type]?.label || a.asset_type
          bValue = ASSET_TYPE_MAP[b.asset_type]?.label || b.asset_type
          break
        case "model":
          aValue = a.asset_model || ""
          bValue = b.asset_model || ""
          break
        case "year":
          aValue = a.acquisition_year || 0
          bValue = b.acquisition_year || 0
          break
        case "status":
          aValue = a.status
          bValue = b.status
          break
        case "assigned_to":
          if (a.current_assignment?.user) {
            aValue = `${a.current_assignment.user.first_name} ${a.current_assignment.user.last_name}`
          } else if (a.current_assignment?.department) {
            aValue = a.current_assignment.department
          } else {
            aValue = ""
          }
          if (b.current_assignment?.user) {
            bValue = `${b.current_assignment.user.first_name} ${b.current_assignment.user.last_name}`
          } else if (b.current_assignment?.department) {
            bValue = b.current_assignment.department
          } else {
            bValue = ""
          }
          break
        default:
          return 0
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortConfig.direction === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      }

      if (sortConfig.direction === "asc") {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
      }
    })

    return sorted
  }

  // Export functions
  const exportToExcel = async () => {
    try {
      const XLSX = await import("xlsx")
      const { default: saveAs } = await import("file-saver")

      const dataToExport = getSortedAssets(filteredAssets).map((asset, index) => ({
        "#": index + 1,
        "Unique Code": asset.unique_code,
        "Asset Type": ASSET_TYPE_MAP[asset.asset_type]?.label || asset.asset_type,
        Model: asset.asset_model || "-",
        "Serial Number": asset.serial_number || "-",
        Year: asset.acquisition_year,
        Status: asset.status,
        "Assigned To":
          asset.status === "assigned" || asset.status === "retired" || asset.status === "maintenance"
            ? asset.assignment_type === "office"
              ? `${asset.office_location || "Office"}${asset.status === "retired" ? " (retired)" : asset.status === "maintenance" ? " (maintenance)" : ""}`
              : asset.current_assignment?.user
                ? `${formatName(asset.current_assignment.user.first_name)} ${formatName(asset.current_assignment.user.last_name)}${asset.status === "retired" ? " (retired)" : asset.status === "maintenance" ? " (maintenance)" : ""}`
                : asset.current_assignment?.department
                  ? `${asset.current_assignment.department}${asset.status === "retired" ? " (retired)" : asset.status === "maintenance" ? " (maintenance)" : ""}`
                  : "Unassigned"
            : "Unassigned",
        Department: asset.department || "-",
        "Office Location": asset.office_location || "-",
        Notes: asset.notes || "-",
      }))

      const ws = XLSX.utils.json_to_sheet(dataToExport)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Assets")

      // Auto-size columns
      const maxWidth = 50
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
      saveAs(data, `assets-export-${new Date().toISOString().split("T")[0]}.xlsx`)
      toast.success("Assets exported to Excel successfully")
    } catch (error: any) {
      console.error("Error exporting to Excel:", error)
      toast.error("Failed to export to Excel")
    }
  }

  const exportToPDF = async () => {
    try {
      const jsPDF = (await import("jspdf")).default
      const autoTable = (await import("jspdf-autotable")).default

      const doc = new jsPDF({ orientation: "landscape" })

      // Add title
      doc.setFontSize(16)
      doc.text("Assets Report", 14, 15)
      doc.setFontSize(10)
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22)
      doc.text(`Total Assets: ${getSortedAssets(filteredAssets).length}`, 14, 28)

      // Prepare data
      const dataToExport = getSortedAssets(filteredAssets).map((asset, index) => [
        index + 1,
        asset.unique_code,
        ASSET_TYPE_MAP[asset.asset_type]?.label || asset.asset_type,
        asset.asset_model || "-",
        asset.acquisition_year,
        asset.status,
        asset.status === "assigned" || asset.status === "retired" || asset.status === "maintenance"
          ? asset.assignment_type === "office"
            ? `${asset.office_location || "Office"}${asset.status === "retired" ? " (retired)" : asset.status === "maintenance" ? " (maintenance)" : ""}`
            : asset.current_assignment?.user
              ? `${formatName(asset.current_assignment.user.first_name)} ${formatName(asset.current_assignment.user.last_name)}${asset.status === "retired" ? " (retired)" : asset.status === "maintenance" ? " (maintenance)" : ""}`
              : asset.current_assignment?.department
                ? `${asset.current_assignment.department}${asset.status === "retired" ? " (retired)" : asset.status === "maintenance" ? " (maintenance)" : ""}`
                : "Unassigned"
          : "Unassigned",
      ])

      autoTable(doc, {
        head: [["#", "Code", "Type", "Model", "Year", "Status", "Assigned To"]],
        body: dataToExport,
        startY: 35,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      })

      doc.save(`assets-export-${new Date().toISOString().split("T")[0]}.pdf`)
      toast.success("Assets exported to PDF successfully")
    } catch (error: any) {
      console.error("Error exporting to PDF:", error)
      toast.error("Failed to export to PDF")
    }
  }

  const exportToWord = async () => {
    try {
      const {
        Document,
        Packer,
        Paragraph,
        TextRun,
        Table,
        TableCell,
        TableRow,
        WidthType,
        AlignmentType,
        HeadingLevel,
      } = await import("docx")
      const { default: saveAs } = await import("file-saver")

      const dataToExport = getSortedAssets(filteredAssets)

      // Create header rows
      const tableRows = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "#", bold: true })] })] }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Unique Code", bold: true })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Asset Type", bold: true })] })],
            }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Model", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Year", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Status", bold: true })] })] }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Assigned To", bold: true })] })],
            }),
          ],
        }),
        ...dataToExport.map(
          (asset, index) =>
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph((index + 1).toString())] }),
                new TableCell({ children: [new Paragraph(asset.unique_code)] }),
                new TableCell({
                  children: [new Paragraph(ASSET_TYPE_MAP[asset.asset_type]?.label || asset.asset_type)],
                }),
                new TableCell({ children: [new Paragraph(asset.asset_model || "-")] }),
                new TableCell({ children: [new Paragraph(asset.acquisition_year?.toString() || "-")] }),
                new TableCell({ children: [new Paragraph(asset.status)] }),
                new TableCell({
                  children: [
                    new Paragraph(
                      asset.status === "assigned" || asset.status === "retired" || asset.status === "maintenance"
                        ? asset.assignment_type === "office"
                          ? `${asset.office_location || "Office"}${asset.status === "retired" ? " (retired)" : asset.status === "maintenance" ? " (maintenance)" : ""}`
                          : asset.current_assignment?.user
                            ? `${formatName(asset.current_assignment.user.first_name)} ${formatName(asset.current_assignment.user.last_name)}${asset.status === "retired" ? " (retired)" : asset.status === "maintenance" ? " (maintenance)" : ""}`
                            : asset.current_assignment?.department
                              ? `${asset.current_assignment.department}${asset.status === "retired" ? " (retired)" : asset.status === "maintenance" ? " (maintenance)" : ""}`
                              : "Unassigned"
                        : "Unassigned"
                    ),
                  ],
                }),
              ],
            })
        ),
      ]

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                text: "Assets Report",
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                text: `Generated on: ${new Date().toLocaleDateString()}`,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                text: `Total Assets: ${dataToExport.length}`,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({ text: "" }), // Empty line
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: tableRows,
              }),
            ],
          },
        ],
      })

      const blob = await Packer.toBlob(doc)
      saveAs(blob, `assets-export-${new Date().toISOString().split("T")[0]}.docx`)
      toast.success("Assets exported to Word successfully")
    } catch (error: any) {
      console.error("Error exporting to Word:", error)
      toast.error("Failed to export to Word")
    }
  }

  const filteredAssets = assets.filter((asset) => {
    const assetTypeLabel = ASSET_TYPE_MAP[asset.asset_type]?.label || asset.asset_type

    // Enhanced search - now searches across all relevant fields
    const matchesSearch =
      searchQuery === "" ||
      [
        asset.unique_code,
        assetTypeLabel,
        asset.asset_model,
        asset.serial_number,
        asset.acquisition_year?.toString(),
        asset.status,
        asset.notes,
        asset.department,
        asset.office_location,
        asset.current_assignment?.user
          ? `${asset.current_assignment.user.first_name} ${asset.current_assignment.user.last_name}`
          : "",
        asset.current_assignment?.department,
      ].some((field) => field?.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesStatus = statusFilter === "all" || asset.status === statusFilter
    const matchesYear = yearFilter === "all" || asset.acquisition_year?.toString() === yearFilter
    const matchesAssetType = assetTypeFilter === "all" || asset.asset_type === assetTypeFilter
    const matchesOfficeLocation =
      officeLocationFilter === "all" ||
      asset.office_location === officeLocationFilter ||
      asset.current_assignment?.office_location === officeLocationFilter

    // Filter by issue status
    const matchesIssueStatus =
      issueStatusFilter === "all" ||
      (issueStatusFilter === "has_issues" && (asset.unresolved_issues_count || 0) > 0) ||
      (issueStatusFilter === "no_issues" && (asset.unresolved_issues_count || 0) === 0)

    // Filter by department - for leads, always filter by their departments
    let matchesDepartment = true
    if (userProfile?.role === "lead") {
      // Leads: assets are already filtered, but ensure they match lead's departments
      if (userProfile.lead_departments && userProfile.lead_departments.length > 0) {
        const assignmentDept = asset.current_assignment?.department
        const assignedUserDept = asset.current_assignment?.assigned_to
          ? staff.find((s) => s.id === asset.current_assignment?.assigned_to)?.department
          : null

        matchesDepartment = assignmentDept
          ? userProfile.lead_departments.includes(assignmentDept)
          : assignedUserDept
            ? userProfile.lead_departments.includes(assignedUserDept)
            : false
      }
    } else {
      // Admins: use department filter
      matchesDepartment = departmentFilter === "all" || asset.current_assignment?.department === departmentFilter
    }

    // Filter by user
    const matchesUser = userFilter === "all" || asset.current_assignment?.assigned_to === userFilter

    return (
      matchesSearch &&
      matchesStatus &&
      matchesDepartment &&
      matchesUser &&
      matchesYear &&
      matchesAssetType &&
      matchesOfficeLocation &&
      matchesIssueStatus
    )
  })

  const stats = {
    total: assets.length,
    available: assets.filter((d) => d.status === "available").length,
    assigned: assets.filter((d) => d.status === "assigned").length,
    maintenance: assets.filter((d) => d.status === "maintenance").length,
    unresolvedIssues: assets.reduce((sum, asset) => sum + (asset.unresolved_issues_count || 0), 0),
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "assigned":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "available":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "maintenance":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      case "retired":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  const getUniqueCodePreview = () => {
    if (!assetForm.asset_type || !assetForm.acquisition_year) {
      return "ACOB/HQ/???/????/???"
    }
    return generateUniqueCodePreview(assetForm.asset_type, assetForm.acquisition_year, "???")
  }

  return (
    <div className="from-background via-background to-muted/20 min-h-screen w-full overflow-x-hidden bg-gradient-to-br">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold sm:gap-3 sm:text-3xl">
              <Package className="text-primary h-6 w-6 sm:h-8 sm:w-8" />
              Asset Management
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">Manage asset inventory and assignments</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            {userProfile?.role !== "lead" && (
              <Button onClick={() => handleOpenAssetDialog()} className="gap-2" size="sm">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Asset</span>
                <span className="sm:hidden">Add</span>
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-5 md:gap-4">
          <Card className="border-2">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="xs:text-xs text-muted-foreground truncate text-[10px] font-medium">Total assets</p>
                  <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">{stats.total}</p>
                </div>
                <div className="ml-1 shrink-0 rounded-lg bg-blue-100 p-1.5 sm:p-2 md:p-3 dark:bg-blue-900/30">
                  <Package className="h-4 w-4 text-blue-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="xs:text-xs text-muted-foreground truncate text-[10px] font-medium">Available</p>
                  <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">
                    {stats.available}
                  </p>
                </div>
                <div className="ml-1 flex-shrink-0 rounded-lg bg-green-100 p-1.5 sm:p-2 md:p-3 dark:bg-green-900/30">
                  <Package className="h-4 w-4 text-green-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="xs:text-xs text-muted-foreground truncate text-[10px] font-medium">Assigned</p>
                  <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">
                    {stats.assigned}
                  </p>
                </div>
                <div className="ml-1 flex-shrink-0 rounded-lg bg-purple-100 p-1.5 sm:p-2 md:p-3 dark:bg-purple-900/30">
                  <Package className="h-4 w-4 text-purple-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="xs:text-xs text-muted-foreground truncate text-[10px] font-medium">Maintenance</p>
                  <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">
                    {stats.maintenance}
                  </p>
                </div>
                <div className="ml-1 flex-shrink-0 rounded-lg bg-yellow-100 p-1.5 sm:p-2 md:p-3 dark:bg-yellow-900/30">
                  <Package className="h-4 w-4 text-yellow-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-2 transition-all hover:border-orange-300 hover:shadow-lg dark:hover:border-orange-700"
            onClick={() => router.push("/admin/assets/issues")}
          >
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="xs:text-xs text-muted-foreground truncate text-[10px] font-medium">Issues</p>
                  <p className="mt-1 text-lg font-bold text-orange-600 sm:text-xl md:mt-2 md:text-3xl dark:text-orange-400">
                    {stats.unresolvedIssues}
                  </p>
                </div>
                <div className="ml-1 flex-shrink-0 rounded-lg bg-orange-100 p-1.5 sm:p-2 md:p-3 dark:bg-orange-900/30">
                  <AlertCircle className="h-4 w-4 text-orange-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-orange-400" />
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
                <span className="text-foreground text-sm font-medium">Export Filtered Data:</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToExcel}
                  className="gap-2"
                  disabled={getSortedAssets(filteredAssets).length === 0}
                >
                  <FileText className="h-4 w-4" />
                  Excel (.xlsx)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToPDF}
                  className="gap-2"
                  disabled={getSortedAssets(filteredAssets).length === 0}
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToWord}
                  className="gap-2"
                  disabled={getSortedAssets(filteredAssets).length === 0}
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
              {/* First row - Search */}
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                <Input
                  placeholder="Search assets by code, type, model, serial, year, status, notes, location, or assigned user..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Second row - Filters */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                <SearchableSelect
                  value={assetTypeFilter}
                  onValueChange={setAssetTypeFilter}
                  placeholder="All Types"
                  searchPlaceholder="Search types..."
                  icon={<Package className="h-4 w-4" />}
                  className="w-full"
                  options={[
                    { value: "all", label: "All Types" },
                    ...ASSET_TYPES.map((type) => ({
                      value: type.code,
                      label: type.label,
                    })),
                  ]}
                />
                <SearchableSelect
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  placeholder="All Status"
                  searchPlaceholder="Search status..."
                  icon={<Filter className="h-4 w-4" />}
                  className="w-full"
                  options={[
                    { value: "all", label: "All Status" },
                    { value: "available", label: "Available" },
                    { value: "assigned", label: "Assigned" },
                    { value: "maintenance", label: "Maintenance" },
                    { value: "retired", label: "Retired" },
                  ]}
                />
                <SearchableSelect
                  value={yearFilter}
                  onValueChange={setYearFilter}
                  placeholder="All Years"
                  searchPlaceholder="Search years..."
                  icon={<Calendar className="h-4 w-4" />}
                  className="w-full"
                  options={[
                    { value: "all", label: "All Years" },
                    ...Array.from(new Set(assets.map((a) => a.acquisition_year)))
                      .filter(Boolean)
                      .sort((a, b) => (b || 0) - (a || 0))
                      .map((year) => ({
                        value: year?.toString() || "",
                        label: year?.toString() || "",
                      })),
                  ]}
                />
                <SearchableSelect
                  value={officeLocationFilter}
                  onValueChange={setOfficeLocationFilter}
                  placeholder="All Locations"
                  searchPlaceholder="Search locations..."
                  icon={<Building className="h-4 w-4" />}
                  className="w-full"
                  options={[
                    { value: "all", label: "All Locations" },
                    ...OFFICE_LOCATIONS.map((location) => ({
                      value: location,
                      label: location,
                      icon: <Building className="h-3 w-3" />,
                    })),
                  ]}
                />
                <SearchableSelect
                  value={issueStatusFilter}
                  onValueChange={setIssueStatusFilter}
                  placeholder="All Assets"
                  searchPlaceholder="Filter by issues..."
                  icon={<AlertCircle className="h-4 w-4" />}
                  className="w-full"
                  options={[
                    { value: "all", label: "All Assets" },
                    {
                      value: "has_issues",
                      label: "Has Issues",
                      icon: <AlertCircle className="h-3 w-3 text-orange-500" />,
                    },
                    {
                      value: "no_issues",
                      label: "No Issues",
                      icon: <CheckCircle2 className="h-3 w-3 text-green-500" />,
                    },
                  ]}
                />
                {/* Department filter - hidden for leads */}
                {userProfile?.role !== "lead" && (
                  <SearchableSelect
                    value={departmentFilter}
                    onValueChange={setDepartmentFilter}
                    placeholder="All Departments"
                    searchPlaceholder="Search departments..."
                    icon={<Building2 className="h-4 w-4" />}
                    className="w-full"
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
                  value={userFilter}
                  onValueChange={setUserFilter}
                  placeholder={
                    userProfile?.role === "lead" && departments.length > 0
                      ? `All ${departments.length === 1 ? departments[0] : "Department"} Users`
                      : "All Users"
                  }
                  searchPlaceholder="Search users..."
                  icon={<User className="h-4 w-4" />}
                  className="w-full"
                  options={[
                    {
                      value: "all",
                      label:
                        userProfile?.role === "lead" && departments.length > 0
                          ? `All ${departments.length === 1 ? departments[0] : "Department"} Users`
                          : "All Users",
                    },
                    ...staff.map((member) => ({
                      value: member.id,
                      label: `${formatName(member.first_name)} ${formatName(member.last_name)} - ${member.department}`,
                      icon: <User className="h-3 w-3" />,
                    })),
                  ]}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* assets List */}
        {getSortedAssets(filteredAssets).length > 0 ? (
          viewMode === "list" ? (
            <Card className="border-2">
              <div className="table-responsive">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead
                        className="hover:bg-muted/50 cursor-pointer select-none"
                        onClick={() => handleSort("unique_code")}
                      >
                        <div className="flex items-center gap-2">
                          Unique Code
                          {sortConfig?.key === "unique_code" ? (
                            sortConfig.direction === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : (
                            <ArrowUpDown className="text-muted-foreground h-3 w-3" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead
                        className="hover:bg-muted/50 cursor-pointer select-none"
                        onClick={() => handleSort("asset_type")}
                      >
                        <div className="flex items-center gap-2">
                          Asset Type
                          {sortConfig?.key === "asset_type" ? (
                            sortConfig.direction === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : (
                            <ArrowUpDown className="text-muted-foreground h-3 w-3" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead
                        className="hover:bg-muted/50 cursor-pointer select-none"
                        onClick={() => handleSort("model")}
                      >
                        <div className="flex items-center gap-2">
                          Model / Serial
                          {sortConfig?.key === "model" ? (
                            sortConfig.direction === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : (
                            <ArrowUpDown className="text-muted-foreground h-3 w-3" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead
                        className="hover:bg-muted/50 cursor-pointer select-none"
                        onClick={() => handleSort("year")}
                      >
                        <div className="flex items-center gap-2">
                          Year
                          {sortConfig?.key === "year" ? (
                            sortConfig.direction === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : (
                            <ArrowUpDown className="text-muted-foreground h-3 w-3" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead
                        className="hover:bg-muted/50 cursor-pointer select-none"
                        onClick={() => handleSort("status")}
                      >
                        <div className="flex items-center gap-2">
                          Status
                          {sortConfig?.key === "status" ? (
                            sortConfig.direction === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : (
                            <ArrowUpDown className="text-muted-foreground h-3 w-3" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead
                        className="hover:bg-muted/50 cursor-pointer select-none"
                        onClick={() => handleSort("assigned_to")}
                      >
                        <div className="flex items-center gap-2">
                          Assigned To
                          {sortConfig?.key === "assigned_to" ? (
                            sortConfig.direction === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : (
                            <ArrowUpDown className="text-muted-foreground h-3 w-3" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getSortedAssets(filteredAssets).map((asset, index) => (
                      <TableRow key={asset.id}>
                        <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="bg-primary/10 rounded-lg p-2">
                              <Package className="text-primary h-4 w-4" />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-foreground font-mono text-xs font-medium">{asset.unique_code}</span>
                              {asset.unresolved_issues_count! > 0 && (
                                <div className="flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 dark:bg-orange-900/30">
                                  <AlertCircle className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                                  <span className="text-[10px] font-medium text-orange-700 dark:text-orange-300">
                                    {asset.unresolved_issues_count}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-foreground text-sm font-medium">
                            {ASSET_TYPE_MAP[asset.asset_type]?.label || asset.asset_type}
                          </div>
                        </TableCell>
                        <TableCell>
                          {asset.asset_model || asset.serial_number ? (
                            <div className="text-sm">
                              {asset.asset_model && <div className="text-foreground">{asset.asset_model}</div>}
                              {asset.serial_number && (
                                <div className="text-muted-foreground font-mono text-xs">{asset.serial_number}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-foreground text-sm">{asset.acquisition_year}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(asset.status)}>{asset.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {asset.status === "assigned" ||
                          asset.status === "retired" ||
                          asset.status === "maintenance" ? (
                            asset.assignment_type === "office" ? (
                              <div className="flex items-center gap-2 text-sm">
                                <Building className="text-muted-foreground h-3 w-3" />
                                <span className="text-foreground">{asset.office_location || "Office"}</span>
                                {(asset.status === "retired" || asset.status === "maintenance") && (
                                  <span className="text-muted-foreground text-xs">({asset.status})</span>
                                )}
                              </div>
                            ) : asset.current_assignment ? (
                              asset.current_assignment.department ? (
                                <div className="flex items-center gap-2 text-sm">
                                  <Building2 className="text-muted-foreground h-3 w-3" />
                                  <span className="text-foreground">{asset.current_assignment.department}</span>
                                  {(asset.status === "retired" || asset.status === "maintenance") && (
                                    <span className="text-muted-foreground text-xs">({asset.status})</span>
                                  )}
                                </div>
                              ) : asset.current_assignment.user ? (
                                <div className="flex items-center gap-2 text-sm">
                                  <User className="text-muted-foreground h-3 w-3" />
                                  <span className="text-foreground">
                                    {formatName(asset.current_assignment.user.first_name)}{" "}
                                    {formatName(asset.current_assignment.user.last_name)}
                                  </span>
                                  {(asset.status === "retired" || asset.status === "maintenance") && (
                                    <span className="text-muted-foreground text-xs">({asset.status})</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">Unassigned</span>
                              )
                            ) : (
                              <span className="text-muted-foreground text-sm">Unassigned</span>
                            )
                          ) : (
                            <span className="text-muted-foreground text-sm">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-nowrap items-center justify-end gap-1 sm:gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenAssignDialog(asset)}
                              title={
                                asset.status === "retired"
                                  ? "Cannot reassign retired asset"
                                  : asset.status === "assigned" && asset.current_assignment
                                    ? "Reassign Asset"
                                    : "Assign Asset"
                              }
                              disabled={asset.status === "retired"}
                              className="h-8 w-8 p-0 sm:h-auto sm:w-auto sm:p-2"
                            >
                              <UserPlus className="h-3 w-3 sm:mr-1" />
                              <span className="hidden sm:inline">
                                {asset.status === "assigned" && asset.current_assignment ? "Reassign" : "Assign"}
                              </span>
                            </Button>
                            {userProfile?.role !== "lead" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenAssetDialog(asset)}
                                title="Edit Asset"
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenIssuesDialog(asset)}
                              title={`Asset Issues (${asset.unresolved_issues_count || 0} unresolved)`}
                              className={`h-8 w-8 p-0 ${(asset.unresolved_issues_count || 0) > 0 ? "border-orange-500 text-orange-600" : ""}`}
                            >
                              <AlertCircle className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => loadAssetHistory(asset)}
                              title="View assignment history"
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            {userProfile?.role !== "lead" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setAssetToDelete(asset)
                                  setIsDeleteDialogOpen(true)
                                }}
                                title="Delete asset"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
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
              {getSortedAssets(filteredAssets).map((asset) => (
                <Card key={asset.id} className="border-2 transition-shadow hover:shadow-lg">
                  <CardHeader className="from-primary/5 to-background border-b bg-linear-to-r">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="bg-primary/10 rounded-lg p-2">
                          <Package className="text-primary h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="font-mono text-sm">{asset.unique_code}</CardTitle>
                            {asset.unresolved_issues_count! > 0 && (
                              <div className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 dark:bg-orange-900/30">
                                <AlertCircle className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                                <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                                  {asset.unresolved_issues_count || 0} issue
                                  {(asset.unresolved_issues_count || 0) > 1 ? "s" : ""}
                                </span>
                              </div>
                            )}
                          </div>
                          <p className="text-muted-foreground mt-1 text-sm">
                            {ASSET_TYPE_MAP[asset.asset_type]?.label || asset.asset_type}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Status:</span>
                      <Badge className={getStatusColor(asset.status)}>{asset.status}</Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Year:</span>
                      <span className="text-foreground text-sm font-medium">{asset.acquisition_year}</span>
                    </div>

                    {asset.asset_model && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">Model:</span>
                        <span className="text-foreground text-sm">{asset.asset_model}</span>
                      </div>
                    )}

                    {asset.serial_number && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">Serial:</span>
                        <span className="text-foreground font-mono text-sm">{asset.serial_number}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Assigned To:</span>
                      {asset.status === "assigned" || asset.status === "retired" || asset.status === "maintenance" ? (
                        asset.assignment_type === "office" ? (
                          <div className="flex items-center gap-2">
                            <Building className="text-muted-foreground h-3 w-3" />
                            <span className="text-foreground text-sm font-medium">
                              {asset.office_location || "Office"}
                            </span>
                            {asset.status === "retired" && (
                              <span className="text-muted-foreground text-xs">(retired)</span>
                            )}
                            {asset.status === "maintenance" && (
                              <span className="text-muted-foreground text-xs">(maintenance)</span>
                            )}
                          </div>
                        ) : asset.current_assignment ? (
                          asset.current_assignment.department ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="text-muted-foreground h-3 w-3" />
                              <span className="text-foreground text-sm font-medium">
                                {asset.current_assignment.department}
                              </span>
                              {asset.status === "retired" && (
                                <span className="text-muted-foreground text-xs">(retired)</span>
                              )}
                              {asset.status === "maintenance" && (
                                <span className="text-muted-foreground text-xs">(maintenance)</span>
                              )}
                            </div>
                          ) : asset.current_assignment.user ? (
                            <div className="flex items-center gap-2">
                              <User className="text-muted-foreground h-3 w-3" />
                              <span className="text-foreground text-sm font-medium">
                                {formatName(asset.current_assignment.user.first_name)}{" "}
                                {formatName(asset.current_assignment.user.last_name)}
                              </span>
                              {asset.status === "retired" && (
                                <span className="text-muted-foreground text-xs">(retired)</span>
                              )}
                              {asset.status === "maintenance" && (
                                <span className="text-muted-foreground text-xs">(maintenance)</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Unassigned</span>
                          )
                        ) : (
                          <span className="text-muted-foreground text-sm">Unassigned</span>
                        )
                      ) : (
                        <span className="text-muted-foreground text-sm">Unassigned</span>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAssignDialog(asset)}
                        className="flex-1 gap-2"
                        disabled={asset.status === "retired"}
                        title={asset.status === "retired" ? "Cannot reassign retired asset" : ""}
                      >
                        <UserPlus className="h-3 w-3" />
                        {asset.status === "assigned" && asset.current_assignment ? "Reassign" : "Assign"}
                      </Button>
                      {userProfile?.role !== "lead" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenAssetDialog(asset)}
                          title="Edit Asset"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenIssuesDialog(asset)}
                        title={`Asset Issues (${asset.unresolved_issues_count || 0} unresolved)`}
                        className={`${(asset.unresolved_issues_count || 0) > 0 ? "border-orange-500 text-orange-600" : ""}`}
                      >
                        <AlertCircle className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadAssetHistory(asset)}
                        title="View assignment history"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      {userProfile?.role !== "lead" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAssetToDelete(asset)
                            setIsDeleteDialogOpen(true)
                          }}
                          title="Delete Asset"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
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
              <Package className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
              <h3 className="text-foreground mb-2 text-xl font-semibold">No Assets Found</h3>
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== "all" || departmentFilter !== "all" || userFilter !== "all"
                  ? "No assets match your filters"
                  : "Get started by adding your first asset"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* asset Dialog */}
      <Dialog open={isAssetDialogOpen} onOpenChange={setIsAssetDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedAsset ? "Edit Asset" : "Add New Asset"}</DialogTitle>
            <DialogDescription>
              {selectedAsset ? "Update the asset information below" : "Enter the details for the new asset"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="asset_type">Asset Type *</Label>
                <SearchableSelect
                  value={assetForm.asset_type}
                  onValueChange={(value) => setAssetForm({ ...assetForm, asset_type: value })}
                  placeholder="Select asset type"
                  searchPlaceholder="Search asset types..."
                  disabled={!!selectedAsset}
                  options={ASSET_TYPES.map((type) => ({
                    value: type.code,
                    label: type.label,
                  }))}
                />
                {selectedAsset && (
                  <p className="text-muted-foreground mt-1 text-xs">Asset type cannot be changed after creation</p>
                )}
              </div>
              <div>
                <Label htmlFor="acquisition_year">Acquisition Year *</Label>
                <Input
                  id="acquisition_year"
                  type="number"
                  min={2000}
                  max={currentYear + 1}
                  value={assetForm.acquisition_year}
                  onChange={(e) =>
                    setAssetForm({ ...assetForm, acquisition_year: parseInt(e.target.value) || currentYear })
                  }
                  disabled={!!selectedAsset}
                />
                {selectedAsset && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Year cannot be changed after creation (it's part of the unique code)
                  </p>
                )}
              </div>
            </div>

            {/* Unique Code Preview */}
            <div>
              <Label htmlFor="unique_code">Unique Code</Label>
              <Input
                id="unique_code"
                value={selectedAsset ? assetForm.unique_code : getUniqueCodePreview()}
                readOnly
                className="bg-muted font-mono text-sm"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                {selectedAsset
                  ? "Asset unique code (auto-generated at creation)"
                  : "Preview - Serial number (001, 002...) is unique across all years for this asset type"}
              </p>
            </div>

            {/* Model and Serial Number fields - optional */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="asset_model">Asset Model (Optional)</Label>
                <Input
                  id="asset_model"
                  value={assetForm.asset_model}
                  onChange={(e) => setAssetForm({ ...assetForm, asset_model: e.target.value })}
                  placeholder="e.g., Dell Latitude 5420"
                />
                <p className="text-muted-foreground mt-1 text-xs">Can be added later if not available now</p>
              </div>
              <div>
                <Label htmlFor="serial_number">Serial Number (Optional)</Label>
                <Input
                  id="serial_number"
                  value={assetForm.serial_number}
                  onChange={(e) => setAssetForm({ ...assetForm, serial_number: e.target.value })}
                  placeholder="e.g., ABC123XYZ"
                />
                <p className="text-muted-foreground mt-1 text-xs">Can be added later if not available now</p>
              </div>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <SearchableSelect
                value={assetForm.status}
                onValueChange={(value) => setAssetForm({ ...assetForm, status: value })}
                placeholder="Select status"
                searchPlaceholder="Search status..."
                options={[
                  { value: "available", label: "Available" },
                  { value: "assigned", label: "Assigned" },
                  { value: "maintenance", label: "Maintenance" },
                  { value: "retired", label: "Retired" },
                ]}
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={assetForm.notes}
                onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })}
                placeholder="Additional information about the asset..."
                rows={3}
              />
            </div>

            {/* Assignment section - only show when creating new asset and status is 'assigned' */}
            {!selectedAsset && assetForm.status === "assigned" && (
              <div className="space-y-4 border-t pt-4">
                <div className="mb-2 flex items-center gap-2">
                  <div className="bg-primary h-8 w-1 rounded" />
                  <h4 className="text-foreground font-semibold">Assignment Details</h4>
                </div>

                <div>
                  <Label htmlFor="assignment_type">Assignment Type *</Label>
                  <SearchableSelect
                    value={assetForm.assignment_type}
                    onValueChange={(value) =>
                      setAssetForm({
                        ...assetForm,
                        assignment_type: value as "individual" | "department" | "office",
                        assigned_to: "",
                        assignment_department: "",
                        office_location: "",
                      })
                    }
                    placeholder="Select assignment type"
                    searchPlaceholder="Search assignment types..."
                    options={[
                      { value: "individual", label: "Individual Assignment" },
                      { value: "department", label: "Department Assignment" },
                      { value: "office", label: "Office/Room Assignment" },
                    ]}
                  />
                </div>

                {assetForm.assignment_type === "individual" && (
                  <div>
                    <Label htmlFor="assigned_to">Assign To *</Label>
                    <SearchableSelect
                      value={assetForm.assigned_to}
                      onValueChange={(value) => setAssetForm({ ...assetForm, assigned_to: value })}
                      placeholder="Select staff member"
                      searchPlaceholder="Search staff..."
                      icon={<User className="h-4 w-4" />}
                      options={staff.map((member) => ({
                        value: member.id,
                        label: `${formatName(member.first_name)} ${formatName(member.last_name)} - ${member.department}`,
                        icon: <User className="h-3 w-3" />,
                      }))}
                    />
                  </div>
                )}

                {assetForm.assignment_type === "department" && (
                  <div>
                    <Label htmlFor="assignment_department">Department *</Label>
                    <SearchableSelect
                      value={assetForm.assignment_department}
                      onValueChange={(value) => setAssetForm({ ...assetForm, assignment_department: value })}
                      placeholder="Select department"
                      searchPlaceholder="Search departments..."
                      icon={<Building2 className="h-4 w-4" />}
                      options={departments.map((dept) => ({
                        value: dept,
                        label: dept,
                        icon: <Building2 className="h-3 w-3" />,
                      }))}
                    />
                  </div>
                )}

                {assetForm.assignment_type === "office" && (
                  <div>
                    <Label htmlFor="office_location">Office Location *</Label>
                    <SearchableSelect
                      value={assetForm.office_location}
                      onValueChange={(value) => setAssetForm({ ...assetForm, office_location: value })}
                      placeholder="Select office location"
                      searchPlaceholder="Search office locations..."
                      icon={<Building className="h-4 w-4" />}
                      options={OFFICE_LOCATIONS.map((location) => ({
                        value: location,
                        label: location,
                        icon: <Building className="h-3 w-3" />,
                      }))}
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="assignment_notes">Assignment Notes (Optional)</Label>
                  <Textarea
                    id="assignment_notes"
                    value={assetForm.assignment_notes}
                    onChange={(e) => setAssetForm({ ...assetForm, assignment_notes: e.target.value })}
                    placeholder="Notes about this assignment..."
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssetDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAsset}
              loading={isSaving}
              disabled={
                // For both create and edit: asset_type is required
                !assetForm.asset_type ||
                // For edit: check if anything changed
                (selectedAsset &&
                  assetForm.asset_type === originalAssetForm.asset_type &&
                  assetForm.acquisition_year === originalAssetForm.acquisition_year &&
                  assetForm.asset_model === originalAssetForm.asset_model &&
                  assetForm.serial_number === originalAssetForm.serial_number &&
                  assetForm.status === originalAssetForm.status &&
                  assetForm.notes === originalAssetForm.notes) ||
                // For create with "assigned" status: validate assignment fields (only when creating, not editing)
                (!selectedAsset &&
                  assetForm.status === "assigned" &&
                  assetForm.assignment_type === "individual" &&
                  !assetForm.assigned_to) ||
                (!selectedAsset &&
                  assetForm.status === "assigned" &&
                  assetForm.assignment_type === "department" &&
                  !assetForm.assignment_department) ||
                (!selectedAsset &&
                  assetForm.status === "assigned" &&
                  assetForm.assignment_type === "office" &&
                  !assetForm.office_location)
              }
            >
              {selectedAsset ? "Update Asset" : "Create Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentAssignment ? "Reassign" : "Assign"} Asset</DialogTitle>
            <DialogDescription>
              {currentAssignment ? "Reassign" : "Assign"} {selectedAsset?.unique_code} (
              {ASSET_TYPE_MAP[selectedAsset?.asset_type || ""]?.label})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!currentAssignment && selectedAsset?.status !== "assigned" && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200">New Assignment</p>
                <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                  When you assign this asset, its status will automatically be changed to "assigned"
                </p>
              </div>
            )}
            {currentAssignment && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                  Currently assigned to:{" "}
                  {selectedAsset?.assignment_type === "office" ? (
                    <span>{selectedAsset.office_location || "Office"}</span>
                  ) : currentAssignment.department ? (
                    <span>{currentAssignment.department} (Department)</span>
                  ) : currentAssignment.user ? (
                    <span>
                      {formatName((currentAssignment.user as any)?.first_name)}{" "}
                      {formatName((currentAssignment.user as any)?.last_name)}
                    </span>
                  ) : (
                    "Unknown"
                  )}
                </p>
                <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                  This assignment will be marked as handed over
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="assignment_type">Assignment Type *</Label>
              <SearchableSelect
                value={assignForm.assignment_type}
                onValueChange={(value) =>
                  setAssignForm({
                    ...assignForm,
                    assignment_type: value as "individual" | "department" | "office",
                    assigned_to: "",
                    department: "",
                    office_location: "",
                  })
                }
                placeholder="Select assignment type"
                searchPlaceholder="Search assignment types..."
                options={[
                  { value: "individual", label: "Individual Assignment", icon: <User className="h-3 w-3" /> },
                  { value: "department", label: "Department Assignment", icon: <Building2 className="h-3 w-3" /> },
                  { value: "office", label: "Office/Room Assignment", icon: <Building className="h-3 w-3" /> },
                ]}
              />
            </div>

            {assignForm.assignment_type === "individual" && (
              <div>
                <Label htmlFor="assigned_to">Assign To *</Label>
                <SearchableSelect
                  value={assignForm.assigned_to}
                  onValueChange={(value) => setAssignForm({ ...assignForm, assigned_to: value })}
                  placeholder="Select staff member"
                  searchPlaceholder="Search staff..."
                  icon={<User className="h-4 w-4" />}
                  options={staff.map((member) => ({
                    value: member.id,
                    label: `${formatName(member.first_name)} ${formatName(member.last_name)} - ${member.department}`,
                    icon: <User className="h-3 w-3" />,
                  }))}
                />
                <p className="text-muted-foreground mt-1 text-xs">{staff.length} staff members available</p>
              </div>
            )}

            {assignForm.assignment_type === "department" && (
              <div>
                <Label htmlFor="department">Department *</Label>
                <SearchableSelect
                  value={assignForm.department}
                  onValueChange={(value) => setAssignForm({ ...assignForm, department: value })}
                  placeholder="Select department"
                  searchPlaceholder="Search departments..."
                  icon={<Building2 className="h-4 w-4" />}
                  options={departments.map((dept) => ({
                    value: dept,
                    label: dept,
                    icon: <Building2 className="h-3 w-3" />,
                  }))}
                />
                <p className="text-muted-foreground mt-1 text-xs">{departments.length} departments available</p>
              </div>
            )}

            {assignForm.assignment_type === "office" && (
              <div>
                <Label htmlFor="office_location">Office Location *</Label>
                <SearchableSelect
                  value={assignForm.office_location}
                  onValueChange={(value) => setAssignForm({ ...assignForm, office_location: value })}
                  placeholder="Select office location"
                  searchPlaceholder="Search office locations..."
                  icon={<Building className="h-4 w-4" />}
                  options={OFFICE_LOCATIONS.map((location) => ({
                    value: location,
                    label: location,
                    icon: <Building className="h-3 w-3" />,
                  }))}
                />
                <p className="text-muted-foreground mt-1 text-xs">
                  {OFFICE_LOCATIONS.length} office locations available
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="assignment_notes">Assignment Notes</Label>
              <Textarea
                id="assignment_notes"
                value={assignForm.assignment_notes}
                onChange={(e) => setAssignForm({ ...assignForm, assignment_notes: e.target.value })}
                placeholder="Any notes about this assignment (e.g., faults, accessories included)..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)} disabled={isAssigning}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignAsset}
              loading={isAssigning}
              disabled={
                (assignForm.assignment_type === "individual" && !assignForm.assigned_to) ||
                (assignForm.assignment_type === "department" && !assignForm.department) ||
                (assignForm.assignment_type === "office" && !assignForm.office_location)
              }
            >
              {currentAssignment ? "Reassign Asset" : "Assign Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{assetToDelete?.unique_code}" (
              {ASSET_TYPE_MAP[assetToDelete?.asset_type || ""]?.label}). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAssetToDelete(null)} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <Button onClick={handleDeleteAsset} loading={isDeleting} className="bg-red-600 text-white hover:bg-red-700">
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* asset History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="text-primary h-5 w-5" />
              Asset Assignment History
            </DialogTitle>
            <DialogDescription>
              Complete history of assignments for {selectedAsset?.unique_code} (
              {ASSET_TYPE_MAP[selectedAsset?.asset_type || ""]?.label})
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {assetHistory.map((history, index) => (
              <div
                key={history.id}
                className={`rounded-lg border-2 p-4 ${
                  index === 0 ? "bg-primary/5 border-primary/30 shadow-sm" : "bg-muted/30 border-muted"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <Badge variant={index === 0 ? "default" : "outline"} className="text-xs">
                    {index === 0 ? "Current Assignment" : `Assignment ${assetHistory.length - index}`}
                  </Badge>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Calendar className="h-3 w-3" />
                    {formatDate(history.assigned_at)}
                  </div>
                </div>

                {(history.assigned_to_user || (history as any).department) && (
                  <div className="mb-2">
                    <p className="text-muted-foreground text-sm">
                      Assigned to:{" "}
                      {(history as any).department ? (
                        <span className="text-foreground flex items-center gap-1 font-semibold">
                          <Building2 className="h-3 w-3" />
                          {(history as any).department} (Department)
                        </span>
                      ) : history.assigned_to_user ? (
                        <span className="text-foreground font-semibold">
                          {formatName(history.assigned_to_user.first_name)}{" "}
                          {formatName(history.assigned_to_user.last_name)}
                        </span>
                      ) : (
                        <span className="text-foreground font-semibold">Office</span>
                      )}
                    </p>
                  </div>
                )}

                {history.assigned_by_user && (
                  <p className="text-muted-foreground mb-2 text-sm">
                    Assigned by:{" "}
                    <span className="text-foreground font-medium">
                      {formatName(history.assigned_by_user.first_name)} {formatName(history.assigned_by_user.last_name)}
                    </span>
                  </p>
                )}

                {history.assigned_from_user && (
                  <p className="text-muted-foreground mb-2 text-sm">
                    Transferred from:{" "}
                    <span className="text-foreground font-medium">
                      {formatName(history.assigned_from_user.first_name)}{" "}
                      {formatName(history.assigned_from_user.last_name)}
                    </span>
                  </p>
                )}

                {history.assignment_notes && (
                  <div className="bg-background/50 mt-3 rounded border p-3">
                    <p className="text-foreground mb-1 flex items-center gap-1 text-xs font-semibold">
                      <FileText className="h-3 w-3" />
                      Assignment Notes:
                    </p>
                    <p className="text-muted-foreground text-sm">{history.assignment_notes}</p>
                  </div>
                )}

                {history.handed_over_at && (
                  <div className="mt-3 border-t pt-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Handed Over
                      </Badge>
                      <span className="text-muted-foreground text-xs">{formatDate(history.handed_over_at)}</span>
                    </div>
                    {history.handover_notes && (
                      <div className="bg-background/50 rounded border p-3">
                        <p className="text-foreground mb-1 flex items-center gap-1 text-xs font-semibold">
                          <FileText className="h-3 w-3" />
                          Handover Notes:
                        </p>
                        <p className="text-muted-foreground text-sm">{history.handover_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Asset Issues Dialog */}
      <Dialog open={isIssuesDialogOpen} onOpenChange={setIsIssuesDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-orange-500" />
              <div>
                <DialogTitle>Asset Issues Tracker</DialogTitle>
                <DialogDescription>
                  {selectedAsset?.unique_code} - Track and manage asset issues, faults, or maintenance needs
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted/50 flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Package className="text-muted-foreground h-4 w-4" />
                <span className="text-foreground text-sm font-medium">{selectedAsset?.unique_code}</span>
                <Badge variant="outline" className="text-xs">
                  {ASSET_TYPE_MAP[selectedAsset?.asset_type || ""]?.label || selectedAsset?.asset_type}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {assetIssues.filter((i) => !i.resolved).length} unresolved
                </span>
                <span className="text-muted-foreground text-xs">•</span>
                <span className="text-muted-foreground text-xs">{assetIssues.length} total</span>
              </div>
            </div>

            {/* Add new issue */}
            <div className="space-y-2">
              <Label>Add New Issue</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Describe issue (e.g., RAM not working, screen cracked)..."
                  value={newIssueDescription}
                  onChange={(e) => setNewIssueDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleAddIssue()
                    }
                  }}
                />
                <Button
                  onClick={handleAddIssue}
                  loading={isAddingIssue}
                  disabled={!newIssueDescription.trim()}
                  size="sm"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>

            {/* Issues list */}
            <div className="space-y-2">
              <Label>Issues ({assetIssues.length})</Label>
              <div className="max-h-[400px] space-y-2 overflow-y-auto rounded-lg border p-3">
                {assetIssues.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="text-muted-foreground mb-2 h-12 w-12" />
                    <p className="text-muted-foreground text-sm font-medium">No issues tracked</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Add an issue above if there's a problem with this asset
                    </p>
                  </div>
                ) : (
                  assetIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                        issue.resolved
                          ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20"
                          : "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20"
                      }`}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleIssue(issue)}
                        className="mt-0.5 h-6 w-6 p-0 hover:bg-transparent"
                        title={issue.resolved ? "Mark as unresolved" : "Mark as resolved"}
                      >
                        {issue.resolved ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-orange-500" />
                        )}
                      </Button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm ${
                            issue.resolved ? "text-muted-foreground line-through" : "text-foreground font-medium"
                          }`}
                        >
                          {issue.description}
                        </p>
                        <div className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(issue.created_at).toLocaleDateString()}
                          </div>
                          {issue.resolved && issue.resolved_at && (
                            <>
                              <span>•</span>
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Resolved {new Date(issue.resolved_at).toLocaleDateString()}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteIssue(issue.id)}
                        className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                        title="Delete issue"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg border p-3">
              <p className="text-muted-foreground flex items-start gap-2 text-xs">
                <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                <span>
                  Track hardware issues, faults, or maintenance needs. Click the checkbox to mark issues as resolved
                  when fixed.
                </span>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsIssuesDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
