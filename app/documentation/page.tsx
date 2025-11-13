"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { FileText, Plus, Edit2, Trash2, Save, X, Eye, EyeOff, Search, Tag } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Documentation {
  id: string
  title: string
  content: string
  category?: string
  tags?: string[]
  is_draft: boolean
  created_at: string
  updated_at: string
}

const CATEGORIES = [
  "Project Documentation",
  "Meeting Notes",
  "Process Documentation",
  "Technical Guides",
  "Reports",
  "Training Materials",
  "Other",
]

export default function DocumentationPage() {
  const [docs, setDocs] = useState<Documentation[]>([])
  const [filteredDocs, setFilteredDocs] = useState<Documentation[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<Documentation | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "",
    tags: "",
    is_draft: false,
  })
  const supabase = createClient()

  useEffect(() => {
    loadDocumentation()
  }, [])

  useEffect(() => {
    filterDocumentation()
  }, [docs, searchQuery, categoryFilter])

  const loadDocumentation = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("user_documentation")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })

      if (error) throw error
      setDocs(data || [])
    } catch (error) {
      console.error("Error loading documentation:", error)
      toast.error("Failed to load documentation")
    }
  }

  const filterDocumentation = () => {
    let filtered = docs

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (doc) =>
          doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    // Filter by category
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
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const tags = formData.tags
        ? formData.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : []

      const docData = {
        user_id: user.id,
        title: formData.title,
        content: formData.content,
        category: formData.category || null,
        tags,
        is_draft: isDraft,
        updated_at: new Date().toISOString(),
      }

      if (selectedDoc) {
        // Update existing
        const { error } = await supabase.from("user_documentation").update(docData).eq("id", selectedDoc.id)

        if (error) throw error

        // Log audit
        await supabase.rpc("log_audit", {
          p_action: "update",
          p_entity_type: "documentation",
          p_entity_id: selectedDoc.id,
          p_new_values: docData,
        })

        toast.success("Documentation updated")
      } else {
        // Create new
        const { error } = await supabase.from("user_documentation").insert({
          ...docData,
          created_at: new Date().toISOString(),
        })

        if (error) throw error

        // Log audit
        await supabase.rpc("log_audit", {
          p_action: "create",
          p_entity_type: "documentation",
          p_new_values: docData,
        })

        toast.success("Documentation created")
      }

      setIsDialogOpen(false)
      await loadDocumentation()
    } catch (error) {
      console.error("Error saving documentation:", error)
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

      // Log audit
      await supabase.rpc("log_audit", {
        p_action: "delete",
        p_entity_type: "documentation",
        p_entity_id: selectedDoc.id,
      })

      toast.success("Documentation deleted")
      setIsDeleteDialogOpen(false)
      setSelectedDoc(null)
      await loadDocumentation()
    } catch (error) {
      console.error("Error deleting documentation:", error)
      toast.error("Failed to delete documentation")
    } finally {
      setIsSaving(false)
    }
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

  const getStats = () => {
    return {
      total: docs.length,
      published: docs.filter((d) => !d.is_draft).length,
      draft: docs.filter((d) => d.is_draft).length,
    }
  }

  const stats = getStats()

  return (
    <div className="from-background via-background to-muted/20 min-h-screen bg-gradient-to-br p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-foreground flex items-center gap-3 text-3xl font-bold">
              <FileText className="text-primary h-8 w-8" />
              My Documentation
            </h1>
            <p className="text-muted-foreground mt-2">Create and manage your work documentation</p>
          </div>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            New Document
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Total Documents</p>
                  <p className="text-foreground mt-2 text-3xl font-bold">{stats.total}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Published</p>
                  <p className="text-foreground mt-2 text-3xl font-bold">{stats.published}</p>
                </div>
                <Eye className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Drafts</p>
                  <p className="text-foreground mt-2 text-3xl font-bold">{stats.draft}</p>
                </div>
                <EyeOff className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-2">
          <CardContent className="p-4">
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
          </CardContent>
        </Card>

        {/* Documentation List */}
        {filteredDocs.length > 0 ? (
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
                  <p className="text-muted-foreground line-clamp-3 text-sm">{doc.content}</p>

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
                    <Button size="sm" variant="outline" onClick={() => openEditDialog(doc)} className="flex-1 gap-2">
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
      </div>

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
            <Button variant="outline" onClick={() => handleSave(true)} loading={isSaving} className="gap-2">
              <EyeOff className="h-4 w-4" />
              Save as Draft
            </Button>
            <Button onClick={() => handleSave(false)} loading={isSaving} className="gap-2">
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
            <Button onClick={handleDelete} loading={isSaving} className="bg-red-600 text-white hover:bg-red-700">
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
