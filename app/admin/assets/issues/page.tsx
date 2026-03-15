"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatName } from "@/lib/utils"
import { ASSET_TYPE_MAP } from "@/lib/asset-types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, Trash2, Search, Package, Calendar, User, Filter } from "lucide-react"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState, ListToolbar } from "@/components/ui/patterns"
import { TableSkeleton } from "@/components/ui/query-states"

import { logger } from "@/lib/logger"

const log = logger("assets-issues")

interface AssetIssue {
  id: string
  asset_id: string
  description: string
  resolved: boolean
  created_at: string
  resolved_at?: string
  resolved_by?: string
  created_by: string
  asset?: {
    unique_code: string
    asset_type: string
    status: string
    assignment_type?: string
    department?: string
    office_location?: string
    current_assignment?: {
      type?: "individual" | "department" | "office"
      department?: string
      office_location?: string
      user?: {
        first_name: string
        last_name: string
      }
    }
  }
  creator?: {
    first_name: string
    last_name: string
  }
  resolver?: {
    first_name: string
    last_name: string
  }
}

async function fetchAssetIssues(): Promise<AssetIssue[]> {
  const supabase = createClient()
  const { data: issuesData, error: issuesError } = await supabase
    .from("asset_issues")
    .select("*")
    .order("created_at", { ascending: false })

  if (issuesError) throw new Error(issuesError.message)

  const issuesWithDetails = await Promise.all(
    (issuesData || []).map(async (issue) => {
      const { data: assetData } = await supabase
        .from("assets")
        .select("unique_code, asset_type, status, assignment_type, department, office_location")
        .eq("id", issue.asset_id)
        .single()

      let assignmentData = null
      if (assetData) {
        const { data: assignment } = await supabase
          .from("asset_assignments")
          .select("assigned_to, department, office_location")
          .eq("asset_id", issue.asset_id)
          .eq("is_current", true)
          .maybeSingle()

        if (assignment) {
          if (assignment.assigned_to) {
            const { data: userData } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("id", assignment.assigned_to)
              .single()
            assignmentData = {
              type: "individual",
              user: userData,
              department: assignment.department,
              office_location: assignment.office_location,
            }
          } else if (assignment.department) {
            assignmentData = { type: "department", department: assignment.department }
          } else if (assignment.office_location) {
            assignmentData = { type: "office", office_location: assignment.office_location }
          }
        } else if (
          assetData.status === "assigned" ||
          assetData.status === "retired" ||
          assetData.status === "maintenance"
        ) {
          if (assetData.assignment_type === "department" && assetData.department) {
            assignmentData = { type: "department", department: assetData.department }
          } else if (assetData.assignment_type === "office" && assetData.office_location) {
            assignmentData = { type: "office", office_location: assetData.office_location }
          }
        }
      }

      const { data: creatorData } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", issue.created_by)
        .single()

      let resolverData = null
      if (issue.resolved_by) {
        const { data } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", issue.resolved_by)
          .single()
        resolverData = data
      }

      return {
        ...issue,
        asset: { ...assetData, current_assignment: assignmentData },
        creator: creatorData,
        resolver: resolverData,
      }
    })
  )

  return issuesWithDetails as AssetIssue[]
}

export default function AssetIssuesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("unresolved")
  const [assetTypeFilter, setAssetTypeFilter] = useState("all")
  const queryClient = useQueryClient()

  const { data: issues = [], isLoading: loading } = useQuery({
    queryKey: QUERY_KEYS.adminAssetIssues(),
    queryFn: fetchAssetIssues,
  })

  const handleToggleResolved = async (issue: AssetIssue) => {
    try {
      const supabase = createClient()
      const { error } = await supabase.from("asset_issues").update({ resolved: !issue.resolved }).eq("id", issue.id)
      if (error) throw error
      toast.success(issue.resolved ? "Issue marked as unresolved" : "Issue marked as resolved")
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminAssetIssues() })
    } catch (error: any) {
      log.error("Error toggling issue:", error)
      toast.error("Failed to update issue")
    }
  }

  const handleDeleteIssue = async (issueId: string) => {
    if (!confirm("Are you sure you want to delete this issue?")) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from("asset_issues").delete().eq("id", issueId)
      if (error) throw error
      toast.success("Issue deleted")
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminAssetIssues() })
    } catch (error: any) {
      log.error("Error deleting issue:", error)
      toast.error("Failed to delete issue")
    }
  }

  const filteredIssues = issues.filter((issue) => {
    const matchesSearch =
      searchQuery === "" ||
      issue.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.asset?.unique_code.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "resolved" && issue.resolved) ||
      (statusFilter === "unresolved" && !issue.resolved)

    const matchesAssetType = assetTypeFilter === "all" || issue.asset?.asset_type === assetTypeFilter

    return matchesSearch && matchesStatus && matchesAssetType
  })

  const stats = {
    total: issues.length,
    unresolved: issues.filter((i) => !i.resolved).length,
    resolved: issues.filter((i) => i.resolved).length,
  }

  return (
    <AdminTablePage
      title="Asset Issues"
      description="Track and manage all asset issues across the organization"
      icon={AlertCircle}
      stats={
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4">
          <StatCard title="Total Issues" value={stats.total} icon={AlertCircle} description="All tracked issues" />
          <StatCard
            title="Unresolved Issues"
            value={stats.unresolved}
            icon={AlertCircle}
            iconBgColor="bg-orange-100 dark:bg-orange-900/30"
            iconColor="text-orange-600 dark:text-orange-400"
            description="Requiring attention"
          />
          <StatCard
            title="Resolved Issues"
            value={stats.resolved}
            icon={CheckCircle2}
            iconBgColor="bg-green-100 dark:bg-green-900/30"
            iconColor="text-green-600 dark:text-green-400"
            description="Successfully fixed"
          />
        </div>
      }
      filters={
        <ListToolbar
          search={
            <div className="relative w-full min-w-0 flex-1 sm:max-w-md">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
              <Input
                placeholder="Search issues or asset codes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          }
          filters={
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
              <SearchableSelect
                value={statusFilter}
                onValueChange={setStatusFilter}
                placeholder="Filter by status"
                searchPlaceholder="Search status..."
                icon={<Filter className="h-4 w-4" />}
                options={[
                  { value: "all", label: "All Issues" },
                  {
                    value: "unresolved",
                    label: "Unresolved",
                    icon: <AlertCircle className="h-3 w-3 text-orange-500" />,
                  },
                  {
                    value: "resolved",
                    label: "Resolved",
                    icon: <CheckCircle2 className="h-3 w-3 text-green-500" />,
                  },
                ]}
              />
              <SearchableSelect
                value={assetTypeFilter}
                onValueChange={setAssetTypeFilter}
                placeholder="All Asset Types"
                searchPlaceholder="Search asset types..."
                icon={<Package className="h-4 w-4" />}
                options={[
                  { value: "all", label: "All Asset Types" },
                  ...Object.entries(ASSET_TYPE_MAP).map(([key, value]) => ({
                    value: key,
                    label: value.label,
                  })),
                ]}
              />
            </div>
          }
        />
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Issues List ({filteredIssues.length})</CardTitle>
          <CardDescription>
            {statusFilter === "unresolved"
              ? "Showing unresolved issues requiring attention"
              : statusFilter === "resolved"
                ? "Showing resolved issues"
                : "Showing all issues"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={5} cols={7} />
          ) : filteredIssues.length === 0 ? (
            <EmptyState
              icon={AlertCircle}
              title="No issues found"
              description={
                searchQuery || statusFilter !== "all" || assetTypeFilter !== "all"
                  ? "No issues match your filters."
                  : "No issues tracked yet."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Status</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>Issue Description</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Reported By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIssues.map((issue) => (
                    <TableRow
                      key={issue.id}
                      className={
                        issue.resolved ? "bg-green-50/50 dark:bg-green-950/10" : "bg-orange-50/50 dark:bg-orange-950/10"
                      }
                    >
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleResolved(issue)}
                          className="h-8 w-8 p-0"
                        >
                          {issue.resolved ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-orange-500" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="bg-primary/10 rounded p-1.5">
                            <Package className="text-primary h-3 w-3" />
                          </div>
                          <div>
                            <div className="font-mono text-xs font-medium">{issue.asset?.unique_code}</div>
                            <div className="text-muted-foreground text-xs">
                              {ASSET_TYPE_MAP[issue.asset?.asset_type || ""]?.label || issue.asset?.asset_type}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          <p
                            className={`text-sm ${
                              issue.resolved ? "text-muted-foreground line-through" : "text-foreground"
                            }`}
                          >
                            {issue.description}
                          </p>
                          {issue.resolved && issue.resolved_at && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>
                                Resolved {new Date(issue.resolved_at).toLocaleDateString()}
                                {issue.resolver && (
                                  <span>
                                    {" "}
                                    by {formatName(issue.resolver.first_name)} {formatName(issue.resolver.last_name)}
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {issue.asset?.current_assignment ? (
                          issue.asset.current_assignment.type === "individual" &&
                          issue.asset.current_assignment.user ? (
                            <div className="flex items-center gap-1.5">
                              <User className="text-muted-foreground h-3 w-3" />
                              <span className="text-sm">
                                {formatName(issue.asset.current_assignment.user.first_name)}{" "}
                                {formatName(issue.asset.current_assignment.user.last_name)}
                              </span>
                            </div>
                          ) : issue.asset.current_assignment.type === "department" &&
                            issue.asset.current_assignment.department ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{issue.asset.current_assignment.department}</span>
                            </div>
                          ) : issue.asset.current_assignment.type === "office" &&
                            issue.asset.current_assignment.office_location ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{issue.asset.current_assignment.office_location}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )
                        ) : (
                          <span className="text-muted-foreground text-sm">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <User className="text-muted-foreground h-3 w-3" />
                          <span className="text-sm">
                            {issue.creator
                              ? `${formatName(issue.creator.first_name)} ${formatName(issue.creator.last_name)}`
                              : "Unknown"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
                          <Calendar className="h-3 w-3" />
                          {new Date(issue.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteIssue(issue.id)}
                          className="text-destructive hover:text-destructive h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminTablePage>
  )
}
