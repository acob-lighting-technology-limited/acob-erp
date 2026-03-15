"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Building2 } from "lucide-react"
import { formatName } from "@/lib/utils"
import { FileText, Search, Filter, Eye, User, Calendar, Tag, FolderOpen, LayoutGrid, List } from "lucide-react"
import type { UserRole } from "@/types/database"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { MarkdownContent } from "@/components/ui/markdown-content"
import { DepartmentDocumentsBrowser } from "@/components/documentation/department-documents-browser"

export interface Documentation {
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

export interface UserProfile {
  role: UserRole
  is_department_lead?: boolean
  lead_departments?: string[]
  managed_departments?: string[]
}

export interface employeeMember {
  id: string
  first_name: string
  last_name: string
  department: string
}

interface AdminDocumentationContentProps {
  initialDocumentation: Documentation[]
  initialemployee: employeeMember[]
  userProfile: UserProfile
  departmentDocs: {
    initialPath: string
    rootLabel: string
    enabled: boolean
    lockToInitialPath?: boolean
  }
  defaultTab?: "knowledge-docs" | "department-documents"
  hideTabList?: boolean
  backLinkHref?: string
  backLinkLabel?: string
}

export function AdminDocumentationContent({
  initialDocumentation,
  initialemployee,
  userProfile,
  departmentDocs,
  defaultTab,
  hideTabList = false,
  backLinkHref = "/admin",
  backLinkLabel = "Back to Admin",
}: AdminDocumentationContentProps) {
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get("tab")
  const initialTab = defaultTab || (tabFromUrl === "department-documents" ? "department-documents" : "knowledge-docs")
  const [activeTab, setActiveTab] = useState<"knowledge-docs" | "department-documents">(
    initialTab as "knowledge-docs" | "department-documents"
  )
  const scopedDepartments = userProfile.managed_departments ?? userProfile.lead_departments ?? []
  const [documentation] = useState<Documentation[]>(initialDocumentation)
  const [employee] = useState<employeeMember[]>(initialemployee)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [employeeFilter, setemployeeFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const [selectedDoc, setSelectedDoc] = useState<Documentation | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)

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

    const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "published" && !doc.is_draft) ||
      (statusFilter === "draft" && doc.is_draft)

    let matchesDepartment = true
    if (userProfile?.is_department_lead) {
      if (scopedDepartments.length > 0) {
        matchesDepartment = doc.user?.department ? scopedDepartments.includes(doc.user.department) : false
      }
    } else {
      matchesDepartment = departmentFilter === "all" || doc.user?.department === departmentFilter
    }

    const matchesemployee = employeeFilter === "all" || doc.user_id === employeeFilter

    return matchesSearch && matchesCategory && matchesStatus && matchesDepartment && matchesemployee
  })

  const categories = Array.from(new Set(documentation.map((d) => d.category).filter(Boolean))) as string[]
  const departments = Array.from(new Set(documentation.map((d) => d.user?.department).filter(Boolean))) as string[]

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

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "knowledge-docs" | "department-documents")}>
      {!hideTabList && (
        <div className="mb-4">
          <TabsList className="grid w-full max-w-lg grid-cols-2">
            <TabsTrigger value="knowledge-docs">Internal Documentation</TabsTrigger>
            <TabsTrigger value="department-documents">Department Documents</TabsTrigger>
          </TabsList>
        </div>
      )}

      <TabsContent value="knowledge-docs" className="space-y-4">
        <AdminTablePage
          title="Employee Documentation"
          description="View all employee documentation and knowledge base articles"
          icon={FileText}
          backLinkHref={backLinkHref}
          backLinkLabel={backLinkLabel}
          actions={
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
          }
          stats={
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 md:gap-4">
              <Card className="border-2">
                <CardContent className="p-3 sm:p-4 md:p-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-muted-foreground truncate text-[10px] font-medium sm:text-xs md:text-sm">
                        Total Documents
                      </p>
                      <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">
                        {stats.total}
                      </p>
                    </div>
                    <div className="ml-1 shrink-0 rounded-lg bg-blue-100 p-1.5 sm:p-2 md:p-3 dark:bg-blue-900/30">
                      <FileText className="h-4 w-4 text-blue-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardContent className="p-3 sm:p-4 md:p-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-muted-foreground truncate text-[10px] font-medium sm:text-xs md:text-sm">
                        Published
                      </p>
                      <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">
                        {stats.published}
                      </p>
                    </div>
                    <div className="ml-1 shrink-0 rounded-lg bg-green-100 p-1.5 sm:p-2 md:p-3 dark:bg-green-900/30">
                      <FileText className="h-4 w-4 text-green-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardContent className="p-3 sm:p-4 md:p-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-muted-foreground truncate text-[10px] font-medium sm:text-xs md:text-sm">
                        Drafts
                      </p>
                      <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">
                        {stats.drafts}
                      </p>
                    </div>
                    <div className="ml-1 shrink-0 rounded-lg bg-yellow-100 p-1.5 sm:p-2 md:p-3 dark:bg-yellow-900/30">
                      <FileText className="h-4 w-4 text-yellow-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-yellow-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardContent className="p-3 sm:p-4 md:p-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-muted-foreground truncate text-[10px] font-medium sm:text-xs md:text-sm">
                        This Month
                      </p>
                      <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">
                        {stats.thisMonth}
                      </p>
                    </div>
                    <div className="ml-1 shrink-0 rounded-lg bg-purple-100 p-1.5 sm:p-2 md:p-3 dark:bg-purple-900/30">
                      <Calendar className="h-4 w-4 text-purple-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          }
          filters={
            <Card className="border-2">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 md:flex-row">
                  <div className="relative flex-1">
                    <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                    <Input
                      placeholder="Search documentation..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full md:w-48">
                      <Filter className="mr-2 h-4 w-4" />
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
                  {!userProfile?.is_department_lead && (
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
                    value={employeeFilter}
                    onValueChange={setemployeeFilter}
                    placeholder={
                      userProfile?.is_department_lead &&
                      userProfile.lead_departments &&
                      userProfile.lead_departments.length > 0
                        ? `All ${userProfile.lead_departments.length === 1 ? userProfile.lead_departments[0] : "Department"} employee`
                        : "All employee"
                    }
                    searchPlaceholder="Search employee..."
                    icon={<User className="h-4 w-4" />}
                    className="w-full md:w-48"
                    options={[
                      {
                        value: "all",
                        label:
                          userProfile?.is_department_lead &&
                          userProfile.lead_departments &&
                          userProfile.lead_departments.length > 0
                            ? `All ${userProfile.lead_departments.length === 1 ? userProfile.lead_departments[0] : "Department"} employee`
                            : "All employee",
                      },
                      ...employee.map((member) => ({
                        value: member.id,
                        label: `${formatName(member.first_name)} ${formatName(member.last_name)} - ${member.department}`,
                        icon: <User className="h-3 w-3" />,
                      })),
                    ]}
                  />
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
          }
          filtersInCard={false}
        >
          {/* Documentation List */}
          {filteredDocumentation.length > 0 ? (
            viewMode === "list" ? (
              <Card className="border-2">
                <CardContent className="p-6">
                  <div className="table-responsive">
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
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDate(doc.created_at)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewDocument(doc)}
                                className="h-8 w-8 gap-1 p-0 sm:h-auto sm:w-auto sm:gap-2 sm:p-2"
                                title="View document"
                              >
                                <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span className="hidden sm:inline">View</span>
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
                {filteredDocumentation.map((doc) => (
                  <Card key={doc.id} className="border-2 transition-shadow hover:shadow-lg">
                    <CardHeader className="from-primary/5 to-background border-b bg-gradient-to-r">
                      <div className="flex items-start justify-between">
                        <div className="flex flex-1 items-start gap-3">
                          <div className="bg-primary/10 rounded-lg p-2">
                            <FileText className="text-primary h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="line-clamp-2 text-lg">{doc.title}</CardTitle>
                            <div className="mt-2 flex items-center gap-2">
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
                    <CardContent className="space-y-3 p-4">
                      <div className="text-muted-foreground flex items-center gap-2 text-sm">
                        <User className="h-4 w-4" />
                        <span>
                          {doc.user?.first_name} {doc.user?.last_name}
                        </span>
                      </div>

                      <div className="text-muted-foreground flex items-center gap-2 text-sm">
                        <FolderOpen className="h-4 w-4" />
                        <span>{doc.user?.department || "No Department"}</span>
                      </div>

                      <div className="text-muted-foreground flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(doc.created_at)}</span>
                      </div>

                      {doc.tags && doc.tags.length > 0 && (
                        <div className="flex items-start gap-2">
                          <Tag className="text-muted-foreground mt-1 h-4 w-4" />
                          <div className="flex flex-wrap gap-1">
                            {doc.tags.slice(0, 3).map((tag, index) => (
                              <span key={index} className="bg-muted rounded px-2 py-1 text-xs">
                                {tag}
                              </span>
                            ))}
                            {doc.tags.length > 3 && (
                              <span className="text-muted-foreground px-2 py-1 text-xs">
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
                <FileText className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
                <h3 className="text-foreground mb-2 text-xl font-semibold">No Documentation Found</h3>
                <p className="text-muted-foreground">
                  {searchQuery ||
                  categoryFilter !== "all" ||
                  statusFilter !== "all" ||
                  departmentFilter !== "all" ||
                  employeeFilter !== "all"
                    ? "No documentation matches your filters"
                    : "No documentation has been created yet"}
                </p>
              </CardContent>
            </Card>
          )}
          {/* View Document Dialog */}
          <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
            <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedDoc?.title}</DialogTitle>
                <DialogDescription>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <Badge className={getStatusColor(selectedDoc?.is_draft || false)}>
                      {selectedDoc?.is_draft ? "Draft" : "Published"}
                    </Badge>
                    {selectedDoc?.category && <span className="text-sm">Category: {selectedDoc.category}</span>}
                    <span className="text-sm">
                      By {selectedDoc?.user?.first_name} {selectedDoc?.user?.last_name}
                    </span>
                    <span className="text-sm">{selectedDoc?.created_at && formatDate(selectedDoc.created_at)}</span>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                {selectedDoc?.tags && selectedDoc.tags.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {selectedDoc.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="bg-muted/50 rounded-lg p-4">
                  <MarkdownContent content={selectedDoc?.content || ""} />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </AdminTablePage>
      </TabsContent>

      <TabsContent value="department-documents" className="space-y-4">
        {departmentDocs.enabled ? (
          <DepartmentDocumentsBrowser
            initialPath={departmentDocs.initialPath}
            rootLabel={departmentDocs.rootLabel}
            lockToInitialPath={Boolean(departmentDocs.lockToInitialPath)}
          />
        ) : (
          <Card className="border-2">
            <CardContent className="p-12 text-center">
              <h3 className="text-foreground mb-2 text-xl font-semibold">Department Documents Not Available</h3>
              <p className="text-muted-foreground">No managed department folder is assigned to this account yet.</p>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  )
}
