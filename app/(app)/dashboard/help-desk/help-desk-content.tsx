"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Headset, Plus } from "lucide-react"

interface HelpDeskTicket {
  id: string
  ticket_number: string
  title: string
  service_department: string
  request_type: "support" | "procurement"
  priority: "low" | "medium" | "high" | "urgent"
  status: string
  assigned_to: string | null
  requester_id: string
  created_at: string
  resolved_at: string | null
  csat_rating: number | null
  handling_mode?: string | null
  support_mode?: string | null
  requester_department?: string | null
}

interface HelpDeskCategory {
  id: string
  service_department: string
  request_type: "support" | "procurement"
  code: string
  name: string
  description: string | null
  support_mode: "open_queue" | "lead_review_required" | null
}

interface HelpDeskContentProps {
  userId: string
  userDepartment: string | null
  initialDepartments: string[]
  initialTickets: HelpDeskTicket[]
  initialError?: string | null
}

interface HelpDeskCategoriesResponse {
  data?: HelpDeskCategory[]
  departments?: string[]
  error?: string
}

function buildFetchDebugLabel(source: string, status: number, payload: any) {
  const detail =
    payload?.error ||
    payload?.message ||
    (typeof payload === "string" ? payload : "") ||
    "Unknown error"
  return `${source} failed (${status}): ${detail}`
}

export function HelpDeskContent({
  userId,
  userDepartment,
  initialDepartments,
  initialTickets,
  initialError,
}: HelpDeskContentProps) {
  const [tickets, setTickets] = useState<HelpDeskTicket[]>(initialTickets)
  const [isSaving, setIsSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingApprovals, setPendingApprovals] = useState<HelpDeskTicket[]>([])
  const [categories, setCategories] = useState<HelpDeskCategory[]>([])
  const [availableDepartments, setAvailableDepartments] = useState<string[]>(initialDepartments || [])
  const pendingRef = useRef<HTMLDivElement | null>(null)
  const [form, setForm] = useState({
    title: "",
    description: "",
    service_department: "IT and Communications",
    priority: "medium",
    request_type: "support",
    category_id: "",
  })

  const myOpenTickets = useMemo(
    () => tickets.filter((t) => !["resolved", "closed", "cancelled"].includes(t.status)).length,
    [tickets]
  )
  const pendingReviewCount = pendingApprovals.length

  useEffect(() => {
    if (initialError) {
      toast.error(initialError)
    }
  }, [initialError])

  useEffect(() => {
    const loadSupportData = async () => {
      const [pendingRes, categoriesRes] = await Promise.all([
        fetch("/api/help-desk/tickets?scope=department&status=pending_approval", { cache: "no-store" }),
        fetch("/api/help-desk/categories", { cache: "no-store" }),
      ])

      const [pendingJson, categoriesJson] = await Promise.all([
        pendingRes.json().catch(() => ({})),
        categoriesRes.json().catch(() => ({})),
      ])
      const categoriesPayload = categoriesJson as HelpDeskCategoriesResponse

      if (pendingRes.ok) {
        setPendingApprovals(pendingJson.data || [])
      } else {
        setPendingApprovals([])
        toast.error(buildFetchDebugLabel("Pending approvals load", pendingRes.status, pendingJson))
      }

      if (categoriesRes.ok) {
        setCategories(categoriesPayload.data || [])
        setAvailableDepartments((prev) => {
          const merged = [...prev, ...(categoriesPayload.departments || [])]
          return Array.from(new Set(merged.map((item) => String(item || "").trim()).filter(Boolean)))
        })
        if (!Array.isArray(categoriesPayload.data) || categoriesPayload.data.length === 0) {
          toast.error("Help desk categories are not configured yet. Department options are limited for now.")
        }
      } else {
        setCategories([])
        toast.error(buildFetchDebugLabel("Help desk categories load", categoriesRes.status, categoriesJson))
      }
    }

    loadSupportData().catch((error) => {
      setPendingApprovals([])
      setCategories([])
      toast.error(`Failed to load help desk setup data: ${error instanceof Error ? error.message : "Unknown error"}`)
    })
  }, [])

  const departmentOptions = useMemo(() => {
    const options = new Set<string>()
    options.add(form.service_department)
    for (const category of categories) {
      if (category.service_department) options.add(category.service_department)
    }
    for (const department of availableDepartments) {
      if (department) options.add(department)
    }
    for (const ticket of tickets) {
      if (ticket.service_department) options.add(ticket.service_department)
    }
    return Array.from(options).filter((department) => Boolean(department))
  }, [availableDepartments, categories, form.service_department, tickets])

  const filteredCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.service_department === form.service_department &&
          category.request_type === form.request_type &&
          category.service_department !== (userDepartment || "")
      ),
    [categories, form.request_type, form.service_department, userDepartment]
  )

  const selectedCategory = useMemo(
    () => filteredCategories.find((category) => category.id === form.category_id) || null,
    [filteredCategories, form.category_id]
  )

  useEffect(() => {
    if (form.service_department && userDepartment && form.service_department === userDepartment) {
      const fallbackDepartment = departmentOptions.find((department) => department !== userDepartment) || ""
      setForm((prev) => ({ ...prev, service_department: fallbackDepartment, category_id: "" }))
      if (fallbackDepartment) {
        toast.error("You cannot submit help desk requests to your own department.")
      }
      return
    }

    if (filteredCategories.length === 0) {
      setForm((prev) => ({ ...prev, category_id: "" }))
      return
    }
    if (!filteredCategories.some((category) => category.id === form.category_id)) {
      setForm((prev) => ({ ...prev, category_id: filteredCategories[0]?.id || "" }))
    }
  }, [departmentOptions, filteredCategories, form.category_id, form.service_department, userDepartment])

  async function refreshTickets() {
    const res = await fetch("/api/help-desk/tickets?scope=mine", { cache: "no-store" })
    const json = await res.json()
    if (!res.ok) {
      toast.error(buildFetchDebugLabel("Tickets refresh", res.status, json))
      return
    }
    setTickets(json.data || [])
  }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault()

    if (!form.title.trim()) {
      toast.error("Title is required")
      return
    }
    if (userDepartment && form.service_department === userDepartment) {
      toast.error("You cannot submit help desk requests to your own department.")
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch("/api/help-desk/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || "Failed to create ticket")
      }

      toast.success("Ticket submitted")
      setCreateOpen(false)
      setForm({
        title: "",
        description: "",
        service_department: "IT and Communications",
        priority: "medium",
        request_type: "support",
        category_id: "",
      })
      await refreshTickets()
    } catch (error: any) {
      toast.error(error.message || "Failed to create ticket")
    } finally {
      setIsSaving(false)
    }
  }

  async function setStatus(ticketId: string, status: string) {
    try {
      const res = await fetch(`/api/help-desk/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || "Failed to update")
      }

      toast.success("Ticket updated")
      await refreshTickets()
    } catch (error: any) {
      toast.error(error.message || "Update failed")
    }
  }

  async function rateTicket(ticketId: string, rating: number) {
    try {
      const res = await fetch(`/api/help-desk/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csat_rating: rating }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || "Failed to rate")
      }

      toast.success("Thanks for your feedback")
      await refreshTickets()
    } catch (error: any) {
      toast.error(error.message || "Failed to submit rating")
    }
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Help Desk"
        description="Submit and track support/procurement tickets."
        icon={Headset}
        backLink={{ href: "/profile", label: "Back to Dashboard" }}
        actions={
          <>
            {pendingReviewCount > 0 && (
              <Button
                variant="outline"
                onClick={() => pendingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                Pending Reviews ({pendingReviewCount})
              </Button>
            )}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Ticket
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Submit Help Desk Ticket</DialogTitle>
                  <DialogDescription>Fill in the details and submit your ticket.</DialogDescription>
                </DialogHeader>
                <form onSubmit={createTicket} className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Title</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Brief summary of issue"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Description</Label>
                    <Textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select
                      value={form.service_department}
                      onValueChange={(value) =>
                        setForm((prev) => ({ ...prev, service_department: value, category_id: "" }))
                      }
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
                    <Select
                      value={form.priority}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value }))}
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
                    <Label>Type</Label>
                    <Select
                      value={form.request_type}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, request_type: value, category_id: "" }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="procurement">Procurement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Category</Label>
                    <Select
                      value={form.category_id}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, category_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {filteredCategories.length === 0 && form.request_type === "support" && (
                      <p className="text-muted-foreground text-xs">
                        No support categories configured for this department yet. Ticket will use General Support.
                      </p>
                    )}
                    {selectedCategory?.description && (
                      <p className="text-muted-foreground text-xs">{selectedCategory.description}</p>
                    )}
                    {form.request_type === "support" && selectedCategory?.support_mode && (
                      <p className="text-muted-foreground text-xs">
                        {selectedCategory.support_mode === "lead_review_required"
                          ? "This category goes to the service department lead first."
                          : "This category goes straight to the department queue."}
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? "Submitting..." : "Submit Ticket"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">My Open Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold sm:text-2xl">{myOpenTickets}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Resolved Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold sm:text-2xl">{tickets.filter((t) => t.status === "resolved").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Avg CSAT</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold sm:text-2xl">
              {tickets.filter((t) => t.csat_rating).length
                ? (
                    tickets.filter((t) => t.csat_rating).reduce((sum, t) => sum + Number(t.csat_rating), 0) /
                    tickets.filter((t) => t.csat_rating).length
                  ).toFixed(1)
                : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {pendingReviewCount > 0 && (
        <Card ref={pendingRef}>
          <CardHeader>
            <CardTitle>Pending Department Reviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingApprovals.map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between rounded border p-3">
                <div>
                  <p className="font-medium">{ticket.ticket_number}</p>
                  <p className="text-muted-foreground text-xs">{ticket.title}</p>
                </div>
                <Badge variant="secondary">{ticket.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>My Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>
                    <div className="font-medium">{ticket.ticket_number}</div>
                    <div className="text-muted-foreground text-xs">{ticket.title}</div>
                  </TableCell>
                  <TableCell>{ticket.service_department}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ticket.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge>{ticket.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {ticket.assigned_to === userId && ticket.status === "assigned" && (
                        <Button size="sm" variant="outline" onClick={() => setStatus(ticket.id, "in_progress")}>
                          Start
                        </Button>
                      )}
                      {ticket.assigned_to === userId && ticket.status === "in_progress" && (
                        <Button size="sm" variant="outline" onClick={() => setStatus(ticket.id, "resolved")}>
                          Resolve
                        </Button>
                      )}
                      {ticket.requester_id === userId && ticket.status === "resolved" && (
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((r) => (
                            <Button
                              key={r}
                              size="sm"
                              variant="ghost"
                              onClick={() => rateTicket(ticket.id, r)}
                              title={`Rate ${r}`}
                            >
                              {r}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageWrapper>
  )
}

