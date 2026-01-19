"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Plus, Pencil, Trash2, Boxes } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface Category {
  id: string
  name: string
  description: string | null
  product_count?: number
  created_at: string
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({ name: "", description: "" })

  useEffect(() => {
    fetchCategories()
  }, [])

  async function fetchCategories() {
    try {
      const supabase = createClient()

      const { data, error } = await supabase.from("product_categories").select("*").order("name")

      if (error) {
        if (error.code === "42P01") {
          setCategories([])
          return
        }
        throw error
      }

      // Get product counts
      const catsWithCounts = await Promise.all(
        (data || []).map(async (cat) => {
          const { count } = await supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("category_id", cat.id)
          return { ...cat, product_count: count || 0 }
        })
      )

      setCategories(catsWithCounts)
    } catch (error) {
      console.error("Error fetching categories:", error)
      toast.error("Failed to load categories")
    } finally {
      setLoading(false)
    }
  }

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
      fetchCategories()
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
      fetchCategories()
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

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/admin/inventory" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold">Categories</h1>
          </div>
          <p className="text-muted-foreground">Organize products by category</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Categories</CardTitle>
          <CardDescription>{categories.length} categories</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Boxes className="text-muted-foreground mb-4 h-12 w-12" />
              <h3 className="font-semibold">No categories yet</h3>
              <p className="text-muted-foreground text-sm">Create your first category.</p>
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
