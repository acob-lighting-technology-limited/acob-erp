"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Plus, Pencil, Trash2, Warehouse } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface WarehouseData {
  id: string
  name: string
  code: string
  address: string | null
  is_active: boolean
  created_at: string
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<WarehouseData | null>(null)
  const [formData, setFormData] = useState({ name: "", code: "", address: "", is_active: true })

  useEffect(() => {
    fetchWarehouses()
  }, [])

  async function fetchWarehouses() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from("warehouses").select("*").order("name")
      if (error && error.code !== "42P01") throw error
      setWarehouses(data || [])
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to load warehouses")
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const supabase = createClient()
      if (editing) {
        const { error } = await supabase
          .from("warehouses")
          .update({
            name: formData.name,
            code: formData.code,
            address: formData.address || null,
            is_active: formData.is_active,
          })
          .eq("id", editing.id)
        if (error) throw error
        toast.success("Warehouse updated")
      } else {
        const { error } = await supabase
          .from("warehouses")
          .insert({
            name: formData.name,
            code: formData.code,
            address: formData.address || null,
            is_active: formData.is_active,
          })
        if (error) throw error
        toast.success("Warehouse created")
      }
      setIsDialogOpen(false)
      setEditing(null)
      setFormData({ name: "", code: "", address: "", is_active: true })
      fetchWarehouses()
    } catch (error: any) {
      toast.error(error.message || "Failed to save")
    }
  }

  async function handleDelete(wh: WarehouseData) {
    if (!confirm(`Delete "${wh.name}"?`)) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from("warehouses").delete().eq("id", wh.id)
      if (error) throw error
      toast.success("Deleted")
      fetchWarehouses()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  function openEdit(wh: WarehouseData) {
    setEditing(wh)
    setFormData({ name: wh.name, code: wh.code, address: wh.address || "", is_active: wh.is_active })
    setIsDialogOpen(true)
  }

  function openCreate() {
    setEditing(null)
    setFormData({ name: "", code: "", address: "", is_active: true })
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
            <h1 className="text-3xl font-bold">Warehouses</h1>
          </div>
          <p className="text-muted-foreground">Manage storage locations</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Warehouse
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit" : "Create"} Warehouse</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
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
                    <Label htmlFor="code">Code</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="e.g., WH-001"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Active</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">{editing ? "Update" : "Create"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Warehouses</CardTitle>
          <CardDescription>{warehouses.length} locations</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
            </div>
          ) : warehouses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Warehouse className="text-muted-foreground mb-4 h-12 w-12" />
              <h3 className="font-semibold">No warehouses yet</h3>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.map((wh) => (
                  <TableRow key={wh.id}>
                    <TableCell className="font-mono">{wh.code}</TableCell>
                    <TableCell className="font-medium">{wh.name}</TableCell>
                    <TableCell className="text-muted-foreground">{wh.address || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={wh.is_active ? "default" : "secondary"}>
                        {wh.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(wh)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(wh)}>
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
