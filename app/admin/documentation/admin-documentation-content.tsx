"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, List, LayoutGrid } from "lucide-react"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { DepartmentDocumentsBrowser } from "@/components/documentation/department-documents-browser"
import { AdminDocStatsCards } from "@/components/documentation/admin-doc-stats-cards"
import { AdminDocFilterBar } from "@/components/documentation/admin-doc-filter-bar"
import { AdminDocListView } from "@/components/documentation/admin-doc-list-view"
import { AdminDocCardGrid } from "@/components/documentation/admin-doc-card-grid"
import { AdminDocViewDialog } from "@/components/documentation/admin-doc-view-dialog"
import type { AdminDocumentation, UserProfile, employeeMember } from "@/components/documentation/admin-doc-types"

// Re-export types for consumers of this module
export type { UserProfile, employeeMember }
export type Documentation = AdminDocumentation

interface AdminDocumentationContentProps {
  initialDocumentation: AdminDocumentation[]
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

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

const getStatusColor = (isDraft: boolean) =>
  isDraft
    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
    : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"

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
  const [documentation] = useState<AdminDocumentation[]>(initialDocumentation)
  const [employee] = useState<employeeMember[]>(initialemployee)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [employeeFilter, setEmployeeFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const [selectedDoc, setSelectedDoc] = useState<AdminDocumentation | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)

  const handleViewDocument = (doc: AdminDocumentation) => {
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

    const matchesEmployee = employeeFilter === "all" || doc.user_id === employeeFilter

    return matchesSearch && matchesCategory && matchesStatus && matchesDepartment && matchesEmployee
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
            <AdminDocStatsCards
              total={stats.total}
              published={stats.published}
              drafts={stats.drafts}
              thisMonth={stats.thisMonth}
            />
          }
          filters={
            <AdminDocFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
              categories={categories}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              departmentFilter={departmentFilter}
              onDepartmentChange={setDepartmentFilter}
              departments={departments}
              employeeFilter={employeeFilter}
              onEmployeeChange={setEmployeeFilter}
              employees={employee}
              userProfile={userProfile}
            />
          }
          filtersInCard={false}
        >
          {filteredDocumentation.length > 0 ? (
            viewMode === "list" ? (
              <AdminDocListView
                docs={filteredDocumentation}
                getStatusColor={getStatusColor}
                formatDate={formatDate}
                onView={handleViewDocument}
              />
            ) : (
              <AdminDocCardGrid
                docs={filteredDocumentation}
                getStatusColor={getStatusColor}
                formatDate={formatDate}
                onView={handleViewDocument}
              />
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

          <AdminDocViewDialog
            open={isViewDialogOpen}
            onOpenChange={setIsViewDialogOpen}
            doc={selectedDoc}
            getStatusColor={getStatusColor}
            formatDate={formatDate}
          />
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
