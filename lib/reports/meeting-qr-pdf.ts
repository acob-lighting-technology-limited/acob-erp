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
 * Generates a high-resolution QR code data URL with the dark Matrix mark embedded in the center.
 */
export async function generateQrWithMatrixLogo(text: string): Promise<string> {
  if (typeof window === "undefined") {
    return QRCode.toDataURL(text, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 600,
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
    width: 700,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  })

  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas.toDataURL("image/png")

  // Load the dark Matrix mark from public folder
  try {
    const img = new Image()
    img.crossOrigin = "anonymous"
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject()
      img.src = "/images/exports/matrix-mark.png"
    })

    const size = canvas.width * 0.22
    const x = (canvas.width - size) / 2
    const y = (canvas.height - size) / 2
    const pad = 6

    // Clean white rounded badge with subtle border
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.roundRect(x - pad, y - pad, size + pad * 2, size + pad * 2, 8)
    ctx.fill()

    ctx.strokeStyle = "#e2e8f0"
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Draw logo centered
    ctx.drawImage(img, x, y, size, size)
  } catch {
    // Graceful fallback
    const size = canvas.width * 0.22
    const x = (canvas.width - size) / 2
    const y = (canvas.height - size) / 2

    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.roundRect(x - 6, y - 6, size + 12, size + 12, 8)
    ctx.fill()

    ctx.fillStyle = "#15803d"
    ctx.font = "bold 20px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("MATRIX", canvas.width / 2, canvas.height / 2)
  }

  return canvas.toDataURL("image/png")
}

/**
 * Generates an executive A4 printable poster containing the QR Code & 6-digit code.
 * Precisely reproduces the refined, balanced on-screen card design.
 */
export async function generateMeetingAttendancePdf(data: MeetingSheetData): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = 210

  // 1. Top emerald pill accent bar (centered, matching the card preview)
  const topBarW = 160
  const topBarX = (pageWidth - topBarW) / 2
  doc.setFillColor(21, 128, 61) // Emerald 700
  doc.roundedRect(topBarX, 22, topBarW, 2, 1, 1, "F")

  let currentY = 30

  // 2. Tracked Brand Header
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42) // Slate 900
  doc.text("A C O B   L I G H T I N G", pageWidth / 2, currentY, { align: "center" })
  currentY += 7

  // 3. Meeting Title
  doc.setFontSize(22)
  doc.setTextColor(15, 23, 42)
  doc.text("General Meeting & KSS", pageWidth / 2, currentY, { align: "center" })
  currentY += 6

  // 4. Subtitle with Week
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139) // Slate 500
  doc.text(`Attendance Sign-In Sheet · Week ${data.week}, ${data.year}`, pageWidth / 2, currentY, {
    align: "center",
  })
  currentY += 5.5

  // 5. Formatted Date
  let formattedDate: string
  try {
    const d = new Date(`${data.meetingDate}T00:00:00`)
    formattedDate = formatWATDate(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  } catch {
    formattedDate = data.meetingDate
  }

  doc.setFontSize(9.5)
  doc.text(formattedDate, pageWidth / 2, currentY, { align: "center" })
  currentY += 8

  // Holiday notice (if applicable)
  if (data.isHoliday && data.holidayName) {
    doc.setFillColor(254, 243, 199)
    doc.setDrawColor(245, 158, 11)
    doc.setLineWidth(0.4)
    doc.roundedRect(30, currentY, pageWidth - 60, 7.5, 2, 2, "FD")

    doc.setTextColor(146, 64, 14)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.text(`Public Holiday: ${data.holidayName} (Meeting held ${formattedDate})`, pageWidth / 2, currentY + 5, {
      align: "center",
    })
    currentY += 11
  }

  // -------------------------------------------------------------
  // BLOCK 1: PRIMARY SCAN HERO CARD (Grey Slate-50 container)
  // -------------------------------------------------------------
  const cardW = 160
  const cardX = (pageWidth - cardW) / 2
  const card1Y = currentY
  const card1H = 124

  doc.setFillColor(248, 250, 252) // Slate 50
  doc.setDrawColor(226, 232, 240) // Slate 200
  doc.setLineWidth(0.35)
  doc.roundedRect(cardX, card1Y, cardW, card1H, 4, 4, "FD")

  // Pill badge: SCAN TO SIGN IN
  const badgeW = 50
  const badgeH = 7
  const badgeY = card1Y + 7
  doc.setFillColor(220, 252, 231) // Emerald 100
  doc.setDrawColor(134, 239, 172) // Emerald 300
  doc.setLineWidth(0.3)
  doc.roundedRect((pageWidth - badgeW) / 2, badgeY, badgeW, badgeH, 3.5, 3.5, "FD")

  doc.setTextColor(22, 101, 52) // Emerald 800
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.text("SCAN TO SIGN IN", pageWidth / 2, badgeY + 4.8, { align: "center" })

  // QR Code Container inside Card 1 (White frame)
  const qrDataUrl = await generateQrWithMatrixLogo(data.checkInUrl)
  const qrFrameSize = 86
  const qrFrameX = (pageWidth - qrFrameSize) / 2
  const qrFrameY = badgeY + badgeH + 5

  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(203, 213, 225) // Slate 300
  doc.setLineWidth(0.3)
  doc.roundedRect(qrFrameX, qrFrameY, qrFrameSize, qrFrameSize, 3, 3, "FD")

  // High-res QR image centered in white frame
  const qrSize = 80
  const qrX = (pageWidth - qrSize) / 2
  const qrY = qrFrameY + (qrFrameSize - qrSize) / 2
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize)

  // Subtext below QR
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139) // Slate 500
  doc.text("Point your camera or scanner at the code to check in.", pageWidth / 2, card1Y + card1H - 6.5, {
    align: "center",
  })

  currentY = card1Y + card1H + 7

  // -------------------------------------------------------------
  // BLOCK 2: MANUAL BACKUP CODE CARD (Emerald-50 container)
  // -------------------------------------------------------------
  const card2Y = currentY
  const card2H = 54

  doc.setFillColor(240, 253, 244) // Emerald 50
  doc.setDrawColor(187, 247, 208) // Emerald 200
  doc.setLineWidth(0.4)
  doc.roundedRect(cardX, card2Y, cardW, card2H, 4, 4, "FD")

  // Card 2 title
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.setTextColor(22, 101, 52) // Emerald 800
  doc.text("CAN'T SCAN? USE 6-DIGIT BACKUP CODE", pageWidth / 2, card2Y + 8, { align: "center" })

  // 6-Digit Code Display Box (White pill)
  const rawCode = String(data.code6Digit || "000000").padStart(6, "0")
  const formattedCode = `${rawCode.slice(0, 3)} - ${rawCode.slice(3, 6)}`

  const boxW = 106
  const boxH = 21
  const boxX = (pageWidth - boxW) / 2
  const boxY = card2Y + 12

  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(134, 239, 172) // Emerald 300
  doc.setLineWidth(0.35)
  doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, "FD")

  doc.setTextColor(20, 83, 45) // Deep Green
  doc.setFont("helvetica", "bold")
  doc.setFontSize(28)
  doc.text(formattedCode, pageWidth / 2, boxY + 15, { align: "center" })

  // Subtext below code
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  doc.text("Enter code in Matrix General Meeting Attendance.", pageWidth / 2, card2Y + card2H - 6.5, {
    align: "center",
  })

  currentY = card2Y + card2H + 10

  // -------------------------------------------------------------
  // FOOTER (Matching Image 1)
  // -------------------------------------------------------------
  doc.setDrawColor(241, 245, 249) // Slate 100
  doc.setLineWidth(0.3)
  doc.line(50, currentY, pageWidth - 50, currentY)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184) // Slate 400
  doc.text("ACOB Lighting Technology Limited · Matrix ERP", pageWidth / 2, currentY + 6, {
    align: "center",
  })

  return doc
}
