"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Users,
  Package,
  User,
  UserPlus,
  X,
} from "lucide-react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Project {
  id: string
  project_name: string
  location: string
  deployment_start_date: string
  deployment_end_date: string
  capacity_w?: number
  technology_type?: string
  description?: string
  status: string
}

interface Staff {
  id: string
  first_name: string
  last_name: string
  company_email: string
  department: string
}

interface ProjectMember {
  id: string
  user_id: string
  role: string
  assigned_at: string
  user: Staff
}

interface ProjectItem {
  id: string
  item_name: string
  description?: string
  quantity: number
  unit?: string
  status: string
  notes?: string
}

export default function AdminProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [staff, setStaff] = useState<Staff[]>([])
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [items, setItems] = useState<ProjectItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Member dialog states
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false)
  const [memberForm, setMemberForm] = useState({
    user_id: "",
    role: "member",
  })

  // Item dialog states
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ProjectItem | null>(null)
  const [itemForm, setItemForm] = useState({
    item_name: "",
    description: "",
    quantity: "1",
    unit: "",
    status: "pending",
    notes: "",
  })

  // Delete dialogs
  const [memberToDelete, setMemberToDelete] = useState<ProjectMember | null>(null)
  const [itemToDelete, setItemToDelete] = useState<ProjectItem | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (projectId) {
      loadProjectData()
    }
  }, [projectId])

  const loadProjectData = async () => {
    try {
      await Promise.all([loadProject(), loadStaff(), loadMembers(), loadItems()])
    } catch (error) {
      console.error("Error loading project data:", error)
      toast.error("Failed to load project data")
    } finally {
      setIsLoading(false)
    }
  }

  const loadProject = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single()

    if (error) throw error
    setProject(data)
  }

  const loadStaff = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, company_email, department")
      .order("last_name", { ascending: true })

    if (error) throw error
    setStaff(data || [])
  }

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from("project_members")
      .select(`
        id,
        user_id,
        role,
        assigned_at,
        user:profiles!project_members_user_id_fkey (
          id,
          first_name,
          last_name,
          company_email,
          department
        )
      `)
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("assigned_at", { ascending: false })

    if (error) throw error
    setMembers((data as any) || [])
  }

  const loadItems = async () => {
    const { data, error } = await supabase
      .from("project_items")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })

    if (error) throw error
    setItems(data || [])
  }

  const handleAddMember = async () => {
    if (!memberForm.user_id) {
      toast.error("Please select a staff member")
      return
    }

    // Check if member already exists
    if (members.some((m) => m.user_id === memberForm.user_id)) {
      toast.error("This member is already assigned to the project")
      return
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { error } = await supabase.from("project_members").insert({
        project_id: projectId,
        user_id: memberForm.user_id,
        role: memberForm.role,
        assigned_by: user.id,
      })

      if (error) throw error

      // Add activity update
      await supabase.from("project_updates").insert({
        project_id: projectId,
        user_id: user.id,
        update_type: "member_added",
        content: `Added member with role: ${memberForm.role}`,
      })

      toast.success("Member added successfully")
      setIsMemberDialogOpen(false)
      setMemberForm({ user_id: "", role: "member" })
      loadMembers()
    } catch (error) {
      console.error("Error adding member:", error)
      toast.error("Failed to add member")
    }
  }

  const handleRemoveMember = async () => {
    if (!memberToDelete) return

    try {
      const { error } = await supabase
        .from("project_members")
        .update({ is_active: false, removed_at: new Date().toISOString() })
        .eq("id", memberToDelete.id)

      if (error) throw error

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        await supabase.from("project_updates").insert({
          project_id: projectId,
          user_id: user.id,
          update_type: "member_removed",
          content: `Removed ${memberToDelete.user.first_name} ${memberToDelete.user.last_name}`,
        })
      }

      toast.success("Member removed successfully")
      setMemberToDelete(null)
      loadMembers()
    } catch (error) {
      console.error("Error removing member:", error)
      toast.error("Failed to remove member")
    }
  }

  const handleOpenItemDialog = (item?: ProjectItem) => {
    if (item) {
      setSelectedItem(item)
      setItemForm({
        item_name: item.item_name,
        description: item.description || "",
        quantity: item.quantity.toString(),
        unit: item.unit || "",
        status: item.status,
        notes: item.notes || "",
      })
    } else {
      setSelectedItem(null)
      setItemForm({
        item_name: "",
        description: "",
        quantity: "1",
        unit: "",
        status: "pending",
        notes: "",
      })
    }
    setIsItemDialogOpen(true)
  }

  const handleSaveItem = async () => {
    if (!itemForm.item_name) {
      toast.error("Please enter item name")
      return
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const itemData = {
        item_name: itemForm.item_name,
        description: itemForm.description || null,
        quantity: parseInt(itemForm.quantity) || 1,
        unit: itemForm.unit || null,
        status: itemForm.status,
        notes: itemForm.notes || null,
      }

      if (selectedItem) {
        const { error } = await supabase
          .from("project_items")
          .update(itemData)
          .eq("id", selectedItem.id)

        if (error) throw error
        toast.success("Item updated successfully")
      } else {
        const { error } = await supabase.from("project_items").insert({
          ...itemData,
          project_id: projectId,
          created_by: user.id,
        })

        if (error) throw error
        toast.success("Item added successfully")
      }

      setIsItemDialogOpen(false)
      loadItems()
    } catch (error) {
      console.error("Error saving item:", error)
      toast.error("Failed to save item")
    }
  }

  const handleDeleteItem = async () => {
    if (!itemToDelete) return

    try {
      const { error } = await supabase.from("project_items").delete().eq("id", itemToDelete.id)

      if (error) throw error

      toast.success("Item deleted successfully")
      setItemToDelete(null)
      loadItems()
    } catch (error) {
      console.error("Error deleting item:", error)
      toast.error("Failed to delete item")
    }
  }

  const getItemStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
      case "ordered":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "received":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      case "installed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  const availableStaff = staff.filter((s) => !members.some((m) => m.user_id === s.id))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading project...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Project not found</h2>
          <Link href="/admin/projects">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/projects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{project.project_name}</h1>
          <p className="text-muted-foreground mt-1">Manage project members and items</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Members ({members.length})
          </TabsTrigger>
          <TabsTrigger value="items" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Items ({items.length})
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Project Members</CardTitle>
                <CardDescription>Manage team members assigned to this project</CardDescription>
              </div>
              <Button onClick={() => setIsMemberDialogOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Member
              </Button>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No members assigned yet. Click "Add Member" to get started.
                </div>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {member.user.first_name} {member.user.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">{member.user.company_email}</p>
                          <p className="text-xs text-muted-foreground">{member.user.department}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{member.role}</Badge>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setMemberToDelete(member)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Project Items</CardTitle>
                <CardDescription>Manage equipment and materials for this project</CardDescription>
              </div>
              <Button onClick={() => handleOpenItemDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No items added yet. Click "Add Item" to get started.
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{item.item_name}</p>
                            <Badge className={getItemStatusColor(item.status)}>{item.status}</Badge>
                          </div>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-muted-foreground">
                              Quantity:{" "}
                              <span className="font-medium text-foreground">{item.quantity}</span>
                              {item.unit && ` ${item.unit}`}
                            </span>
                          </div>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground mt-2">Note: {item.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleOpenItemDialog(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setItemToDelete(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Member Dialog */}
      <Dialog open={isMemberDialogOpen} onOpenChange={setIsMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Project Member</DialogTitle>
            <DialogDescription>Assign a staff member to this project</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user_id">Staff Member</Label>
              <Select
                value={memberForm.user_id}
                onValueChange={(value) => setMemberForm({ ...memberForm, user_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {availableStaff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.first_name} {member.last_name} - {member.department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={memberForm.role}
                onValueChange={(value) => setMemberForm({ ...memberForm, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMemberDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMember}>Add Member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Item Dialog */}
      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedItem ? "Edit Item" : "Add Item"}</DialogTitle>
            <DialogDescription>
              {selectedItem ? "Update item details" : "Add a new item to this project"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="item_name">Item Name</Label>
              <Input
                id="item_name"
                value={itemForm.item_name}
                onChange={(e) => setItemForm({ ...itemForm, item_name: e.target.value })}
                placeholder="Enter item name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={itemForm.description}
                onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                placeholder="Enter item description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Input
                  id="unit"
                  value={itemForm.unit}
                  onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                  placeholder="e.g., pieces, units"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={itemForm.status}
                onValueChange={(value) => setItemForm({ ...itemForm, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="ordered">Ordered</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="installed">Installed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={itemForm.notes}
                onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
                placeholder="Additional notes"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveItem}>{selectedItem ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Member Confirmation */}
      <AlertDialog open={!!memberToDelete} onOpenChange={() => setMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              {memberToDelete && `${memberToDelete.user.first_name} ${memberToDelete.user.last_name}`} from this
              project?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-red-600 hover:bg-red-700">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Item Confirmation */}
      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.item_name}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
