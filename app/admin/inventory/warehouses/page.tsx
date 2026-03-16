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
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Plus, Pencil, Trash2, Warehouse } from "lucide-react"
import { EmptyState, FormFieldGroup } from "@/components/ui/patterns"
import { TableSkeleton } from "@/components/ui/query-states"
import { toast } from "sonner"

import { logger } from "@/lib/logger"

const log = logger("inventory-warehouses")

interface WarehouseData {
  id: string
  name: string
  code: string
  address: string | null
  is_active: boolean
  created_at: string
}

async function fetchWarehousesList(): Promise<WarehouseData[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("warehouses").select("*").order("name")
  if (error && error.code !== "42P01") throw new Error(error.message)
  return data || []
}

export default function WarehousesPage() {
  const queryClient = useQueryClient()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<WarehouseData | null>(null)
  const [formData, setFormData] = useState({ name: "", code: "", address: "", is_active: true })
  const [pendingDelete, setPendingDelete] = useState<WarehouseData | null>(null)

  const { data: warehouses = [], isLoading: loading } = useQuery({
    queryKey: QUERY_KEYS.adminWarehouses(),
    queryFn: fetchWarehousesList,
  })

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
        const { error } = await supabase.from("warehouses").insert({
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
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminWarehouses() })
    } catch (error: any) {
      toast.error(error.message || "Failed to save")
    }
  }

  async function handleDelete(wh: WarehouseData) {
    try {
      const supabase = createClient()
      const { error } = await supabase.from("warehouses").delete().eq("id", wh.id)
      if (error) throw error
      toast.success("Deleted")
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminWarehouses() })
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

  const stats = {
    total: warehouses.length,
    active: warehouses.filter((warehouse) => warehouse.is_active).length,
    inactive: warehouses.filter((warehouse) => !warehouse.is_active).length,
  }

  return (
    <AdminTablePage
      title="Warehouses"
      description="Manage storage locations"
      icon={Warehouse}
      backLinkHref="/admin/inventory"
      backLinkLabel="Back to Inventory"
      actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Warehouse
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit" : "Create"} Warehouse</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormFieldGroup label="Name">
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </FormFieldGroup>
                  <FormFieldGroup label="Code">
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="e.g., WH-001"
                      required
                    />
                  </FormFieldGroup>
                </div>
                <FormFieldGroup label="Address">
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={2}
                  />
                </FormFieldGroup>
                <FormFieldGroup label="Active">
                  <div className="flex items-center justify-end">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                    />
                  </div>
                </FormFieldGroup>
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
      }
      stats={
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4">
          <StatCard title="Warehouses" value={stats.total} icon={Warehouse} />
          <StatCard title="Active" value={stats.active} icon={Warehouse} />
          <StatCard title="Inactive" value={stats.inactive} icon={Warehouse} />
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>All Warehouses</CardTitle>
          <CardDescription>{warehouses.length} locations</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : warehouses.length === 0 ? (
            <EmptyState title="No warehouses yet" icon={Warehouse} description="Add your first warehouse location." />
          ) : (
            <div className="overflow-x-auto">
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
                          <Button variant="ghost" size="icon" onClick={() => setPendingDelete(wh)}>
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

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Warehouse</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `Delete "${pendingDelete.name}"?` : "Are you sure?"} This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) handleDelete(pendingDelete)
                setPendingDelete(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminTablePage>
  )
}
