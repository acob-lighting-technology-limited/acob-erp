"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ItemInfoButton } from "@/components/ui/item-info-button"
import { Plus } from "lucide-react"

interface DepartmentCodeOption {
  department_name: string
  department_code: string
}

interface CreateReferenceForm {
  department_name: string
  letter_type: string
  category: string
  subject: string
  recipient_name: string
  sender_name: string
  action_required: boolean
  due_date: string
  metadata_text: string
  attachments: File[]
}

interface CreateReferenceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: CreateReferenceForm
  onFormChange: (form: CreateReferenceForm) => void
  onSubmit: (e: React.FormEvent) => void
  isSaving: boolean
  departmentCodes: DepartmentCodeOption[]
}

const DISPLAY_CODE_OVERRIDES: Record<string, string> = {
  "IT and Communications": "ICT",
  "Legal, Regulatory and Compliance": "RC",
  "Regulatory and Compliance": "RC",
  "Regulatory and Compilance": "RC",
}

const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  "Regulatory and Compilance": "Legal, Regulatory and Compliance",
  "Regulatory and Compliance": "Legal, Regulatory and Compliance",
  "Human Resources": "Admin & HR",
  "Admin and HR": "Admin & HR",
}

export function CreateReferenceDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSubmit,
  isSaving,
  departmentCodes,
}: CreateReferenceDialogProps) {
  const set = (patch: Partial<CreateReferenceForm>) => onFormChange({ ...form, ...patch })
  const options = departmentCodes.map((dept) => ({
    ...dept,
    displayName: DISPLAY_NAME_OVERRIDES[dept.department_name] || dept.department_name,
    displayCode: DISPLAY_CODE_OVERRIDES[dept.department_name] || dept.department_code,
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Reference
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Create Reference</DialogTitle>
            <ItemInfoButton
              title="Reference workflow guide"
              summary="A reference is a tracked correspondence item that can move through review, approval, and dispatch."
              details={[
                {
                  label: "What you are creating",
                  value:
                    "This form creates a formal reference number and correspondence record for a letter, approval request, notice, or other tracked document.",
                },
                {
                  label: "What happens after submission",
                  value:
                    "The reference will stay in workflow so reviewers and approvers can act on it before the final dispatch step.",
                },
                {
                  label: "How to fill it well",
                  value:
                    "Use a clear subject, correct department, real recipient, and enough notes for the next approver or department to understand the purpose quickly.",
                },
              ]}
            />
          </div>
          <DialogDescription>Fill the correspondence details and submit.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={form.department_name} onValueChange={(value) => set({ department_name: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {options.map((dept) => (
                  <SelectItem key={dept.department_name} value={dept.department_name}>
                    {dept.displayName} ({dept.displayCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Subject</Label>
            <Input value={form.subject} onChange={(e) => set({ subject: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Recipient</Label>
            <Input value={form.recipient_name} onChange={(e) => set({ recipient_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Sender</Label>
            <Input value={form.sender_name} readOnly />
            <p className="text-muted-foreground text-xs">Sender is auto-filled from your profile.</p>
          </div>

          <div className="space-y-2">
            <Label>Letter Type</Label>
            <Select value={form.letter_type} onValueChange={(value) => set({ letter_type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="external">External</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(value) => set({ category: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approval">Approval</SelectItem>
                <SelectItem value="notice">Notice</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Due Date (Optional)</Label>
            <Input type="date" value={form.due_date} onChange={(e) => set({ due_date: e.target.value })} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Notes (Optional)</Label>
            <Textarea rows={3} value={form.metadata_text} onChange={(e) => set({ metadata_text: e.target.value })} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Attachments (PDF)</Label>
            <Input
              type="file"
              accept="application/pdf"
              multiple
              onChange={(event) => {
                set({ attachments: Array.from(event.target.files || []) })
              }}
            />
            <p className="text-muted-foreground text-xs">Attach one or more PDF files.</p>
          </div>

          <div className="md:col-span-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Create Reference"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
