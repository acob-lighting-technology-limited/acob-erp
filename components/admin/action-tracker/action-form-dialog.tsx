"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, Plus, Save, Trash2, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getCurrentISOWeek } from "@/lib/utils"

interface ActionFormDialogProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  departments: string[]
  editingAction?: any | null
  defaultDept?: string
  defaultWeek?: number
  defaultYear?: number
}

export function ActionFormDialog({
  isOpen,
  onClose,
  onComplete,
  departments,
  editingAction,
  defaultDept,
  defaultWeek,
  defaultYear,
}: ActionFormDialogProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [dept, setDept] = useState("")
  const [week, setWeek] = useState(getCurrentISOWeek())
  const [year, setYear] = useState(new Date().getFullYear())

  // For Bulk Entry
  const [actionItems, setActionItems] = useState<string[]>([])
  const [newItem, setNewItem] = useState("")

  // For Single Edit
  const [singleData, setSingleData] = useState({
    title: "",
    description: "",
    priority: "medium",
    status: "pending",
    due_date: "",
  })

  useEffect(() => {
    if (editingAction) {
      setSingleData({
        title: editingAction.title || "",
        description: editingAction.description || "",
        priority: editingAction.priority || "medium",
        status: editingAction.status || "pending",
        due_date: editingAction.due_date ? new Date(editingAction.due_date).toISOString().split("T")[0] : "",
      })
      setDept(editingAction.department)
      setWeek(editingAction.week_number)
      setYear(editingAction.year)
    } else {
      setDept(defaultDept || departments[0] || "")
      setActionItems([])
      setNewItem("")
      setWeek(defaultWeek || getCurrentISOWeek())
      setYear(defaultYear || new Date().getFullYear())
    }
  }, [editingAction, isOpen, defaultDept, departments, defaultWeek, defaultYear])

  const addActionItem = () => {
    if (!newItem.trim()) return
    setActionItems([...actionItems, newItem.trim()])
    setNewItem("")
  }

  const removeActionItem = (index: number) => {
    setActionItems(actionItems.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    // Validation
    if (!dept) {
      toast.error("Please select a department")
      return
    }

    if (editingAction) {
      if (!singleData.title.trim()) {
        toast.error("Action title is required")
        return
      }
    } else if (actionItems.length === 0 && !newItem.trim()) {
      toast.error("Please add at least one action")
      return
    }

    setIsSaving(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const finalItems = editingAction ? [singleData.title] : [...actionItems]
      if (!editingAction && newItem.trim()) {
        finalItems.push(newItem.trim())
      }

      if (editingAction) {
        // Update single
        const { error } = await supabase
          .from("tasks")
          .update({
            title: singleData.title,
            description: singleData.description,
            department: dept,
            priority: singleData.priority,
            status: singleData.status,
            due_date: singleData.due_date || null,
            week_number: week,
            year: year,
          })
          .eq("id", editingAction.id)
        if (error) throw error
        toast.success("Action updated")
      } else {
        // Insert bulk
        const payloads = finalItems.map((title) => ({
          title,
          department: dept,
          category: "weekly_action",
          priority: "medium",
          status: "pending",
          week_number: week,
          year: year,
          assigned_by: user.id,
        }))

        const { error } = await supabase.from("tasks").insert(payloads)
        if (error) throw error
        toast.success(`Created ${payloads.length} actions`)

        // Notify Department Members
        const { data: deptMembers } = await supabase
          .from("profiles")
          .select("id")
          .eq("department", dept)
          .neq("id", user.id) // Don't notify self

        if (deptMembers && deptMembers.length > 0) {
          const { createNotification } = await import("@/lib/notifications")

          // If bulk, send one summary or multiple?
          // Sending one summary is better to avoid spam.
          const title = payloads.length === 1 ? "New Action Item" : `${payloads.length} New Action Items`
          const message =
            payloads.length === 1
              ? `New action added to ${dept}: ${payloads[0].title}`
              : `${payloads.length} new actions added to ${dept} tracker.`

          await Promise.all(
            deptMembers.map((member) =>
              createNotification(
                {
                  userId: member.id,
                  type: "task_assigned", // Using task_assigned generic type
                  category: "tasks",
                  title: title,
                  message: message,
                  priority: "normal",
                  linkUrl: `/portal/reports/action-tracker?dept=${dept}`,
                  actorId: user.id,
                  entityType: "task_batch",
                },
                { supabase }
              )
            )
          )
        }
      }

      onComplete()
      onClose()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{editingAction ? "Edit Action" : "Bulk Manual Entry"}</DialogTitle>
          <DialogDescription>
            {editingAction
              ? "Modify this specific departmental action."
              : "Add a list of actions for the selected department. Each will be created as a separate checklist item."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Common Metadata */}
          <div className="bg-muted/30 grid grid-cols-3 gap-4 rounded-lg border p-4">
            <div className="col-span-1 space-y-1.5">
              <Label className="text-muted-foreground text-[10px] font-bold uppercase">Department</Label>
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Dept" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[10px] font-bold uppercase">Week</Label>
              <Input type="number" value={week} onChange={(e) => setWeek(parseInt(e.target.value))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[10px] font-bold uppercase">Year</Label>
              <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="h-9" />
            </div>
          </div>

          {editingAction ? (
            /* Single Edit Mode */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Action Description</Label>
                <Input
                  value={singleData.title}
                  onChange={(e) => setSingleData({ ...singleData, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Details (Optional)</Label>
                <Textarea
                  value={singleData.description}
                  onChange={(e) => setSingleData({ ...singleData, description: e.target.value })}
                  className="h-20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={singleData.priority}
                    onValueChange={(v) => setSingleData({ ...singleData, priority: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={singleData.status} onValueChange={(v) => setSingleData({ ...singleData, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : (
            /* Bulk List Entry Mode */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Add Actions to List</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter action description and press Add..."
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addActionItem()}
                  />
                  <Button type="button" onClick={addActionItem} size="sm" variant="secondary">
                    <Plus className="mr-1 h-4 w-4" /> Add
                  </Button>
                </div>
              </div>

              <div className="bg-muted/10 min-h-[150px] space-y-2 rounded-xl border-2 border-dashed p-3">
                {actionItems.length === 0 ? (
                  <p className="text-muted-foreground py-10 text-center text-sm italic">
                    No actions added yet. Type above and click "Add".
                  </p>
                ) : (
                  <div className="space-y-2">
                    {actionItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="group flex items-center justify-between rounded-lg border bg-white p-2 px-3 shadow-sm"
                      >
                        <span className="text-sm font-medium">
                          {idx + 1}. {item}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => removeActionItem(idx)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editingAction ? "Save Changes" : `Submit ${actionItems.length + (newItem ? 1 : 0)} Actions`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
