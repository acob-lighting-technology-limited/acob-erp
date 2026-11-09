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
import { ItemInfoButton } from "@/components/ui/item-info-button"
import { ArrowUpRight, Plus } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { apiFetch } from "@/lib/api-client"
import { formatWATDate } from "@/lib/utils/date"

export interface CreateTicketForm {
  title: string
  description: string
  service_department: string
  priority: string
  assigned_to?: string | null
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
  const availableDepartmentOptions = useMemo(
    () => departmentOptions.filter((department) => !(userDepartment && department === userDepartment)),
    [departmentOptions, userDepartment]
  )

  const { data: assigneesData, isLoading: isLoadingAssignees } = useQuery({
    queryKey: QUERY_KEYS.helpDeskAssignees(form.service_department),
    queryFn: async () => {
      if (!form.service_department) return []
      const res = await apiFetch(`/api/help-desk/assignees?department=${encodeURIComponent(form.service_department)}`)
      if (!res.ok) throw new Error("Failed to load assignees")
      const json = await res.json()
      return (json.data || []) as Array<{ id: string; name: string; on_leave_until: string | null }>
    },
    enabled: Boolean(form.service_department && open),
    staleTime: 60_000,
  })

  const assignees = assigneesData ?? []

  useEffect(() => {
    if (availableDepartmentOptions.length === 0) return
    if (availableDepartmentOptions.includes(form.service_department)) return
    onFormChange({ ...form, service_department: availableDepartmentOptions[0] || "", assigned_to: null })
  }, [availableDepartmentOptions, form, onFormChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          <span className="hidden sm:inline">New Ticket</span>
          <span className="sm:hidden">Ticket</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Submit Help Desk Ticket</DialogTitle>
            <ItemInfoButton
              title="Help desk workflow guide"
              summary="Help desk tickets are requests sent to another department for support, review, assignment, and resolution."
              details={[
                {
                  label: "What you are creating",
                  value:
                    "This ticket tells another department what support, fix, or operational assistance you need from them.",
                },
                {
                  label: "What happens after submission",
                  value:
                    "The receiving department reviews it, approves or assigns it, works on it, and updates the ticket until it is resolved or closed.",
                },
                {
                  label: "How to avoid delays",
                  value:
                    "Write the issue clearly, pick the correct department, and include enough detail so the next handler can act without chasing basic context.",
                },
              ]}
            />
          </div>
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
              onValueChange={(value) => onFormChange({ ...form, service_department: value, assigned_to: null })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableDepartmentOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
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
          <div className="space-y-2 md:col-span-2">
            <Label>Specific Assignee (Optional)</Label>
            <Select
              value={form.assigned_to ?? "unassigned"}
              onValueChange={(value) => onFormChange({ ...form, assigned_to: value === "unassigned" ? null : value })}
              disabled={isLoadingAssignees}
            >
              <SelectTrigger>
                <SelectValue placeholder="Department Queue (Default)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Department Queue (Default)</SelectItem>
                {assignees.map((person) => {
                  const onLeave = person.on_leave_until
                    ? ` (On leave until ${formatWATDate(person.on_leave_until, { day: "numeric", month: "short" })})`
                    : ""
                  return (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                      {onLeave}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Leave blank to route to the department queue, or choose a team member to assign directly.
            </p>
          </div>
          <div className="border-primary/30 bg-primary/5 text-foreground flex items-center justify-between rounded-lg border px-3 py-2 text-xs md:col-span-2">
            <span>Need something bought or paid for? Money goes through Requisitions, not the help desk.</span>
            <Link
              href="/accounts/requisitions"
              className="text-primary inline-flex shrink-0 items-center gap-1 font-medium hover:underline"
            >
              Go to Requisitions
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
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
