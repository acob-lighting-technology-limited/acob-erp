"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
} from "lucide-react"

interface Asset {
  id: string
  asset_name: string
  asset_type: string
  asset_model?: string
  serial_number?: string
  purchase_date?: string
  purchase_cost?: number
  status: string
  notes?: string
  created_at: string
  created_by: string
  assignment_type?: "individual" | "department"
  department?: string
  current_assignment?: {
    assigned_to?: string
    department?: string
    user?: {
      first_name: string
      last_name: string
    }
  }
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

export default function AdminAssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [userProfile, setUserProfile] = useState<{ role?: string; lead_departments?: string[] } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [userFilter, setUserFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")

  // Dialog states
  const [isAssetDialogOpen, setIsAssetDialogOpen] = useState(false)
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)
  const [assetHistory, setAssetHistory] = useState<AssignmentHistory[]>([])

  // Form states
  const [assetForm, setAssetForm] = useState({
    asset_name: "",
    asset_type: "",
    serial_number: "",
    status: "available",
    notes: "",
  })

  const [assignForm, setAssignForm] = useState({
    assignment_type: "individual" as "individual" | "department",
    assigned_to: "",
    department: "",
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
      const { data: { user } } = await supabase.auth.getUser()
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
        .select("asset_id, assigned_to, department")
        .eq("is_current", true)

      if (assignmentsError) throw assignmentsError
      
      // Fetch user details for assignments
      const assignmentsWithUsers = await Promise.all((assignmentsData || []).map(async (assignment: any) => {
        if (assignment.assigned_to) {
          const { data: userProfile } = await supabase
            .from("profiles")
            .select("first_name, last_name, department")
            .eq("id", assignment.assigned_to)
            .single()
          
          return {
            ...assignment,
            user: userProfile
          }
        }
        return assignment
      }))

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

      // Combine assets with their current assignments
      const assetsWithAssignments = filteredAssets.map((asset) => {
        const assignment = (assignmentsWithUsers || []).find((a: any) => a.asset_id === asset.id)
        return {
          ...asset,
          current_assignment: assignment ? {
            assigned_to: assignment.assigned_to,
            department: assignment.department,
            user: assignment.user || null
          } : undefined
        }
      })

      // Get unique departments - for leads, only show their lead departments
      let uniqueDepartments: string[] = []
      if (userProfile?.role === "lead" && userProfile.lead_departments && userProfile.lead_departments.length > 0) {
        uniqueDepartments = userProfile.lead_departments.sort()
      } else {
        uniqueDepartments = Array.from(
          new Set(staffData?.map((s: any) => s.department).filter(Boolean))
        ) as string[]
        uniqueDepartments.sort()
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
       // Get asset to check assignment type
       const { data: assetData } = await supabase
         .from("assets")
         .select("assignment_type, department")
         .eq("id", assetId)
         .single()

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
            user: userProfile
          } as any)
        } else if (data.department) {
          setCurrentAssignment({
            ...data,
            department: data.department
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
         .select("id, assigned_at, handed_over_at, assignment_notes, handover_notes, assigned_from, assigned_by, assigned_to, department")
         .eq("asset_id", asset.id)
         .order("assigned_at", { ascending: false })

      if (error) throw error
      
      // Fetch user details separately for each assignment
      const historyWithUsers = await Promise.all((data || []).map(async (assignment: any) => {
        const [assignedFromResult, assignedByResult, assignedToResult] = await Promise.all([
          assignment.assigned_from ? supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", assignment.assigned_from)
            .single() : Promise.resolve({ data: null }),
          assignment.assigned_by ? supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", assignment.assigned_by)
            .single() : Promise.resolve({ data: null }),
          assignment.assigned_to ? supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", assignment.assigned_to)
            .single() : Promise.resolve({ data: null })
        ])
        
        return {
          ...assignment,
          assigned_from_user: assignedFromResult.data,
          assigned_by_user: assignedByResult.data,
          assigned_to_user: assignedToResult.data
        }
      }))
      
      setAssetHistory(historyWithUsers as any || [])
      setSelectedAsset(asset)
      setIsHistoryOpen(true)
    } catch (error: any) {
      console.error("Error loading asset history:", error)
      const errorMessage = error?.message || error?.toString() || "Failed to load asset history"
      toast.error(`Failed to load asset history: ${errorMessage}`)
    }
  }

     const handleOpenAssetDialog = (asset?: Asset) => {
     if (asset) {
       setSelectedAsset(asset)
       setAssetForm({
         asset_name: asset.asset_name,
         asset_type: asset.asset_type,
         serial_number: asset.serial_number || "",
         status: asset.status,
         notes: asset.notes || "",
       })
    } else {
      setSelectedAsset(null)
             setAssetForm({
         asset_name: "",
         asset_type: "",
         serial_number: "",
         status: "available",
         notes: "",
       })
    }
    setIsAssetDialogOpen(true)
  }

     const handleOpenAssignDialog = async (asset: Asset) => {
    setSelectedAsset(asset)
    await loadCurrentAssignment(asset.id)
    setAssignForm({
      assignment_type: asset.assignment_type || "individual",
      assigned_to: asset.current_assignment?.assigned_to || "",
      department: asset.current_assignment?.department || asset.department || "",
      assignment_notes: "",
    })
    setIsAssignDialogOpen(true)
  }

  const handleSaveAsset = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (selectedAsset) {
                 // Update existing asset
         const updateData = {
           ...assetForm,
         }
         const { error } = await supabase
           .from("assets")
           .update(updateData)
           .eq("id", selectedAsset.id)

         if (error) throw error

         // Log audit
         await supabase.rpc("log_audit", {
           p_action: "update",
           p_entity_type: "asset",
           p_entity_id: selectedAsset.id,
           p_old_values: selectedAsset,
           p_new_values: updateData,
         })

         toast.success("Asset updated successfully")
      } else {
                 // Create new asset
         const insertData = {
           ...assetForm,
           created_by: user.id,
         }
         const { data: newAsset, error } = await supabase.from("assets").insert(insertData).select().single()

         if (error) throw error

         // Log audit
         await supabase.rpc("log_audit", {
           p_action: "create",
           p_entity_type: "asset",
           p_entity_id: newAsset?.id || null,
           p_new_values: insertData,
         })

         toast.success("Asset created successfully")
      }

      setIsAssetDialogOpen(false)
      loadData()
    } catch (error) {
      console.error("Error saving asset:", error)
      toast.error("Failed to save asset")
    }
  }

  const handleAssignAsset = async () => {
    if (isAssigning) return // Prevent duplicate submissions
    
    try {
      if (!selectedAsset) return
      
      // Validate based on assignment type
      if (assignForm.assignment_type === "individual" && !assignForm.assigned_to) {
        toast.error("Please select a user")
        return
      }
      if (assignForm.assignment_type === "department" && !assignForm.department) {
        toast.error("Please select a department")
        return
      }

      setIsAssigning(true)

      const { data: { user } } = await supabase.auth.getUser()
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
      } else {
        assignmentData.department = assignForm.department
      }

      const { error: assignError } = await supabase
        .from("asset_assignments")
        .insert(assignmentData)

      if (assignError) throw assignError

      // Update asset with assignment type and department if department assignment
      const assetUpdate: any = {
        assignment_type: assignForm.assignment_type,
        status: "assigned",
      }
      
      if (assignForm.assignment_type === "department") {
        assetUpdate.department = assignForm.department
      } else {
        assetUpdate.department = null
      }

      const { error: assetError } = await supabase
        .from("assets")
        .update(assetUpdate)
        .eq("id", selectedAsset.id)

      if (assetError) throw assetError

      // Log audit
      await supabase.rpc("log_audit", {
        p_action: currentAssignment ? "reassign" : "assign",
        p_entity_type: "asset",
        p_entity_id: selectedAsset.id,
        p_old_values: previousAssignedTo ? { assigned_to: previousAssignedTo } : previousDepartment ? { department: previousDepartment } : null,
        p_new_values: assignForm.assignment_type === "individual" 
          ? { assigned_to: assignForm.assigned_to, notes: assignForm.assignment_notes }
          : { department: assignForm.department, notes: assignForm.assignment_notes },
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
    try {
      if (!assetToDelete) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

             // Check if asset has active assignments
       const { data: assignments } = await supabase
         .from("asset_assignments")
         .select("*")
         .eq("asset_id", assetToDelete.id)
         .eq("is_current", true)

      if (assignments && assignments.length > 0) {
        toast.error("Cannot delete asset with active assignments")
        return
      }

             const { error } = await supabase
         .from("assets")
         .delete()
         .eq("id", assetToDelete.id)

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
    } catch (error) {
      console.error("Error deleting asset:", error)
      toast.error("Failed to delete asset")
    }
  }

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.asset_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.asset_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.asset_model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.serial_number?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || asset.status === statusFilter

    // Filter by department - for leads, always filter by their departments
    let matchesDepartment = true
    if (userProfile?.role === "lead") {
      // Leads: assets are already filtered, but ensure they match lead's departments
      if (userProfile.lead_departments && userProfile.lead_departments.length > 0) {
        const assignmentDept = asset.current_assignment?.department
        const assignedUserDept = asset.current_assignment?.assigned_to 
          ? staff.find((s) => s.id === asset.current_assignment?.assigned_to)?.department
          : null
        
        matchesDepartment = assignmentDept ? userProfile.lead_departments.includes(assignmentDept) :
          assignedUserDept ? userProfile.lead_departments.includes(assignedUserDept) : false
      }
    } else {
      // Admins: use department filter
      matchesDepartment = departmentFilter === "all" || 
        asset.current_assignment?.department === departmentFilter
    }

    // Filter by user
    const matchesUser = userFilter === "all" || 
      asset.current_assignment?.assigned_to === userFilter

    return matchesSearch && matchesStatus && matchesDepartment && matchesUser
  })

  const stats = {
    total: assets.length,
    available: assets.filter((d) => d.status === "available").length,
    assigned: assets.filter((d) => d.status === "assigned").length,
    maintenance: assets.filter((d) => d.status === "maintenance").length,
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="animate-pulse space-y-6">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-8 bg-muted rounded w-64"></div>
                <div className="h-5 bg-muted rounded w-96"></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-10 bg-muted rounded w-32"></div>
                <div className="h-10 bg-muted rounded w-32"></div>
                <div className="h-10 bg-muted rounded w-32"></div>
              </div>
            </div>

            {/* Stats Skeleton */}
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="border-2">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="h-4 bg-muted rounded w-24"></div>
                        <div className="h-8 bg-muted rounded w-16"></div>
                      </div>
                      <div className="h-12 w-12 bg-muted rounded-lg"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Filters Skeleton */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="h-10 bg-muted rounded flex-1"></div>
                  <div className="h-10 bg-muted rounded w-48"></div>
                  <div className="h-10 bg-muted rounded w-48"></div>
                  <div className="h-10 bg-muted rounded w-32"></div>
                </div>
              </CardContent>
            </Card>

            {/* Table/List Skeleton */}
            <Card className="border-2">
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded"></div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2 sm:gap-3">
              <Package className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              Asset Management
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Manage asset inventory and assignments
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center border rounded-lg p-1">
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
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total assets</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.total}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Available</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.available}</p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Package className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Assigned</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.assigned}</p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Package className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Maintenance</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.maintenance}</p>
                </div>
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <Package className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-2">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search assets by name, type, model, or serial number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
              {/* Department filter - hidden for leads */}
              {userProfile?.role !== "lead" && (
                <SearchableSelect
                  value={departmentFilter}
                  onValueChange={setDepartmentFilter}
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
                value={userFilter}
                onValueChange={setUserFilter}
                placeholder={
                  userProfile?.role === "lead" && departments.length > 0
                    ? `All ${departments.length === 1 ? departments[0] : "Department"} Users`
                    : "All Users"
                }
                searchPlaceholder="Search users..."
                icon={<User className="h-4 w-4" />}
                className="w-full md:w-48"
                options={[
                  { 
                    value: "all", 
                    label: userProfile?.role === "lead" && departments.length > 0
                      ? `All ${departments.length === 1 ? departments[0] : "Department"} Users`
                      : "All Users"
                  },
                  ...staff.map((member) => ({
                    value: member.id,
                    label: `${formatName(member.first_name)} ${formatName(member.last_name)} - ${member.department}`,
                    icon: <User className="h-3 w-3" />,
                  })),
                ]}
              />
            </div>
          </CardContent>
        </Card>

        {/* assets List */}
        {filteredAssets.length > 0 ? (
          viewMode === "list" ? (
            <Card className="border-2">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Asset Name</TableHead>
                      <TableHead>Type / Model</TableHead>
                      <TableHead>Serial Number</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {filteredAssets.map((asset, index) => (
                    <TableRow key={asset.id}>
                      <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Package className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium text-foreground">{asset.asset_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="text-foreground">{asset.asset_type}</div>
                          {asset.asset_model && (
                            <div className="text-xs text-muted-foreground">{asset.asset_model}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {asset.serial_number ? (
                          <span className="text-sm font-mono text-foreground">{asset.serial_number}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(asset.status)}>{asset.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {asset.current_assignment ? (
                          asset.current_assignment.department ? (
                            <div className="flex items-center gap-2 text-sm">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              <span className="text-foreground">{asset.current_assignment.department}</span>
                            </div>
                          ) : asset.current_assignment.user ? (
                            <div className="flex items-center gap-2 text-sm">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-foreground">
                                {asset.current_assignment?.user 
                                  ? `${formatName(asset.current_assignment.user.first_name)} ${formatName(asset.current_assignment.user.last_name)}`
                                  : asset.current_assignment?.department || "Unassigned"}
                              </span>
                            </div>
                          ) : null
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 sm:gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenAssignDialog(asset)}
                            title={asset.current_assignment ? "Reassign Asset" : "Assign Asset"}
                            className="h-8 w-8 sm:h-auto sm:w-auto p-0 sm:p-2"
                          >
                            <UserPlus className="h-3 w-3 sm:mr-1" />
                            <span className="hidden sm:inline">{asset.current_assignment ? "Reassign" : "Assign"}</span>
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
              {filteredAssets.map((asset) => (
                <Card key={asset.id} className="border-2 hover:shadow-lg transition-shadow">
                  <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-background">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{asset.asset_name}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {asset.asset_type}
                            {asset.asset_model && ` • ${asset.asset_model}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <Badge className={getStatusColor(asset.status)}>{asset.status}</Badge>
                    </div>

                    {asset.serial_number && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Serial:</span>
                        <span className="text-sm font-mono text-foreground">
                          {asset.serial_number}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Assigned To:</span>
                      {asset.current_assignment ? (
                        asset.current_assignment.department ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm text-foreground font-medium">
                              {asset.current_assignment.department}
                            </span>
                          </div>
                        ) : asset.current_assignment?.user ? (
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm text-foreground font-medium">
                              {formatName(asset.current_assignment.user.first_name)} {formatName(asset.current_assignment.user.last_name)}
                            </span>
                          </div>
                        ) : null
                      ) : (
                        <span className="text-sm text-muted-foreground">Unassigned</span>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAssignDialog(asset)}
                        className="flex-1 gap-2"
                      >
                        <UserPlus className="h-3 w-3" />
                        {asset.current_assignment ? "Reassign" : "Assign"}
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
              <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No Assets Found</h3>
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
        <DialogContent className="max-w-2xl">
                     <DialogHeader>
             <DialogTitle>
               {selectedAsset ? "Edit Asset" : "Add New Asset"}
             </DialogTitle>
             <DialogDescription>
               {selectedAsset
                 ? "Update the asset information below"
                 : "Enter the details for the new asset"}
             </DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-4">
             <div className="grid gap-4 md:grid-cols-2">
               <div>
                 <Label htmlFor="asset_name">Asset Name *</Label>
                 <Input
                   id="asset_name"
                   value={assetForm.asset_name}
                   onChange={(e) =>
                     setAssetForm({ ...assetForm, asset_name: e.target.value })
                   }
                   placeholder="e.g., Office Desk"
                 />
               </div>
               <div>
                 <Label htmlFor="asset_type">Asset Type *</Label>
                 <Select
                   value={assetForm.asset_type}
                   onValueChange={(value) =>
                     setAssetForm({ ...assetForm, asset_type: value })
                   }
                 >
                   <SelectTrigger id="asset_type">
                     <SelectValue placeholder="Select asset type" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="furniture">Furniture</SelectItem>
                     <SelectItem value="equipment">Equipment</SelectItem>
                     <SelectItem value="vehicle">Vehicle</SelectItem>
                     <SelectItem value="other">Other</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
             </div>

            <div>
              <Label htmlFor="serial_number">Serial Number</Label>
              <Input
                id="serial_number"
                value={assetForm.serial_number}
                onChange={(e) =>
                  setAssetForm({ ...assetForm, serial_number: e.target.value })
                }
                placeholder="e.g., ABC123XYZ"
              />
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={assetForm.status}
                onValueChange={(value) => setAssetForm({ ...assetForm, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssetDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAsset}
              disabled={!assetForm.asset_name || !assetForm.asset_type}
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
               {currentAssignment ? "Reassign" : "Assign"} {selectedAsset?.asset_name} to a staff member
             </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {currentAssignment && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                  Currently assigned to:{" "}
                  {currentAssignment.department ? (
                    <span>{currentAssignment.department} (Department)</span>
                  ) : currentAssignment.user ? (
                    <span>
                      {formatName((currentAssignment.user as any)?.first_name)} {formatName((currentAssignment.user as any)?.last_name)}
                    </span>
                  ) : (
                    "Unknown"
                  )}
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  This assignment will be marked as handed over
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="assignment_type">Assignment Type *</Label>
              <Select
                value={assignForm.assignment_type}
                onValueChange={(value: "individual" | "department") =>
                  setAssignForm({ ...assignForm, assignment_type: value, assigned_to: "", department: "" })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>Individual Assignment</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="department">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span>Department Assignment</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {assignForm.assignment_type === "individual" ? (
              <div>
                <Label htmlFor="assigned_to">Assign To *</Label>
                <Select
                  value={assignForm.assigned_to}
                  onValueChange={(value) =>
                    setAssignForm({ ...assignForm, assigned_to: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {staff.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {formatName(member.first_name)} {formatName(member.last_name)} - {member.department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {staff.length} staff members available
                </p>
              </div>
            ) : (
              <div>
                <Label htmlFor="department">Department *</Label>
                <Select
                  value={assignForm.department}
                  onValueChange={(value) =>
                    setAssignForm({ ...assignForm, department: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {departments.length} departments available
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="assignment_notes">Assignment Notes</Label>
              <Textarea
                id="assignment_notes"
                value={assignForm.assignment_notes}
                onChange={(e) =>
                  setAssignForm({ ...assignForm, assignment_notes: e.target.value })
                }
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
              disabled={
                isAssigning ||
                (assignForm.assignment_type === "individual" && !assignForm.assigned_to) ||
                (assignForm.assignment_type === "department" && !assignForm.department)
              }
            >
              {isAssigning ? "Processing..." : currentAssignment ? "Reassign Asset" : "Assign Asset"}
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
               This will permanently delete "{assetToDelete?.asset_name}". This action cannot be
               undone.
             </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAssetToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAsset}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* asset History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
                         <DialogTitle className="flex items-center gap-2">
               <History className="h-5 w-5 text-primary" />
               Asset Assignment History
             </DialogTitle>
             <DialogDescription>
               Complete history of assignments for {selectedAsset?.asset_name}
             </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {assetHistory.map((history, index) => (
              <div
                key={history.id}
                className={`p-4 rounded-lg border-2 ${
                  index === 0 
                    ? "bg-primary/5 border-primary/30 shadow-sm" 
                    : "bg-muted/30 border-muted"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <Badge variant={index === 0 ? "default" : "outline"} className="text-xs">
                    {index === 0 ? "Current Assignment" : `Assignment ${assetHistory.length - index}`}
                  </Badge>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDate(history.assigned_at)}
                  </div>
                </div>

                                  {(history.assigned_to_user || (history as any).department) && (
                    <div className="mb-2">
                      <p className="text-sm text-muted-foreground">
                        Assigned to:{" "}
                        {(history as any).department ? (
                          <span className="text-foreground font-semibold flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {(history as any).department} (Department)
                          </span>
                        ) : history.assigned_to_user ? (
                          <span className="text-foreground font-semibold">
                            {formatName(history.assigned_to_user.first_name)} {formatName(history.assigned_to_user.last_name)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  )}

                                  {history.assigned_by_user && (
                    <p className="text-sm text-muted-foreground mb-2">
                      Assigned by:{" "}
                      <span className="text-foreground font-medium">
                        {formatName(history.assigned_by_user.first_name)} {formatName(history.assigned_by_user.last_name)}
                      </span>
                    </p>
                  )}

                                  {history.assigned_from_user && (
                    <p className="text-sm text-muted-foreground mb-2">
                      Transferred from:{" "}
                      <span className="text-foreground font-medium">
                        {formatName(history.assigned_from_user.first_name)} {formatName(history.assigned_from_user.last_name)}
                      </span>
                    </p>
                  )}

                {history.assignment_notes && (
                  <div className="mt-3 p-3 bg-background/50 rounded border">
                    <p className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Assignment Notes:
                    </p>
                    <p className="text-sm text-muted-foreground">{history.assignment_notes}</p>
                  </div>
                )}

                {history.handed_over_at && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">Handed Over</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(history.handed_over_at)}
                      </span>
                    </div>
                    {history.handover_notes && (
                      <div className="p-3 bg-background/50 rounded border">
                        <p className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Handover Notes:
                        </p>
                        <p className="text-sm text-muted-foreground">{history.handover_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

