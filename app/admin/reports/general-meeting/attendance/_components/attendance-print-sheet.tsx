"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { AlertTriangle, Download, Loader2, Printer, QrCode, ShieldCheck } from "lucide-react"
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
}: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [generatingQr, setGeneratingQr] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [printingPdf, setPrintingPdf] = useState(false)

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

  const handlePrint = async () => {
    // Open immediately while the click still counts as a user gesture; opening
    // after PDF generation is commonly blocked by browser pop-up protection.
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      toast.error("Allow pop-ups for Matrix to open the print sheet")
      return
    }
    printWindow.opener = null

    setPrintingPdf(true)
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
      pdf.autoPrint()
      printWindow.location.href = pdf.output("bloburl").toString()
    } catch (err: unknown) {
      printWindow.close()
      toast.error(err instanceof Error ? err.message : "Failed to open print sheet")
    } finally {
      setPrintingPdf(false)
    }
  }

  // Format code with dash e.g. "849 - 203"
  const formattedCode = code6Digit.length === 6 ? `${code6Digit.slice(0, 3)} - ${code6Digit.slice(3, 6)}` : code6Digit

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <QrCode className="text-primary h-5 w-5" />
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

          {/* Large On-Screen Scan Display */}
          <div className="bg-muted/30 flex flex-col items-center justify-center rounded-2xl border p-5 text-center shadow-inner sm:p-6">
            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Week {week}, {year} • General Meeting & KSS
            </div>
            <div className="text-foreground mt-1 text-sm font-medium">{meetingDate}</div>

            {/* QR Code Container - Large and High Contrast for instant camera focus */}
            <div className="relative mt-4 flex h-60 w-60 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white p-3 shadow-md sm:h-64 sm:w-64 dark:border-slate-800">
              {generatingQr ? (
                <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
              ) : qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="Meeting QR Code" className="h-full w-full object-contain" />
              ) : (
                <span className="text-muted-foreground text-xs">Unable to render QR</span>
              )}
            </div>

            <div className="text-muted-foreground mt-3 text-xs">
              Point your camera or scanner at the code to check in.
            </div>

            <div className="mt-3.5 flex items-center gap-2">
              <div className="bg-border h-px w-10 sm:w-16" />
              <span className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
                OR ENTER CODE IN MATRIX
              </span>
              <div className="bg-border h-px w-10 sm:w-16" />
            </div>

            {/* 6-Digit Code with Dash */}
            <div className="mt-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-8 py-2.5 font-mono text-2xl font-black tracking-[0.25em] text-emerald-700 shadow-xs sm:text-3xl dark:text-emerald-300">
              {formattedCode}
            </div>

            <div className="mt-3 flex items-center gap-1.5">
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-700 dark:text-emerald-300"
              >
                <ShieldCheck className="mr-1 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Biometric Entrance
                Punch Required
              </Badge>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={printingPdf} className="gap-1.5">
              {printingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Print
            </Button>
            <Button size="sm" onClick={handleDownloadPdf} disabled={downloadingPdf} className="gap-1.5">
              {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
