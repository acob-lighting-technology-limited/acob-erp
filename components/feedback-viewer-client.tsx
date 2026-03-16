"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Building2, User } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Eye, MessageSquare, Search, ArrowUp, ArrowDown } from "lucide-react"
import { formatName } from "@/lib/utils"
import { writeAuditLogClient } from "@/lib/audit/client"

interface FeedbackViewerClientProps {
  feedback: any[]
}

interface FeedbackFilterData {
  isDepartmentLead: boolean
  leadDepartments: string[]
  employees: { id: string; first_name: string; last_name: string; department: string }[]
  departments: string[]
}

async function fetchFeedbackFilterData(): Promise<FeedbackFilterData> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { isDepartmentLead: false, leadDepartments: [], employees: [], departments: [] }

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("role, department, is_department_lead, lead_departments")
    .eq("id", user.id)
    .single()

  const scopedDepartments = userProfile?.lead_departments?.length
    ? userProfile.lead_departments
    : userProfile?.department
      ? [userProfile.department]
      : []

  let employeeQuery = supabase
    .from("profiles")
    .select("id, first_name, last_name, department")
    .order("last_name", { ascending: true })

  if (userProfile?.is_department_lead && scopedDepartments.length > 0) {
    employeeQuery = employeeQuery.in("department", scopedDepartments)
  }

  const { data: employeeData } = await employeeQuery
  const employees = (employeeData || []) as { id: string; first_name: string; last_name: string; department: string }[]

  let uniqueDepartments: string[] = []
  if (userProfile?.is_department_lead && scopedDepartments.length > 0) {
    uniqueDepartments = [...scopedDepartments].sort()
  } else {
    uniqueDepartments = Array.from(new Set(employees.map((s) => s.department).filter(Boolean))) as string[]
    uniqueDepartments.sort()
  }

  return {
    isDepartmentLead: Boolean(userProfile?.is_department_lead),
    leadDepartments: scopedDepartments,
    employees,
    departments: uniqueDepartments,
  }
}

export function FeedbackViewerClient({ feedback }: FeedbackViewerClientProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [employeeFilter, setEmployeeFilter] = useState("all")
  const [nameSortOrder, setNameSortOrder] = useState<"asc" | "desc">("asc")
  const [selectedFeedback, setSelectedFeedback] = useState<any | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const supabase = createClient()

  const { data: filterData } = useQuery({
    queryKey: QUERY_KEYS.feedbackViewer(),
    queryFn: fetchFeedbackFilterData,
  })

  const isDepartmentLead = filterData?.isDepartmentLead ?? false
  const leadDepartments = filterData?.leadDepartments ?? []
  const employees = filterData?.employees ?? []
  const departments = filterData?.departments ?? []

  const filteredFeedback = useMemo(() => {
    let filtered = feedback

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter((item) => {
        const titleMatch = item.title?.toLowerCase().includes(searchQuery.toLowerCase())
        const userMatch =
          item.profiles?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.profiles?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.profiles?.company_email?.toLowerCase().includes(searchQuery.toLowerCase())
        return titleMatch || userMatch
      })
    }

    // Type filter
    if (selectedType !== "all") {
      filtered = filtered.filter((item) => item.feedback_type === selectedType)
    }

    // Status filter
    if (selectedStatus !== "all") {
      filtered = filtered.filter((item) => item.status === selectedStatus)
    }

    // Department filter
    if (departmentFilter !== "all") {
      filtered = filtered.filter((item) => item.profiles?.department === departmentFilter)
    }

    // employee filter
    if (employeeFilter !== "all") {
      filtered = filtered.filter((item) => item.user_id === employeeFilter)
    }

    // Sort by name
    return [...filtered].sort((a, b) => {
      const lastNameA = formatName(a.profiles?.last_name || "").toLowerCase()
      const lastNameB = formatName(b.profiles?.last_name || "").toLowerCase()

      if (nameSortOrder === "asc") {
        return lastNameA.localeCompare(lastNameB)
      } else {
        return lastNameB.localeCompare(lastNameA)
      }
    })
  }, [feedback, searchQuery, selectedType, selectedStatus, departmentFilter, employeeFilter, nameSortOrder])

  const getTypeColor = (type: string) => {
    switch (type) {
      case "concern":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      case "complaint":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      case "suggestion":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "required_item":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "in_progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "resolved":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
      case "closed":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  const handleViewDetails = (item: any) => {
    setSelectedFeedback(item)
    setIsModalOpen(true)
  }

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedFeedback) return

    const supabase = createClient()
    setIsUpdating(true)

    try {
      const { error } = await supabase
        .from("feedback")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedFeedback.id)

      if (error) throw error

      // Log audit
      await writeAuditLogClient(
        supabase as any,
        {
          action: "status_change",
          entityType: "feedback",
          entityId: selectedFeedback.id,
          oldValues: {
            status: selectedFeedback.status,
          },
          newValues: {
            status: newStatus,
          },
          metadata: {
            event: "feedback_status_updated",
          },
          context: {
            source: "ui",
            route: "/admin/feedback",
          },
        },
        { failOpen: true }
      )

      toast.success("Status updated successfully!")

      // Update local state
      const updatedFeedback = { ...selectedFeedback, status: newStatus }
      setSelectedFeedback(updatedFeedback)

      // Trigger a re-render by updating the feedback list
      window.location.reload()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update status"
      toast.error(message)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <div className="bg-card space-y-4 rounded-lg border p-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            placeholder="Search by title or user name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filter Selects */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div className="space-y-2">
            <label className="text-foreground text-sm font-medium">Feedback Type</label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="concern">Concern</SelectItem>
                <SelectItem value="complaint">Complaint</SelectItem>
                <SelectItem value="suggestion">Suggestion</SelectItem>
                <SelectItem value="required_item">Required Item</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-foreground text-sm font-medium">Status</label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Department filter - hidden for leads */}
          {!isDepartmentLead && (
            <div className="space-y-2">
              <label className="text-foreground text-sm font-medium">Department</label>
              <SearchableSelect
                value={departmentFilter}
                onValueChange={setDepartmentFilter}
                placeholder="All Departments"
                searchPlaceholder="Search departments..."
                icon={<Building2 className="h-4 w-4" />}
                options={[
                  { value: "all", label: "All Departments" },
                  ...departments.map((dept) => ({
                    value: dept,
                    label: dept,
                    icon: <Building2 className="h-3 w-3" />,
                  })),
                ]}
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-foreground text-sm font-medium">
              {isDepartmentLead && departments.length > 0 ? `employee (${departments.join(", ")})` : "employee"}
            </label>
            <SearchableSelect
              value={employeeFilter}
              onValueChange={setEmployeeFilter}
              placeholder={
                isDepartmentLead && departments.length > 0
                  ? `All ${departments.length === 1 ? departments[0] : "Department"} employee`
                  : "All employee"
              }
              searchPlaceholder="Search employee..."
              icon={<User className="h-4 w-4" />}
              options={[
                {
                  value: "all",
                  label:
                    isDepartmentLead && departments.length > 0
                      ? `All ${departments.length === 1 ? departments[0] : "Department"} employee`
                      : "All employee",
                },
                ...employees.map((member) => ({
                  value: member.id,
                  label: `${formatName(member.first_name)} ${formatName(member.last_name)} - ${member.department}`,
                  icon: <User className="h-3 w-3" />,
                })),
              ]}
            />
          </div>

          <div className="space-y-2">
            <label className="text-foreground text-sm font-medium">Results</label>
            <div className="bg-muted rounded-md border px-3 py-2 text-sm font-medium">
              {filteredFeedback.length} item{filteredFeedback.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback List */}
      {filteredFeedback.length > 0 ? (
        <Card className="border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        <span>User</span>
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
                    <TableHead>Department</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFeedback.map((item, index) => (
                    <TableRow key={item.id} className="hover:bg-muted/50 cursor-pointer">
                      <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {item.user_id ? (
                            <>
                              <p className="font-medium">
                                {formatName(item.profiles?.last_name)}, {formatName(item.profiles?.first_name)}
                              </p>
                              <p className="text-muted-foreground text-xs">{item.profiles?.company_email}</p>
                            </>
                          ) : (
                            <p className="text-muted-foreground font-medium italic">Anonymous</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{item.user_id ? item.profiles?.department || "-" : "-"}</TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(item.feedback_type)}>{item.feedback_type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{item.title}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(item.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleViewDetails(item)
                          }}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2">
          <CardContent className="p-12 text-center">
            <MessageSquare className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
            <h3 className="text-foreground mb-2 text-xl font-semibold">No Feedback Found</h3>
            <p className="text-muted-foreground">
              {searchQuery ||
              selectedType !== "all" ||
              selectedStatus !== "all" ||
              departmentFilter !== "all" ||
              employeeFilter !== "all"
                ? "No feedback matches your filters"
                : "No feedback has been submitted yet"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Feedback Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Feedback Details</DialogTitle>
            <DialogDescription>View and manage feedback details</DialogDescription>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-6">
              {/* User Information */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Submitted By</Label>
                <div className="bg-muted/50 rounded-lg border p-4">
                  {selectedFeedback.user_id ? (
                    <>
                      <p className="text-lg font-medium">
                        {formatName(selectedFeedback.profiles?.first_name)}{" "}
                        {formatName(selectedFeedback.profiles?.last_name)}
                      </p>
                      <p className="text-muted-foreground text-sm">{selectedFeedback.profiles?.company_email}</p>
                      <p className="text-muted-foreground text-sm">{selectedFeedback.profiles?.department}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-lg font-medium italic">Anonymous Submission</p>
                  )}
                  <div className="mt-2 border-t pt-2">
                    <p className="text-muted-foreground text-xs">
                      Submitted: {new Date(selectedFeedback.created_at).toLocaleString()}
                    </p>
                    {selectedFeedback.updated_at !== selectedFeedback.created_at && (
                      <p className="text-muted-foreground text-xs">
                        Updated: {new Date(selectedFeedback.updated_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Feedback Type and Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Feedback Type</Label>
                  <div>
                    <Badge className={getTypeColor(selectedFeedback.feedback_type)}>
                      {selectedFeedback.feedback_type}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Current Status</Label>
                  <div>
                    <Badge className={getStatusColor(selectedFeedback.status)}>{selectedFeedback.status}</Badge>
                  </div>
                </div>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Title</Label>
                <div className="bg-muted/50 rounded-lg border p-3">
                  <p className="font-medium">{selectedFeedback.title}</p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Description</Label>
                <div className="bg-muted/50 min-h-[100px] rounded-lg border p-4">
                  <p className="whitespace-pre-wrap">{selectedFeedback.description || "No description provided."}</p>
                </div>
              </div>

              {/* Update Status */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Update Status</Label>
                <Select
                  value={selectedFeedback.status}
                  onValueChange={(value) => handleUpdateStatus(value)}
                  disabled={isUpdating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="flex gap-2 border-t pt-4">
                <Button onClick={() => setIsModalOpen(false)} variant="outline" className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
