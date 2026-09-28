"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { AlertTriangle, Download, Loader2, Printer, QrCode } from "lucide-react"
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

          {/* Screen preview of the A4 sheet */}
          <div className="bg-muted/30 rounded-xl border p-3 shadow-inner sm:p-4">
            <div className="mx-auto flex aspect-[210/297] w-full max-w-[340px] flex-col items-center overflow-hidden rounded-sm border bg-white px-5 py-5 text-center shadow-sm">
              <div className="h-1 w-full rounded-full bg-emerald-700" />
              <div className="mt-3 text-[10px] font-bold tracking-[0.16em] text-slate-900">ACOB LIGHTING</div>
              <div className="mt-2 text-base font-bold text-slate-900">General Meeting & KSS</div>
              <div className="mt-0.5 text-[9px] text-slate-500">
                Attendance Sign-In Sheet · Week {week}, {year}
              </div>
              <div className="mt-0.5 text-[9px] text-slate-500">{meetingDate}</div>

              <div className="mt-3 flex w-full flex-1 flex-col gap-2">
                {/* Block 1: Scan Hero */}
                <div className="flex flex-col items-center rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
                  <div className="rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-0.5 text-[8px] font-bold tracking-wider text-emerald-800">
                    SCAN TO SIGN IN
                  </div>

                  {/* QR Code Container */}
                  <div className="relative mt-1.5 flex aspect-square w-[56%] items-center justify-center rounded-md border border-slate-300 bg-white p-1.5 shadow-xs">
                    {generatingQr ? (
                      <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                    ) : qrDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qrDataUrl} alt="Meeting QR Code" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-muted-foreground text-[10px]">Unable to render QR</span>
                    )}
                  </div>

                  <div className="mt-1 text-[7.5px] text-slate-500">
                    Point your camera or scanner at the code to check in.
                  </div>
                </div>

                {/* Block 2: Backup Code */}
                <div className="flex flex-col items-center rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-center">
                  <div className="text-[7.5px] font-bold tracking-wide text-emerald-800">
                    CAN&apos;T SCAN? USE 6-DIGIT BACKUP CODE
                  </div>
                  <div className="mt-1 w-full max-w-[180px] rounded-md border border-emerald-300 bg-white py-1 text-base font-black tracking-widest text-emerald-950">
                    {formattedCode}
                  </div>
                  <div className="mt-1 text-[7px] text-slate-500">Enter code in Matrix General Meeting Attendance.</div>
                </div>
              </div>

              <div className="mt-auto border-t border-slate-100 pt-1.5 text-[7px] text-slate-400">
                ACOB Lighting Technology Limited · Matrix ERP
              </div>
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
