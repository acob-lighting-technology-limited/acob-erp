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
  Eye,
  History,
  Calendar,
  FileText,
} from "lucide-react"

interface asset {
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
  current_assignment?: {
    assigned_to: string
    user: {
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
  assigned_to: string
  assigned_at: string
  is_current: boolean
  user: {
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
  const [assets, setAssets] = useState<asset[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")

  // Dialog states
  const [isAssetDialogOpen, setIsAssetDialogOpen] = useState(false)
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<asset | null>(null)
  const [assetToDelete, setAssetToDelete] = useState<asset | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)
  const [assetHistory, setAssetHistory] = useState<AssignmentHistory[]>([])

  // Form states
  const [assetForm, setAssetForm] = useState({
    asset_name: "",
    asset_type: "",
    asset_model: "",
    serial_number: "",
    purchase_date: "",
    purchase_cost: "",
    status: "available",
    notes: "",
  })

  const [assignForm, setAssignForm] = useState({
    assigned_to: "",
    assignment_notes: "",
  })

  const [currentAssignment, setCurrentAssignment] = useState<AssetAssignment | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Fetch assets first
      const { data: AssetsData, error: AssetsError } = await supabase
        .from("assets")
        .select("*")
        .order("created_at", { ascending: false })

      if (AssetsError) throw AssetsError

      // Fetch current assignments for all assets
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("Asset_assignments")
        .select("Asset_id, assigned_to")
        .eq("is_current", true)

      if (assignmentsError) throw assignmentsError
      
      // Fetch user details for assignments
      const assignmentsWithUsers = await Promise.all((assignmentsData || []).map(async (assignment: any) => {
        if (assignment.assigned_to) {
          const { data: userProfile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", assignment.assigned_to)
            .single()
          
          return {
            ...assignment,
            user: userProfile
          }
        }
        return assignment
      }))

      // Fetch staff
      const { data: staffData, error: staffError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, company_email, department")
        .order("last_name", { ascending: true })

      if (staffError) throw staffError

      // Combine assets with their current assignments
      const AssetsWithAssignments = (AssetsData || []).map((asset) => {
        const assignment = (assignmentsWithUsers || []).find((a: any) => a.Asset_id === asset.id)
        return {
          ...asset,
          current_assignment: assignment ? {
            assigned_to: assignment.assigned_to,
            user: assignment.user
          } : undefined
        }
      })

      setAssets(AssetsWithAssignments)
      setStaff(staffData || [])
    } catch (error: any) {
      console.error("Error loading data:", error)
      const errorMessage = error?.message || error?.toString() || "Failed to load data"
      toast.error(`Failed to load data: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const loadCurrentAssignment = async (AssetId: string) => {
    try {
      const { data, error } = await supabase
        .from("Asset_assignments")
        .select("id, assigned_to, assigned_at, is_current")
        .eq("Asset_id", AssetId)
        .eq("is_current", true)
        .single()

      if (error && error.code !== "PGRST116") throw error
      
      if (data && data.assigned_to) {
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
      } else {
        setCurrentAssignment(null)
      }
    } catch (error) {
      console.error("Error loading assignment:", error)
      setCurrentAssignment(null)
    }
  }

  const loadAssetHistory = async (asset: asset) => {
    try {
      const { data, error } = await supabase
        .from("Asset_assignments")
        .select("id, assigned_at, handed_over_at, assignment_notes, handover_notes, assigned_from, assigned_by, assigned_to")
        .eq("Asset_id", asset.id)
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

  const handleOpenAssetDialog = (asset?: asset) => {
    if (asset) {
      setSelectedAsset(asset)
      setAssetForm({
        asset_name: asset.asset_name,
        asset_type: asset.asset_type,
        asset_model: asset.asset_model || "",
        serial_number: asset.serial_number || "",
        status: asset.status,
        notes: asset.notes || "",
      })
    } else {
      setSelectedAsset(null)
      setAssetForm({
        asset_name: "",
        asset_type: "",
        asset_model: "",
        serial_number: "",
        status: "available",
        notes: "",
      })
    }
    setIsAssetDialogOpen(true)
  }

  const handleOpenAssignDialog = async (asset: asset) => {
    setSelectedAsset(asset)
    await loadCurrentAssignment(asset.id)
    setAssignForm({
      assigned_to: "",
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
        const { error } = await supabase
          .from("assets")
          .update(assetForm)
          .eq("id", selectedAsset.id)

        if (error) throw error

        // Log audit
        await supabase.rpc("log_audit", {
          p_action: "update",
          p_entity_type: "asset",
          p_entity_id: selectedAsset.id,
          p_new_values: assetForm,
        })

        toast.success("asset updated successfully")
      } else {
        // Create new asset
        const { error } = await supabase.from("assets").insert({
          ...assetForm,
          created_by: user.id,
        })

        if (error) throw error

        // Log audit
        await supabase.rpc("log_audit", {
          p_action: "create",
          p_entity_type: "asset",
          p_entity_id: null,
          p_new_values: assetForm,
        })

        toast.success("asset created successfully")
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
      if (!selectedAsset || !assignForm.assigned_to) return

      setIsAssigning(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Use transactional RPC to handle assignment safely
      const { data: previousAssignedTo, error: rpcError } = await supabase.rpc("assign_Asset", {
        p_Asset_id: selectedAsset.id,
        p_assigned_to: assignForm.assigned_to,
        p_assigned_by: user.id,
        p_assignment_notes: assignForm.assignment_notes || null,
      })

      if (rpcError) {
        console.error("assign_Asset RPC error:", rpcError)
        throw rpcError
      }

      // Log audit
      await supabase.rpc("log_audit", {
        p_action: currentAssignment ? "reassign" : "assign",
        p_entity_type: "asset",
        p_entity_id: selectedAsset.id,
        p_old_values: previousAssignedTo ? { assigned_to: previousAssignedTo } : null,
        p_new_values: {
          assigned_to: assignForm.assigned_to,
          notes: assignForm.assignment_notes,
        },
      })

      toast.success(`asset ${currentAssignment ? "reassigned" : "assigned"} successfully`)
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
      if (!AssetToDelete) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check if asset has active assignments
      const { data: assignments } = await supabase
        .from("Asset_assignments")
        .select("*")
        .eq("Asset_id", AssetToDelete.id)
        .eq("is_current", true)

      if (assignments && assignments.length > 0) {
        toast.error("Cannot delete asset with active assignments")
        return
      }

      const { error } = await supabase
        .from("assets")
        .delete()
        .eq("id", AssetToDelete.id)

      if (error) throw error

      // Log audit
      await supabase.rpc("log_audit", {
        p_action: "delete",
        p_entity_type: "asset",
        p_entity_id: AssetToDelete.id,
        p_old_values: AssetToDelete,
      })

      toast.success("asset deleted successfully")
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
      asset.serial_number?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || asset.status === statusFilter

    return matchesSearch && matchesStatus
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
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="h-24 bg-muted rounded"></div>
              <div className="h-24 bg-muted rounded"></div>
              <div className="h-24 bg-muted rounded"></div>
              <div className="h-24 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              asset Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage asset inventory and assignments
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-lg p-1">
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
            <Button onClick={() => handleOpenAssetDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Add asset
            </Button>
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
                  placeholder="Search assets..."
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
            </div>
          </CardContent>
        </Card>

        {/* assets List */}
        {filteredAssets.length > 0 ? (
          viewMode === "list" ? (
            <Card className="border-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>asset Name</TableHead>
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
                                                      <div className="flex items-center gap-2 text-sm">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-foreground">
                                {formatName(asset.current_assignment.user.first_name)} {formatName(asset.current_assignment.user.last_name)}
                              </span>
                            </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenAssignDialog(asset)}
                            title={asset.current_assignment ? "Reassign asset" : "Assign asset"}
                          >
                            <UserPlus className="h-3 w-3 mr-1" />
                            {asset.current_assignment ? "Reassign" : "Assign"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenAssetDialog(asset)}
                            title="Edit asset"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadAssetHistory(asset)}
                            title="View assignment history"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAssetToDelete(asset)
                              setIsDeleteDialogOpen(true)
                            }}
                            title="Delete asset"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm text-foreground font-medium">
                            {formatName(asset.current_assignment.user.first_name)} {formatName(asset.current_assignment.user.last_name)}
                          </span>
                        </div>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAssetDialog(asset)}
                        title="Edit asset"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadAssetHistory(asset)}
                        title="View assignment history"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAssetToDelete(asset)
                          setIsDeleteDialogOpen(true)
                        }}
                        title="Delete asset"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
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
              <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No assets Found</h3>
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== "all"
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
              {selectedAsset ? "Edit asset" : "Add New asset"}
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
                <Label htmlFor="asset_name">asset Name *</Label>
                <Input
                  id="asset_name"
                  value={assetForm.asset_name}
                  onChange={(e) =>
                    setAssetForm({ ...assetForm, asset_name: e.target.value })
                  }
                  placeholder="e.g., MacBook Pro"
                />
              </div>
              <div>
                <Label htmlFor="asset_type">asset Type *</Label>
                <Input
                  id="asset_type"
                  value={assetForm.asset_type}
                  onChange={(e) =>
                    setAssetForm({ ...assetForm, asset_type: e.target.value })
                  }
                  placeholder="e.g., Package"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="asset_model">Model</Label>
                <Input
                  id="asset_model"
                  value={assetForm.asset_model}
                  onChange={(e) =>
                    setAssetForm({ ...assetForm, asset_model: e.target.value })
                  }
                  placeholder="e.g., 2023 M2"
                />
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
              {selectedAsset ? "Update asset" : "Create asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentAssignment ? "Reassign" : "Assign"} asset</DialogTitle>
            <DialogDescription>
              {currentAssignment ? "Reassign" : "Assign"} {selectedAsset?.asset_name} to a staff member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {currentAssignment && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                    Currently assigned to: {formatName((currentAssignment.user as any)?.first_name)} {formatName((currentAssignment.user as any)?.last_name)}
                  </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  This assignment will be marked as handed over
                </p>
              </div>
            )}

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
            <Button onClick={handleAssignAsset} disabled={!assignForm.assigned_to || isAssigning}>
              {isAssigning ? "Processing..." : currentAssignment ? "Reassign asset" : "Assign asset"}
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
              This will permanently delete "{AssetToDelete?.asset_name}". This action cannot be
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
              asset Assignment History
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

                                  {history.assigned_to_user && (
                    <div className="mb-2">
                      <p className="text-sm text-muted-foreground">
                        Assigned to:{" "}
                        <span className="text-foreground font-semibold">
                          {formatName(history.assigned_to_user.first_name)} {formatName(history.assigned_to_user.last_name)}
                        </span>
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

