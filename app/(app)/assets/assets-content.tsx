"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatName } from "@/lib/utils"
import { Package, Calendar, User, FileText, Building2, Hash, Search, Filter } from "lucide-react"
import { ASSET_TYPE_MAP } from "@/lib/asset-types"
import type { AssetAssignment } from "./page"
import { AppTablePage } from "@/components/app/app-table-page"
import { toast } from "sonner"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/patterns"
import { TableViewToggle } from "@/components/admin/table-view-toggle"

interface AssetsContentProps {
  initialAssignments: AssetAssignment[]
  initialError?: string | null
}

export function AssetsContent({ initialAssignments, initialError }: AssetsContentProps) {
  const [assignments] = useState<AssetAssignment[]>(initialAssignments)
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [assignmentTypeFilter, setAssignmentTypeFilter] = useState("all")

  useEffect(() => {
    if (initialError) {
      toast.error(initialError)
    }
  }, [initialError])

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
    if (assignment.id.startsWith("shared-")) {
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

  const filteredAssignments = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    return assignments.filter((assignment) => {
      const assignmentType = getAssignmentTypeLabel(assignment)
      const status = assignment.asset?.status || "available"
      const matchesStatus = statusFilter === "all" || status === statusFilter
      const matchesAssignmentType = assignmentTypeFilter === "all" || assignmentType === assignmentTypeFilter
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [
          getAssetTypeLabel(assignment.asset?.asset_type || ""),
          assignment.asset?.unique_code,
          assignment.asset?.asset_model,
          assignment.asset?.serial_number,
          String(assignment.asset?.acquisition_year || ""),
          assignment.department,
          assignment.assigner ? `${assignment.assigner.first_name || ""} ${assignment.assigner.last_name || ""}` : "",
          assignmentType,
        ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch))

      return matchesStatus && matchesAssignmentType && matchesSearch
    })
  }, [assignmentTypeFilter, assignments, searchQuery, statusFilter])

  return (
    <AppTablePage
      title="My Assets"
      description="View your currently assigned assets and equipment"
      icon={Package}
      actions={
        <TableViewToggle viewMode={viewMode} onChange={setViewMode} />
      }
      stats={
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Assigned Assets"
            value={assignments.length}
            icon={Package}
            iconBgColor="bg-blue-100 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
          />
          <StatCard
            title="Personal"
            value={assignments.filter((assignment) => getAssignmentTypeLabel(assignment) === "Personal").length}
            icon={User}
            iconBgColor="bg-green-100 dark:bg-green-900/30"
            iconColor="text-green-600 dark:text-green-400"
          />
          <StatCard
            title="Department"
            value={assignments.filter((assignment) => getAssignmentTypeLabel(assignment) === "Department").length}
            icon={Building2}
            iconBgColor="bg-purple-100 dark:bg-purple-900/30"
            iconColor="text-purple-600 dark:text-purple-400"
          />
          <StatCard
            title="Office"
            value={assignments.filter((assignment) => getAssignmentTypeLabel(assignment) === "Office").length}
            icon={Package}
            iconBgColor="bg-orange-100 dark:bg-orange-900/30"
            iconColor="text-orange-600 dark:text-orange-400"
          />
        </div>
      }
      filters={
        <Card className="border-2">
          <CardContent className="p-4">
            <div className="grid gap-3 lg:grid-cols-[1.2fr_220px_220px]">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by asset name, code, model, serial, year, or assigner..."
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <SelectValue placeholder="All status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                </SelectContent>
              </Select>
              <Select value={assignmentTypeFilter} onValueChange={setAssignmentTypeFilter}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <SelectValue placeholder="All assignment types" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignment Types</SelectItem>
                  <SelectItem value="Personal">Personal</SelectItem>
                  <SelectItem value="Department">Department</SelectItem>
                  <SelectItem value="Office">Office</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      }
    >
      {/* Assets List/Grid */}
      {filteredAssignments.length > 0 ? (
        viewMode === "list" ? (
          <Card className="border-2">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-foreground w-[50px] font-bold">#</TableHead>
                    <TableHead className="text-foreground font-bold">Asset Name</TableHead>
                    <TableHead className="text-foreground font-bold">Unique Code</TableHead>
                    <TableHead className="text-foreground font-bold">Model</TableHead>
                    <TableHead className="text-foreground font-bold">Serial Number</TableHead>
                    <TableHead className="text-foreground font-bold">Year</TableHead>
                    <TableHead className="text-foreground font-bold">Status</TableHead>
                    <TableHead className="text-foreground font-bold">Assignment Type</TableHead>
                    <TableHead className="text-foreground font-bold">Assigned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.map((assignment, index) => {
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
            {filteredAssignments.map((assignment) => {
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
        <EmptyState
          title="No Assets Found"
          description={
            assignments.length === 0
              ? "You don't have any assets assigned to you at the moment."
              : "No assets match your current filters."
          }
          icon={Package}
        />
      )}
    </AppTablePage>
  )
}
