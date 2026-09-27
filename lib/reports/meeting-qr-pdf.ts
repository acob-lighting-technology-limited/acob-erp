import QRCode from "qrcode"
import { jsPDF } from "jspdf"
import { formatWATDate } from "@/lib/utils/date"

export interface MeetingSheetData {
  week: number
  year: number
  meetingDate: string
  meetingTime?: string
  code6Digit: string
  checkInUrl: string
  holidayName?: string | null
  isHoliday?: boolean
}

/**
 * Generates a high-resolution QR code data URL with the Matrix logo embedded in the center.
 */
export async function generateQrWithMatrixLogo(text: string): Promise<string> {
  // Generate base QR code on an offscreen canvas with High error correction (level 'H' allows ~30% obscuration)
  if (typeof window === "undefined") {
    // Server-side fallback: generate standard high-res data URL
    return QRCode.toDataURL(text, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 400,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
  }

  const canvas = document.createElement("canvas")
  await QRCode.toCanvas(canvas, text, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 480,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  })

  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas.toDataURL("image/png")

  // Load Matrix logo from public folder
  try {
    const img = new Image()
    img.crossOrigin = "anonymous"
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject()
      img.src = "/images/matrix-logo-dark.png"
    })

    const size = canvas.width * 0.24 // 24% width in the center
    const x = (canvas.width - size) / 2
    const y = (canvas.height - size) / 2
    const padding = 6

    // Draw white background badge with rounded corners behind logo for high contrast
    ctx.fillStyle = "#ffffff"
    ctx.strokeStyle = "#e2e8f0"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(x - padding, y - padding, size + padding * 2, size + padding * 2, 8)
    ctx.fill()
    ctx.stroke()

    // Draw logo centered
    ctx.drawImage(img, x, y, size, size)
  } catch {
    // If image fails to load, draw a branded "MATRIX" badge in the center
    const size = canvas.width * 0.24
    const x = (canvas.width - size) / 2
    const y = (canvas.height - size) / 2

    ctx.fillStyle = "#0f172a"
    ctx.beginPath()
    ctx.roundRect(x, y, size, size, 8)
    ctx.fill()

    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 16px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("MATRIX", canvas.width / 2, canvas.height / 2)
  }

  return canvas.toDataURL("image/png")
}

/**
 * Generates an official, beautiful A4 printable PDF containing the QR Code & 6-digit code.
 */
export async function generateMeetingAttendancePdf(data: MeetingSheetData): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = 210
  const pageHeight = 297

  // 1. Header Background Accent
  doc.setFillColor(15, 23, 42) // Slate 900
  doc.rect(0, 0, pageWidth, 28, "F")

  // Top header text
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text("ACOB LIGHTING TECHNOLOGY LIMITED", pageWidth / 2, 12, { align: "center" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(203, 213, 225) // Slate 300
  doc.text("MATRIX ERP  •  INTERNAL MEETING OPERATIONS", pageWidth / 2, 20, { align: "center" })

  // 2. Document Title Box
  doc.setTextColor(15, 23, 42)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  doc.text("WEEKLY GENERAL MEETING & KSS", pageWidth / 2, 42, { align: "center" })

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(79, 70, 229) // Indigo 600
  doc.text(`OFFICIAL ATTENDANCE SIGN-IN SHEET  —  WEEK ${data.week}, ${data.year}`, pageWidth / 2, 49, {
    align: "center",
  })

  // Meeting Date & Time info pill
  let formattedDate: string
  try {
    const d = new Date(`${data.meetingDate}T00:00:00`)
    formattedDate = formatWATDate(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  } catch {
    formattedDate = data.meetingDate
  }

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10.5)
  doc.setTextColor(71, 85, 105)
  doc.text(
    `Meeting Date: ${formattedDate}   |   Scheduled Time: ${data.meetingTime || "08:30 AM"} WAT`,
    pageWidth / 2,
    57,
    { align: "center" }
  )

  // Holiday Alert Banner (if applicable)
  let nextY = 65
  if (data.isHoliday && data.holidayName) {
    doc.setFillColor(254, 243, 199) // Amber 100
    doc.setDrawColor(245, 158, 11) // Amber 500
    doc.roundedRect(25, nextY, pageWidth - 50, 11, 2, 2, "FD")

    doc.setTextColor(146, 64, 14) // Amber 800
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9.5)
    doc.text(
      `PUBLIC HOLIDAY NOTICE: ${data.holidayName.toUpperCase()} — Meeting held on ${formattedDate}`,
      pageWidth / 2,
      nextY + 7,
      { align: "center" }
    )
    nextY += 16
  }

  // 3. Central Card Frame for QR Code
  const cardWidth = 140
  const cardHeight = 135
  const cardX = (pageWidth - cardWidth) / 2
  const cardY = nextY

  doc.setFillColor(248, 250, 252) // Slate 50
  doc.setDrawColor(226, 232, 240) // Slate 200
  doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 4, 4, "FD")

  // Generate QR Code with Logo
  const qrDataUrl = await generateQrWithMatrixLogo(data.checkInUrl)
  const qrSize = 75
  const qrX = (pageWidth - qrSize) / 2
  const qrY = cardY + 10
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize)

  // QR Instruction
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text("Scan with phone camera to open check-in directly", pageWidth / 2, qrY + qrSize + 6, { align: "center" })

  // "OR ENTER 6-DIGIT CODE" divider
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.setTextColor(148, 163, 184)
  doc.text("— OR ENTER CODE MANUALLY —", pageWidth / 2, qrY + qrSize + 14, { align: "center" })

  // Large 6-Digit Code Box
  const codeBoxWidth = 85
  const codeBoxHeight = 16
  const codeBoxX = (pageWidth - codeBoxWidth) / 2
  const codeBoxY = qrY + qrSize + 18

  doc.setFillColor(15, 23, 42) // Slate 900
  doc.roundedRect(codeBoxX, codeBoxY, codeBoxWidth, codeBoxHeight, 3, 3, "F")

  // Split 6 digits (e.g. "8 4 9   2 0 3")
  const rawCode = String(data.code6Digit || "000000").padStart(6, "0")
  const spacedCode = `${rawCode.slice(0, 3)}   ${rawCode.slice(3, 6)}`

  doc.setTextColor(255, 255, 255)
  doc.setFont("courier", "bold")
  doc.setFontSize(22)
  doc.text(spacedCode, pageWidth / 2, codeBoxY + 11.5, { align: "center" })

  // 4. Step-by-Step Instructions
  const instructY = cardY + cardHeight + 10
  doc.setFillColor(241, 245, 249)
  doc.setDrawColor(203, 213, 225)
  doc.roundedRect(25, instructY, pageWidth - 50, 32, 3, 3, "FD")

  doc.setTextColor(15, 23, 42)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text("HOW TO RECORD ATTENDANCE:", 32, instructY + 7)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(51, 65, 85)
  doc.text("1. Scan the QR code above or visit Matrix: /reports/general-meeting/attendance", 32, instructY + 14)
  doc.text("2. Type or confirm the 6-digit meeting code shown above.", 32, instructY + 20)
  doc.text(
    "3. Ensure you have clocked in on the office biometric entrance machine today before checking in.",
    32,
    instructY + 26
  )

  // 5. Footer Watermark / Disclaimer
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text(
    "Automated Attendance Validation Gate: Check-in requires matching biometric entrance record. Generated by Matrix ERP.",
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  )

  return doc
}
