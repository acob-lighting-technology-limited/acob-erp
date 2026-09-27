"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { PageHeader, PageWrapper } from "@/components/layout"
import { PageSection } from "@/components/ui/patterns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, Clock, Loader2, QrCode, ShieldCheck, UserCheck } from "lucide-react"
import { toast } from "sonner"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { cn } from "@/lib/utils"

function CheckInContent() {
  const searchParams = useSearchParams()
  const officeWeek = useMemo(() => getCurrentOfficeWeek(), [])

  const initialWeek = Number(searchParams.get("week")) || officeWeek.week
  const initialYear = Number(searchParams.get("year")) || officeWeek.year
  const initialCode = searchParams.get("code") || ""

  const [week] = useState(initialWeek)
  const [year] = useState(initialYear)
  const [code, setCode] = useState(initialCode)
  const [mode, setMode] = useState<"physical" | "virtual">("physical")
  const [submitting, setSubmitting] = useState(false)
  const [successResult, setSuccessResult] = useState<{
    officeClockIn: string | null
    meetingClockIn: string
  } | null>(null)
  const [biometricError, setBiometricError] = useState<string | null>(null)

  // Auto-submit if code is prefilled via QR scan (length 6)
  useEffect(() => {
    if (initialCode && initialCode.length === 6 && !successResult && !submitting) {
      // Auto pre-populate code
      setCode(initialCode)
    }
  }, [initialCode, successResult, submitting])

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setBiometricError(null)

    const cleanedCode = code.trim().replace(/\s+/g, "")
    if (cleanedCode.length !== 6) {
      toast.error("Please enter a valid 6-digit meeting code")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/reports/general-meeting/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week,
          year,
          code: cleanedCode,
          attendanceMode: mode,
          source: initialCode ? "qr_scan" : "code_input",
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.code === "BIOMETRIC_PUNCH_REQUIRED") {
          setBiometricError(data.error)
        }
        throw new Error(data.error || "Failed to record attendance")
      }

      toast.success("Attendance confirmed successfully!")
      setSuccessResult({
        officeClockIn: data.record.office_clock_in,
        meetingClockIn: data.record.meeting_clock_in,
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error checking in")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Card className="border shadow-md">
        <CardHeader className="pb-4 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600">
            <UserCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">General Meeting & KSS Check-In</CardTitle>
          <CardDescription>
            Week {week}, {year} • Enter the 6-digit code or scan the room sign-in sheet
          </CardDescription>
        </CardHeader>

        <CardContent>
          {successResult ? (
            <div className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center text-emerald-950 dark:text-emerald-200">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 dark:text-emerald-400" />
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">Attendance Confirmed!</h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Your meeting attendance has been recorded and verified.
                </p>
              </div>

              <div className="bg-background/80 mt-4 space-y-2 rounded-lg border border-emerald-500/20 p-3 text-left text-xs">
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

              <Button variant="outline" size="sm" onClick={() => setSuccessResult(null)} className="mt-2 text-xs">
                Check In Another Session
              </Button>
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
                  Shown on the printed sheet in the conference room.
                </p>
              </div>

              {/* Mode Selection: Physical vs Virtual */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Attendance Mode</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMode("physical")}
                    className={cn(
                      "flex cursor-pointer flex-col items-center justify-between rounded-lg border-2 p-3 text-center text-xs transition-all",
                      mode === "physical"
                        ? "border-indigo-600 bg-indigo-50/50 font-semibold text-indigo-950 dark:bg-indigo-950/30 dark:text-indigo-200"
                        : "border-muted bg-popover hover:bg-accent text-muted-foreground"
                    )}
                  >
                    <span className="mb-1 text-base">🏢</span>
                    <span>In Conference Room</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("virtual")}
                    className={cn(
                      "flex cursor-pointer flex-col items-center justify-between rounded-lg border-2 p-3 text-center text-xs transition-all",
                      mode === "virtual"
                        ? "border-indigo-600 bg-indigo-50/50 font-semibold text-indigo-950 dark:bg-indigo-950/30 dark:text-indigo-200"
                        : "border-muted bg-popover hover:bg-accent text-muted-foreground"
                    )}
                  >
                    <span className="mb-1 text-base">💻</span>
                    <span>Online (Teams)</span>
                  </button>
                </div>
              </div>

              {/* Security notice */}
              <div className="bg-muted/50 text-muted-foreground flex items-center gap-2 rounded-lg p-2.5 text-[11px]">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>Requires your morning biometric punch at the office entrance machine.</span>
              </div>

              <Button
                type="submit"
                disabled={submitting || code.trim().length !== 6}
                className="h-11 w-full bg-indigo-600 text-sm font-semibold text-white shadow hover:bg-indigo-700"
              >
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
