"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/ui/stat-card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Pencil, Trash2, Boxes } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/ui/patterns"
import { TableSkeleton } from "@/components/ui/query-states"

import { logger } from "@/lib/logger"

const log = logger("inventory-categories")

interface Category {
  id: string
  name: string
  description: string | null
  product_count?: number
  created_at: string
}

async function fetchCategoriesList(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("product_categories").select("*").order("name")

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    throw new Error(error.message)
  }

  const catsWithCounts = await Promise.all(
    (data || []).map(async (cat) => {
      const { count } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("category_id", cat.id)
      return { ...cat, product_count: count || 0 }
    })
  )

  return catsWithCounts
}

export default function CategoriesPage() {
  const queryClient = useQueryClient()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({ name: "", description: "" })

  const { data: categories = [], isLoading: loading } = useQuery({
    queryKey: QUERY_KEYS.adminCategories(),
    queryFn: fetchCategoriesList,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const supabase = createClient()

      if (editingCategory) {
        const { error } = await supabase
          .from("product_categories")
          .update({ name: formData.name, description: formData.description || null })
          .eq("id", editingCategory.id)
        if (error) throw error
        toast.success("Category updated")
      } else {
        const { error } = await supabase
          .from("product_categories")
          .insert({ name: formData.name, description: formData.description || null })
        if (error) throw error
        toast.success("Category created")
      }

      setIsDialogOpen(false)
      setEditingCategory(null)
      setFormData({ name: "", description: "" })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminCategories() })
    } catch (error: any) {
      toast.error(error.message || "Failed to save category")
    }
  }

  async function handleDelete(cat: Category) {
    if (!confirm(`Delete "${cat.name}"?`)) return

    try {
      const supabase = createClient()
      const { error } = await supabase.from("product_categories").delete().eq("id", cat.id)
      if (error) throw error
      toast.success("Category deleted")
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminCategories() })
    } catch (error: any) {
      toast.error(error.message || "Failed to delete")
    }
  }

  function openEdit(cat: Category) {
    setEditingCategory(cat)
    setFormData({ name: cat.name, description: cat.description || "" })
    setIsDialogOpen(true)
  }

  function openCreate() {
    setEditingCategory(null)
    setFormData({ name: "", description: "" })
    setIsDialogOpen(true)
  }

  const stats = {
    categories: categories.length,
    mappedProducts: categories.reduce((acc, category) => acc + (category.product_count || 0), 0),
  }

  return (
    <AdminTablePage
      title="Categories"
      description="Organize products by category"
      icon={Boxes}
      backLinkHref="/admin/inventory"
      backLinkLabel="Back to Inventory"
      stats={
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4">
          <StatCard title="Categories" value={stats.categories} icon={Boxes} />
          <StatCard title="Mapped Products" value={stats.mappedProducts} icon={Plus} />
        </div>
      }
      actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingCategory ? "Edit" : "Create"} Category</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">{editingCategory ? "Update" : "Create"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {/* Migrated list layout now uses shared admin table shell + stat cards */}
      <Card>
        <CardHeader>
          <CardTitle>All Categories</CardTitle>
          <CardDescription>{categories.length} categories</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={5} cols={3} />
          ) : categories.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="No categories yet"
              description="Create your first category to organize products."
              action={
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Category
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell className="text-muted-foreground">{cat.description || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{cat.product_count}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(cat)}
                            disabled={(cat.product_count ?? 0) > 0}
                          >
                            <Trash2 className="text-destructive h-4 w-4" />
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
    </AdminTablePage>
  )
}
