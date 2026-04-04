"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { writeAuditLogClient } from "@/lib/audit/client"
import { toast } from "sonner"
import { FileText, Plus } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Documentation } from "./page"
import { AppTablePage } from "@/components/app/app-table-page"
import { DepartmentDocumentsBrowser } from "@/components/documentation/department-documents-browser"
import { DocStatsCards } from "@/components/documentation/doc-stats-cards"
import { DocFilterBar } from "@/components/documentation/doc-filter-bar"
import { DocListView } from "@/components/documentation/doc-list-view"
import { DocCardView } from "@/components/documentation/doc-card-view"
import { DocViewDialog } from "@/components/documentation/doc-view-dialog"
import { DocFormDialog, type DocFormData } from "@/components/documentation/doc-form-dialog"
import { DocDeleteDialog } from "@/components/documentation/doc-delete-dialog"
import { DocViewToggle } from "@/components/documentation/doc-view-toggle"
import { DocEmptyState } from "@/components/documentation/doc-empty-state"

import { logger } from "@/lib/logger"

const log = logger("documentation-documentation-content")

interface DocumentationContentProps {
  initialDocs: Documentation[]
  userId: string
  departmentDocs: {
    initialPath: string
    rootLabel: string
    enabled: boolean
    lockToInitialPath: boolean
    accessMode: "self" | "admin"
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
  const [formData, setFormData] = useState<DocFormData>({
    title: "",
    content: "",
    category: "",
    tags: "",
    is_draft: false,
  })
  const supabase = createClient()

  useEffect(() => {
    filterDocumentation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setFormData({ title: "", content: "", category: "", tags: "", is_draft: false })
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

      const auditCtx = { source: "ui" as const, route: "/documentation", actorId: userId }
      if (selectedDoc) {
        const { error } = await supabase.from("user_documentation").update(docData).eq("id", selectedDoc.id)
        if (error) throw error
        await writeAuditLogClient(
          supabase,
          {
            action: "update",
            entityType: "documentation",
            entityId: selectedDoc.id,
            newValues: docData,
            context: auditCtx,
          },
          { failOpen: true }
        )
        toast.success("Documentation updated")
      } else {
        const { data: createdDoc, error } = await supabase
          .from("user_documentation")
          .insert({ ...docData, created_at: new Date().toISOString() })
          .select("id")
          .single()
        if (error) throw error
        await writeAuditLogClient(
          supabase,
          {
            action: "create",
            entityType: "documentation",
            entityId: createdDoc.id,
            newValues: docData,
            context: auditCtx,
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
        supabase,
        {
          action: "delete",
          entityType: "documentation",
          entityId: selectedDoc.id,
          oldValues: { title: selectedDoc.title, category: selectedDoc.category },
          context: { source: "ui", route: "/documentation", actorId: userId },
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

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

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
              <DocViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
              <Button onClick={openCreateDialog} className="gap-2">
                <Plus className="h-4 w-4" />
                New Document
              </Button>
            </div>
          }
          stats={<DocStatsCards total={stats.total} published={stats.published} draft={stats.draft} />}
          filters={
            <DocFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
            />
          }
        >
          {filteredDocs.length > 0 ? (
            viewMode === "list" ? (
              <DocListView
                docs={filteredDocs}
                getStatusColor={getStatusColor}
                formatDate={formatDate}
                onView={(doc) => {
                  setSelectedDoc(doc)
                  setIsViewDialogOpen(true)
                }}
                onEdit={openEditDialog}
                onDelete={(doc) => {
                  setSelectedDoc(doc)
                  setIsDeleteDialogOpen(true)
                }}
              />
            ) : (
              <DocCardView
                docs={filteredDocs}
                formatDate={formatDate}
                onView={(doc) => {
                  setSelectedDoc(doc)
                  setIsViewDialogOpen(true)
                }}
                onEdit={openEditDialog}
                onDelete={(doc) => {
                  setSelectedDoc(doc)
                  setIsDeleteDialogOpen(true)
                }}
              />
            )
          ) : (
            <DocEmptyState hasFilters={!!(searchQuery || categoryFilter !== "all")} onCreateClick={openCreateDialog} />
          )}

          <DocViewDialog
            open={isViewDialogOpen}
            onOpenChange={setIsViewDialogOpen}
            doc={selectedDoc}
            getStatusColor={getStatusColor}
            formatDate={formatDate}
          />

          <DocFormDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            isEditing={!!selectedDoc}
            formData={formData}
            onFormChange={setFormData}
            onSave={handleSave}
            isSaving={isSaving}
          />

          <DocDeleteDialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            docTitle={selectedDoc?.title}
            onConfirm={handleDelete}
            isSaving={isSaving}
          />
        </AppTablePage>
      </TabsContent>

      <TabsContent value="department-documents" className="space-y-4">
        {departmentDocs.enabled ? (
          <DepartmentDocumentsBrowser
            initialPath={departmentDocs.initialPath}
            rootLabel={departmentDocs.rootLabel}
            lockToInitialPath={departmentDocs.lockToInitialPath}
            accessMode={departmentDocs.accessMode}
          />
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
