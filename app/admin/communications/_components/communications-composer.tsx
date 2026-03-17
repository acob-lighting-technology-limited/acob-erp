"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { logger } from "@/lib/logger"

const log = logger("communications-composer")
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { writeAuditLogClient } from "@/lib/audit/client"
import { PageWrapper, PageHeader } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Megaphone, Users, Calendar, Clock } from "lucide-react"
import {
  DEFAULT_TEAMS_LINK,
  DEFAULT_AGENDA,
  getNextMondayFormatted,
  formatDateNice,
  capitalize,
  stripHtmlToText,
} from "./composer-utils"
import { MeetingReminderForm } from "./MeetingReminderForm"
import { KnowledgeSessionForm } from "./KnowledgeSessionForm"
import { BroadcastForm } from "./BroadcastForm"
import { RecipientSelector } from "./RecipientSelector"
import { SchedulingOptions } from "./SchedulingOptions"
import { SendSummary } from "./SendSummary"
import { ReminderTypeSelector } from "./ReminderTypeSelector"
import { getOfficeWeekFromDate } from "@/lib/meeting-week"

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
  currentUser?: {
    id: string
    full_name: string | null
    department: string | null
    email?: string | null
  }
}

export function CommunicationsComposer({ employees, mode = "meetings", currentUser }: Props) {
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

  // Broadcast fields
  const [broadcastSubject, setBroadcastSubject] = useState("Administrative Notice")
  const [broadcastBodyHtml, setBroadcastBodyHtml] = useState("<p>Type your message here...</p>")
  const [broadcastDepartment, setBroadcastDepartment] = useState(currentUser?.department || "Admin & HR")
  const [broadcastPreparedById, setBroadcastPreparedById] = useState("none")

  // Delivery timing
  const [sendTiming, setSendTiming] = useState<SendTiming>("now")
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("09:00")
  const [recurringDay, setRecurringDay] = useState("sunday")
  const [recurringTime, setRecurringTime] = useState("18:00")

  const [isSending, setIsSending] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sendResult, setSendResult] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [activeSchedules, setActiveSchedules] = useState<any[]>([])

  const supabase = createClient()
  const queryClient = useQueryClient()
  const currentUserDept = (currentUser?.department || "").trim()
  const currentUserName = (currentUser?.full_name || "").trim()
  const isCurrentUserAdminHr =
    currentUserDept.toLowerCase().includes("admin") && currentUserDept.toLowerCase().includes("hr")

  // ── Derived options ────────────────────────────────────────────────────────
  const departmentOptions = useMemo(() => {
    const set = new Set<string>(["Admin & HR"])
    for (const dept of employees.map((e) => e.department).filter(Boolean) as string[]) set.add(dept)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [employees])

  const presenterOptions = useMemo(
    () =>
      knowledgeDepartment === "none"
        ? []
        : employees
            .filter((e) => e.department === knowledgeDepartment)
            .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "")),
    [employees, knowledgeDepartment]
  )

  const selectedPresenter = useMemo(
    () => (knowledgePresenterId === "none" ? null : employees.find((e) => e.id === knowledgePresenterId) || null),
    [employees, knowledgePresenterId]
  )

  const meetingPreparedByOptions = useMemo(
    () =>
      employees
        .filter((e) => {
          const dept = (e.department || "").toLowerCase()
          return dept.includes("admin") && dept.includes("hr")
        })
        .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "")),
    [employees]
  )

  const selectedMeetingPreparedBy = useMemo(
    () => (meetingPreparedById === "none" ? null : employees.find((e) => e.id === meetingPreparedById) || null),
    [employees, meetingPreparedById]
  )

  const broadcastPreparedByOptions = useMemo(
    () =>
      employees
        .filter((e) => (e.department || "").trim() === broadcastDepartment)
        .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "")),
    [employees, broadcastDepartment]
  )

  const selectedBroadcastPreparedBy = useMemo(
    () => (broadcastPreparedById === "none" ? null : employees.find((e) => e.id === broadcastPreparedById) || null),
    [employees, broadcastPreparedById]
  )

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "communications" && reminderType !== "admin_broadcast") setReminderType("admin_broadcast")
  }, [mode, reminderType])

  useEffect(() => {
    if (meetingPreparedByOptions.length > 0 && !meetingPreparedByOptions.some((p) => p.id === meetingPreparedById)) {
      const rafiatPreferred = meetingPreparedByOptions.find((p) => (p.full_name || "").toLowerCase().includes("rafiat"))
      const preferred =
        rafiatPreferred?.id ||
        (isCurrentUserAdminHr &&
        currentUserName &&
        meetingPreparedByOptions.some((p) => p.full_name === currentUserName)
          ? meetingPreparedByOptions.find((p) => p.full_name === currentUserName)?.id
          : meetingPreparedByOptions[0].id)
      setMeetingPreparedById(preferred || meetingPreparedByOptions[0].id)
    }
  }, [currentUserName, isCurrentUserAdminHr, meetingPreparedById, meetingPreparedByOptions])

  useEffect(() => {
    if (mode !== "communications" || !currentUserDept || broadcastDepartment === currentUserDept) return
    setBroadcastDepartment(currentUserDept)
  }, [broadcastDepartment, currentUserDept, mode])

  useEffect(() => {
    if (broadcastPreparedByOptions.length === 0) return
    if (!broadcastPreparedByOptions.some((p) => p.id === broadcastPreparedById)) {
      const preferred =
        currentUserName && broadcastPreparedByOptions.some((p) => p.full_name === currentUserName)
          ? broadcastPreparedByOptions.find((p) => p.full_name === currentUserName)?.id
          : broadcastPreparedByOptions[0].id
      setBroadcastPreparedById(preferred || broadcastPreparedByOptions[0].id)
    }
  }, [broadcastPreparedById, broadcastPreparedByOptions, currentUserName])

  useEffect(() => {
    if (reminderType !== "meeting") return
    if (!meetingDate) return
    // Respect manual selection; only auto-fill when both fields are untouched.
    if (knowledgeDepartment !== "none" || knowledgePresenterId !== "none") return

    const [year, month, day] = meetingDate.split("-").map((part) => Number(part))
    if (!year || !month || !day) return
    const officeWeek = getOfficeWeekFromDate(new Date(year, month - 1, day))

    let cancelled = false
    const autoFillFromRoster = async () => {
      try {
        const res = await fetch(`/api/reports/kss-roster?week=${officeWeek.week}&year=${officeWeek.year}`)
        const payload = await res.json()
        if (!res.ok) return

        const roster = Array.isArray(payload?.data) ? payload.data : []
        const picked = roster.find((entry: { is_active?: boolean }) => entry?.is_active !== false) ?? roster[0]
        if (!picked || cancelled) return

        if (typeof picked.department === "string" && picked.department.trim()) {
          setKnowledgeDepartment(picked.department)
        }

        const presenterId = typeof picked.presenter_id === "string" ? picked.presenter_id : null
        if (presenterId && employees.some((emp) => emp.id === presenterId)) {
          setKnowledgePresenterId(presenterId)
        } else {
          setKnowledgePresenterId("none")
        }
      } catch {
        // Fail silently; form still works with manual selection.
      }
    }

    autoFillFromRoster()
    return () => {
      cancelled = true
    }
  }, [employees, knowledgeDepartment, knowledgePresenterId, meetingDate, reminderType])

  // ── Query: active schedules ───────────────────────────────────────────────
  const { data: schedulesData } = useQuery({
    queryKey: QUERY_KEYS.adminReminderSchedules(mode),
    queryFn: async () => {
      const allowedTypes =
        mode === "communications" ? (["admin_broadcast"] as const) : (["meeting", "knowledge_sharing"] as const)
      const { data, error } = await supabase
        .from("reminder_schedules")
        .select("*")
        .eq("is_active", true)
        .in("reminder_type", [...allowedTypes])
        .order("created_at", { ascending: false })
      if (error) throw new Error(error.message)
      return data || []
    },
  })

  useEffect(() => {
    if (schedulesData) setActiveSchedules(schedulesData)
  }, [schedulesData])

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
      manualEmails.forEach((m) => emailSet.add(m.toLowerCase()))
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

  const selectAll = useCallback(() => setSelectedEmployeeIds(new Set(employees.map((e) => e.id))), [employees])
  const deselectAll = useCallback(() => setSelectedEmployeeIds(new Set()), [])

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

  const logMailAudit = useCallback(
    async (params: {
      action: string
      entityId: string
      department?: string | null
      metadata?: Record<string, unknown>
    }) => {
      try {
        await writeAuditLogClient(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabase as any,
          {
            action: "send",
            entityType: "communications_mail",
            entityId: params.entityId,
            metadata: { ...(params.metadata || {}), event: params.action },
            context: {
              actorId: currentUser?.id || undefined,
              department: params.department || null,
              source: "ui",
              route: "/admin/communications",
            },
          },
          { failOpen: true }
        )
      } catch (error) {
        log.error({ err: String(error) }, "Failed to write audit log")
      }
    },
    [currentUser?.id, supabase]
  )

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

    // Scheduled / recurring → save to DB
    if (sendTiming === "scheduled" || sendTiming === "recurring") {
      const toastId = toast.loading("Saving schedule...")
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const schedulePayload: any = {
          schedule_type: sendTiming === "scheduled" ? "one_time" : "recurring",
          reminder_type: reminderType,
          recipients: resolvedRecipients,
          is_active: true,
          send_day: sendTiming === "recurring" ? recurringDay : null,
          send_time: sendTiming === "recurring" ? recurringTime : scheduledTime,
          meeting_config: {
            type: reminderType,
            requestedByUserId: currentUser?.id || null,
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
          const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
          const targetDay = days.indexOf(recurringDay)
          const now = new Date()
          let daysUntil = targetDay - now.getDay()
          const [h, m] = recurringTime.split(":")
          const targetMinutes = parseInt(h, 10) * 60 + parseInt(m, 10)
          const nowMinutes = now.getHours() * 60 + now.getMinutes()
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
            ? `✅ Scheduled for ${new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
            : `✅ Recurring every ${capitalize(recurringDay)} at ${recurringTime}`,
          { id: toastId }
        )
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminReminderSchedules(mode) })
      } catch (err: unknown) {
        log.error({ err: String(err) }, "Schedule error")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toast.error((err as any).message || "Failed to save schedule", { id: toastId })
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        type: reminderType,
        recipients: resolvedRecipients,
        requestedByUserId: currentUser?.id || null,
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
        if (knowledgeDepartment !== "none") payload.knowledgeSharingDepartment = knowledgeDepartment
        if (selectedPresenter)
          payload.knowledgeSharingPresenter = {
            id: selectedPresenter.id,
            full_name: selectedPresenter.full_name,
            department: selectedPresenter.department,
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send")

      setSendResult(data)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const successCount = data.results?.filter((r: any) => r.success).length || 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const failCount = data.results?.filter((r: any) => !r.success).length || 0

      if (failCount === 0) {
        toast.success(`✅ ${label} sent to ${successCount} recipient(s)`, { id: toastId })
      } else {
        toast.warning(`Sent to ${successCount}, failed for ${failCount}`, { id: toastId })
      }

      await logMailAudit({
        action: reminderType === "admin_broadcast" ? "communications_broadcast_sent" : "meeting_reminder_sent",
        entityId: crypto.randomUUID(),
        department: reminderType === "admin_broadcast" ? broadcastDepartment : currentUserDept || "Admin & HR",
        metadata: {
          reminder_type: reminderType,
          success_count: successCount,
          failure_count: failCount,
          recipient_count: resolvedRecipients.length,
          subject: reminderType === "admin_broadcast" ? broadcastSubject.trim() : label,
          prepared_by:
            reminderType === "admin_broadcast"
              ? selectedBroadcastPreparedBy?.full_name || null
              : selectedMeetingPreparedBy?.full_name || null,
        },
      })
    } catch (err: unknown) {
      log.error({ err: String(err) }, "Meeting reminder error")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((err as any).message || "Failed to send", { id: toastId })
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
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminReminderSchedules(mode) })
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

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3 lg:items-start">
        {/* ── LEFT: Settings ────────────────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Reminder Type selector (meetings mode only) */}
          {mode !== "communications" && (
            <ReminderTypeSelector reminderType={reminderType} setReminderType={setReminderType} />
          )}

          {/* Details Card */}
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
                <MeetingReminderForm
                  meetingDate={meetingDate}
                  setMeetingDate={setMeetingDate}
                  meetingTime={meetingTime}
                  setMeetingTime={setMeetingTime}
                  teamsLink={teamsLink}
                  setTeamsLink={setTeamsLink}
                  agendaText={agendaText}
                  setAgendaText={setAgendaText}
                  knowledgeDepartment={knowledgeDepartment}
                  setKnowledgeDepartment={setKnowledgeDepartment}
                  knowledgePresenterId={knowledgePresenterId}
                  setKnowledgePresenterId={setKnowledgePresenterId}
                  meetingPreparedById={meetingPreparedById}
                  setMeetingPreparedById={setMeetingPreparedById}
                  departmentOptions={departmentOptions}
                  presenterOptions={presenterOptions}
                  meetingPreparedByOptions={meetingPreparedByOptions}
                />
              ) : reminderType === "knowledge_sharing" ? (
                <KnowledgeSessionForm
                  sessionDate={sessionDate}
                  setSessionDate={setSessionDate}
                  sessionTime={sessionTime}
                  setSessionTime={setSessionTime}
                  duration={duration}
                  setDuration={setDuration}
                />
              ) : (
                <BroadcastForm
                  broadcastDepartment={broadcastDepartment}
                  broadcastPreparedById={broadcastPreparedById}
                  setBroadcastPreparedById={setBroadcastPreparedById}
                  broadcastSubject={broadcastSubject}
                  setBroadcastSubject={setBroadcastSubject}
                  broadcastBodyHtml={broadcastBodyHtml}
                  setBroadcastBodyHtml={setBroadcastBodyHtml}
                  broadcastPreparedByOptions={broadcastPreparedByOptions}
                />
              )}
            </CardContent>
          </Card>

          {/* Recipients */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-purple-600" />
                Recipients
              </CardTitle>
              <CardDescription>Choose who receives the reminder</CardDescription>
            </CardHeader>
            <CardContent>
              <RecipientSelector
                employees={employees}
                recipientMode={recipientMode}
                setRecipientMode={setRecipientMode}
                selectedEmployeeIds={selectedEmployeeIds}
                toggleEmployee={toggleEmployee}
                selectAll={selectAll}
                deselectAll={deselectAll}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                filteredEmployees={filteredEmployees}
                manualEmails={manualEmails}
                manualInput={manualInput}
                setManualInput={setManualInput}
                addManualEmail={addManualEmail}
                removeManualEmail={removeManualEmail}
              />
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
            <CardContent>
              <SchedulingOptions
                sendTiming={sendTiming}
                setSendTiming={setSendTiming}
                scheduledDate={scheduledDate}
                setScheduledDate={setScheduledDate}
                scheduledTime={scheduledTime}
                setScheduledTime={setScheduledTime}
                recurringDay={recurringDay}
                setRecurringDay={setRecurringDay}
                recurringTime={recurringTime}
                setRecurringTime={setRecurringTime}
                activeSchedules={activeSchedules}
                deactivateSchedule={deactivateSchedule}
              />
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT: Summary & Send ─────────────────────────────────────── */}
        <SendSummary
          reminderType={reminderType}
          meetingDate={meetingDate}
          meetingTime={meetingTime}
          sessionDate={sessionDate}
          sessionTime={sessionTime}
          broadcastDepartment={broadcastDepartment}
          broadcastSubject={broadcastSubject}
          selectedMeetingPreparedByName={selectedMeetingPreparedBy?.full_name ?? null}
          selectedBroadcastPreparedByName={selectedBroadcastPreparedBy?.full_name ?? null}
          selectedPresenterName={selectedPresenter?.full_name ?? null}
          knowledgeDepartment={knowledgeDepartment}
          resolvedRecipients={resolvedRecipients}
          sendTiming={sendTiming}
          scheduledDate={scheduledDate}
          scheduledTime={scheduledTime}
          recurringDay={recurringDay}
          recurringTime={recurringTime}
          isSending={isSending}
          onSend={handleSend}
          sendResult={sendResult}
        />
      </div>
    </PageWrapper>
  )
}
