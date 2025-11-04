"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  Briefcase,
  Search,
  Filter,
  Eye,
  User,
  Calendar,
  Building2,
  CheckCircle,
  XCircle,
  List,
  LayoutGrid,
  Printer,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import type { UserRole } from "@/types/database"
import { getRoleDisplayName, getRoleBadgeColor } from "@/lib/permissions"
import { formatName } from "@/lib/utils"

interface Profile {
  id: string
  first_name: string
  last_name: string
  company_email: string
  department: string
  company_role: string | null
  phone_number: string | null
  role: UserRole
  job_description: string | null
  job_description_updated_at: string | null
  created_at: string
}

interface UserProfile {
  role: UserRole
  lead_departments?: string[]
}

export default function AdminJobDescriptionsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [nameSortOrder, setNameSortOrder] = useState<"asc" | "desc">("asc")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, lead_departments")
        .eq("id", user.id)
        .single()

      setUserProfile(profile)

      // Fetch profiles based on role
      let query = supabase
        .from("profiles")
        .select("*")
        .order("last_name", { ascending: true })

      // Role-based filtering
      if (profile?.role === "lead" && profile.lead_departments) {
        // Leads can only see their department's staff
        query = query.in("department", profile.lead_departments)
      }
      // super_admin and admin can see all profiles (no filter needed)

      const { data, error } = await query

      if (error) throw error

      setProfiles(data || [])
    } catch (error: any) {
      console.error("Error loading profiles:", error)
      toast.error("Failed to load job descriptions")
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewJobDescription = (profile: Profile) => {
    setSelectedProfile(profile)
    setIsViewDialogOpen(true)
  }

  const filteredProfiles = profiles
    .filter((profile) => {
      const matchesSearch =
        profile.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.company_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.company_role?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesDepartment =
        departmentFilter === "all" || profile.department === departmentFilter

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "completed" && profile.job_description) ||
        (statusFilter === "pending" && !profile.job_description)

      return matchesSearch && matchesDepartment && matchesStatus
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

  const departments = Array.from(
    new Set(profiles.map((p) => p.department).filter(Boolean))
  ) as string[]

  const stats = {
    total: profiles.length,
    completed: profiles.filter((p) => p.job_description).length,
    pending: profiles.filter((p) => !p.job_description).length,
    thisMonth: profiles.filter(
      (p) =>
        p.job_description_updated_at &&
        new Date(p.job_description_updated_at).getMonth() === new Date().getMonth() &&
        new Date(p.job_description_updated_at).getFullYear() === new Date().getFullYear()
    ).length,
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never"
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const handlePrint = () => {
    window.print()
  }

  const getCompletionColor = (hasDescription: boolean) => {
    return hasDescription
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
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
              <Briefcase className="h-8 w-8 text-primary" />
              Job Descriptions
            </h1>
            <p className="text-muted-foreground mt-2">
              View and manage staff job descriptions
            </p>
          </div>
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

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Staff</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.total}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Completed</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.completed}</p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Pending</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.pending}</p>
                </div>
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <XCircle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Updated This Month</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.thisMonth}</p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
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
                  placeholder="Search staff..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Staff List */}
        {filteredProfiles.length > 0 ? (
          viewMode === "list" ? (
            <Card className="border-2">
              <CardContent className="p-6">
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
                        <TableHead>Department</TableHead>
                        <TableHead>Company Role</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                                          {filteredProfiles.map((profile, index) => (
                        <TableRow key={profile.id}>
                          <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                          <TableCell className="font-medium">
                            {formatName(profile.last_name)}, {formatName(profile.first_name)}
                          </TableCell>
                        <TableCell>{profile.department}</TableCell>
                        <TableCell>{profile.company_role || "-"}</TableCell>
                        <TableCell>
                          <Badge className={getRoleBadgeColor(profile.role)}>
                            {getRoleDisplayName(profile.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getCompletionColor(!!profile.job_description)}>
                            {profile.job_description ? "Completed" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(profile.job_description_updated_at)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewJobDescription(profile)}
                            className="gap-2"
                            disabled={!profile.job_description}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredProfiles.map((profile) => (
                <Card key={profile.id} className="border-2 hover:shadow-lg transition-shadow">
                  <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-background">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                                                  <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg">
                              {formatName(profile.last_name)}, {formatName(profile.first_name)}
                            </CardTitle>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge className={getCompletionColor(!!profile.job_description)}>
                              {profile.job_description ? "Completed" : "Pending"}
                            </Badge>
                            <Badge className={getRoleBadgeColor(profile.role)}>
                              {getRoleDisplayName(profile.role)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      <span>{profile.department}</span>
                    </div>

                    {profile.company_role && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Briefcase className="h-4 w-4" />
                        <span>{profile.company_role}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Updated: {formatDate(profile.job_description_updated_at)}</span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewJobDescription(profile)}
                      className="w-full gap-2"
                      disabled={!profile.job_description}
                    >
                      <Eye className="h-4 w-4" />
                      {profile.job_description ? "View Description" : "No Description"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : (
          <Card className="border-2">
            <CardContent className="p-12 text-center">
              <Briefcase className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                No Staff Found
              </h3>
              <p className="text-muted-foreground">
                {searchQuery || departmentFilter !== "all" || statusFilter !== "all"
                  ? "No staff matches your filters"
                  : "No staff members found"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* View Job Description Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              body {
                background: white !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}} />
          <DialogHeader className="no-print">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl">
                {selectedProfile?.first_name} {selectedProfile?.last_name}'s Job Description
              </DialogTitle>
              {selectedProfile?.job_description && (
                <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
              )}
            </div>
            <DialogDescription>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <span className="text-sm">
                  {selectedProfile?.department}
                </span>
                {selectedProfile?.company_role && (
                  <span className="text-sm">" {selectedProfile.company_role}</span>
                )}
                <Badge className={getRoleBadgeColor(selectedProfile?.role || "staff")}>
                  {getRoleDisplayName(selectedProfile?.role || "staff")}
                </Badge>
                <span className="text-sm">
                  Last updated: {formatDate(selectedProfile?.job_description_updated_at || null)}
                </span>
              </div>
            </DialogDescription>
          </DialogHeader>
          
          {/* Print Letterhead - Hidden on screen, visible when printing */}
          <div className="hidden print:block print:mb-8 print:border-b print:pb-4">
            <div className="flex justify-between items-start">
              <div>
                <img src="/acob-logo.webp" alt="ACOB Lighting" className="h-16 w-auto" />
              </div>
              <div className="text-right text-sm">
                {selectedProfile?.first_name && selectedProfile?.last_name && (
                  <p className="font-semibold mb-1">
                    {formatName(selectedProfile.first_name)} {formatName(selectedProfile.last_name)}
                  </p>
                )}
                {selectedProfile?.company_email && <p className="mb-1">{selectedProfile.company_email}</p>}
                {selectedProfile?.department && <p className="mb-1">{selectedProfile.department}</p>}
                {selectedProfile?.phone_number && <p className="mb-1">{selectedProfile.phone_number}</p>}
                <p className="mt-2">{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 print:mt-0">
            {selectedProfile?.job_description ? (
              <div className="prose dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap bg-muted/50 p-6 rounded-lg print:bg-transparent print:p-0 print:rounded-none">
                  <h2 className="text-xl font-bold mb-4 print:mb-2">Job Description</h2>
                  <div className="whitespace-pre-wrap">{selectedProfile.job_description}</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <XCircle className="h-12 w-12 mx-auto mb-4" />
                <p>No job description has been added yet.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
