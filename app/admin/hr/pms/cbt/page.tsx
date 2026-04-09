"use client"

import { startTransition, useCallback, useEffect, useState } from "react"
import { Brain, Download, Plus, RefreshCw, Save, Search } from "lucide-react"
import { toast } from "sonner"
import { PageHeader, PageWrapper, Section } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { StatCard } from "@/components/ui/stat-card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type ReviewCycle = {
  id: string
  name: string
  review_type: string | null
  start_date: string | null
  end_date: string | null
}

type ScopedUser = {
  id: string
  first_name: string | null
  last_name: string | null
  department: string | null
}

type CbtScoreRow = {
  id: string
  user_id: string
  review_cycle_id: string
  reviewer_id?: string | null
  cbt_score: number | null
  created_at?: string
}

type ReviewerRow = {
  id: string
  first_name: string | null
  last_name: string | null
}

type CbtPayload = {
  users: ScopedUser[]
  cycles: ReviewCycle[]
  scores: CbtScoreRow[]
  reviewers: ReviewerRow[]
}

function formatEmployeeName(user: ScopedUser) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || "Unnamed employee"
}

function formatCycleLabel(cycle: ReviewCycle) {
  const typeSuffix = cycle.review_type ? ` (${cycle.review_type})` : ""
  return `${cycle.name}${typeSuffix}`
}

function formatReviewerName(reviewer?: ReviewerRow) {
  if (!reviewer) return "System"
  return [reviewer.first_name, reviewer.last_name].filter(Boolean).join(" ") || "System"
}

export default function AdminPmsCbtPage() {
  const [data, setData] = useState<CbtPayload>({ users: [], cycles: [], scores: [], reviewers: [] })
  const [selectedCycleId, setSelectedCycleId] = useState("")
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({})
  const [savingUserIds, setSavingUserIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")

  const loadData = useCallback(
    async (cycleId?: string) => {
      setLoading(true)
      try {
        const query = cycleId ? `?cycle_id=${encodeURIComponent(cycleId)}` : ""
        const response = await fetch(`/api/hr/performance/cbt${query}`, { cache: "no-store" })
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "Failed to load CBT data")
        }

        const payload = result.data as CbtPayload
        setData(payload)

        const nextScoreInputs: Record<string, string> = {}
        for (const score of payload.scores) {
          nextScoreInputs[score.user_id] =
            score.cbt_score !== null && score.cbt_score !== undefined ? String(score.cbt_score) : ""
        }
        setScoreInputs((current) => ({ ...current, ...nextScoreInputs }))

        const nextCycleId = cycleId || selectedCycleId || payload.cycles[0]?.id || ""
        if (!cycleId && !selectedCycleId && nextCycleId) {
          setSelectedCycleId(nextCycleId)
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load CBT data")
      } finally {
        setLoading(false)
      }
    },
    [selectedCycleId]
  )

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!selectedCycleId) return
    void loadData(selectedCycleId)
  }, [loadData, selectedCycleId])

  const enteredCount = data.scores.length
  const averageScore =
    data.scores.length > 0
      ? Math.round(
          (data.scores.reduce((sum, item) => sum + (Number(item.cbt_score) || 0), 0) /
            Math.max(data.scores.length, 1)) *
            100
        ) / 100
      : 0

  const tableRows = data.scores.map((score) => {
    const user = data.users.find((entry) => entry.id === score.user_id)
    const reviewer = data.reviewers.find((entry) => entry.id === score.reviewer_id)
    const cycle = data.cycles.find((entry) => entry.id === score.review_cycle_id)
    return {
      id: score.id,
      staff: user ? formatEmployeeName(user) : "Employee",
      department: user?.department || "No department",
      cbt_score: `${score.cbt_score ?? 0}%`,
      reviewed_by: formatReviewerName(reviewer),
      cycle: cycle ? formatCycleLabel(cycle) : "Q2 2026",
      last_updated: score.created_at ? new Date(score.created_at).toLocaleDateString() : "-",
    }
  })

  const departmentOptions = Array.from(
    new Set(tableRows.map((row) => row.department).filter((department) => department !== "No department"))
  ).sort((a, b) => a.localeCompare(b))

  const filteredRows = tableRows.filter((row) => {
    const query = searchQuery.trim().toLowerCase()
    const matchesQuery =
      query.length === 0 ||
      row.staff.toLowerCase().includes(query) ||
      row.department.toLowerCase().includes(query) ||
      row.reviewed_by.toLowerCase().includes(query) ||
      row.cycle.toLowerCase().includes(query)
    const matchesDepartment = departmentFilter === "all" || row.department === departmentFilter
    return matchesQuery && matchesDepartment
  })

  function handleExport() {
    if (filteredRows.length === 0) return
    const header = "S/N,Staff,Department,CBT Score,Reviewed By,Cycle,Last Updated"
    const body = filteredRows
      .map((row, index) =>
        [index + 1, row.staff, row.department, row.cbt_score, row.reviewed_by, row.cycle, row.last_updated]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n")
    const csv = `${header}\n${body}`
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `pms-cbt-${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  async function saveScore(userId: string) {
    if (!selectedCycleId) {
      toast.error("Select a review cycle first")
      return
    }

    if (savingUserIds.includes(userId)) {
      return
    }

    const rawValue = scoreInputs[userId] ?? ""
    const parsedValue = Number(rawValue)
    if (rawValue.trim() === "" || Number.isNaN(parsedValue)) {
      return
    }

    setSavingUserIds((current) => (current.includes(userId) ? current : [...current, userId]))
    try {
      const response = await fetch("/api/hr/performance/cbt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          review_cycle_id: selectedCycleId,
          cbt_score: parsedValue,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Failed to save CBT score")
      }

      const user = data.users.find((entry) => entry.id === userId)
      toast.success(`${user ? formatEmployeeName(user) : "Employee"} CBT score saved`)

      startTransition(() => {
        void loadData(selectedCycleId)
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save CBT score")
    } finally {
      setSavingUserIds((current) => current.filter((entry) => entry !== userId))
    }
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="PMS CBT"
        description="Input CBT scores manually from HR for now, using one modal that lists all staff in scope."
        icon={Brain}
        backLink={{ href: "/admin/hr/pms", label: "Back to PMS" }}
        actions={
          <>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={filteredRows.length === 0}
              className="h-8 gap-2"
              size="sm"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" onClick={() => void loadData(selectedCycleId)} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => setIsModalOpen(true)} disabled={!selectedCycleId}>
              <Plus className="mr-2 h-4 w-4" />
              Open CBT Modal
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard
          title="Employees In Scope"
          value={data.users.length}
          icon={Brain}
          description="Available for manual CBT entry"
        />
        <StatCard title="Scores Entered" value={enteredCount} description="Saved for the selected review cycle" />
        <StatCard
          title="Average CBT"
          value={`${averageScore}%`}
          description="Current manual CBT average for this cycle"
        />
      </div>

      <Section
        title="Entered Scores"
        description="A quick view of the CBT scores already saved for the selected cycle."
      >
        <Card className="mb-4 border-2">
          <CardContent className="p-3 sm:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                <Input
                  placeholder="Search staff, department, reviewer, or cycle..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-full md:w-56">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departmentOptions.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
                <SelectTrigger id="cbt-cycle" className="w-full md:w-80">
                  <SelectValue placeholder="Review cycle" />
                </SelectTrigger>
                <SelectContent>
                  {data.cycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id}>
                      {formatCycleLabel(cycle)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved CBT Entries</CardTitle>
            <CardDescription>The modal now lists all staff with score inputs beside their names.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredRows.length > 0 ? (
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Showing {filteredRows.length} of {tableRows.length} record(s).
                </p>
                <Table className="min-w-[1050px]">
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-16">S/N</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>CBT Score</TableHead>
                      <TableHead>Reviewed By</TableHead>
                      <TableHead>Cycle</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row, index) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                        <TableCell className="font-medium">{row.staff}</TableCell>
                        <TableCell>{row.department}</TableCell>
                        <TableCell className="font-semibold">{row.cbt_score}</TableCell>
                        <TableCell>{row.reviewed_by}</TableCell>
                        <TableCell>{row.cycle}</TableCell>
                        <TableCell className="text-muted-foreground">{row.last_updated}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No CBT scores saved for this review cycle yet.</p>
            )}
          </CardContent>
        </Card>
      </Section>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Enter CBT Scores</DialogTitle>
            <DialogDescription>
              Each staff member is listed here. Enter a score in the second column and press `Enter` or click the save
              icon to save that row.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-3 border-b pb-2 text-sm font-medium">
              <p>Staff</p>
              <p>CBT Score</p>
            </div>

            <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {data.users.map((user) => {
                const isSaving = savingUserIds.includes(user.id)
                return (
                  <div
                    key={user.id}
                    className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{formatEmployeeName(user)}</p>
                      <p className="text-muted-foreground truncate text-sm">{user.department || "No department"}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={scoreInputs[user.id] ?? ""}
                        onChange={(event) =>
                          setScoreInputs((current) => ({
                            ...current,
                            [user.id]: event.target.value,
                          }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            void saveScore(user.id)
                          }
                        }}
                        placeholder="0 - 100"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void saveScore(user.id)}
                        disabled={isSaving}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}
