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
import { formatName } from "@/lib/utils"
import {
  FileText,
  Search,
  Filter,
  Eye,
  User,
  Calendar,
  Tag,
  FolderOpen,
  LayoutGrid,
  List,
} from "lucide-react"
import type { UserRole } from "@/types/database"

interface Documentation {
  id: string
  title: string
  content: string
  category: string | null
  tags: string[] | null
  is_draft: boolean
  created_at: string
  updated_at: string
  user_id: string
  user?: {
    first_name: string
    last_name: string
    company_email: string
    department: string
    role: UserRole
  }
}

interface UserProfile {
  role: UserRole
  lead_departments?: string[]
}

export default function AdminDocumentationPage() {
  const [documentation, setDocumentation] = useState<Documentation[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const [selectedDoc, setSelectedDoc] = useState<Documentation | null>(null)
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

      // Fetch documentation without join first
      const { data: docsData, error: docsError } = await supabase
        .from("user_documentation")
        .select("*")
        .order("created_at", { ascending: false })

      if (docsError) {
        console.error("Documentation error:", docsError)
        throw docsError
      }

      // If we have documentation, fetch user details for each unique user_id
      if (docsData && docsData.length > 0) {
        const userIdsSet = new Set(docsData.map(doc => doc.user_id).filter(Boolean))
        const uniqueUserIds = Array.from(userIdsSet)

        const { data: usersData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, company_email, department, role")
          .in("id", uniqueUserIds)

        // Create a map of user data
        const usersMap = new Map(usersData?.map(user => [user.id, user]))

        // Combine docs with user data
        let docsWithUsers = docsData.map(doc => ({
          ...doc,
          user: doc.user_id ? usersMap.get(doc.user_id) : null
        }))

        // Role-based filtering
        if (profile?.role === "lead" && profile.lead_departments) {
          // Leads can only see their department's documentation
          docsWithUsers = docsWithUsers.filter(doc =>
            doc.user?.department && profile.lead_departments?.includes(doc.user.department)
          )
        }

        setDocumentation(docsWithUsers as any)
      } else {
        setDocumentation([])
      }
    } catch (error: any) {
      console.error("Error loading documentation:", error)
      toast.error("Failed to load documentation")
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewDocument = (doc: Documentation) => {
    setSelectedDoc(doc)
    setIsViewDialogOpen(true)
  }

  const filteredDocumentation = documentation.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.user?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.user?.last_name?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory =
      categoryFilter === "all" || doc.category === categoryFilter

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "published" && !doc.is_draft) ||
      (statusFilter === "draft" && doc.is_draft)

    const matchesDepartment =
      departmentFilter === "all" || doc.user?.department === departmentFilter

    return matchesSearch && matchesCategory && matchesStatus && matchesDepartment
  })

  const categories = Array.from(
    new Set(documentation.map((d) => d.category).filter(Boolean))
  ) as string[]

  const departments = Array.from(
    new Set(documentation.map((d) => d.user?.department).filter(Boolean))
  ) as string[]

  const stats = {
    total: documentation.length,
    published: documentation.filter((d) => !d.is_draft).length,
    drafts: documentation.filter((d) => d.is_draft).length,
    thisMonth: documentation.filter(
      (d) =>
        new Date(d.created_at).getMonth() === new Date().getMonth() &&
        new Date(d.created_at).getFullYear() === new Date().getFullYear()
    ).length,
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const getStatusColor = (isDraft: boolean) => {
    return isDraft
      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
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
              <FileText className="h-8 w-8 text-primary" />
              Staff Documentation
            </h1>
            <p className="text-muted-foreground mt-2">
              View all staff documentation and knowledge base articles
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
                  <p className="text-sm text-muted-foreground font-medium">Total Documents</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.total}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Published</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.published}</p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Drafts</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.drafts}</p>
                </div>
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <FileText className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">This Month</p>
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
                  placeholder="Search documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
                              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-full md:w-48">
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
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
            </div>
          </CardContent>
        </Card>

        {/* Documentation List */}
        {filteredDocumentation.length > 0 ? (
          viewMode === "list" ? (
            <Card className="border-2">
              <CardContent className="p-6">
                <Table>
                                      <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Author</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {filteredDocumentation.map((doc, index) => (
                      <TableRow key={doc.id}>
                        <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                        <TableCell>
                          {doc.user?.first_name && doc.user?.last_name
                            ? `${formatName(doc.user.last_name)}, ${formatName(doc.user.first_name)}`
                            : doc.user?.first_name || doc.user?.last_name
                            ? formatName(doc.user.first_name || doc.user.last_name)
                            : "-"}
                        </TableCell>
                        <TableCell>{doc.user?.department || "No Department"}</TableCell>
                        <TableCell className="font-medium">{doc.title}</TableCell>
                        <TableCell>
                          {doc.category ? (
                            <Badge variant="outline" className="text-xs">
                              {doc.category}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(doc.is_draft)}>
                            {doc.is_draft ? "Draft" : "Published"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(doc.created_at)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDocument(doc)}
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
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredDocumentation.map((doc) => (
                <Card key={doc.id} className="border-2 hover:shadow-lg transition-shadow">
                  <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-background">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg line-clamp-2">{doc.title}</CardTitle>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge className={getStatusColor(doc.is_draft)}>
                              {doc.is_draft ? "Draft" : "Published"}
                            </Badge>
                            {doc.category && (
                              <Badge variant="outline" className="text-xs">
                                {doc.category}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>
                        {doc.user?.first_name} {doc.user?.last_name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FolderOpen className="h-4 w-4" />
                      <span>{doc.user?.department || "No Department"}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(doc.created_at)}</span>
                    </div>

                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex items-start gap-2">
                        <Tag className="h-4 w-4 mt-1 text-muted-foreground" />
                        <div className="flex flex-wrap gap-1">
                          {doc.tags.slice(0, 3).map((tag, index) => (
                            <span
                              key={index}
                              className="text-xs bg-muted px-2 py-1 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                          {doc.tags.length > 3 && (
                            <span className="text-xs text-muted-foreground px-2 py-1">
                              +{doc.tags.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDocument(doc)}
                      className="w-full gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      View Document
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : (
          <Card className="border-2">
            <CardContent className="p-12 text-center">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                No Documentation Found
              </h3>
              <p className="text-muted-foreground">
                {searchQuery || categoryFilter !== "all" || statusFilter !== "all" || departmentFilter !== "all"
                  ? "No documentation matches your filters"
                  : "No documentation has been created yet"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* View Document Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{selectedDoc?.title}</DialogTitle>
            <DialogDescription>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <Badge className={getStatusColor(selectedDoc?.is_draft || false)}>
                  {selectedDoc?.is_draft ? "Draft" : "Published"}
                </Badge>
                {selectedDoc?.category && (
                  <span className="text-sm">Category: {selectedDoc.category}</span>
                )}
                <span className="text-sm">
                  By {selectedDoc?.user?.first_name} {selectedDoc?.user?.last_name}
                </span>
                <span className="text-sm">
                  {selectedDoc?.created_at && formatDate(selectedDoc.created_at)}
                </span>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {selectedDoc?.tags && selectedDoc.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedDoc.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            <div className="prose dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap bg-muted/50 p-4 rounded-lg">
                {selectedDoc?.content}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
