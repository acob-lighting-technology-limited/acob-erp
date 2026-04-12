"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Brain, Eye, Loader2, RefreshCw, Search } from "lucide-react"
import { toast } from "sonner"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"

type TabKey = "individual" | "department" | "cycle"

type ReviewCycle = {
  id: string
  name: string
  review_type: string | null
}

type CbtUser = {
  id: string
  first_name: string | null
  last_name: string | null
  department: string | null
}

type CbtScore = {
  user_id: string
  review_cycle_id: string
  cbt_score: number | null
}

type CbtPayload = {
  users: CbtUser[]
  cycles: ReviewCycle[]
  scores: CbtScore[]
}

export default function AdminPmsCbtPage() {
  const [tab, setTab] = useState<TabKey>("individual")
  const [selectedCycleId, setSelectedCycleId] = useState("all")
  const [data, setData] = useState<CbtPayload>({ users: [], cycles: [], scores: [] })
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({})
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [userFilter, setUserFilter] = useState("all")
  const hasLoadedSnapshotRef = useRef(false)

  const loadCbtSnapshot = useCallback(async () => {
    if (hasLoadedSnapshotRef.current) {
      setIsRefreshing(true)
    } else {
      setIsInitialLoading(true)
    }
    try {
      const response = await fetch("/api/hr/performance/cbt", { cache: "no-store" })
      const payload = (await response.json().catch(() => null)) as { data?: CbtPayload; error?: string } | null
      if (!response.ok || !payload?.data) throw new Error(payload?.error || "Failed to load CBT data")
      const snapshot = payload.data
      setData(snapshot)
      hasLoadedSnapshotRef.current = true
      setSelectedCycleId((current) => current || "all")

      const counts = await Promise.all(
        snapshot.cycles.map(async (cycle) => {
          const questionsResponse = await fetch(
            `/api/hr/performance/cbt/questions?cycle_id=${encodeURIComponent(cycle.id)}`,
            {
              cache: "no-store",
            }
          )
          const questionsPayload = (await questionsResponse.json().catch(() => null)) as {
            data?: Array<{ id: string }>
          } | null
          return [cycle.id, questionsPayload?.data?.length || 0] as const
        })
      )
      setQuestionCounts(Object.fromEntries(counts))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load CBT data")
    } finally {
      setIsInitialLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadCbtSnapshot()
  }, [loadCbtSnapshot])

  const usersById = useMemo(() => new Map(data.users.map((user) => [user.id, user])), [data.users])

  const scoresForSelectedCycle = useMemo(
    () => data.scores.filter((score) => selectedCycleId === "all" || score.review_cycle_id === selectedCycleId),
    [data.scores, selectedCycleId]
  )

  const individualRows = useMemo(
    () =>
      data.scores.map((score, index) => {
        const user = usersById.get(score.user_id)
        return {
          id: `${score.user_id}-${index}`,
          user_id: score.user_id,
          review_cycle_id: score.review_cycle_id,
          employee: [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Employee",
          department: user?.department || "-",
          cycle: data.cycles.find((cycle) => cycle.id === score.review_cycle_id)?.name || "-",
          cbt_score: score.cbt_score !== null ? `${score.cbt_score}%` : "-",
        }
      }),
    [data.cycles, data.scores, usersById]
  )

  const departmentRows = useMemo(() => {
    const grouped = new Map<string, number[]>()
    for (const score of scoresForSelectedCycle) {
      const department = usersById.get(score.user_id)?.department || "Unassigned"
      const current = grouped.get(department) || []
      if (typeof score.cbt_score === "number") current.push(score.cbt_score)
      grouped.set(department, current)
    }
    return Array.from(grouped.entries()).map(([department, values]) => ({
      department,
      cycle: data.cycles.find((cycle) => cycle.id === selectedCycleId)?.name || "-",
      scores_recorded: values.length,
      average_score:
        values.length > 0
          ? `${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2).replace(/\.00$/, "")}%`
          : "-",
    }))
  }, [data.cycles, scoresForSelectedCycle, selectedCycleId, usersById])

  const cycleRows = useMemo(
    () =>
      data.cycles.map((cycle) => ({
        id: cycle.id,
        cycle: cycle.name,
        review_type: cycle.review_type || "-",
        scores_recorded: data.scores.filter((score) => score.review_cycle_id === cycle.id).length,
        questions: questionCounts[cycle.id] || 0,
      })),
    [data.cycles, data.scores, questionCounts]
  )

  const filteredIndividualRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return individualRows.filter((row) => {
      const matchesQuery =
        query.length === 0 ||
        [row.employee, row.department, row.cycle, row.cbt_score].some((value) => value.toLowerCase().includes(query))
      const matchesDepartment = departmentFilter === "all" || row.department === departmentFilter
      const matchesUser = userFilter === "all" || row.user_id === userFilter
      const matchesCycle = selectedCycleId === "all" || row.review_cycle_id === selectedCycleId
      return matchesQuery && matchesDepartment && matchesUser && matchesCycle
    })
  }, [departmentFilter, individualRows, searchQuery, selectedCycleId, userFilter])

  const filteredDepartmentRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return departmentRows.filter((row) => {
      const matchesQuery =
        query.length === 0 ||
        [row.department, row.cycle, row.average_score].some((value) => value.toLowerCase().includes(query))
      const matchesDepartment = departmentFilter === "all" || row.department === departmentFilter
      return matchesQuery && matchesDepartment
    })
  }, [departmentFilter, departmentRows, searchQuery])

  const filteredCycleRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return cycleRows.filter((row) => {
      const matchesQuery =
        query.length === 0 || [row.cycle, row.review_type].some((value) => value.toLowerCase().includes(query))
      const matchesCycle = selectedCycleId === "all" || row.id === selectedCycleId
      return matchesQuery && matchesCycle
    })
  }, [cycleRows, searchQuery, selectedCycleId])

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="PMS CBT"
        description="Review CBT results by employee, department, or cycle. Open a cycle to manage its question bank."
        icon={Brain}
        backLink={{ href: "/admin/hr/pms", label: "Back to PMS" }}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadCbtSnapshot()} disabled={isRefreshing}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Link href="/cbt">
              <Button size="sm">Start Test</Button>
            </Link>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="mb-4">
        <TabsList>
          <TabsTrigger value="individual">Individual</TabsTrigger>
          <TabsTrigger value="department">Department</TabsTrigger>
          <TabsTrigger value="cycle">Cycle</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Rows</p>
            <p className="text-2xl font-semibold">
              {tab === "individual"
                ? filteredIndividualRows.length
                : tab === "department"
                  ? filteredDepartmentRows.length
                  : filteredCycleRows.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Scores Recorded</p>
            <p className="text-2xl font-semibold">
              {tab === "individual"
                ? filteredIndividualRows.length
                : tab === "department"
                  ? filteredDepartmentRows.reduce((sum, row) => sum + row.scores_recorded, 0)
                  : filteredCycleRows.reduce((sum, row) => sum + row.scores_recorded, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Cycle</p>
            <p className="text-lg font-semibold">
              {selectedCycleId === "all"
                ? "All Cycles"
                : data.cycles.find((cycle) => cycle.id === selectedCycleId)?.name || "Current"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4 border-2">
        <CardContent className="p-3 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
              <Input
                placeholder="Search current view..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>
            {tab === "individual" ? (
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder="Employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {data.users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {[user.first_name, user.last_name].filter(Boolean).join(" ") || "Employee"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {tab === "individual" || tab === "department" ? (
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-full md:w-56">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {Array.from(new Set(data.users.map((user) => user.department).filter(Boolean) as string[])).map(
                    (department) => (
                      <SelectItem key={department} value={department}>
                        {department}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            ) : null}
            <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
              <SelectTrigger className="w-full md:w-80">
                <SelectValue placeholder="Select cycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cycles</SelectItem>
                {data.cycles.map((cycle) => (
                  <SelectItem key={cycle.id} value={cycle.id}>
                    {cycle.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{tab[0].toUpperCase() + tab.slice(1)} View</CardTitle>
            {isRefreshing ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Refreshing...
              </div>
            ) : null}
          </div>
          <CardDescription>
            {tab === "individual"
              ? "Scores recorded per employee."
              : tab === "department"
                ? "Department CBT averages for the selected cycle."
                : "Open a cycle to manage that cycle question bank."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isInitialLoading &&
          filteredIndividualRows.length === 0 &&
          filteredDepartmentRows.length === 0 &&
          filteredCycleRows.length === 0 ? (
            <div className="text-muted-foreground py-8 text-sm">Loading CBT data...</div>
          ) : tab === "individual" ? (
            <div className="overflow-x-auto">
              <Table key="individual" className="min-w-[980px]">
                <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
                  <TableRow>
                    <TableHead className="w-16">S/N</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead>CBT Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIndividualRows.map((row, index) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                      <TableCell>{row.employee}</TableCell>
                      <TableCell>{row.department}</TableCell>
                      <TableCell>{row.cycle}</TableCell>
                      <TableCell>{row.cbt_score}</TableCell>
                    </TableRow>
                  ))}
                  {filteredIndividualRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground py-8 text-center text-sm">
                        No records found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          ) : tab === "department" ? (
            <div className="overflow-x-auto">
              <Table key="department" className="min-w-[980px]">
                <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
                  <TableRow>
                    <TableHead className="w-16">S/N</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Scores Recorded</TableHead>
                    <TableHead>Average Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDepartmentRows.map((row, index) => (
                    <TableRow key={`${row.department}-${row.cycle}`}>
                      <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                      <TableCell>{row.department}</TableCell>
                      <TableCell>{row.cycle}</TableCell>
                      <TableCell>{row.scores_recorded}</TableCell>
                      <TableCell>{row.average_score}</TableCell>
                    </TableRow>
                  ))}
                  {filteredDepartmentRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground py-8 text-center text-sm">
                        No records found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table key="cycle" className="min-w-[980px]">
                <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
                  <TableRow>
                    <TableHead className="w-16">S/N</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Review Type</TableHead>
                    <TableHead>Scores Recorded</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCycleRows.map((row, index) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                      <TableCell>{row.cycle}</TableCell>
                      <TableCell>{row.review_type}</TableCell>
                      <TableCell>{row.scores_recorded}</TableCell>
                      <TableCell>{row.questions}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/hr/pms/cbt/${encodeURIComponent(row.id)}`}>
                          <Button size="sm" variant="outline">
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredCycleRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground py-8 text-center text-sm">
                        No records found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </PageWrapper>
  )
}
