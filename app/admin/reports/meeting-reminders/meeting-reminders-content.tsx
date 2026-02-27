"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
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
  FileText,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Link2,
  Repeat,
  Trash2,
} from "lucide-react"

type Employee = {
  id: string
  full_name: string
  company_email: string | null
  additional_email: string | null
  department: string | null
  employment_status: string | null
}

type RecipientMode = "all" | "select" | "manual" | "all_plus"
type ReminderType = "meeting" | "knowledge_sharing" | "admin_broadcast"
type SendTiming = "now" | "scheduled" | "recurring"

interface Props {
  employees: Employee[]
  mode?: "meetings" | "communications"
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

function stripHtmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function MeetingRemindersContent({ employees, mode = "meetings" }: Props) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [reminderType, setReminderType] = useState<ReminderType>(
    mode === "communications" ? "admin_broadcast" : "meeting"
  )
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("select")
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
  const [knowledgeDepartment, setKnowledgeDepartment] = useState("none")
  const [knowledgePresenterId, setKnowledgePresenterId] = useState("none")
  const [meetingPreparedById, setMeetingPreparedById] = useState("none")
  const [broadcastSubject, setBroadcastSubject] = useState("Administrative Notice")
  const [broadcastBodyHtml, setBroadcastBodyHtml] = useState("<p>Type your message here...</p>")
  const [broadcastDepartment, setBroadcastDepartment] = useState("Admin & HR")
  const [broadcastPreparedById, setBroadcastPreparedById] = useState("none")
  const editorRef = useRef<HTMLDivElement | null>(null)

  // Delivery timing
  const [sendTiming, setSendTiming] = useState<SendTiming>("now")
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("09:00")
  const [recurringDay, setRecurringDay] = useState("sunday")
  const [recurringTime, setRecurringTime] = useState("18:00")

  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState<any>(null)
  const [activeSchedules, setActiveSchedules] = useState<any[]>([])

  const supabase = createClient()

  const departmentOptions = useMemo(() => {
    const set = new Set<string>(["Admin & HR"])
    for (const dept of employees.map((e) => e.department).filter(Boolean) as string[]) {
      set.add(dept)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [employees])

  const presenterOptions = useMemo(() => {
    if (knowledgeDepartment === "none") return []
    return employees
      .filter((e) => e.department === knowledgeDepartment)
      .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""))
  }, [employees, knowledgeDepartment])

  const selectedPresenter = useMemo(() => {
    if (knowledgePresenterId === "none") return null
    return employees.find((e) => e.id === knowledgePresenterId) || null
  }, [employees, knowledgePresenterId])

  const meetingPreparedByOptions = useMemo(() => {
    return employees
      .filter((e) => {
        const dept = (e.department || "").toLowerCase()
        return dept.includes("admin") && dept.includes("hr")
      })
      .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""))
  }, [employees])

  const selectedMeetingPreparedBy = useMemo(() => {
    if (meetingPreparedById === "none") return null
    return employees.find((e) => e.id === meetingPreparedById) || null
  }, [employees, meetingPreparedById])

  const broadcastPreparedByOptions = useMemo(() => {
    return employees
      .filter((e) => (e.department || "").trim() === broadcastDepartment)
      .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""))
  }, [employees, broadcastDepartment])

  const selectedBroadcastPreparedBy = useMemo(() => {
    if (broadcastPreparedById === "none") return null
    return employees.find((e) => e.id === broadcastPreparedById) || null
  }, [employees, broadcastPreparedById])

  useEffect(() => {
    if (mode === "communications" && reminderType !== "admin_broadcast") {
      setReminderType("admin_broadcast")
    }
  }, [mode, reminderType])

  useEffect(() => {
    if (meetingPreparedByOptions.length > 0 && !meetingPreparedByOptions.some((p) => p.id === meetingPreparedById)) {
      setMeetingPreparedById(meetingPreparedByOptions[0].id)
    }
  }, [meetingPreparedById, meetingPreparedByOptions])

  useEffect(() => {
    if (reminderType !== "admin_broadcast") return
    const el = editorRef.current
    if (!el) return
    if (el.innerHTML !== broadcastBodyHtml) {
      el.innerHTML = broadcastBodyHtml
    }
  }, [reminderType, broadcastBodyHtml])

  const runEditorCommand = useCallback((command: string, value?: string) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    document.execCommand(command, false, value)
    setBroadcastBodyHtml(editorRef.current.innerHTML)
  }, [])

  const addEditorLink = useCallback(() => {
    const url = window.prompt("Enter link URL (https://...)")
    if (!url) return
    runEditorCommand("createLink", url.trim())
  }, [runEditorCommand])

  const fetchSchedules = useCallback(async () => {
    try {
      const allowedTypes =
        mode === "communications" ? (["admin_broadcast"] as const) : (["meeting", "knowledge_sharing"] as const)

      const { data, error } = await supabase
        .from("reminder_schedules")
        .select("*")
        .eq("is_active", true)
        .in("reminder_type", [...allowedTypes])
        .order("created_at", { ascending: false })
      if (!error && data) setActiveSchedules(data)
    } catch {
      // ignore
    }
  }, [supabase, mode])

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
        e.additional_email?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q)
    )
  }, [employees, searchQuery])

  const resolvedRecipients = useMemo(() => {
    const emailSet = new Set<string>()
    if (recipientMode === "all" || recipientMode === "all_plus") {
      employees.forEach((e) => {
        if (e.company_email) emailSet.add(e.company_email.toLowerCase())
        if (e.additional_email) emailSet.add(e.additional_email.toLowerCase())
      })
    } else if (recipientMode === "select") {
      employees.forEach((e) => {
        if (selectedEmployeeIds.has(e.id)) {
          if (e.company_email) emailSet.add(e.company_email.toLowerCase())
          if (e.additional_email) emailSet.add(e.additional_email.toLowerCase())
        }
      })
    }
    if (recipientMode === "manual" || recipientMode === "all_plus") {
      manualEmails.forEach((m) => {
        emailSet.add(m.toLowerCase())
      })
    }
    return Array.from(emailSet)
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

    if (reminderType === "admin_broadcast") {
      if (!broadcastSubject.trim()) {
        toast.error("Broadcast subject is required")
        return
      }
      if (!broadcastDepartment.trim()) {
        toast.error("Broadcast department is required")
        return
      }
      if (!stripHtmlToText(broadcastBodyHtml)) {
        toast.error("Broadcast body is required")
        return
      }
      if (!selectedBroadcastPreparedBy?.full_name) {
        toast.error("Prepared by is required")
        return
      }
    }

    if (reminderType === "meeting" && !selectedMeetingPreparedBy?.full_name) {
      toast.error("Prepared by is required")
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
            knowledgeSharingDepartment:
              reminderType === "meeting" && knowledgeDepartment !== "none" ? knowledgeDepartment : undefined,
            knowledgeSharingPresenter:
              reminderType === "meeting" && selectedPresenter
                ? {
                    id: selectedPresenter.id,
                    full_name: selectedPresenter.full_name,
                    department: selectedPresenter.department,
                  }
                : undefined,
            meetingPreparedByName:
              reminderType === "meeting" ? selectedMeetingPreparedBy?.full_name || "ACOB Team" : undefined,
            sessionDate: reminderType === "knowledge_sharing" ? sessionDate : undefined,
            sessionTime: reminderType === "knowledge_sharing" ? sessionTime : undefined,
            duration: reminderType === "knowledge_sharing" ? duration : undefined,
            broadcastSubject: reminderType === "admin_broadcast" ? broadcastSubject : undefined,
            broadcastBodyHtml: reminderType === "admin_broadcast" ? broadcastBodyHtml : undefined,
            broadcastDepartment: reminderType === "admin_broadcast" ? broadcastDepartment : undefined,
            broadcastPreparedByName:
              reminderType === "admin_broadcast" ? selectedBroadcastPreparedBy?.full_name || null : undefined,
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
          const [h, m] = recurringTime.split(":")
          const targetMinutes = parseInt(h, 10) * 60 + parseInt(m, 10)
          const nowMinutes = now.getHours() * 60 + now.getMinutes()
          // If day already passed, or same day and time has passed, schedule next week.
          if (daysUntil < 0 || (daysUntil === 0 && nowMinutes >= targetMinutes)) daysUntil += 7
          const nextRun = new Date(now)
          nextRun.setDate(now.getDate() + daysUntil)
          nextRun.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0)
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
        fetchSchedules()
      } catch (err: any) {
        console.error("[Schedule Error]", err)
        toast.error(err.message || "Failed to save schedule", { id: toastId })
      }
      return
    }

    // Send immediately
    setIsSending(true)
    setSendResult(null)
    const label =
      reminderType === "meeting"
        ? "Meeting Reminder"
        : reminderType === "knowledge_sharing"
          ? "Knowledge Sharing Reminder"
          : "Admin Broadcast"
    const toastId = toast.loading(`Sending ${label} to ${resolvedRecipients.length} recipient(s)...`)

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const payload: any = {
        type: reminderType,
        recipients: resolvedRecipients,
      }

      if (reminderType === "meeting") {
        payload.meetingDate = meetingDate
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
        if (knowledgeDepartment !== "none") {
          payload.knowledgeSharingDepartment = knowledgeDepartment
        }
        if (selectedPresenter) {
          payload.knowledgeSharingPresenter = {
            id: selectedPresenter.id,
            full_name: selectedPresenter.full_name,
            department: selectedPresenter.department,
          }
        }
        payload.meetingPreparedByName = selectedMeetingPreparedBy?.full_name || "ACOB Team"
      } else if (reminderType === "knowledge_sharing") {
        payload.sessionDate = formatDateNice(sessionDate)
        payload.sessionTime = sessionTime
        payload.duration = duration
      } else {
        payload.broadcastSubject = broadcastSubject.trim()
        payload.broadcastBodyHtml = broadcastBodyHtml
        payload.broadcastDepartment = broadcastDepartment
        payload.broadcastPreparedByName = selectedBroadcastPreparedBy?.full_name || null
      }

      const targetFunction = reminderType === "admin_broadcast" ? "send-communications-mail" : "send-meeting-reminder"
      const res = await fetch(`${supabaseUrl}/functions/v1/${targetFunction}`, {
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

  const deactivateSchedule = async (id: string) => {
    const { error } = await supabase.from("reminder_schedules").update({ is_active: false }).eq("id", id)
    if (error) {
      toast.error("Failed to deactivate schedule")
      return
    }
    toast.success("Schedule deactivated")
    fetchSchedules()
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title={mode === "communications" ? "Broadcast Communications" : "Meeting Reminders"}
        description={
          mode === "communications"
            ? "Send branded department-level broadcast emails to selected recipients."
            : "Send meeting reminders and knowledge-sharing alerts to selected recipients."
        }
        icon={Megaphone}
        backLink={{
          href: mode === "communications" ? "/admin/communications" : "/admin/communications/meetings",
          label: "Back",
        }}
      />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        {/* ── LEFT: Settings ────────────────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Reminder Type */}
          {mode !== "communications" && (
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
          )}

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
                  : reminderType === "knowledge_sharing"
                    ? "Configure the session date, time, and duration"
                    : "Write your custom subject and formatted message body"}
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
                  <div className="space-y-3 rounded-lg border border-dashed p-3">
                    <div>
                      <Label className="text-sm">Knowledge Sharing Presenter (Optional)</Label>
                      <p className="text-muted-foreground mt-1 text-xs">
                        This updates the agenda line "Knowledge Sharing Session (30 minutes)" with department and
                        presenter.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="ks-department">Department</Label>
                        <Select
                          value={knowledgeDepartment}
                          onValueChange={(value) => {
                            setKnowledgeDepartment(value)
                            setKnowledgePresenterId("none")
                          }}
                        >
                          <SelectTrigger id="ks-department" className="w-[220px]">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Not selected</SelectItem>
                            {departmentOptions.map((dept) => (
                              <SelectItem key={dept} value={dept}>
                                {dept}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ks-presenter">Presenter</Label>
                        <Select
                          value={knowledgePresenterId}
                          onValueChange={setKnowledgePresenterId}
                          disabled={knowledgeDepartment === "none"}
                        >
                          <SelectTrigger id="ks-presenter" className="w-[260px]">
                            <SelectValue placeholder="Select presenter" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Not selected</SelectItem>
                            {presenterOptions.map((emp) => (
                              <SelectItem key={emp.id} value={emp.id}>
                                {emp.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meeting-prepared-by">Prepared by</Label>
                    <Select value={meetingPreparedById} onValueChange={setMeetingPreparedById}>
                      <SelectTrigger id="meeting-prepared-by" className="w-[320px]">
                        <SelectValue placeholder="Select person" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select person</SelectItem>
                        {meetingPreparedByOptions.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-xs">
                      Admin &amp; HR only. This appears as “Prepared by” in the footer.
                    </p>
                  </div>
                </>
              ) : reminderType === "knowledge_sharing" ? (
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
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="broadcast-department">Department</Label>
                    <Select
                      value={broadcastDepartment}
                      onValueChange={(value) => {
                        setBroadcastDepartment(value)
                        setBroadcastPreparedById("none")
                      }}
                    >
                      <SelectTrigger id="broadcast-department" className="w-[260px]">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departmentOptions.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-xs">
                      Sender label and footer branding will use this department.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="broadcast-prepared-by">Prepared by</Label>
                    <Select value={broadcastPreparedById} onValueChange={setBroadcastPreparedById}>
                      <SelectTrigger id="broadcast-prepared-by" className="w-[320px]">
                        <SelectValue placeholder="Select person" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select person</SelectItem>
                        {broadcastPreparedByOptions.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-xs">This will appear as “Prepared by” in the footer.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="broadcast-subject">Email Subject</Label>
                    <Input
                      id="broadcast-subject"
                      value={broadcastSubject}
                      onChange={(e) => setBroadcastSubject(e.target.value)}
                      placeholder="Enter broadcast subject..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Message Body (rich text)</Label>
                    <div className="bg-muted/50 flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 p-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => runEditorCommand("bold")}
                      >
                        <Bold className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => runEditorCommand("italic")}
                      >
                        <Italic className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => runEditorCommand("underline")}
                      >
                        <Underline className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => runEditorCommand("insertUnorderedList")}
                      >
                        <List className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => runEditorCommand("insertOrderedList")}
                      >
                        <ListOrdered className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={addEditorLink}>
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <div className="bg-border mx-1 h-5 w-px" />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => runEditorCommand("undo")}
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => runEditorCommand("redo")}
                      >
                        <Redo2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      className="bg-background min-h-[220px] rounded-b-lg border p-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-orange-500"
                      onInput={(e) => setBroadcastBodyHtml((e.currentTarget as HTMLDivElement).innerHTML)}
                    />
                    <p className="text-muted-foreground text-xs">
                      Paste text from Word or type directly. This message is placed between the ACOB header and footer.
                    </p>
                  </div>
                </div>
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
                          <div className="text-muted-foreground truncate text-xs">
                            {[emp.company_email, emp.additional_email].filter(Boolean).join(" | ")}
                          </div>
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
                          <Repeat className="h-4 w-4 text-orange-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-orange-600" />
                        )}
                        <span>
                          {s.schedule_type === "recurring"
                            ? `Every ${capitalize(s.send_day || "sunday")} at ${String(s.send_time || "18:00").slice(0, 5)}`
                            : `One-time: ${new Date(s.next_run_at).toLocaleString("en-GB", {
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
        <aside className="space-y-6 self-start">
          <Card className="border-orange-200 lg:sticky lg:top-24 dark:border-orange-900">
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
                    ) : reminderType === "knowledge_sharing" ? (
                      <>
                        <BookOpen className="h-3 w-3" /> Knowledge Sharing
                      </>
                    ) : (
                      <>
                        <FileText className="h-3 w-3" /> Admin Broadcast
                      </>
                    )}
                  </Badge>
                </div>
                {reminderType !== "admin_broadcast" ? (
                  <>
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
                    {reminderType === "meeting" && (
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">Prepared by</span>
                        <Badge variant="outline" className="max-w-[68%] truncate">
                          {selectedMeetingPreparedBy?.full_name || "Not set"}
                        </Badge>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">Department</span>
                      <Badge variant="outline" className="max-w-[68%] truncate">
                        {broadcastDepartment}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">Prepared by</span>
                      <Badge variant="outline" className="max-w-[68%] truncate">
                        {selectedBroadcastPreparedBy?.full_name || "Not set"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">Subject</span>
                      <Badge variant="secondary" className="max-w-[68%] truncate">
                        {broadcastSubject.trim() || "Not set"}
                      </Badge>
                    </div>
                  </>
                )}
                {reminderType === "meeting" && selectedPresenter && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Knowledge Sharing</span>
                    <Badge variant="secondary" className="max-w-[70%] truncate">
                      {selectedPresenter.full_name} ({knowledgeDepartment !== "none" ? knowledgeDepartment : "N/A"})
                    </Badge>
                  </div>
                )}
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
                {resolvedRecipients.length > 0 && (
                  <div className="mt-2 max-h-[160px] space-y-0.5 overflow-y-auto rounded-md border p-2 text-xs">
                    {resolvedRecipients.map((email) => (
                      <div key={email} className="truncate">
                        {email}
                      </div>
                    ))}
                  </div>
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
        </aside>
      </div>
    </PageWrapper>
  )
}
