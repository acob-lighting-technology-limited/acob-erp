"use client"

import { useCallback, useEffect, useState } from "react"
import { BookOpen, Loader2, Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react"
import { toast } from "sonner"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type Competency = {
  id: string
  key: string
  label: string
  description: string | null
  category: "behaviour" | "leadership" | "core"
  is_active: boolean
  sort_order: number
  created_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  behaviour: "Behaviour",
  leadership: "Leadership",
  core: "Core",
}

const CATEGORY_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  behaviour: "default",
  leadership: "secondary",
  core: "outline",
}

export default function AdminCompetenciesPage() {
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selected, setSelected] = useState<Competency | null>(null)

  // Form state
  const [key, setKey] = useState("")
  const [label, setLabel] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<"behaviour" | "leadership" | "core">("behaviour")
  const [sortOrder, setSortOrder] = useState("0")

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/hr/performance/competencies")
      const data = (await res.json().catch(() => ({}))) as { data?: Competency[] }
      setCompetencies(data.data || [])
    } catch {
      toast.error("Failed to load competencies")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setKey("")
    setLabel("")
    setDescription("")
    setCategory("behaviour")
    setSortOrder("0")
    setIsCreateOpen(true)
  }

  function openEdit(c: Competency) {
    setSelected(c)
    setLabel(c.label)
    setDescription(c.description || "")
    setCategory(c.category)
    setSortOrder(String(c.sort_order))
    setIsEditOpen(true)
  }

  function openDelete(c: Competency) {
    setSelected(c)
    setIsDeleteOpen(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!key || !label) {
      toast.error("Key and label are required")
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/hr/performance/competencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          label,
          description: description || null,
          category,
          sort_order: Number(sortOrder) || 0,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) throw new Error(data.error || "Failed to create")
      toast.success(data.message || "Competency created")
      setIsCreateOpen(false)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/hr/performance/competencies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          label,
          description: description || null,
          category,
          sort_order: Number(sortOrder) || 0,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) throw new Error(data.error || "Failed to update")
      toast.success(data.message || "Competency updated")
      setIsEditOpen(false)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleToggleActive(c: Competency) {
    try {
      const res = await fetch("/api/hr/performance/competencies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, is_active: !c.is_active }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Failed to update")
      toast.success(`Competency ${!c.is_active ? "activated" : "deactivated"}`)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    }
  }

  async function handleDelete() {
    if (!selected) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/hr/performance/competencies?id=${selected.id}`, { method: "DELETE" })
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) throw new Error(data.error || "Failed to delete")
      toast.success(data.message || "Competency deleted")
      setIsDeleteOpen(false)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeCount = competencies.filter((c) => c.is_active).length

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Competency Frameworks"
        description="Manage the behaviour competencies used in performance reviews."
        icon={BookOpen}
        backLink={{ href: "/admin/hr/pms", label: "Back to PMS" }}
        actions={
          <Button onClick={openCreate} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Competency
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Competencies</CardTitle>
          <CardDescription>
            {activeCount} active · {competencies.length} total — these keys appear as scoring fields on every
            performance review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-10">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : competencies.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No competencies found. Add one to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
                  <TableRow>
                    <TableHead className="w-8">Order</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competencies.map((c) => (
                    <TableRow key={c.id} className={!c.is_active ? "opacity-50" : ""}>
                      <TableCell className="text-muted-foreground text-center">{c.sort_order}</TableCell>
                      <TableCell>
                        <code className="bg-muted rounded px-1 py-0.5 text-xs">{c.key}</code>
                      </TableCell>
                      <TableCell className="font-medium">{c.label}</TableCell>
                      <TableCell>
                        <Badge variant={CATEGORY_VARIANTS[c.category] || "outline"}>
                          {CATEGORY_LABELS[c.category] || c.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[240px] truncate text-sm">
                        {c.description || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.is_active ? "default" : "outline"}>
                          {c.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={c.is_active ? "Deactivate" : "Activate"}
                            onClick={() => void handleToggleActive(c)}
                          >
                            {c.is_active ? (
                              <ToggleRight className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <ToggleLeft className="text-muted-foreground h-4 w-4" />
                            )}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openDelete(c)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Competency</DialogTitle>
            <DialogDescription>
              Define a new competency that will appear as a scoring field on performance reviews.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Key *</Label>
                <Input
                  placeholder="e.g. problem_solving"
                  value={key}
                  onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                  required
                />
                <p className="text-muted-foreground text-xs">
                  Lowercase, underscores only. Cannot be changed after creation.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Label *</Label>
                <Input
                  placeholder="e.g. Problem Solving"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as "behaviour" | "leadership" | "core")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="behaviour">Behaviour</SelectItem>
                    <SelectItem value="leadership">Leadership</SelectItem>
                    <SelectItem value="core">Core</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Short explanation of this competency…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Competency
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Competency</DialogTitle>
            <DialogDescription>
              Updating <code className="bg-muted rounded px-1">{selected?.key}</code> — the key itself cannot be
              changed.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleEdit(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Label *</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as "behaviour" | "leadership" | "core")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="behaviour">Behaviour</SelectItem>
                    <SelectItem value="leadership">Leadership</SelectItem>
                    <SelectItem value="core">Core</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Competency</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{selected?.label}</strong> (key: <code>{selected?.key}</code>).
              Existing reviews that already have scores for this key will retain those values, but no new reviews will
              include this field.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageWrapper>
  )
}
