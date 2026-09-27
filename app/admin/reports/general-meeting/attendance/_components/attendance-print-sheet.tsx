"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { AlertTriangle, Download, Loader2, Printer, QrCode, RefreshCw, ShieldCheck } from "lucide-react"
import {
  generateMeetingAttendancePdf,
  generateQrWithMatrixLogo,
  type MeetingSheetData,
} from "@/lib/reports/meeting-qr-pdf"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  week: number
  year: number
  meetingDate: string
  code6Digit: string
  isHoliday?: boolean
  holidayName?: string | null
  onRegenerateCode?: () => Promise<void>
}

export function AttendancePrintSheetDialog({
  open,
  onOpenChange,
  week,
  year,
  meetingDate,
  code6Digit,
  isHoliday,
  holidayName,
  onRegenerateCode,
}: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [generatingQr, setGeneratingQr] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  // Construct check-in URL with prefilled code for easy scanning
  const checkInUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/reports/general-meeting/attendance?week=${week}&year=${year}&code=${code6Digit}`
      : `/reports/general-meeting/attendance?week=${week}&year=${year}&code=${code6Digit}`

  useEffect(() => {
    if (!open || !code6Digit) return
    let active = true

    const loadQr = async () => {
      setGeneratingQr(true)
      try {
        const url = await generateQrWithMatrixLogo(checkInUrl)
        if (active) setQrDataUrl(url)
      } catch {
        toast.error("Failed to generate QR preview")
      } finally {
        if (active) setGeneratingQr(false)
      }
    }

    loadQr()
    return () => {
      active = false
    }
  }, [open, code6Digit, checkInUrl])

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true)
    try {
      const sheetData: MeetingSheetData = {
        week,
        year,
        meetingDate,
        code6Digit,
        checkInUrl,
        isHoliday,
        holidayName,
      }
      const pdf = await generateMeetingAttendancePdf(sheetData)
      pdf.save(`ACOB_General_Meeting_Attendance_Sheet_W${week}_${year}.pdf`)
      toast.success("Attendance sign-in sheet downloaded as PDF")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to download PDF")
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleRegenerate = async () => {
    if (!onRegenerateCode) return
    setRegenerating(true)
    try {
      await onRegenerateCode()
      toast.success("New 6-digit meeting code generated")
    } catch {
      toast.error("Failed to regenerate code")
    } finally {
      setRegenerating(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // Format code with space e.g. "849 203"
  const formattedCode = code6Digit.length === 6 ? `${code6Digit.slice(0, 3)}  ${code6Digit.slice(3, 6)}` : code6Digit

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <QrCode className="h-5 w-5 text-indigo-600" />
            Meeting Sign-In Sheet (QR & Code)
          </DialogTitle>
          <DialogDescription>
            Print or display this sheet in the conference room. Attendees scan or enter the 6-digit code.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Holiday Alert if applicable */}
          {isHoliday && holidayName && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <span className="font-semibold">Public Holiday Notice:</span> {holidayName} (Meeting held on{" "}
                {meetingDate})
              </div>
            </div>
          )}

          {/* Printable Card Preview */}
          <div className="bg-muted/30 flex flex-col items-center justify-center rounded-xl border p-6 text-center shadow-inner">
            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Week {week}, {year} • General Meeting & KSS
            </div>
            <div className="text-foreground mt-1 text-sm font-medium">{meetingDate}</div>

            {/* QR Code Container */}
            <div className="relative mt-4 flex h-52 w-52 items-center justify-center rounded-xl border bg-white p-2 shadow-sm">
              {generatingQr ? (
                <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
              ) : qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="Meeting QR Code" className="h-full w-full object-contain" />
              ) : (
                <span className="text-muted-foreground text-xs">Unable to render QR</span>
              )}
            </div>

            <div className="text-muted-foreground mt-2 text-[11px]">Scan with camera to open check-in</div>

            <div className="mt-3 flex items-center gap-2">
              <div className="bg-border h-px w-10" />
              <span className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
                OR ENTER CODE
              </span>
              <div className="bg-border h-px w-10" />
            </div>

            {/* 6-Digit Code */}
            <div className="mt-3 rounded-lg bg-slate-900 px-6 py-2.5 text-2xl font-black tracking-[0.25em] text-white shadow">
              {formattedCode}
            </div>

            <div className="mt-3 flex items-center gap-1.5">
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-50 text-[11px] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
              >
                <ShieldCheck className="mr-1 h-3.5 w-3.5 text-emerald-600" /> Biometric Entrance Punch Required
              </Badge>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            {onRegenerateCode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="text-muted-foreground gap-1.5 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
                Regenerate Code
              </Button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button
                size="sm"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download PDF
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
