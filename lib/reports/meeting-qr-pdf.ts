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
 * Loads an image from a URL or public path and converts it to a base64 PNG data URL.
 */
async function loadImageDataUrl(src: string): Promise<string | null> {
  if (typeof window === "undefined") return null
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const c = document.createElement("canvas")
        c.width = img.naturalWidth || img.width
        c.height = img.naturalHeight || img.height
        const ctx = c.getContext("2d")
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0)
        resolve(c.toDataURL("image/png"))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/**
 * Generates a high-resolution QR code data URL with the dark Matrix mark embedded in the center.
 */
export async function generateQrWithMatrixLogo(text: string): Promise<string> {
  if (typeof window === "undefined") {
    return QRCode.toDataURL(text, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 500,
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
    width: 600,
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
 * Two-Block Executive design: Primary Scan Card + Manual Backup Card.
 * Perfectly balanced across the entire A4 canvas.
 */
export async function generateMeetingAttendancePdf(data: MeetingSheetData): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = 210
  const pageHeight = 297

  // 1. Top emerald brand banner
  doc.setFillColor(22, 101, 52) // Brand Deep Green
  doc.rect(0, 0, pageWidth, 5, "F")

  // 2. Elegant outer structural border framing the entire sheet
  doc.setDrawColor(226, 232, 240) // Slate 200
  doc.setLineWidth(0.4)
  doc.roundedRect(12, 12, pageWidth - 24, pageHeight - 24, 4, 4, "S")

  // 3. Load full ACOB Lighting logo
  const logoDataUrl = await loadImageDataUrl("/images/exports/acob-lighting-full.png")

  let currentY = 19

  if (logoDataUrl) {
    const logoWidth = 66
    const logoHeight = 15
    doc.addImage(logoDataUrl, "PNG", (pageWidth - logoWidth) / 2, currentY, logoWidth, logoHeight)
    currentY += logoHeight + 6
  } else {
    doc.setTextColor(15, 23, 42)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(16)
    doc.text("ACOB LIGHTING TECHNOLOGY LIMITED", pageWidth / 2, currentY + 6, { align: "center" })
    currentY += 16
  }

  // Meeting Title
  doc.setTextColor(15, 23, 42)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(22)
  doc.text("General Meeting & KSS", pageWidth / 2, currentY, { align: "center" })
  currentY += 7

  // Subtitle with Week
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10.5)
  doc.setTextColor(71, 85, 105) // Slate 600
  doc.text(`Attendance Sign-In Sheet   ·   Week ${data.week}, ${data.year}`, pageWidth / 2, currentY, {
    align: "center",
  })
  currentY += 5.5

  // Formatted Date
  let formattedDate: string
  try {
    const d = new Date(`${data.meetingDate}T00:00:00`)
    formattedDate = formatWATDate(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  } catch {
    formattedDate = data.meetingDate
  }

  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139) // Slate 500
  doc.text(formattedDate, pageWidth / 2, currentY, { align: "center" })
  currentY += 6

  // Holiday notice (if applicable)
  if (data.isHoliday && data.holidayName) {
    doc.setFillColor(254, 243, 199)
    doc.setDrawColor(245, 158, 11)
    doc.setLineWidth(0.4)
    doc.roundedRect(30, currentY, pageWidth - 60, 8, 2, 2, "FD")

    doc.setTextColor(146, 64, 14)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8.5)
    doc.text(`Public Holiday: ${data.holidayName} (Meeting held ${formattedDate})`, pageWidth / 2, currentY + 5.2, {
      align: "center",
    })
    currentY += 11
  }

  // Dividing rule
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.35)
  doc.line(28, currentY, pageWidth - 28, currentY)
  currentY += 6

  // -------------------------------------------------------------
  // BLOCK 1: PRIMARY SCAN HERO CARD
  // -------------------------------------------------------------
  const card1X = 18
  const card1Y = currentY
  const card1W = pageWidth - card1X * 2
  const card1H = 132

  doc.setFillColor(248, 250, 252) // Slate 50
  doc.setDrawColor(226, 232, 240) // Slate 200
  doc.setLineWidth(0.45)
  doc.roundedRect(card1X, card1Y, card1W, card1H, 4, 4, "FD")

  // Pill badge: SCAN TO SIGN IN
  const badgeWidth = 52
  const badgeHeight = 7.5
  const badgeY = card1Y + 7
  doc.setFillColor(220, 252, 231) // Emerald 100
  doc.setDrawColor(134, 239, 172) // Emerald 300
  doc.setLineWidth(0.35)
  doc.roundedRect((pageWidth - badgeWidth) / 2, badgeY, badgeWidth, badgeHeight, 3.5, 3.5, "FD")

  doc.setTextColor(22, 101, 52)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.text("SCAN TO SIGN IN", pageWidth / 2, badgeY + 5, { align: "center" })

  // QR Code Frame inside Card 1
  const qrDataUrl = await generateQrWithMatrixLogo(data.checkInUrl)
  const qrFrameSize = 96
  const qrFrameX = (pageWidth - qrFrameSize) / 2
  const qrFrameY = badgeY + badgeHeight + 5

  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(203, 213, 225) // Slate 300
  doc.setLineWidth(0.4)
  doc.roundedRect(qrFrameX, qrFrameY, qrFrameSize, qrFrameSize, 3, 3, "FD")

  // High-res QR image centered in white frame
  const qrSize = 90
  const qrX = (pageWidth - qrSize) / 2
  const qrY = qrFrameY + (qrFrameSize - qrSize) / 2
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize)

  // Clear step instruction below QR
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9.5)
  doc.setTextColor(71, 85, 105) // Slate 600
  doc.text(
    "Point your mobile camera or scanner at the code to confirm attendance.",
    pageWidth / 2,
    card1Y + card1H - 6.5,
    {
      align: "center",
    }
  )

  currentY = card1Y + card1H + 6

  // -------------------------------------------------------------
  // BLOCK 2: MANUAL BACKUP CODE CARD
  // -------------------------------------------------------------
  const card2X = 18
  const card2Y = currentY
  const card2W = card1W
  const card2H = 58

  doc.setFillColor(240, 253, 244) // Emerald 50
  doc.setDrawColor(187, 247, 208) // Emerald 200
  doc.setLineWidth(0.5)
  doc.roundedRect(card2X, card2Y, card2W, card2H, 4, 4, "FD")

  // Card 2 title
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(22, 101, 52) // Deep Green
  doc.text("CAN'T SCAN? USE 6-DIGIT BACKUP CODE", pageWidth / 2, card2Y + 8.5, { align: "center" })

  // 6-Digit Code Display Box
  const rawCode = String(data.code6Digit || "000000").padStart(6, "0")
  const formattedCode = `${rawCode.slice(0, 3)} - ${rawCode.slice(3, 6)}`

  const boxW = 114
  const boxH = 22
  const boxX = (pageWidth - boxW) / 2
  const boxY = card2Y + 13

  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(134, 239, 172)
  doc.setLineWidth(0.4)
  doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, "FD")

  doc.setTextColor(20, 83, 45) // Forest Green
  doc.setFont("helvetica", "bold")
  doc.setFontSize(28)
  doc.text(formattedCode, pageWidth / 2, boxY + 15.5, { align: "center" })

  // Step instruction inside backup card
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(
    "Enter this code in Matrix General Meeting Attendance to record your presence.",
    pageWidth / 2,
    card2Y + card2H - 7,
    {
      align: "center",
    }
  )

  // -------------------------------------------------------------
  // FOOTER & BOTTOM ACCENT
  // -------------------------------------------------------------
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184) // Slate 400
  doc.text("ACOB Lighting Technology Limited   ·   Matrix ERP", pageWidth / 2, pageHeight - 16, {
    align: "center",
  })

  // Bottom brand strip
  doc.setFillColor(22, 101, 52)
  doc.rect(0, pageHeight - 4, pageWidth, 4, "F")

  return doc
}
