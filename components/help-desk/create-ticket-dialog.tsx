"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus } from "lucide-react"

export interface CreateTicketForm {
  title: string
  description: string
  service_department: string
  priority: string
  request_type: string
}

interface CreateTicketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: CreateTicketForm
  onFormChange: (form: CreateTicketForm) => void
  onSubmit: (e: React.FormEvent) => void
  isSaving: boolean
  departmentOptions: string[]
  userDepartment: string | null
}

export function CreateTicketDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSubmit,
  isSaving,
  departmentOptions,
  userDepartment,
}: CreateTicketDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Help Desk Ticket</DialogTitle>
          <DialogDescription>Fill in the details and submit your ticket.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => onFormChange({ ...form, title: e.target.value })}
              placeholder="Brief summary of issue"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => onFormChange({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Select
              value={form.service_department}
              onValueChange={(value) => onFormChange({ ...form, service_department: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {departmentOptions.map((d) => (
                  <SelectItem key={d} value={d} disabled={Boolean(userDepartment && d === userDepartment)}>
                    {d}
                    {userDepartment && d === userDepartment ? " (Your Department)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {userDepartment && (
              <p className="text-muted-foreground text-xs">Your department ({userDepartment}) is excluded.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={(value) => onFormChange({ ...form, priority: value })}>
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
            <Label>Type</Label>
            <Select value={form.request_type} onValueChange={(value) => onFormChange({ ...form, request_type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="procurement">Procurement</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Submitting..." : "Submit Ticket"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
