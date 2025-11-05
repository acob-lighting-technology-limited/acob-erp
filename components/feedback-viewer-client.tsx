"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Building2, User } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Eye, List, LayoutGrid, MessageSquare, Search, Filter, ArrowUp, ArrowDown } from "lucide-react"
import { formatName } from "@/lib/utils"

interface FeedbackViewerClientProps {
  feedback: any[]
}

export function FeedbackViewerClient({ feedback }: FeedbackViewerClientProps) {
  const [filteredFeedback, setFilteredFeedback] = useState(feedback)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [staffFilter, setStaffFilter] = useState("all")
  const [nameSortOrder, setNameSortOrder] = useState<"asc" | "desc">("asc")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const [selectedFeedback, setSelectedFeedback] = useState<any | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [departments, setDepartments] = useState<string[]>([])
  const [staff, setStaff] = useState<{ id: string; first_name: string; last_name: string; department: string }[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [leadDepartments, setLeadDepartments] = useState<string[]>([])

  const supabase = createClient()

  // Load all departments and staff from database
  useEffect(() => {
    const loadFilterData = async () => {
      try {
        // Get current user profile to check if they're a lead
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: userProfile } = await supabase
          .from("profiles")
          .select("role, lead_departments")
          .eq("id", user.id)
          .single()

        if (userProfile) {
          setUserRole(userProfile.role)
          setLeadDepartments(userProfile.lead_departments || [])
        }

        // Load staff - leads can only see staff in their departments
        let staffQuery = supabase
          .from("profiles")
          .select("id, first_name, last_name, department")
          .order("last_name", { ascending: true })

        // If user is a lead, filter by their lead departments
        if (userProfile?.role === "lead" && userProfile.lead_departments && userProfile.lead_departments.length > 0) {
          staffQuery = staffQuery.in("department", userProfile.lead_departments)
        }

        const { data: staffData } = await staffQuery

        if (staffData) {
          setStaff(staffData)
          
          // Extract unique departments - for leads, only show their lead departments
          let uniqueDepartments: string[] = []
          if (userProfile?.role === "lead" && userProfile.lead_departments && userProfile.lead_departments.length > 0) {
            uniqueDepartments = userProfile.lead_departments.sort()
          } else {
            uniqueDepartments = Array.from(
              new Set(staffData.map((s: any) => s.department).filter(Boolean))
            ) as string[]
            uniqueDepartments.sort()
          }
          setDepartments(uniqueDepartments)
        }
      } catch (error) {
        console.error("Error loading filter data:", error)
      }
    }

    loadFilterData()
  }, [])

  // Real-time filtering with useEffect
  useEffect(() => {
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

    // Staff filter
    if (staffFilter !== "all") {
      filtered = filtered.filter((item) => item.user_id === staffFilter)
    }

    // Sort by name
    filtered = filtered.sort((a, b) => {
      const lastNameA = formatName(a.profiles?.last_name || "").toLowerCase()
      const lastNameB = formatName(b.profiles?.last_name || "").toLowerCase()
      
      if (nameSortOrder === "asc") {
        return lastNameA.localeCompare(lastNameB)
      } else {
        return lastNameB.localeCompare(lastNameA)
      }
    })

    setFilteredFeedback(filtered)
  }, [feedback, searchQuery, selectedType, selectedStatus, departmentFilter, staffFilter, nameSortOrder])

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
      await supabase.rpc("log_audit", {
        p_action: "update",
        p_entity_type: "feedback",
        p_entity_id: selectedFeedback.id,
        p_old_values: {
          status: selectedFeedback.status,
        },
        p_new_values: {
          status: newStatus,
        },
      })

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
      <Card className="border-2 shadow-lg">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              Filters & Search
            </CardTitle>
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
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
              <label className="text-sm font-medium text-foreground">Feedback Type</label>
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
              <label className="text-sm font-medium text-foreground">Status</label>
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
            {userRole !== "lead" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Department</label>
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
              <label className="text-sm font-medium text-foreground">
                {userRole === "lead" && departments.length > 0 
                  ? `Staff (${departments.join(", ")})`
                  : "Staff"}
              </label>
              <SearchableSelect
                value={staffFilter}
                onValueChange={setStaffFilter}
                placeholder={
                  userRole === "lead" && departments.length > 0
                    ? `All ${departments.length === 1 ? departments[0] : "Department"} Staff`
                    : "All Staff"
                }
                searchPlaceholder="Search staff..."
                icon={<User className="h-4 w-4" />}
                options={[
                  { 
                    value: "all", 
                    label: userRole === "lead" && departments.length > 0
                      ? `All ${departments.length === 1 ? departments[0] : "Department"} Staff`
                      : "All Staff"
                  },
                  ...staff.map((member) => ({
                    value: member.id,
                    label: `${formatName(member.first_name)} ${formatName(member.last_name)} - ${member.department}`,
                    icon: <User className="h-3 w-3" />,
                  })),
                ]}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Results</label>
              <div className="px-3 py-2 border rounded-md bg-muted text-sm font-medium">
                {filteredFeedback.length} item{filteredFeedback.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedback List */}
      {filteredFeedback.length > 0 ? (
        viewMode === "list" ? (
          <Card className="border-2 shadow-lg">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Feedback Items
              </CardTitle>
              <CardDescription>Total: {filteredFeedback.length} items</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
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
                      <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">
                              {formatName(item.profiles?.last_name)}, {formatName(item.profiles?.first_name)}
                            </p>
                            <p className="text-xs text-muted-foreground">{item.profiles?.company_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{item.profiles?.department || "-"}</TableCell>
                        <TableCell>
                          <Badge className={getTypeColor(item.feedback_type)}>{item.feedback_type}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{item.title}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredFeedback.map((item) => (
              <Card key={item.id} className="border-2 hover:shadow-lg transition-shadow">
                <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-background">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <MessageSquare className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg line-clamp-2">{item.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge className={getTypeColor(item.feedback_type)}>
                            {item.feedback_type}
                          </Badge>
                          <Badge className={getStatusColor(item.status)}>
                            {item.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="text-sm">
                    <p className="font-medium">
                      {formatName(item.profiles?.last_name)}, {formatName(item.profiles?.first_name)}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.profiles?.company_email}</p>
                    <p className="text-xs text-muted-foreground">{item.profiles?.department}</p>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {item.description || "No description provided."}
                  </p>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(item)}
                      className="gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      View
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
            <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              No Feedback Found
            </h3>
            <p className="text-muted-foreground">
              {searchQuery || selectedType !== "all" || selectedStatus !== "all" || departmentFilter !== "all" || staffFilter !== "all"
                ? "No feedback matches your filters"
                : "No feedback has been submitted yet"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Feedback Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Feedback Details</DialogTitle>
            <DialogDescription>View and manage feedback details</DialogDescription>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-6">
              {/* User Information */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Submitted By</Label>
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <p className="font-medium text-lg">
                    {formatName(selectedFeedback.profiles?.first_name)} {formatName(selectedFeedback.profiles?.last_name)}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedFeedback.profiles?.company_email}</p>
                  <p className="text-sm text-muted-foreground">{selectedFeedback.profiles?.department}</p>
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      Submitted: {new Date(selectedFeedback.created_at).toLocaleString()}
                    </p>
                    {selectedFeedback.updated_at !== selectedFeedback.created_at && (
                      <p className="text-xs text-muted-foreground">
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
                <div className="p-3 bg-muted/50 rounded-lg border">
                  <p className="font-medium">{selectedFeedback.title}</p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Description</Label>
                <div className="p-4 bg-muted/50 rounded-lg border min-h-[100px]">
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
              <div className="flex gap-2 pt-4 border-t">
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

