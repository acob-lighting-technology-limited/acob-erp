"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"
import { writeAuditLogClient } from "@/lib/audit/client"
import { toast } from "sonner"
import { FileText, Plus, Edit2, Trash2, Save, Eye, EyeOff, Search, Tag, LayoutGrid, List } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { Documentation } from "./page"
import { AppTablePage } from "@/components/app/app-table-page"
import { MarkdownContent } from "@/components/ui/markdown-content"
import { DepartmentDocumentsBrowser } from "@/components/documentation/department-documents-browser"

import { logger } from "@/lib/logger"

const log = logger("documentation-documentation-content")


const CATEGORIES = [
  "Project Documentation",
  "Meeting Notes",
  "Process Documentation",
  "Technical Guides",
  "Reports",
  "Training Materials",
  "Other",
]

interface DocumentationContentProps {
  initialDocs: Documentation[]
  userId: string
  departmentDocs: {
    initialPath: string
    rootLabel: string
    enabled: boolean
  }
  defaultTab?: "knowledge-docs" | "department-documents"
  hideTabList?: boolean
  backLinkHref?: string
  backLinkLabel?: string
}

export function DocumentationContent({
  initialDocs,
  userId,
  departmentDocs,
  defaultTab,
  hideTabList = false,
  backLinkHref = "/profile",
  backLinkLabel = "Back to Dashboard",
}: DocumentationContentProps) {
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get("tab")
  const initialTab = defaultTab || (tabFromUrl === "department-documents" ? "department-documents" : "knowledge-docs")
  const [activeTab, setActiveTab] = useState<"knowledge-docs" | "department-documents">(
    initialTab as "knowledge-docs" | "department-documents"
  )
  const [docs, setDocs] = useState<Documentation[]>(initialDocs)
  const [filteredDocs, setFilteredDocs] = useState<Documentation[]>(initialDocs)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<Documentation | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "",
    tags: "",
    is_draft: false,
  })
  const supabase = createClient()

  useEffect(() => {
    filterDocumentation()
  }, [docs, searchQuery, categoryFilter])

  const loadDocumentation = async () => {
    try {
      const { data, error } = await supabase
        .from("user_documentation")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })

      if (error) throw error
      setDocs(data || [])
    } catch (error) {
      log.error("Error loading documentation:", error)
      toast.error("Failed to load documentation")
    }
  }

  const filterDocumentation = () => {
    let filtered = docs

    if (searchQuery) {
      filtered = filtered.filter(
        (doc) =>
          doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    if (categoryFilter !== "all") {
      if (categoryFilter === "draft") {
        filtered = filtered.filter((doc) => doc.is_draft)
      } else if (categoryFilter === "published") {
        filtered = filtered.filter((doc) => !doc.is_draft)
      } else {
        filtered = filtered.filter((doc) => doc.category === categoryFilter)
      }
    }

    setFilteredDocs(filtered)
  }

  const openCreateDialog = () => {
    setSelectedDoc(null)
    setFormData({
      title: "",
      content: "",
      category: "",
      tags: "",
      is_draft: false,
    })
    setIsDialogOpen(true)
  }

  const openEditDialog = (doc: Documentation) => {
    setSelectedDoc(doc)
    setFormData({
      title: doc.title,
      content: doc.content,
      category: doc.category || "",
      tags: doc.tags?.join(", ") || "",
      is_draft: doc.is_draft,
    })
    setIsDialogOpen(true)
  }

  const handleSave = async (isDraft: boolean) => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error("Title and content are required")
      return
    }

    setIsSaving(true)
    try {
      const tags = formData.tags
        ? formData.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : []

      const docData = {
        user_id: userId,
        title: formData.title,
        content: formData.content,
        category: formData.category || null,
        tags,
        is_draft: isDraft,
        updated_at: new Date().toISOString(),
      }

      if (selectedDoc) {
        const { error } = await supabase.from("user_documentation").update(docData).eq("id", selectedDoc.id)

        if (error) throw error

        await writeAuditLogClient(
          supabase as any,
          {
            action: "update",
            entityType: "documentation",
            entityId: selectedDoc.id,
            newValues: docData,
            context: {
              source: "ui",
              route: "/documentation",
              actorId: userId,
            },
          },
          { failOpen: true }
        )

        toast.success("Documentation updated")
      } else {
        const { data: createdDoc, error } = await supabase
          .from("user_documentation")
          .insert({
            ...docData,
            created_at: new Date().toISOString(),
          })
          .select("id")
          .single()

        if (error) throw error

        await writeAuditLogClient(
          supabase as any,
          {
            action: "create",
            entityType: "documentation",
            entityId: createdDoc.id,
            newValues: docData,
            context: {
              source: "ui",
              route: "/documentation",
              actorId: userId,
            },
          },
          { failOpen: true }
        )

        toast.success("Documentation created")
      }

      setIsDialogOpen(false)
      await loadDocumentation()
    } catch (error) {
      log.error("Error saving documentation:", error)
      toast.error("Failed to save documentation")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedDoc) return

    setIsSaving(true)
    try {
      const { error } = await supabase.from("user_documentation").delete().eq("id", selectedDoc.id)

      if (error) throw error

      await writeAuditLogClient(
        supabase as any,
        {
          action: "delete",
          entityType: "documentation",
          entityId: selectedDoc.id,
          oldValues: {
            title: selectedDoc.title,
            category: selectedDoc.category,
          },
          context: {
            source: "ui",
            route: "/documentation",
            actorId: userId,
          },
        },
        { failOpen: true }
      )

      toast.success("Documentation deleted")
      setIsDeleteDialogOpen(false)
      setSelectedDoc(null)
      await loadDocumentation()
    } catch (error) {
      log.error("Error deleting documentation:", error)
      toast.error("Failed to delete documentation")
    } finally {
      setIsSaving(false)
    }
  }

  const handleViewDocument = (doc: Documentation) => {
    setSelectedDoc(doc)
    setIsViewDialogOpen(true)
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

  const stats = {
    total: docs.length,
    published: docs.filter((d) => !d.is_draft).length,
    draft: docs.filter((d) => d.is_draft).length,
  }

  const getStatusColor = (isDraft: boolean) =>
    isDraft
      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"

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
        <AppTablePage
          title="My Documentation"
          description="Create and manage your work documentation"
          icon={FileText}
          backLinkHref={backLinkHref}
          backLinkLabel={backLinkLabel}
          actions={
            <div className="flex items-center gap-2">
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
              <Button onClick={openCreateDialog} className="gap-2">
                <Plus className="h-4 w-4" />
                New Document
              </Button>
            </div>
          }
          stats={
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4">
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
                    <FileText className="h-5 w-5 shrink-0 text-blue-600 sm:h-6 sm:w-6 md:h-8 md:w-8 dark:text-blue-400" />
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
                    <Eye className="h-5 w-5 shrink-0 text-green-600 sm:h-6 sm:w-6 md:h-8 md:w-8 dark:text-green-400" />
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
                        {stats.draft}
                      </p>
                    </div>
                    <EyeOff className="h-5 w-5 shrink-0 text-yellow-600 sm:h-6 sm:w-6 md:h-8 md:w-8 dark:text-yellow-400" />
                  </div>
                </CardContent>
              </Card>
            </div>
          }
          filters={
            <div className="flex flex-wrap gap-4">
              <div className="min-w-[200px] flex-1">
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                  <Input
                    placeholder="Search documentation..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Documents</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Drafts</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        >
          {/* Documentation List */}
          {filteredDocs.length > 0 ? (
            viewMode === "list" ? (
              <Card className="border-2">
                <CardContent className="p-6">
                  <div className="table-responsive">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Updated</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDocs.map((doc, index) => (
                          <TableRow key={doc.id}>
                            <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
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
                              {formatDate(doc.updated_at)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(doc)}
                                  className="h-8 w-8 gap-1 p-0 sm:h-auto sm:w-auto sm:gap-2 sm:p-2"
                                  title="Edit document"
                                >
                                  <Edit2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                  <span className="hidden sm:inline">Edit</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedDoc(doc)
                                    setIsDeleteDialogOpen(true)
                                  }}
                                  className="h-8 w-8 gap-1 p-0 text-red-600 hover:text-red-700 sm:h-auto sm:w-auto sm:gap-2 sm:p-2"
                                  title="Delete document"
                                >
                                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                  <span className="hidden sm:inline">Delete</span>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredDocs.map((doc) => (
                  <Card key={doc.id} className="border-2 shadow-md transition-all hover:shadow-lg">
                    <CardHeader className="from-primary/5 to-background border-b bg-gradient-to-r">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            {doc.title}
                            {doc.is_draft && (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30">
                                Draft
                              </Badge>
                            )}
                          </CardTitle>
                          {doc.category && <CardDescription className="mt-1">{doc.category}</CardDescription>}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 p-6">
                      <div className="max-h-48 overflow-auto rounded-md border p-3">
                        <MarkdownContent content={doc.content} />
                      </div>

                      {doc.tags && doc.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {doc.tags.map((tag, i) => (
                            <Badge key={i} variant="outline" className="gap-1">
                              <Tag className="h-3 w-3" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="text-muted-foreground text-xs">Last updated: {formatDate(doc.updated_at)}</div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDocument(doc)}
                          className="flex-1 gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(doc)}
                          className="flex-1 gap-2"
                        >
                          <Edit2 className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedDoc(doc)
                            setIsDeleteDialogOpen(true)
                          }}
                          className="gap-2 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
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
                <FileText className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
                <h3 className="text-foreground mb-2 text-xl font-semibold">
                  {searchQuery || categoryFilter !== "all" ? "No documents found" : "No documentation yet"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || categoryFilter !== "all"
                    ? "Try adjusting your filters or search query"
                    : "Create your first document to get started"}
                </p>
                {!searchQuery && categoryFilter === "all" && (
                  <Button onClick={openCreateDialog} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Document
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

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
                    <span className="text-sm">{selectedDoc?.updated_at && formatDate(selectedDoc.updated_at)}</span>
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

          {/* Create/Edit Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{selectedDoc ? "Edit Document" : "Create New Document"}</DialogTitle>
                <DialogDescription>
                  {selectedDoc ? "Update your documentation" : "Create a new work document"}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title *</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Document title..."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tags (comma separated)</label>
                    <Input
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      placeholder="tag1, tag2, tag3"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Content *</label>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Write your documentation here..."
                    className="min-h-[300px] text-base"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button variant="outline" onClick={() => handleSave(true)} disabled={isSaving} className="gap-2">
                  <EyeOff className="h-4 w-4" />
                  Save as Draft
                </Button>
                <Button onClick={() => handleSave(false)} disabled={isSaving} className="gap-2">
                  <Save className="h-4 w-4" />
                  Publish
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
                  This will permanently delete "{selectedDoc?.title}". This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
                <Button onClick={handleDelete} disabled={isSaving} className="bg-red-600 text-white hover:bg-red-700">
                  Delete
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </AppTablePage>
      </TabsContent>

      <TabsContent value="department-documents" className="space-y-4">
        {departmentDocs.enabled ? (
          <DepartmentDocumentsBrowser initialPath={departmentDocs.initialPath} rootLabel={departmentDocs.rootLabel} />
        ) : (
          <Card className="border-2">
            <CardContent className="p-12 text-center">
              <h3 className="text-foreground mb-2 text-xl font-semibold">Department Documents Not Available</h3>
              <p className="text-muted-foreground">
                Your account is not assigned to a department yet. Contact HR or an administrator.
              </p>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  )
}
