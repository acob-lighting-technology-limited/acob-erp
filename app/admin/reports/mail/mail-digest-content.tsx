"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { toast } from "sonner"
import { PageWrapper, PageHeader } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Mail,
  Send,
  Clock,
  Users,
  UserPlus,
  FileText,
  ClipboardList,
  X,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  CalendarDays,
  Repeat,
  Trash2,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Employee = {
  id: string
  full_name: string
  company_email: string
  department: string | null
  employment_status: string | null
}

type RecipientMode = "all" | "select" | "manual" | "all_plus"
type ContentChoice = "both" | "weekly_report" | "action_tracker"
type SendTiming = "now" | "scheduled" | "recurring"

interface Props {
  employees: Employee[]
}

export function MailDigestContent({ employees }: Props) {
  const supabase = createClient()

  // ── State ──────────────────────────────────────────────────────────────────
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("all")
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set())
  const [manualEmails, setManualEmails] = useState<string[]>([])
  const [manualInput, setManualInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const [contentChoice, setContentChoice] = useState<ContentChoice>("both")

  const currentYear = new Date().getFullYear()
  const currentWeekNumber = getISOWeek()
  // Default = CURRENT week (the meeting week)
  const [weekNumber, setWeekNumber] = useState(currentWeekNumber)
  const [yearNumber, setYearNumber] = useState(currentYear)

  const [sendTiming, setSendTiming] = useState<SendTiming>("now")
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("09:00")
  const [recurringDay, setRecurringDay] = useState("monday")
  const [recurringTime, setRecurringTime] = useState("09:00")

  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState<any>(null)

  // Active schedules from DB
  const [activeSchedules, setActiveSchedules] = useState<any[]>([])
  const [loadingSchedules, setLoadingSchedules] = useState(false)

  // ── Fetch active schedules ──────────────────────────────────────────────────
  const fetchSchedules = useCallback(async () => {
    setLoadingSchedules(true)
    try {
      const { data, error } = await supabase
        .from("digest_schedules")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
      if (!error && data) setActiveSchedules(data)
    } catch {
      /* ignore */
    } finally {
      setLoadingSchedules(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])

  // ── Computed ────────────────────────────────────────────────────────────────
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees
    const q = searchQuery.toLowerCase()
    return employees.filter(
      (e) =>
        e.full_name?.toLowerCase().includes(q) ||
        e.company_email?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q)
    )
  }, [employees, searchQuery])

  const resolvedRecipients = useMemo(() => {
    const emails: string[] = []
    if (recipientMode === "all" || recipientMode === "all_plus") {
      employees.forEach((e) => {
        if (e.company_email) emails.push(e.company_email)
      })
    } else if (recipientMode === "select") {
      employees.forEach((e) => {
        if (selectedEmployeeIds.has(e.id) && e.company_email) emails.push(e.company_email)
      })
    }
    if (recipientMode === "manual" || recipientMode === "all_plus") {
      manualEmails.forEach((m) => {
        if (!emails.includes(m)) emails.push(m)
      })
    }
    return emails
  }, [recipientMode, employees, selectedEmployeeIds, manualEmails])

  // Meeting week = weekNumber. Action tracker is the SAME meeting week.
  // Work done data is fetched internally from (weekNumber - 1).
  const actionTrackerWeek = weekNumber
  const actionTrackerYear = yearNumber

  // ── Handlers ────────────────────────────────────────────────────────────────
  const toggleEmployee = useCallback((id: string) => {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedEmployeeIds(new Set(employees.map((e) => e.id)))
  }, [employees])

  const deselectAll = useCallback(() => {
    setSelectedEmployeeIds(new Set())
  }, [])

  const addManualEmail = useCallback(() => {
    const email = manualInput.trim().toLowerCase()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Invalid email address")
      return
    }
    if (manualEmails.includes(email)) {
      toast.error("Email already added")
      return
    }
    setManualEmails((prev) => [...prev, email])
    setManualInput("")
  }, [manualInput, manualEmails])

  const removeManualEmail = useCallback((email: string) => {
    setManualEmails((prev) => prev.filter((e) => e !== email))
  }, [])

  const handleSend = async () => {
    if (resolvedRecipients.length === 0) {
      toast.error("No recipients selected")
      return
    }

    // ── Scheduled: save to DB ────────────────────────────────────────────
    if (sendTiming === "scheduled") {
      if (!scheduledDate) {
        toast.error("Please set a scheduled date")
        return
      }
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`)
      if (scheduledDateTime <= new Date()) {
        toast.error("Scheduled time must be in the future")
        return
      }

      const { error } = await supabase.from("digest_schedules").insert({
        schedule_type: "one_time",
        meeting_week: weekNumber,
        meeting_year: yearNumber,
        recipients: resolvedRecipients,
        content_choice: contentChoice,
        next_run_at: scheduledDateTime.toISOString(),
      })

      if (error) {
        toast.error("Failed to save schedule: " + error.message)
        return
      }

      toast.success(
        `Email scheduled for ${scheduledDateTime.toLocaleString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}`
      )
      fetchSchedules()
      return
    }

    // ── Recurring: save to DB ────────────────────────────────────────────
    if (sendTiming === "recurring") {
      const { error } = await supabase.from("digest_schedules").insert({
        schedule_type: "recurring",
        recipients: resolvedRecipients,
        content_choice: "both", // Recurring always sends both reports
        send_day: recurringDay,
        send_time: recurringTime,
      })

      if (error) {
        toast.error("Failed to save recurring schedule: " + error.message)
        return
      }

      toast.success(`Recurring weekly email set for every ${capitalize(recurringDay)} at ${recurringTime}`)
      fetchSchedules()
      return
    }

    // ── Immediate ────────────────────────────────────────────────────────
    await doSend()
  }

  const doSend = async () => {
    setIsSending(true)
    setSendResult(null)
    const toastId = toast.loading(`Sending digest to ${resolvedRecipients.length} recipient(s)...`)

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const payload: any = {
        recipients: resolvedRecipients,
        meetingWeek: weekNumber,
        meetingYear: yearNumber,
      }

      if (contentChoice === "weekly_report") {
        payload.skipActionTracker = true
      } else if (contentChoice === "action_tracker") {
        payload.skipWeeklyReport = true
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/send-weekly-digest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(payload),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Failed to send digest")

      setSendResult(result)
      const successCount = result.results?.filter((r: any) => r.success).length || 0
      const failCount = result.results?.filter((r: any) => !r.success).length || 0

      if (failCount === 0) {
        toast.success(`✅ Digest sent to ${successCount} recipient(s)`, { id: toastId })
      } else {
        toast.warning(`Sent to ${successCount}, failed for ${failCount}`, { id: toastId })
      }
    } catch (err: any) {
      console.error("[Mail Digest Error]", err)
      toast.error(err.message || "Failed to send digest", { id: toastId })
    } finally {
      setIsSending(false)
    }
  }

  const deactivateSchedule = async (id: string) => {
    const { error } = await supabase.from("digest_schedules").update({ is_active: false }).eq("id", id)
    if (error) {
      toast.error("Failed to deactivate schedule")
    } else {
      toast.success("Schedule deactivated")
      fetchSchedules()
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const weekOptions = Array.from({ length: 52 }, (_, i) => i + 1)
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1]

  const departments = useMemo(() => {
    const depts = new Set(employees.map((e) => e.department).filter(Boolean))
    return Array.from(depts).sort() as string[]
  }, [employees])

  // Work done is from the previous week
  const workDoneWeek = weekNumber > 1 ? weekNumber - 1 : 52
  const workDoneYear = weekNumber > 1 ? yearNumber : yearNumber - 1

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="General Meeting Mailing"
        description="Send weekly report digests and action trackers to selected recipients."
        icon={Mail}
        backLink={{ href: "/admin/reports", label: "Back to Reports" }}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── LEFT: Settings ────────────────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Week Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-5 w-5 text-green-600" />
                Meeting Week
              </CardTitle>
              <CardDescription>Choose which general meeting week to send</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label htmlFor="week-select">Meeting Week</Label>
                  <Select value={String(weekNumber)} onValueChange={(v) => setWeekNumber(Number(v))}>
                    <SelectTrigger id="week-select" className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {weekOptions.map((w) => (
                        <SelectItem key={w} value={String(w)}>
                          Week {w}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year-select">Year</Label>
                  <Select value={String(yearNumber)} onValueChange={(v) => setYearNumber(Number(v))}>
                    <SelectTrigger id="year-select" className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-muted-foreground space-y-1 text-sm">
                  <p>
                    Cover / Email: <Badge variant="outline">Week {weekNumber}</Badge>
                  </p>
                  <p>
                    Work Done from: <Badge variant="secondary">Week {workDoneWeek}</Badge>
                  </p>
                  <p>
                    Action Tracker: <Badge variant="outline">Week {actionTrackerWeek}</Badge>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content Choice */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-blue-600" />
                Content to Send
              </CardTitle>
              <CardDescription>Choose which attachments to include</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {[
                  { value: "both", label: "Both Reports", icon: FileText, desc: "Weekly Report + Action Tracker" },
                  {
                    value: "weekly_report",
                    label: "Weekly Report Only",
                    icon: FileText,
                    desc: "Departmental work done, tasks & challenges",
                  },
                  {
                    value: "action_tracker",
                    label: "Action Tracker Only",
                    icon: ClipboardList,
                    desc: "Upcoming action items & completion status",
                  },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setContentChoice(opt.value as ContentChoice)}
                    className={`flex min-w-[180px] flex-1 items-start gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                      contentChoice === opt.value
                        ? "border-green-600 bg-green-50 dark:border-green-500 dark:bg-green-950/30"
                        : "hover:border-muted-foreground/30 bg-muted/30 border-transparent"
                    }`}
                  >
                    <opt.icon
                      className={`mt-0.5 h-5 w-5 shrink-0 ${contentChoice === opt.value ? "text-green-600" : "text-muted-foreground"}`}
                    />
                    <div>
                      <div
                        className={`font-semibold ${contentChoice === opt.value ? "text-green-700 dark:text-green-400" : ""}`}
                      >
                        {opt.label}
                      </div>
                      <div className="text-muted-foreground mt-0.5 text-xs">{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recipient Mode */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-purple-600" />
                Recipients
              </CardTitle>
              <CardDescription>Choose who receives the email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mode Pills */}
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all", label: "All Employees", icon: Users },
                  { value: "select", label: "Select Specific", icon: UserPlus },
                  { value: "manual", label: "Enter Manually", icon: Mail },
                  { value: "all_plus", label: "All + Add More", icon: Plus },
                ].map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setRecipientMode(mode.value as RecipientMode)}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                      recipientMode === mode.value
                        ? "bg-green-600 text-white shadow-md"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    <mode.icon className="h-4 w-4" />
                    {mode.label}
                  </button>
                ))}
              </div>

              {/* Employee Selection (for "select" mode) */}
              {recipientMode === "select" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                      <Input
                        placeholder="Search by name, email, or department..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAll}>
                      Clear
                    </Button>
                  </div>
                  <div className="max-h-[320px] space-y-1 overflow-y-auto rounded-lg border p-2">
                    {filteredEmployees.map((emp) => (
                      <label
                        key={emp.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors ${
                          selectedEmployeeIds.has(emp.id) ? "bg-green-50 dark:bg-green-950/20" : "hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          checked={selectedEmployeeIds.has(emp.id)}
                          onCheckedChange={() => toggleEmployee(emp.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{emp.full_name}</div>
                          <div className="text-muted-foreground truncate text-xs">{emp.company_email}</div>
                        </div>
                        {emp.department && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            {emp.department}
                          </Badge>
                        )}
                      </label>
                    ))}
                    {filteredEmployees.length === 0 && (
                      <div className="text-muted-foreground py-8 text-center text-sm">No employees found</div>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {selectedEmployeeIds.size} of {employees.length} selected
                  </p>
                </div>
              )}

              {/* Manual Email Input (for "manual" and "all_plus" modes) */}
              {(recipientMode === "manual" || recipientMode === "all_plus") && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter email address..."
                      type="email"
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addManualEmail()
                        }
                      }}
                      className="flex-1"
                    />
                    <Button variant="outline" onClick={addManualEmail}>
                      <Plus className="mr-1 h-4 w-4" /> Add
                    </Button>
                  </div>
                  {manualEmails.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {manualEmails.map((email) => (
                        <Badge key={email} variant="secondary" className="gap-1.5 py-1.5 pr-1.5 pl-3">
                          {email}
                          <button
                            type="button"
                            onClick={() => removeManualEmail(email)}
                            className="hover:bg-destructive/20 rounded-full p-0.5 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  {recipientMode === "all_plus" && (
                    <p className="text-muted-foreground text-xs">
                      All {employees.length} employee emails will be included, plus any emails you add above.
                    </p>
                  )}
                </div>
              )}

              {recipientMode === "all" && (
                <p className="text-muted-foreground text-sm">
                  The digest will be sent to all <strong>{employees.length}</strong> active employees.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Send Timing */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-orange-600" />
                Delivery Timing
              </CardTitle>
              <CardDescription>Send now, schedule once, or set up recurring weekly delivery</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setSendTiming("now")}
                  className={`flex min-w-[150px] flex-1 items-center gap-3 rounded-lg border-2 p-4 transition-all ${
                    sendTiming === "now"
                      ? "border-green-600 bg-green-50 dark:border-green-500 dark:bg-green-950/30"
                      : "hover:border-muted-foreground/30 bg-muted/30 border-transparent"
                  }`}
                >
                  <Send className={`h-5 w-5 ${sendTiming === "now" ? "text-green-600" : "text-muted-foreground"}`} />
                  <div className="text-left">
                    <div
                      className={`font-semibold ${sendTiming === "now" ? "text-green-700 dark:text-green-400" : ""}`}
                    >
                      Send Immediately
                    </div>
                    <div className="text-muted-foreground text-xs">Email will be sent right away</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSendTiming("scheduled")}
                  className={`flex min-w-[150px] flex-1 items-center gap-3 rounded-lg border-2 p-4 transition-all ${
                    sendTiming === "scheduled"
                      ? "border-green-600 bg-green-50 dark:border-green-500 dark:bg-green-950/30"
                      : "hover:border-muted-foreground/30 bg-muted/30 border-transparent"
                  }`}
                >
                  <Clock
                    className={`h-5 w-5 ${sendTiming === "scheduled" ? "text-green-600" : "text-muted-foreground"}`}
                  />
                  <div className="text-left">
                    <div
                      className={`font-semibold ${sendTiming === "scheduled" ? "text-green-700 dark:text-green-400" : ""}`}
                    >
                      Schedule
                    </div>
                    <div className="text-muted-foreground text-xs">One-time, pick a date & time</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSendTiming("recurring")}
                  className={`flex min-w-[150px] flex-1 items-center gap-3 rounded-lg border-2 p-4 transition-all ${
                    sendTiming === "recurring"
                      ? "border-green-600 bg-green-50 dark:border-green-500 dark:bg-green-950/30"
                      : "hover:border-muted-foreground/30 bg-muted/30 border-transparent"
                  }`}
                >
                  <Repeat
                    className={`h-5 w-5 ${sendTiming === "recurring" ? "text-green-600" : "text-muted-foreground"}`}
                  />
                  <div className="text-left">
                    <div
                      className={`font-semibold ${sendTiming === "recurring" ? "text-green-700 dark:text-green-400" : ""}`}
                    >
                      Recurring
                    </div>
                    <div className="text-muted-foreground text-xs">Automatic every week (server-side)</div>
                  </div>
                </button>
              </div>

              {sendTiming === "scheduled" && (
                <div className="flex flex-wrap gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sched-date">Date</Label>
                    <Input
                      id="sched-date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-[180px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sched-time">Time</Label>
                    <Input
                      id="sched-time"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-[140px]"
                    />
                  </div>
                </div>
              )}

              {sendTiming === "recurring" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="recurring-day">Day of Week</Label>
                      <Select value={recurringDay} onValueChange={setRecurringDay}>
                        <SelectTrigger id="recurring-day" className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((d) => (
                            <SelectItem key={d} value={d}>
                              {capitalize(d)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="recurring-time">Time</Label>
                      <Input
                        id="recurring-time"
                        type="time"
                        value={recurringTime}
                        onChange={(e) => setRecurringTime(e.target.value)}
                        className="w-[140px]"
                      />
                    </div>
                  </div>
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Repeat className="h-3.5 w-3.5" />
                    Runs server-side — no need to keep your computer on. The meeting week is auto-calculated each time.
                  </p>
                </div>
              )}

              {/* Active Schedules */}
              {activeSchedules.length > 0 && (
                <div className="space-y-2 border-t pt-2">
                  <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    Active Schedules
                  </div>
                  {activeSchedules.map((s) => (
                    <div
                      key={s.id}
                      className="bg-muted/40 flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {s.schedule_type === "recurring" ? (
                          <Repeat className="h-4 w-4 text-green-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-orange-600" />
                        )}
                        <span>
                          {s.schedule_type === "recurring"
                            ? `Every ${capitalize(s.send_day || "monday")} at ${s.send_time || "09:00"}`
                            : `One-time: W${s.meeting_week} — ${new Date(s.next_run_at).toLocaleString("en-GB", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {(s.recipients as string[])?.length || 0} recipients
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-7 w-7 p-0"
                        onClick={() => deactivateSchedule(s.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT: Summary & Send ─────────────────────────────────────── */}
        <div className="space-y-6">
          <Card className="sticky top-6 border-green-200 dark:border-green-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Week info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Meeting Week</span>
                  <Badge>
                    W{weekNumber}, {yearNumber}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Work Done</span>
                  <Badge variant="secondary">
                    W{workDoneWeek}, {workDoneYear}
                  </Badge>
                </div>
                {contentChoice !== "weekly_report" && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tracker Week</span>
                    <Badge variant="outline">
                      W{actionTrackerWeek}, {actionTrackerYear}
                    </Badge>
                  </div>
                )}
              </div>

              <div className="border-t" />

              {/* Content */}
              <div className="space-y-1">
                <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">Attachments</div>
                <div className="flex flex-wrap gap-1.5">
                  {(contentChoice === "both" || contentChoice === "weekly_report") && (
                    <Badge variant="secondary" className="gap-1">
                      <FileText className="h-3 w-3" /> Weekly Report
                    </Badge>
                  )}
                  {(contentChoice === "both" || contentChoice === "action_tracker") && (
                    <Badge variant="secondary" className="gap-1">
                      <ClipboardList className="h-3 w-3" /> Action Tracker
                    </Badge>
                  )}
                </div>
              </div>

              <div className="border-t" />

              {/* Recipients */}
              <div className="space-y-1">
                <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">Recipients</div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <span className="text-2xl font-bold">{resolvedRecipients.length}</span>
                  <span className="text-muted-foreground text-sm">email(s)</span>
                </div>
                {resolvedRecipients.length > 0 && resolvedRecipients.length <= 10 && (
                  <div className="text-muted-foreground mt-2 max-h-[120px] space-y-0.5 overflow-y-auto text-xs">
                    {resolvedRecipients.map((email) => (
                      <div key={email} className="truncate">
                        {email}
                      </div>
                    ))}
                  </div>
                )}
                {resolvedRecipients.length > 10 && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {resolvedRecipients.slice(0, 3).join(", ")} and {resolvedRecipients.length - 3} more...
                  </p>
                )}
              </div>

              <div className="border-t" />

              {/* Timing */}
              <div className="space-y-1">
                <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">Delivery</div>
                <div className="flex items-center gap-2 text-sm">
                  {sendTiming === "now" ? (
                    <>
                      <Send className="h-4 w-4 text-green-600" />
                      <span>Immediately</span>
                    </>
                  ) : sendTiming === "recurring" ? (
                    <>
                      <Repeat className="h-4 w-4 text-green-600" />
                      <span>
                        Every {capitalize(recurringDay)} at {recurringTime}
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 text-orange-600" />
                      <span>
                        {scheduledDate
                          ? new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString("en-GB", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Not set"}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <Button
                className="mt-4 w-full bg-green-600 text-white hover:bg-green-700"
                size="lg"
                disabled={isSending || resolvedRecipients.length === 0}
                onClick={handleSend}
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : sendTiming === "scheduled" ? (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Schedule Send
                  </>
                ) : sendTiming === "recurring" ? (
                  <>
                    <Repeat className="mr-2 h-4 w-4" />
                    Save Recurring
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Now
                  </>
                )}
              </Button>

              {resolvedRecipients.length === 0 && (
                <p className="text-destructive text-center text-xs">
                  <AlertCircle className="mr-1 inline h-3 w-3" />
                  No recipients selected
                </p>
              )}
            </CardContent>
          </Card>

          {/* Send Results */}
          {sendResult?.results && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Send Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[300px] space-y-1 overflow-y-auto">
                  {sendResult.results.map((r: any, i: number) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between rounded px-2 py-1.5 text-sm ${
                        r.success ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"
                      }`}
                    >
                      <span className="truncate">{r.to}</span>
                      {r.success ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getISOWeek(): number {
  const now = new Date()
  const jan4 = new Date(now.getFullYear(), 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setDate(jan4.getDate() - (dayOfWeek - 1))
  const diff = now.getTime() - week1Monday.getTime()
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
