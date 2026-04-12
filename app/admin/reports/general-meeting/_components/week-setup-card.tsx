"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Calendar, ChevronDown, ChevronUp, Loader2, Lock, Plus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { fetchWeeklyReportLockState, getDefaultMeetingDateIso } from "@/lib/weekly-report-lock"
import { QUERY_KEYS } from "@/lib/query-keys"
import { normalizeDepartmentName } from "@/shared/departments"

type EmployeeOption = {
  id: string
  full_name: string
  department: string
}

type AuthUser = {
  id: string
}

type OfficeYearRow = { year: number; anchor_day: number; is_locked: boolean }

function getInitialOfficeWeek() {
  const now = new Date()
  const current = getCurrentOfficeWeek()
  if (now.getDay() === 0) {
    // Sunday — advance to next week since that's when you prepare
    const next = new Date(now)
    next.setDate(next.getDate() + 1)
    return getCurrentOfficeWeek(next)
  }
  return current
}

export function WeekSetupCard() {
  const [initialWeek] = useState(getInitialOfficeWeek)
  const currentOfficeWeek = getCurrentOfficeWeek()
  const [supabase] = useState(() => createClient())
  const queryClient = useQueryClient()
  const currentYear = new Date().getFullYear()

  const [weekNumber, setWeekNumber] = useState(initialWeek.week)
  const [yearNumber, setYearNumber] = useState(initialWeek.year)
  const [meetingDateInput, setMeetingDateInput] = useState(
    getDefaultMeetingDateIso(currentOfficeWeek.week, currentOfficeWeek.year)
  )
  const [meetingTimeInput, setMeetingTimeInput] = useState("08:30")
  const [meetingGraceHours, setMeetingGraceHours] = useState(24)
  const [kssDepartmentInput, setKssDepartmentInput] = useState("none")
  const [kssPresenterIdInput, setKssPresenterIdInput] = useState("none")
  const [savingMeetingWindow, setSavingMeetingWindow] = useState(false)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [showWeekSetup, setShowWeekSetup] = useState(false)
  const [showYearConfig, setShowYearConfig] = useState(false)

  const weekOptions = useMemo(() => Array.from({ length: 53 }, (_, index) => index + 1), [])
  const yearOptions = useMemo(
    () => [currentOfficeWeek.year - 1, currentOfficeWeek.year, currentOfficeWeek.year + 1, currentOfficeWeek.year + 2],
    [currentOfficeWeek.year]
  )

  useEffect(() => {
    let cancelled = false

    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) {
        setAuthUser(data.user ? { id: data.user.id } : null)
      }
    })

    return () => {
      cancelled = true
    }
  }, [supabase])

  const { data: employees = [] } = useQuery({
    queryKey: ["general-meeting-week-setup-employees"],
    queryFn: async (): Promise<EmployeeOption[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, department")
        .not("department", "is", null)
        .order("full_name", { ascending: true })

      if (error) throw new Error(error.message)

      return (data || [])
        .filter((row): row is { id: string; full_name: string; department: string } =>
          Boolean(row?.id && row?.full_name && row?.department)
        )
        .map((row) => ({
          id: row.id,
          full_name: row.full_name,
          department: normalizeDepartmentName(row.department),
        }))
    },
  })

  const departmentOptions = useMemo(
    () => Array.from(new Set(employees.map((employee) => employee.department))).sort((a, b) => a.localeCompare(b)),
    [employees]
  )

  const presenterOptions = useMemo(
    () =>
      employees
        .filter(
          (employee) => normalizeDepartmentName(employee.department) === normalizeDepartmentName(kssDepartmentInput)
        )
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [employees, kssDepartmentInput]
  )

  const { data: lockState } = useQuery({
    queryKey: QUERY_KEYS.adminWeeklyReportLockState(weekNumber, yearNumber),
    queryFn: () => fetchWeeklyReportLockState(supabase, weekNumber, yearNumber),
  })

  const { data: weekSetupData } = useQuery({
    queryKey: ["general-meeting-week-setup", weekNumber, yearNumber],
    queryFn: async () => {
      const [meetingWindowResult, rosterResult] = await Promise.all([
        supabase
          .from("weekly_report_meeting_windows")
          .select("meeting_time")
          .eq("week_number", weekNumber)
          .eq("year", yearNumber)
          .maybeSingle(),
        supabase
          .from("kss_weekly_roster")
          .select("id, department, presenter_id")
          .eq("meeting_week", weekNumber)
          .eq("meeting_year", yearNumber)
          .maybeSingle(),
      ])

      if (meetingWindowResult.error) throw new Error(meetingWindowResult.error.message)
      if (rosterResult.error) throw new Error(rosterResult.error.message)

      return {
        rosterId: typeof rosterResult.data?.id === "string" ? rosterResult.data.id : null,
        meetingTime:
          typeof meetingWindowResult.data?.meeting_time === "string" ? meetingWindowResult.data.meeting_time : "08:30",
        kssDepartment:
          typeof rosterResult.data?.department === "string" && rosterResult.data.department.trim()
            ? normalizeDepartmentName(rosterResult.data.department)
            : "none",
        kssPresenterId:
          typeof rosterResult.data?.presenter_id === "string" && rosterResult.data.presenter_id
            ? rosterResult.data.presenter_id
            : "none",
      }
    },
  })

  const isWeekSetupLocked = useMemo(() => {
    if (!lockState) return false
    if (lockState.isLocked) return true
    // Also lock if the meeting date has passed (grace period expired)
    if (lockState.lockDeadline) {
      return new Date() >= new Date(lockState.lockDeadline)
    }
    return false
  }, [lockState])

  useEffect(() => {
    if (!lockState) return
    setMeetingDateInput(lockState.meetingDate || getDefaultMeetingDateIso(weekNumber, yearNumber))
    setMeetingGraceHours(lockState.graceHours || 24)
  }, [lockState, weekNumber, yearNumber])

  useEffect(() => {
    if (!weekSetupData) return
    setMeetingTimeInput(weekSetupData.meetingTime || "08:30")
    setKssDepartmentInput(weekSetupData.kssDepartment || "none")
    setKssPresenterIdInput(weekSetupData.kssPresenterId || "none")
  }, [weekSetupData])

  const saveMeetingWindow = async () => {
    if (!meetingDateInput) {
      toast.error("Meeting date is required")
      return
    }
    if (!meetingTimeInput) {
      toast.error("Meeting time is required")
      return
    }
    if (meetingGraceHours < 0 || meetingGraceHours > 24) {
      toast.error("Grace hours must be between 0 and 24")
      return
    }
    if (kssDepartmentInput === "none") {
      toast.error("KSS department is required")
      return
    }
    if (kssPresenterIdInput === "none") {
      toast.error("KSS presenter is required")
      return
    }

    setSavingMeetingWindow(true)
    try {
      const [meetingDateResponse, kssResult] = await Promise.all([
        fetch("/api/reports/meeting-date", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingWeek: weekNumber,
            meetingYear: yearNumber,
            meetingDate: meetingDateInput,
            meetingTime: meetingTimeInput,
          }),
        }),
        weekSetupData?.rosterId
          ? fetch("/api/reports/kss-roster", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: weekSetupData.rosterId,
                department: kssDepartmentInput,
                presenterId: kssPresenterIdInput,
                isActive: true,
              }),
            })
          : fetch("/api/reports/kss-roster", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                meetingWeek: weekNumber,
                meetingYear: yearNumber,
                department: kssDepartmentInput,
                presenterId: kssPresenterIdInput,
              }),
            }),
      ])

      const meetingDatePayload = await meetingDateResponse.json().catch(() => ({}))
      if (!meetingDateResponse.ok) {
        throw new Error(meetingDatePayload.error || "Failed to save meeting date")
      }

      const kssPayload = await kssResult.json().catch(() => ({}))
      if (!kssResult.ok) {
        throw new Error(kssPayload.error || "Failed to save KSS setup")
      }

      if (authUser?.id) {
        const { error: graceError } = await supabase.from("weekly_report_meeting_windows").upsert(
          {
            week_number: weekNumber,
            year: yearNumber,
            meeting_date: meetingDateInput,
            meeting_time: meetingTimeInput,
            grace_hours: meetingGraceHours,
            updated_by: authUser.id,
            created_by: authUser.id,
          },
          { onConflict: "week_number,year" }
        )

        if (graceError) throw new Error(graceError.message)
      } else {
        const { error: graceError } = await supabase
          .from("weekly_report_meeting_windows")
          .update({ grace_hours: meetingGraceHours, meeting_time: meetingTimeInput })
          .eq("week_number", weekNumber)
          .eq("year", yearNumber)

        if (graceError) throw new Error(graceError.message)
      }

      toast.success("Week setup saved")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminWeeklyReportLockState(weekNumber, yearNumber) }),
        queryClient.invalidateQueries({ queryKey: ["general-meeting-week-setup", weekNumber, yearNumber] }),
      ])
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save week setup")
    } finally {
      setSavingMeetingWindow(false)
    }
  }

  // ── Office Year Config ──────────────────────────────────────────────────────

  const { data: yearRows = [], isLoading: yearConfigLoading } = useQuery<OfficeYearRow[]>({
    queryKey: ["office-year-config"],
    queryFn: async () => {
      const res = await fetch("/api/reports/office-year-config")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load")
      return json.data
    },
  })

  const [newYear, setNewYear] = useState(currentYear + 1)
  const [newDay, setNewDay] = useState(12)
  const [editingYear, setEditingYear] = useState<number | null>(null)
  const [editDay, setEditDay] = useState(12)

  const saveYearMutation = useMutation({
    mutationFn: async ({ year, anchor_day }: { year: number; anchor_day: number }) => {
      const res = await fetch("/api/reports/office-year-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, anchor_day }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to save")
      return json.data
    },
    onSuccess: (_data, variables) => {
      toast.success(`Week 1 for ${variables.year} set to January ${variables.anchor_day}`)
      queryClient.invalidateQueries({ queryKey: ["office-year-config"] })
      setEditingYear(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const existingYears = new Set(yearRows.map((r) => r.year))
  const canAddNew = !existingYears.has(newYear)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="text-muted-foreground h-5 w-5" />
          <CardTitle className="text-base">{`Week Setup: W${weekNumber}, ${yearNumber}`}</CardTitle>
        </div>
        <CardDescription>
          Source of truth for reminders, meeting mail, KSS, Minutes of Meeting, Action Points, and the weekly report
          lock window.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ── Week Setup Fields (collapsible) ────────────────────────────────── */}
        <div>
          <button
            type="button"
            onClick={() => setShowWeekSetup(!showWeekSetup)}
            className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between text-sm font-medium transition-colors"
          >
            <span>Week Setup Fields</span>
            {showWeekSetup ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {showWeekSetup && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6 xl:items-end">
              <div className="w-full max-w-[160px]">
                <Label className="mb-1.5 block text-xs font-semibold">Week</Label>
                <Select value={String(weekNumber)} onValueChange={(value) => setWeekNumber(Number(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {weekOptions.map((week) => (
                      <SelectItem key={week} value={String(week)}>
                        Week {week}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full max-w-[140px]">
                <Label className="mb-1.5 block text-xs font-semibold">Year</Label>
                <Select value={String(yearNumber)} onValueChange={(value) => setYearNumber(Number(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full max-w-[220px]">
                <Label className="mb-1.5 block text-xs font-semibold">Actual Meeting Date</Label>
                <Input
                  type="date"
                  value={meetingDateInput}
                  onChange={(event) => setMeetingDateInput(event.target.value)}
                  disabled={isWeekSetupLocked}
                />
              </div>
              <div className="w-full max-w-[160px]">
                <Label className="mb-1.5 block text-xs font-semibold">Meeting Time</Label>
                <Input
                  type="time"
                  value={meetingTimeInput}
                  onChange={(event) => setMeetingTimeInput(event.target.value)}
                  disabled={isWeekSetupLocked}
                />
              </div>
              <div className="w-full min-w-[220px]">
                <Label className="mb-1.5 block text-xs font-semibold">KSS Department</Label>
                <Select
                  value={kssDepartmentInput}
                  onValueChange={(value) => {
                    setKssDepartmentInput(value)
                    setKssPresenterIdInput("none")
                  }}
                  disabled={isWeekSetupLocked}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select department</SelectItem>
                    {departmentOptions.map((department) => (
                      <SelectItem key={department} value={department}>
                        {department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full max-w-[180px]">
                <Label className="mb-1.5 block text-xs font-semibold">Grace Hours After Meeting</Label>
                <Input
                  type="number"
                  value={meetingGraceHours}
                  onChange={(event) => setMeetingGraceHours(parseInt(event.target.value, 10) || 0)}
                  min={0}
                  max={24}
                  disabled={isWeekSetupLocked}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(220px,320px)_1fr] md:items-end">
              <div className="w-full">
                <Label className="mb-1.5 block text-xs font-semibold">KSS Presenter</Label>
                <Select
                  value={kssPresenterIdInput}
                  onValueChange={setKssPresenterIdInput}
                  disabled={isWeekSetupLocked || kssDepartmentInput === "none"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select presenter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select presenter</SelectItem>
                    {presenterOptions.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={saveMeetingWindow}
                  disabled={savingMeetingWindow || isWeekSetupLocked}
                  className="gap-2"
                >
                  {savingMeetingWindow && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Week Setup
                </Button>
                <span className="text-muted-foreground text-[11px]">
                  {isWeekSetupLocked
                    ? "This week is locked after the meeting grace window, so the setup is read-only."
                    : "Saving here updates the week's meeting date, meeting time, KSS presenter, and lock grace window together."}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Office Year Configuration (collapsible) ────────────────────────── */}
        <div className="border-t pt-4">
          <button
            type="button"
            onClick={() => setShowYearConfig(!showYearConfig)}
            className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between text-sm font-medium transition-colors"
          >
            <span>Office Year Configuration</span>
            {showYearConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <p className="text-muted-foreground mt-1 text-xs">
            Set which January day Week 1 starts on for each year. Locked years cannot be changed.
          </p>

          {showYearConfig && (
            <div className="mt-4 space-y-4">
              {yearConfigLoading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : (
                <div className="space-y-2">
                  {yearRows.map((row) => (
                    <div
                      key={row.year}
                      className="bg-muted/50 flex items-center justify-between gap-4 rounded-lg border px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">{row.year}</span>
                        {row.is_locked && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Lock className="h-3 w-3" /> Locked
                          </Badge>
                        )}
                      </div>

                      {editingYear === row.year && !row.is_locked ? (
                        <div className="flex items-center gap-2">
                          <Label className="text-xs whitespace-nowrap">January</Label>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            value={editDay}
                            onChange={(e) => setEditDay(Number(e.target.value))}
                            className="w-20"
                          />
                          <Button
                            size="sm"
                            onClick={() => saveYearMutation.mutate({ year: row.year, anchor_day: editDay })}
                            disabled={saveYearMutation.isPending}
                          >
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingYear(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground text-sm">Week 1 starts January {row.anchor_day}</span>
                          {!row.is_locked && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingYear(row.year)
                                setEditDay(row.anchor_day)
                              }}
                            >
                              Edit
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Year</Label>
                  <Input
                    type="number"
                    min={currentYear}
                    max={2100}
                    value={newYear}
                    onChange={(e) => setNewYear(Number(e.target.value))}
                    className="w-24"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">January start day</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={newDay}
                    onChange={(e) => setNewDay(Number(e.target.value))}
                    className="w-20"
                  />
                </div>
                <Button
                  size="sm"
                  disabled={!canAddNew || saveYearMutation.isPending}
                  onClick={() => saveYearMutation.mutate({ year: newYear, anchor_day: newDay })}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add {newYear}
                </Button>
                {!canAddNew && existingYears.has(newYear) && (
                  <p className="text-muted-foreground text-xs">{newYear} already exists above.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
