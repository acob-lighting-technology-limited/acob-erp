"use client"

import { useState, useMemo, useCallback } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { PageWrapper, PageHeader } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Megaphone,
  Send,
  Users,
  UserPlus,
  Mail,
  X,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  Calendar,
  Clock,
  Video,
  BookOpen,
  Repeat,
} from "lucide-react"

type Employee = {
  id: string
  full_name: string
  company_email: string
  department: string | null
  employment_status: string | null
}

type RecipientMode = "all" | "select" | "manual" | "all_plus"
type ReminderType = "meeting" | "knowledge_sharing"
type SendTiming = "now" | "scheduled" | "recurring"

interface Props {
  employees: Employee[]
}

const DEFAULT_TEAMS_LINK =
  "https://teams.microsoft.com/l/meetup-join/19%3ameeting_MWZhNTgwYjEtMzdjMi00ZDZkLWJhM2YtZjFiNjgxNDEzN2Nk%40thread.v2/0?context=%7b%22Tid%22%3a%22b1f048ac-9f61-4cfd-98a3-13454b2682e5%22%2c%22Oid%22%3a%22224317b2-9cfb-425c-bc86-57bb397c73cd%22%7d"

const DEFAULT_AGENDA = [
  "Opening Prayer",
  "Knowledge Sharing Session (30 minutes)",
  "Departmental Updates",
  "Progress on Ongoing Projects",
  "Upcoming Events and Deadlines",
  "Any Other Business",
  "Adjournment",
]

function getNextMondayFormatted(): string {
  const now = new Date()
  const day = now.getDay()
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day
  const nextMonday = new Date(now)
  nextMonday.setDate(now.getDate() + daysUntilMonday)
  return nextMonday.toISOString().split("T")[0]
}

function formatDateNice(dateStr: string): string {
  if (!dateStr) return ""
  const d = new Date(dateStr + "T00:00:00")
  const day = d.getDate()
  const suffix = [1, 21, 31].includes(day) ? "st" : [2, 22].includes(day) ? "nd" : [3, 23].includes(day) ? "rd" : "th"
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long" })
  const month = d.toLocaleDateString("en-GB", { month: "long" })
  const year = d.getFullYear()
  return `${weekday} ${day}${suffix} ${month} ${year}`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function MeetingRemindersContent({ employees }: Props) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [reminderType, setReminderType] = useState<ReminderType>("meeting")
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("all")
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set())
  const [manualEmails, setManualEmails] = useState<string[]>([])
  const [manualInput, setManualInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  // Meeting fields
  const [meetingDate, setMeetingDate] = useState(getNextMondayFormatted())
  const [meetingTime, setMeetingTime] = useState("08:30")
  const [teamsLink, setTeamsLink] = useState(DEFAULT_TEAMS_LINK)
  const [agendaText, setAgendaText] = useState(DEFAULT_AGENDA.join("\n"))

  // Knowledge sharing fields
  const [sessionDate, setSessionDate] = useState(getNextMondayFormatted())
  const [sessionTime, setSessionTime] = useState("08:30")
  const [duration, setDuration] = useState("30 minutes")

  // Delivery timing
  const [sendTiming, setSendTiming] = useState<SendTiming>("now")
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("09:00")
  const [recurringDay, setRecurringDay] = useState("sunday")
  const [recurringTime, setRecurringTime] = useState("18:00")

  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState<any>(null)

  const supabase = createClient()

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

    // For scheduled/recurring, save the schedule to DB
    if (sendTiming === "scheduled" || sendTiming === "recurring") {
      const toastId = toast.loading("Saving schedule...")
      try {
        const schedulePayload: any = {
          schedule_type: sendTiming === "scheduled" ? "one_time" : "recurring",
          reminder_type: reminderType,
          recipients: resolvedRecipients,
          is_active: true,
          send_day: sendTiming === "recurring" ? recurringDay : null,
          send_time: sendTiming === "recurring" ? recurringTime : scheduledTime,
          meeting_config: {
            type: reminderType,
            meetingDate: reminderType === "meeting" ? meetingDate : undefined,
            meetingTime: reminderType === "meeting" ? meetingTime : undefined,
            teamsLink: reminderType === "meeting" ? teamsLink : undefined,
            agenda: reminderType === "meeting" ? agendaText : undefined,
            sessionDate: reminderType === "knowledge_sharing" ? sessionDate : undefined,
            sessionTime: reminderType === "knowledge_sharing" ? sessionTime : undefined,
            duration: reminderType === "knowledge_sharing" ? duration : undefined,
          },
        }

        if (sendTiming === "scheduled") {
          schedulePayload.next_run_at = new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
        } else {
          // For recurring, calculate next run
          const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
          const targetDay = days.indexOf(recurringDay)
          const now = new Date()
          const currentDay = now.getDay()
          let daysUntil = targetDay - currentDay
          if (daysUntil <= 0) daysUntil += 7
          const nextRun = new Date(now)
          nextRun.setDate(now.getDate() + daysUntil)
          const [h, m] = recurringTime.split(":")
          nextRun.setHours(parseInt(h), parseInt(m), 0, 0)
          schedulePayload.next_run_at = nextRun.toISOString()
        }

        const { error } = await supabase.from("reminder_schedules").insert(schedulePayload)
        if (error) throw error

        toast.success(
          sendTiming === "scheduled"
            ? `✅ Scheduled for ${new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : `✅ Recurring every ${capitalize(recurringDay)} at ${recurringTime}`,
          { id: toastId }
        )
      } catch (err: any) {
        console.error("[Schedule Error]", err)
        toast.error(err.message || "Failed to save schedule", { id: toastId })
      }
      return
    }

    // Send immediately
    setIsSending(true)
    setSendResult(null)
    const label = reminderType === "meeting" ? "Meeting Reminder" : "Knowledge Sharing Reminder"
    const toastId = toast.loading(`Sending ${label} to ${resolvedRecipients.length} recipient(s)...`)

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const payload: any = {
        type: reminderType,
        recipients: resolvedRecipients,
      }

      if (reminderType === "meeting") {
        payload.meetingDate = formatDateNice(meetingDate)
        payload.meetingTime = new Date(`2000-01-01T${meetingTime}`).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
        payload.teamsLink = teamsLink
        payload.agenda = agendaText
          .split("\n")
          .map((l) => l.replace(/^\d+\.\s*/, "").trim())
          .filter(Boolean)
      } else {
        payload.sessionDate = formatDateNice(sessionDate)
        payload.sessionTime = sessionTime
        payload.duration = duration
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/send-meeting-reminder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send")

      setSendResult(data)
      const successCount = data.results?.filter((r: any) => r.success).length || 0
      const failCount = data.results?.filter((r: any) => !r.success).length || 0

      if (failCount === 0) {
        toast.success(`✅ ${label} sent to ${successCount} recipient(s)`, { id: toastId })
      } else {
        toast.warning(`Sent to ${successCount}, failed for ${failCount}`, { id: toastId })
      }
    } catch (err: any) {
      console.error("[Meeting Reminder Error]", err)
      toast.error(err.message || "Failed to send", { id: toastId })
    } finally {
      setIsSending(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Meeting Reminders"
        description="Send general meeting and knowledge sharing session reminders to all employees."
        icon={Megaphone}
        backLink={{ href: "/admin/reports", label: "Back to Reports" }}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── LEFT: Settings ────────────────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Reminder Type */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-orange-600" />
                Reminder Type
              </CardTitle>
              <CardDescription>Choose which reminder to send</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {[
                  {
                    value: "meeting" as ReminderType,
                    label: "General Meeting Reminder",
                    icon: Video,
                    desc: "Weekly meeting with agenda & Teams link",
                  },
                  {
                    value: "knowledge_sharing" as ReminderType,
                    label: "Knowledge Sharing Session",
                    icon: BookOpen,
                    desc: "Pre-meeting knowledge sharing reminder",
                  },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setReminderType(opt.value)}
                    className={`flex min-w-[240px] flex-1 items-start gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                      reminderType === opt.value
                        ? "border-orange-600 bg-orange-50 dark:border-orange-500 dark:bg-orange-950/30"
                        : "hover:border-muted-foreground/30 bg-muted/30 border-transparent"
                    }`}
                  >
                    <opt.icon
                      className={`mt-0.5 h-5 w-5 shrink-0 ${reminderType === opt.value ? "text-orange-600" : "text-muted-foreground"}`}
                    />
                    <div>
                      <div
                        className={`font-semibold ${reminderType === opt.value ? "text-orange-700 dark:text-orange-400" : ""}`}
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

          {/* Meeting Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
                {reminderType === "meeting" ? "Meeting Details" : "Session Details"}
              </CardTitle>
              <CardDescription>
                {reminderType === "meeting"
                  ? "Configure the meeting date, time, Teams link, and agenda"
                  : "Configure the session date, time, and duration"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {reminderType === "meeting" ? (
                <>
                  <div className="flex flex-wrap gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="meet-date">Meeting Date</Label>
                      <Input
                        id="meet-date"
                        type="date"
                        value={meetingDate}
                        onChange={(e) => setMeetingDate(e.target.value)}
                        className="w-[180px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="meet-time">Meeting Time</Label>
                      <Input
                        id="meet-time"
                        type="time"
                        value={meetingTime}
                        onChange={(e) => setMeetingTime(e.target.value)}
                        className="w-[140px]"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teams-link">Microsoft Teams Link</Label>
                    <Input
                      id="teams-link"
                      placeholder="Paste Microsoft Teams meeting link..."
                      value={teamsLink}
                      onChange={(e) => setTeamsLink(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agenda">Agenda (one item per line)</Label>
                    <Textarea
                      id="agenda"
                      value={agendaText}
                      onChange={(e) => setAgendaText(e.target.value)}
                      rows={8}
                      placeholder={"1. Opening Prayer\n2. Departmental updates\n..."}
                    />
                    <p className="text-muted-foreground text-xs">
                      Each line becomes one agenda item. Numbering is automatic.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="session-date">Session Date</Label>
                      <Input
                        id="session-date"
                        type="date"
                        value={sessionDate}
                        onChange={(e) => setSessionDate(e.target.value)}
                        className="w-[180px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="session-time">Session Time</Label>
                      <Input
                        id="session-time"
                        type="time"
                        value={sessionTime}
                        onChange={(e) => setSessionTime(e.target.value)}
                        className="w-[140px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="session-duration">Duration</Label>
                      <Input
                        id="session-duration"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        placeholder="e.g. 30 minutes"
                        className="w-[160px]"
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Recipient Mode */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-purple-600" />
                Recipients
              </CardTitle>
              <CardDescription>Choose who receives the reminder</CardDescription>
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
                        ? "bg-orange-600 text-white shadow-md"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    <mode.icon className="h-4 w-4" />
                    {mode.label}
                  </button>
                ))}
              </div>

              {/* Employee Selection */}
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
                          selectedEmployeeIds.has(emp.id) ? "bg-orange-50 dark:bg-orange-950/20" : "hover:bg-muted/50"
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

              {/* Manual Email Input */}
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
                  The reminder will be sent to all <strong>{employees.length}</strong> active employees.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Delivery Timing */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-orange-600" />
                Delivery Timing
              </CardTitle>
              <CardDescription>Send now, schedule once, or set up recurring delivery</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setSendTiming("now")}
                  className={`flex min-w-[150px] flex-1 items-center gap-3 rounded-lg border-2 p-4 transition-all ${
                    sendTiming === "now"
                      ? "border-orange-600 bg-orange-50 dark:border-orange-500 dark:bg-orange-950/30"
                      : "hover:border-muted-foreground/30 bg-muted/30 border-transparent"
                  }`}
                >
                  <Send className={`h-5 w-5 ${sendTiming === "now" ? "text-orange-600" : "text-muted-foreground"}`} />
                  <div className="text-left">
                    <div
                      className={`font-semibold ${sendTiming === "now" ? "text-orange-700 dark:text-orange-400" : ""}`}
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
                      ? "border-orange-600 bg-orange-50 dark:border-orange-500 dark:bg-orange-950/30"
                      : "hover:border-muted-foreground/30 bg-muted/30 border-transparent"
                  }`}
                >
                  <Clock
                    className={`h-5 w-5 ${sendTiming === "scheduled" ? "text-orange-600" : "text-muted-foreground"}`}
                  />
                  <div className="text-left">
                    <div
                      className={`font-semibold ${sendTiming === "scheduled" ? "text-orange-700 dark:text-orange-400" : ""}`}
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
                      ? "border-orange-600 bg-orange-50 dark:border-orange-500 dark:bg-orange-950/30"
                      : "hover:border-muted-foreground/30 bg-muted/30 border-transparent"
                  }`}
                >
                  <Repeat
                    className={`h-5 w-5 ${sendTiming === "recurring" ? "text-orange-600" : "text-muted-foreground"}`}
                  />
                  <div className="text-left">
                    <div
                      className={`font-semibold ${sendTiming === "recurring" ? "text-orange-700 dark:text-orange-400" : ""}`}
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
                          {["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].map((d) => (
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
                    Runs server-side — no need to keep your computer on. The reminder is sent automatically each week.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT: Summary & Send ─────────────────────────────────────── */}
        <div className="space-y-6">
          <Card className="sticky top-6 border-orange-200 dark:border-orange-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Type */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <Badge variant="outline" className="gap-1">
                    {reminderType === "meeting" ? (
                      <>
                        <Video className="h-3 w-3" /> Meeting
                      </>
                    ) : (
                      <>
                        <BookOpen className="h-3 w-3" /> Knowledge Sharing
                      </>
                    )}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Date</span>
                  <Badge>
                    {reminderType === "meeting"
                      ? meetingDate
                        ? formatDateNice(meetingDate)
                        : "Not set"
                      : sessionDate
                        ? formatDateNice(sessionDate)
                        : "Not set"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Time</span>
                  <Badge variant="secondary">{reminderType === "meeting" ? meetingTime : sessionTime}</Badge>
                </div>
              </div>

              <div className="border-t" />

              {/* Recipients */}
              <div className="space-y-1">
                <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">Recipients</div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-600" />
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

              {/* Delivery */}
              <div className="space-y-1">
                <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">Delivery</div>
                <div className="flex items-center gap-2 text-sm">
                  {sendTiming === "now" ? (
                    <>
                      <Send className="h-4 w-4 text-orange-600" />
                      <span>Immediately</span>
                    </>
                  ) : sendTiming === "recurring" ? (
                    <>
                      <Repeat className="h-4 w-4 text-orange-600" />
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
                className="mt-4 w-full bg-orange-600 text-white hover:bg-orange-700"
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
