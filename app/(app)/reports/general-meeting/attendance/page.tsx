"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  QrCode,
  ShieldCheck,
  UserCheck,
} from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"

interface SessionData {
  session: {
    meeting_week: number
    meeting_year: number
    meeting_date: string
    code_6_digit: string
    is_active: boolean
  } | null
  holidayInfo: {
    isMondayHoliday: boolean
    mondayHolidayName: string | null
    isMeetingDayHoliday: boolean
    meetingHolidayName: string | null
    mondayIso: string
    meetingDate: string
  } | null
}

function formatMeetingDate(dateStr?: string | null): string {
  if (!dateStr) return "Scheduled for Monday"
  const parts = dateStr.split("-").map(Number)
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return dateStr
  const [y, m, d] = parts
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function CheckInContent() {
  const searchParams = useSearchParams()
  const officeWeek = useMemo(() => getCurrentOfficeWeek(), [])

  const initialWeek = Number(searchParams.get("week")) || officeWeek.week
  const initialYear = Number(searchParams.get("year")) || officeWeek.year
  const initialCode = searchParams.get("code") || ""

  const [week] = useState(initialWeek)
  const [year] = useState(initialYear)
  const [code, setCode] = useState(initialCode)
  const [submitting, setSubmitting] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [userStatus, setUserStatus] = useState<{
    hasOfficeClockIn: boolean
    officeClockIn: string | null
    officeClockInSource: string | null
    alreadyCheckedIn: boolean
    meetingClockIn: string | null
  } | null>(null)
  const [successResult, setSuccessResult] = useState<{
    officeClockIn: string | null
    meetingClockIn: string
  } | null>(null)
  const [biometricError, setBiometricError] = useState<string | null>(null)

  // Fetch session & current user's biometric entrance punch status
  useEffect(() => {
    let mounted = true
    const loadSession = async () => {
      try {
        setSessionLoading(true)
        const res = await apiFetch(`/api/reports/general-meeting/attendance/session?week=${week}&year=${year}`)
        const data = await res.json()
        if (mounted) {
          if (data.session || data.holidayInfo) {
            setSessionData({
              session: data.session || null,
              holidayInfo: data.holidayInfo || null,
            })
          }
          if (data.userStatus) {
            setUserStatus(data.userStatus)
            if (data.userStatus.alreadyCheckedIn && data.userStatus.meetingClockIn) {
              setSuccessResult({
                officeClockIn: data.userStatus.officeClockIn,
                meetingClockIn: data.userStatus.meetingClockIn,
              })
            }
          }
        }
      } catch {
        // Fail quietly on network hiccup
      } finally {
        if (mounted) setSessionLoading(false)
      }
    }
    loadSession()
    return () => {
      mounted = false
    }
  }, [week, year])

  // Auto-submit if code is prefilled via QR scan (length 6)
  useEffect(() => {
    if (initialCode && initialCode.length === 6 && !successResult && !submitting) {
      setCode(initialCode)
    }
  }, [initialCode, successResult, submitting])

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setBiometricError(null)

    // Check if user has clocked in at entrance
    if (userStatus && !userStatus.hasOfficeClockIn) {
      toast.error("You haven't clocked in yet to use this")
      return
    }

    const cleanedCode = code.trim().replace(/\s+/g, "")
    if (cleanedCode.length !== 6) {
      toast.error("Please enter a valid 6-digit meeting code")
      return
    }

    setSubmitting(true)
    try {
      const res = await apiFetch("/api/reports/general-meeting/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week,
          year,
          code: cleanedCode,
          attendanceMode: "physical",
          source: initialCode ? "qr_scan" : "code_input",
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.code === "BIOMETRIC_PUNCH_REQUIRED") {
          setBiometricError(data.error)
          toast.error("You haven't clocked in yet to use this")
        } else {
          throw new Error(data.error || "Failed to record attendance")
        }
        return
      }

      toast.success("Attendance confirmed successfully!")
      setSuccessResult({
        officeClockIn: data.record.office_clock_in,
        meetingClockIn: data.record.meeting_clock_in,
      })
      setUserStatus((prev) => (prev ? { ...prev, alreadyCheckedIn: true } : null))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error checking in")
    } finally {
      setSubmitting(false)
    }
  }

  const meetingDateDisplay = formatMeetingDate(
    sessionData?.session?.meeting_date || sessionData?.holidayInfo?.meetingDate
  )

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Column: Check-In Interaction Card */}
      <div className="space-y-6 lg:col-span-7">
        <Card className="border shadow-md">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <UserCheck className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">General Meeting Check-In</CardTitle>
                <CardDescription>
                  Week {week}, {year} • Enter the 6-digit session code or scan the room sign-in sheet
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {successResult ? (
              <div className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center text-emerald-950 dark:text-emerald-200">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 dark:text-emerald-400" />
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">Attendance Confirmed!</h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Your general meeting presence has been recorded and verified.
                  </p>
                </div>

                <div className="bg-background/80 mt-4 space-y-2 rounded-lg border border-emerald-500/20 p-3.5 text-left text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Meeting Check-In:</span>
                    <span className="text-foreground font-semibold">
                      {new Date(successResult.meetingClockIn).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {successResult.officeClockIn && (
                    <div className="flex justify-between border-t pt-1.5">
                      <span className="text-muted-foreground">Entrance Biometric Punch:</span>
                      <span className="text-foreground font-semibold">
                        {new Date(successResult.officeClockIn).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1.5">
                    <span className="text-muted-foreground">Verification Gate:</span>
                    <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-3.5 w-3.5" /> Biometrics Validated
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSuccessResult(null)} className="text-xs">
                    Check In Another Session
                  </Button>
                  <Button asChild size="sm" className="text-xs">
                    <Link href="/reports/general-meeting">
                      View Attendance List <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCheckIn} className="space-y-5">
                {biometricError && (
                  <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2.5 rounded-lg border p-3 text-xs">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="space-y-1">
                      <span className="block font-semibold">Biometric Entrance Punch Required</span>
                      <p className="leading-relaxed">{biometricError}</p>
                    </div>
                  </div>
                )}

                {/* 6-Digit Code Input */}
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-xs font-semibold">
                    6-Digit Meeting Code
                  </Label>
                  <div className="relative">
                    <Input
                      id="code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="e.g. 582914"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                      className="h-12 text-center font-mono text-2xl font-bold tracking-[0.3em] uppercase"
                      autoFocus
                      required
                    />
                    <QrCode className="text-muted-foreground/60 pointer-events-none absolute top-3.5 right-3.5 h-5 w-5" />
                  </div>
                  <p className="text-muted-foreground text-center text-[11px]">
                    Shown on the printed sheet or QR poster in the conference room.
                  </p>
                </div>

                {/* Biometric status notice */}
                {sessionLoading ? (
                  <div className="bg-muted/40 text-muted-foreground flex items-center justify-center gap-2 rounded-lg border p-3 text-xs">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                    <span>Checking office entrance clock-in status...</span>
                  </div>
                ) : userStatus && !userStatus.hasOfficeClockIn ? (
                  <div className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                    <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                      <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>No Office Clock-In Recorded Today</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-300/90">
                      You haven&apos;t clocked in at the front entrance biometric machine yet today. If you just punched
                      seconds ago, please wait 30 seconds for device sync.
                    </p>
                  </div>
                ) : userStatus && userStatus.hasOfficeClockIn ? (
                  <div className="space-y-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-950 dark:text-emerald-200">
                    <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>Office Entrance Punch Verified</span>
                    </div>
                    <p className="text-[11px] text-emerald-700/90 dark:text-emerald-300/90">
                      Punched in at{" "}
                      {new Date(userStatus.officeClockIn!).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      ({userStatus.officeClockInSource || "Biometric"}).
                    </p>
                  </div>
                ) : null}

                <Button type="submit" disabled={submitting} className="h-11 w-full text-sm font-semibold shadow">
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying Clock-In...
                    </>
                  ) : (
                    "Confirm Attendance"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Session Overview & Verification Guidelines */}
      <div className="space-y-6 lg:col-span-5">
        {/* Session Details Card */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Meeting Session</CardTitle>
                  <CardDescription className="text-xs">Schedule and attendance status</CardDescription>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-300"
              >
                Week {week}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Meeting Date
              </span>
              <span className="text-foreground font-medium">{meetingDateDisplay}</span>
            </div>

            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Session Status
              </span>
              <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Active for Check-In
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5" /> Your Status
              </span>
              {successResult || userStatus?.alreadyCheckedIn ? (
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Checked In
                </Badge>
              ) : userStatus && !userStatus.hasOfficeClockIn ? (
                <Badge
                  variant="outline"
                  className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                >
                  <AlertCircle className="mr-1 h-3 w-3" /> Punch Required
                </Badge>
              ) : (
                <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                  Ready to Check In
                </Badge>
              )}
            </div>

            {sessionData?.holidayInfo?.isMondayHoliday && (
              <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>Public Holiday Notice</span>
                </div>
                <p className="mt-0.5 leading-tight text-amber-700/90 dark:text-amber-300/90">
                  Monday is marked as a holiday ({sessionData.holidayInfo.mondayHolidayName || "Public Holiday"}).
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Verification Guidelines Card */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Info className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Check-In Guidelines</CardTitle>
                <CardDescription className="text-xs">How attendance verification works</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                1
              </div>
              <div className="space-y-0.5">
                <p className="text-foreground font-semibold">Front Entrance Biometric Punch</p>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Clock in at the main office entrance machine first. Attendance records require an active morning
                  biometric punch.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                2
              </div>
              <div className="space-y-0.5">
                <p className="text-foreground font-semibold">Room Poster or 6-Digit Code</p>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Scan the sign-in poster QR code with your phone camera or enter the 6-digit code shown on the
                  conference room sheet.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                3
              </div>
              <div className="space-y-0.5">
                <p className="text-foreground font-semibold">Automated Anti-Proxy Verification</p>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  The system verifies that you are physically in the building before recording your attendance for the
                  session.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="bg-muted text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                4
              </div>
              <div className="space-y-0.5">
                <p className="text-foreground font-semibold">Virtual / Off-Site Attendance</p>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Colleagues joining remotely or from branch offices are marked present by the session coordinator.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function MeetingCheckInPage() {
  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="General Meeting Attendance Check-In"
        description="Record your presence for this week's General Meeting & Knowledge Sharing Session."
        icon={UserCheck}
        backLink={{ href: "/reports/general-meeting", label: "Back to General Meeting" }}
      />
      <Suspense fallback={<div className="text-muted-foreground py-10 text-center">Loading check-in session...</div>}>
        <CheckInContent />
      </Suspense>
    </PageWrapper>
  )
}
