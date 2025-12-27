"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatName } from "@/lib/utils"
import { Package, Calendar, User, FileText, Building2, LayoutGrid, List, Hash } from "lucide-react"
import { ASSET_TYPE_MAP } from "@/lib/asset-types"

interface Asset {
  id: string
  unique_code: string
  asset_type: string
  asset_model?: string
  serial_number?: string
  status: string
  acquisition_year?: number
  assignment_type?: "individual" | "department" | "office"
  department?: string
  office_location?: string
}

interface AssetAssignment {
  id: string
  assigned_at: string
  assignment_notes?: string
  assigned_by: string
  asset: Asset
  assigner?: {
    first_name: string
    last_name: string
  }
  department?: string
}

export default function AssetsPage() {
  const [assignments, setAssignments] = useState<AssetAssignment[]>([])
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const supabase = createClient()

  useEffect(() => {
    loadAssets()
  }, [])

  const loadAssets = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Get user's department and office location
      const { data: profile } = await supabase
        .from("profiles")
        .select("department, office_location")
        .eq("id", user.id)
        .single()

      // Fetch individual assignments
      const { data: individualAssignments, error: individualError } = await supabase
        .from("asset_assignments")
        .select(
          `
          id,
          assigned_at,
          assignment_notes,
          assigned_by,
          asset_id,
          department
        `
        )
        .eq("assigned_to", user.id)
        .eq("is_current", true)
        .order("assigned_at", { ascending: false })

      if (individualError) throw individualError

      // Fetch department and office assignments if user has a department or office
      let departmentAndOfficeAssets: any[] = []
      if (profile?.department || profile?.office_location) {
        // Fetch assets assigned to user's department or office
        const { data: sharedAssets, error: sharedError } = await supabase
          .from("assets")
          .select(
            `
            id,
            unique_code,
            asset_type,
            asset_model,
            serial_number,
            status,
            acquisition_year,
            assignment_type,
            department,
            office_location,
            created_at
          `
          )
          .eq("status", "assigned")
          .or(
            `and(assignment_type.eq.department,department.eq.${profile.department}),and(assignment_type.eq.office,office_location.eq.${profile.office_location})`
          )

        if (!sharedError && sharedAssets) {
          // Convert shared assets to assignment format
          departmentAndOfficeAssets = sharedAssets.map((asset) => ({
            id: `shared-${asset.id}`,
            assigned_at: asset.created_at, // Use the asset's creation date
            assignment_notes:
              asset.assignment_type === "department"
                ? `Assigned to ${asset.department} department`
                : `Assigned to ${asset.office_location} office`,
            assigned_by: null,
            asset_id: asset.id,
            department: asset.department,
            asset: asset,
            assigner: null,
          }))
        }
      }

      // Combine both assignment types
      const allAssignments = [...(individualAssignments || []), ...departmentAndOfficeAssets]

      // Fetch Asset and assigner details separately (only for individual assignments)
      const assignmentsWithDetails = await Promise.all(
        allAssignments.map(async (assignment: any) => {
          // If asset data already exists (from department assignments), skip fetching
          if (assignment.asset) {
            return assignment
          }

          const [assetResult, assignerResult] = await Promise.all([
            supabase
              .from("assets")
              .select("id, unique_code, asset_type, asset_model, serial_number, status, acquisition_year")
              .eq("id", assignment.asset_id)
              .single(),
            assignment.assigned_by
              ? supabase.from("profiles").select("first_name, last_name").eq("id", assignment.assigned_by).single()
              : Promise.resolve({ data: null }),
          ])

          return {
            ...assignment,
            asset: assetResult.data,
            assigner: assignerResult.data,
          }
        })
      )

      setAssignments((assignmentsWithDetails as any) || [])
    } catch (error: any) {
      console.error("Error loading Assets:", error)
      const errorMessage = error?.message || error?.toString() || "Failed to load Assets"
      toast.error(`Failed to load Assets: ${errorMessage}`)
    }
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
      case "maintenance":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      case "available":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  const getAssetTypeLabel = (assetTypeCode: string) => {
    return ASSET_TYPE_MAP[assetTypeCode]?.label || assetTypeCode
  }

  const getAssignmentTypeLabel = (assignment: AssetAssignment) => {
    // Check if it's from department/office (has department field or starts with 'shared-')
    if (assignment.id.startsWith("shared-")) {
      // Check the asset's assignment_type
      if (assignment.asset?.assignment_type === "department") {
        return "Department"
      } else if (assignment.asset?.assignment_type === "office") {
        return "Office"
      }
    }
    return "Personal"
  }

  const getAssignmentTypeBadgeColor = (type: string) => {
    switch (type) {
      case "Personal":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "Department":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
      case "Office":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  return (
    <div className="from-background via-background to-muted/20 min-h-screen bg-gradient-to-br p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-foreground flex items-center gap-3 text-2xl font-bold sm:text-3xl">
              <Package className="text-primary h-6 w-6 sm:h-8 sm:w-8" />
              My Assets
            </h1>
            <p className="text-muted-foreground mt-2">View your currently assigned assets and equipment</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="gap-2"
            >
              <List className="h-4 w-4" />
              List
            </Button>
            <Button
              variant={viewMode === "card" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("card")}
              className="gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              Card
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Active Assets</p>
                  <p className="text-foreground mt-2 text-3xl font-bold">{assignments.length}</p>
                </div>
                <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                  <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assets List/Grid */}
        {assignments.length > 0 ? (
          viewMode === "list" ? (
            <Card className="border-2">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">S/N</TableHead>
                      <TableHead>Asset Name</TableHead>
                      <TableHead>Unique Code</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Serial Number</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assignment Type</TableHead>
                      <TableHead>Assigned</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((assignment, index) => {
                      const assignmentType = getAssignmentTypeLabel(assignment)
                      return (
                        <TableRow key={assignment.id}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell className="font-medium">
                            {getAssetTypeLabel(assignment.asset?.asset_type || "")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Hash className="text-muted-foreground h-3.5 w-3.5" />
                              <span className="font-mono text-sm">{assignment.asset?.unique_code || "-"}</span>
                            </div>
                          </TableCell>
                          <TableCell>{assignment.asset?.asset_model || "-"}</TableCell>
                          <TableCell>
                            {assignment.asset?.serial_number ? (
                              <span className="font-mono text-sm">{assignment.asset.serial_number}</span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>{assignment.asset?.acquisition_year || "-"}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(assignment.asset?.status || "available")}>
                              {assignment.asset?.status || "available"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getAssignmentTypeBadgeColor(assignmentType)}>{assignmentType}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(assignment.assigned_at)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {assignments.map((assignment) => {
                const assignmentType = getAssignmentTypeLabel(assignment)
                return (
                  <Card key={assignment.id} className="border-2 shadow-lg transition-shadow hover:shadow-xl">
                    <CardHeader className="from-primary/5 to-background border-b bg-gradient-to-r">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="bg-primary/10 rounded-lg p-3">
                            <Package className="text-primary h-6 w-6" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-lg">
                              {getAssetTypeLabel(assignment.asset?.asset_type || "")}
                            </CardTitle>
                            <CardDescription className="mt-1 flex items-center gap-1.5">
                              <Hash className="h-3.5 w-3.5" />
                              <span className="font-mono text-xs">{assignment.asset?.unique_code || "-"}</span>
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Badge className={getStatusColor(assignment.asset?.status || "available")}>
                            {assignment.asset?.status || "available"}
                          </Badge>
                          <Badge className={getAssignmentTypeBadgeColor(assignmentType)}>{assignmentType}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 p-6">
                      {assignment.asset?.asset_model && (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="text-muted-foreground h-4 w-4" />
                          <span className="text-muted-foreground">Model:</span>
                          <span className="text-foreground font-medium">{assignment.asset.asset_model}</span>
                        </div>
                      )}

                      {assignment.asset?.serial_number && (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="text-muted-foreground h-4 w-4" />
                          <span className="text-muted-foreground">Serial:</span>
                          <span className="text-foreground font-mono">{assignment.asset.serial_number}</span>
                        </div>
                      )}

                      {assignment.asset?.acquisition_year && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="text-muted-foreground h-4 w-4" />
                          <span className="text-muted-foreground">Year:</span>
                          <span className="text-foreground font-medium">{assignment.asset.acquisition_year}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="text-muted-foreground h-4 w-4" />
                        <span className="text-muted-foreground">Assigned:</span>
                        <span className="text-foreground">{formatDate(assignment.assigned_at)}</span>
                      </div>

                      {assignment.department ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="text-muted-foreground h-4 w-4" />
                          <span className="text-muted-foreground">Department:</span>
                          <span className="text-foreground font-medium">{assignment.department}</span>
                        </div>
                      ) : (
                        assignment.assigner && (
                          <div className="flex items-center gap-2 text-sm">
                            <User className="text-muted-foreground h-4 w-4" />
                            <span className="text-muted-foreground">Assigned by:</span>
                            <span className="text-foreground">
                              {formatName(assignment.assigner.first_name)} {formatName(assignment.assigner.last_name)}
                            </span>
                          </div>
                        )
                      )}

                      {assignment.assignment_notes && (
                        <div className="bg-muted/50 mt-4 rounded-lg p-3">
                          <p className="text-foreground mb-1 text-sm font-medium">Notes:</p>
                          <p className="text-muted-foreground text-sm">{assignment.assignment_notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )
        ) : (
          <Card className="border-2">
            <CardContent className="p-12 text-center">
              <Package className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
              <h3 className="text-foreground mb-2 text-xl font-semibold">No Assets Assigned</h3>
              <p className="text-muted-foreground">You don't have any assets assigned to you at the moment.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
