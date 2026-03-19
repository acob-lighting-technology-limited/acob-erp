"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Plus, Pencil, Trash2, Users, Search, Eye, Building2, CheckCircle2, Ban } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState, FormFieldGroup, ListToolbar, StatusBadge } from "@/components/ui/patterns"
import { TableSkeleton } from "@/components/ui/query-states"

interface Supplier {
  id: string
  name: string
  code: string
  email: string | null
  phone: string | null
  address: string | null
  contact_person: string | null
  is_active: boolean
  created_at: string
}

async function fetchSuppliersList(): Promise<Supplier[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("suppliers").select("*").order("name")
  if (error) {
    if (error.code === "42P01") {
      return []
    }
    throw new Error(error.message)
  }
  return data || []
}

export default function SuppliersPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Supplier | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    email: "",
    phone: "",
    address: "",
    contact_person: "",
    is_active: true,
  })

  const { data: suppliers = [], isLoading: loading } = useQuery({
    queryKey: QUERY_KEYS.adminSuppliers(),
    queryFn: fetchSuppliersList,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const supabase = createClient()
      const payload = {
        name: formData.name,
        code: formData.code,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        contact_person: formData.contact_person || null,
        is_active: formData.is_active,
      }

      if (editing) {
        const { error } = await supabase.from("suppliers").update(payload).eq("id", editing.id)
        if (error) throw error
        toast.success("Supplier updated")
      } else {
        const { error } = await supabase.from("suppliers").insert(payload)
        if (error) throw error
        toast.success("Supplier created")
      }

      setIsDialogOpen(false)
      setEditing(null)
      setFormData({ name: "", code: "", email: "", phone: "", address: "", contact_person: "", is_active: true })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminSuppliers() })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save")
    }
  }

  async function handleDelete(s: Supplier) {
    try {
      const supabase = createClient()
      const { error } = await supabase.from("suppliers").delete().eq("id", s.id)
      if (error) throw error
      toast.success("Deleted")
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminSuppliers() })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete")
    }
  }

  function openEdit(s: Supplier) {
    setEditing(s)
    setFormData({
      name: s.name,
      code: s.code,
      email: s.email || "",
      phone: s.phone || "",
      address: s.address || "",
      contact_person: s.contact_person || "",
      is_active: s.is_active,
    })
    setIsDialogOpen(true)
  }

  function openCreate() {
    setEditing(null)
    setFormData({ name: "", code: "", email: "", phone: "", address: "", contact_person: "", is_active: true })
    setIsDialogOpen(true)
  }

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const stats = {
    total: suppliers.length,
    active: suppliers.filter((s) => s.is_active).length,
    inactive: suppliers.filter((s) => !s.is_active).length,
  }

  return (
    <AdminTablePage
      title="Suppliers"
      description="Manage your vendors and suppliers"
      icon={Users}
      backLinkHref="/admin/purchasing"
      backLinkLabel="Back to Purchasing"
      actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit" : "Add"} Supplier</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormFieldGroup label="Name *">
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </FormFieldGroup>
                  <FormFieldGroup label="Code *">
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="e.g., SUP-001"
                      required
                    />
                  </FormFieldGroup>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormFieldGroup label="Email">
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </FormFieldGroup>
                  <FormFieldGroup label="Phone">
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </FormFieldGroup>
                </div>
                <FormFieldGroup label="Contact Person">
                  <Input
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  />
                </FormFieldGroup>
                <FormFieldGroup label="Address">
                  <Textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={2}
                  />
                </FormFieldGroup>
                <FormFieldGroup label="Active">
                  <div className="flex items-center justify-end">
                    <Switch
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
          <StatCard title="Total Suppliers" value={stats.total} icon={Building2} />
          <StatCard
            title="Active"
            value={stats.active}
            icon={CheckCircle2}
            iconBgColor="bg-green-100 dark:bg-green-900/30"
            iconColor="text-green-600 dark:text-green-400"
          />
          <StatCard
            title="Inactive"
            value={stats.inactive}
            icon={Ban}
            iconBgColor="bg-slate-200 dark:bg-slate-800"
            iconColor="text-slate-700 dark:text-slate-300"
          />
        </div>
      }
      filters={
        <ListToolbar
          search={
            <div className="relative w-full sm:max-w-md">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search suppliers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          }
        />
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>All Suppliers</CardTitle>
          <CardDescription>{filtered.length} suppliers</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No suppliers yet"
              description="Add your first supplier to start managing vendors."
              icon={Users}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono">{s.code}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.contact_person || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{s.email || "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={s.is_active ? "active" : "inactive"} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/admin/purchasing/suppliers/${s.id}`}>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setPendingDelete(s)}>
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
            <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
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
