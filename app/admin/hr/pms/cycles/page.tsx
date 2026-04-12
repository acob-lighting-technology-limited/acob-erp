"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Calendar, CheckCircle2, Loader2, Lock, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StatCard } from "@/components/ui/stat-card"

type CycleStatus = "planned" | "active" | "closed" | "locked"

type ReviewCycle = {
  id: string
  name: string
  review_type: string
  start_date: string
  end_date: string
  status: CycleStatus | null
  created_at: string
  updated_at: string | null
}

const STATUS_COLORS: Record<string, string> = {
  planned: "secondary",
  active: "default",
  closed: "outline",
  locked: "destructive",
}

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  active: "Active",
  closed: "Closed",
  locked: "Locked",
}

const STATUS_TRANSITIONS: Record<CycleStatus, CycleStatus[]> = {
  planned: ["active"],
  active: ["closed"],
  closed: ["locked"],
  locked: [],
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

export default function ReviewCyclesPage() {
  const [cycles, setCycles] = useState<ReviewCycle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ReviewCycle | null>(null)
  const [statusTarget, setStatusTarget] = useState<{ cycle: ReviewCycle; newStatus: CycleStatus } | null>(null)

  // Form
  const [name, setName] = useState("")
  const [reviewType, setReviewType] = useState("quarterly")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [status, setStatus] = useState<CycleStatus>("planned")

  const loadCycles = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/hr/performance/cycles")
      const data = (await res.json().catch(() => ({}))) as { data?: ReviewCycle[]; error?: string }
      if (!res.ok) throw new Error(data.error || "Failed to load cycles")
      setCycles(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCycles()
  }, [loadCycles])

  function resetForm() {
    setName("")
    setReviewType("quarterly")
    setStartDate("")
    setEndDate("")
    setStatus("planned")
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/hr/performance/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, review_type: reviewType, start_date: startDate, end_date: endDate, status }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) throw new Error(data.error || "Failed to create")
      toast.success(data.message || "Cycle created")
      setIsCreateOpen(false)
      resetForm()
      void loadCycles()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create cycle")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleStatusChange(cycle: ReviewCycle, newStatus: CycleStatus) {
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/hr/performance/cycles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cycle.id, status: newStatus }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) throw new Error(data.error || "Failed to update")
      toast.success(data.message || "Cycle updated")
      setStatusTarget(null)
      void loadCycles()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update cycle")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(cycle: ReviewCycle) {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/hr/performance/cycles?id=${encodeURIComponent(cycle.id)}`, {
        method: "DELETE",
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) throw new Error(data.error || "Failed to delete")
      toast.success(data.message || "Cycle deleted")
      setDeleteTarget(null)
      void loadCycles()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete cycle")
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeCycle = useMemo(() => cycles.find((c) => c.status === "active"), [cycles])

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Review Cycles"
        description="Create and manage performance review cycles. Only one cycle can be active at a time."
        icon={RefreshCw}
        backLink={{ href: "/admin/hr/pms", label: "Back to PMS" }}
        actions={
          <Button onClick={() => setIsCreateOpen(true)} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            New Cycle
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard title="Total" value={cycles.length} icon={Calendar} description="All review cycles" />
        <StatCard
          title="Active"
          value={activeCycle ? activeCycle.name : "None"}
          icon={CheckCircle2}
          description="Currently running cycle"
        />
        <StatCard
          title="Planned"
          value={cycles.filter((c) => c.status === "planned").length}
          icon={Calendar}
          description="Upcoming cycles"
        />
        <StatCard
          title="Closed"
          value={cycles.filter((c) => ["closed", "locked"].includes(String(c.status))).length}
          icon={Lock}
          description="Completed cycles"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Review Cycles</CardTitle>
          <CardDescription>
            Lifecycle: <strong>Planned → Active → Closed → Locked</strong>. Locked cycles cannot be edited or deleted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-10">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : error ? (
            <div className="space-y-2 py-4">
              <p className="text-sm text-red-500">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void loadCycles()}>
                Retry
              </Button>
            </div>
          ) : cycles.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No review cycles yet. Create the first one using the &quot;New Cycle&quot; button.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
                  <TableRow>
                    <TableHead className="w-12">S/N</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cycles.map((cycle, index) => {
                    const nextStatuses = STATUS_TRANSITIONS[cycle.status as CycleStatus] || []
                    return (
                      <TableRow key={cycle.id}>
                        <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="font-medium">{cycle.name}</TableCell>
                        <TableCell className="capitalize">{cycle.review_type}</TableCell>
                        <TableCell>{formatDate(cycle.start_date)}</TableCell>
                        <TableCell>{formatDate(cycle.end_date)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              STATUS_COLORS[String(cycle.status)] as "default" | "secondary" | "outline" | "destructive"
                            }
                          >
                            {STATUS_LABELS[String(cycle.status)] || cycle.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {nextStatuses.map((next) => (
                              <Button
                                key={next}
                                size="sm"
                                variant="outline"
                                onClick={() => setStatusTarget({ cycle, newStatus: next })}
                              >
                                Mark {STATUS_LABELS[next]}
                              </Button>
                            ))}
                            {!["active", "locked"].includes(String(cycle.status)) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(cycle)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Review Cycle</DialogTitle>
            <DialogDescription>Define a new performance review period.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div className="space-y-2">
              <Label>Cycle Name *</Label>
              <Input
                placeholder="e.g. Q1 2026 Performance Review"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Review Type *</Label>
              <Select value={reviewType} onValueChange={setReviewType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="mid_year">Mid-Year</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="probation">Probation</SelectItem>
                  <SelectItem value="ad_hoc">Ad Hoc</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  min={startDate}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Initial Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CycleStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="active">Active (starts immediately)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false)
                  resetForm()
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Cycle
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Status change confirmation */}
      <AlertDialog open={Boolean(statusTarget)} onOpenChange={() => setStatusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Mark cycle as {statusTarget ? STATUS_LABELS[statusTarget.newStatus] : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.newStatus === "active" &&
                "Activating this cycle will allow reviews and feedback to be submitted. Ensure the previous cycle is closed."}
              {statusTarget?.newStatus === "closed" &&
                "Closing this cycle prevents new reviews from being submitted. Existing reviews remain accessible."}
              {statusTarget?.newStatus === "locked" &&
                "Locking is permanent. The cycle cannot be re-opened or modified after this."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={() => statusTarget && void handleStatusChange(statusTarget.cycle, statusTarget.newStatus)}
            >
              {isSubmitting ? "Updating…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the cycle. This cannot be undone. Cycles with linked reviews cannot be
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
              onClick={() => deleteTarget && void handleDelete(deleteTarget)}
            >
              {isSubmitting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageWrapper>
  )
}
