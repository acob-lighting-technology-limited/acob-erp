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
 * Generates an executive A4 printable PDF containing the QR Code & 6-digit code.
 * Clean, modern layout matching ACOB brand guidelines (Green, Slate, Crisp White).
 */
export async function generateMeetingAttendancePdf(data: MeetingSheetData): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = 210
  const pageHeight = 297

  // Top emerald accent strip
  doc.setFillColor(22, 101, 52) // Brand Deep Green
  doc.rect(0, 0, pageWidth, 4, "F")

  // Load the full ACOB Lighting logo
  const logoDataUrl = await loadImageDataUrl("/images/exports/acob-lighting-full.png")

  let currentY = 18

  if (logoDataUrl) {
    const logoWidth = 64
    const logoHeight = 14.5
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
  doc.setFontSize(23)
  doc.text("General Meeting & KSS", pageWidth / 2, currentY, { align: "center" })
  currentY += 7.5

  // Subtitle with Week
  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
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
  currentY += 7

  // Holiday notice (if applicable)
  if (data.isHoliday && data.holidayName) {
    doc.setFillColor(254, 243, 199)
    doc.setDrawColor(245, 158, 11)
    doc.setLineWidth(0.4)
    doc.roundedRect(30, currentY, pageWidth - 60, 8.5, 2, 2, "FD")

    doc.setTextColor(146, 64, 14)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8.5)
    doc.text(`Public Holiday: ${data.holidayName} (Meeting held ${formattedDate})`, pageWidth / 2, currentY + 5.5, {
      align: "center",
    })
    currentY += 12
  }

  // Thin clean divider
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.35)
  doc.line(36, currentY, pageWidth - 36, currentY)
  currentY += 8

  // Pill badge: SCAN TO CHECK IN
  const badgeWidth = 48
  const badgeHeight = 7
  doc.setFillColor(240, 253, 244)
  doc.setDrawColor(187, 247, 208)
  doc.setLineWidth(0.3)
  doc.roundedRect((pageWidth - badgeWidth) / 2, currentY, badgeWidth, badgeHeight, 3.5, 3.5, "FD")

  doc.setTextColor(22, 101, 52)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.text("SCAN TO CHECK IN", pageWidth / 2, currentY + 4.8, { align: "center" })
  currentY += badgeHeight + 5

  // Central QR Code Container
  const qrDataUrl = await generateQrWithMatrixLogo(data.checkInUrl)
  const qrSize = 92
  const framePad = 4
  const frameSize = qrSize + framePad * 2
  const frameX = (pageWidth - frameSize) / 2

  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.4)
  doc.roundedRect(frameX, currentY, frameSize, frameSize, 3, 3, "FD")
  doc.addImage(qrDataUrl, "PNG", frameX + framePad, currentY + framePad, qrSize, qrSize)
  currentY += frameSize + 10

  // Divider: OR ENTER CODE IN MATRIX
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.35)
  doc.line(36, currentY, 78, currentY)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  doc.text("OR ENTER CODE IN MATRIX", pageWidth / 2, currentY + 1, { align: "center" })

  doc.line(132, currentY, pageWidth - 36, currentY)
  currentY += 7

  // 6-Digit Code Box with dash: e.g. "836 - 223"
  const rawCode = String(data.code6Digit || "000000").padStart(6, "0")
  const formattedCode = `${rawCode.slice(0, 3)} - ${rawCode.slice(3, 6)}`

  const boxWidth = 110
  const boxHeight = 24
  const boxX = (pageWidth - boxWidth) / 2

  doc.setFillColor(240, 253, 244)
  doc.setDrawColor(187, 247, 208)
  doc.setLineWidth(0.5)
  doc.roundedRect(boxX, currentY, boxWidth, boxHeight, 3.5, 3.5, "FD")

  doc.setTextColor(20, 83, 45) // Deep Forest Green
  doc.setFont("helvetica", "bold")
  doc.setFontSize(30)
  doc.text(formattedCode, pageWidth / 2, currentY + 16.5, { align: "center" })
  currentY += boxHeight + 10

  // Simple instruction text
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(71, 85, 105) // Slate 600
  doc.text(
    "Open your mobile camera or scanner, scan the QR code, then confirm your attendance.",
    pageWidth / 2,
    currentY,
    {
      align: "center",
    }
  )

  // Footer divider & branding
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.35)
  doc.line(40, pageHeight - 16, pageWidth - 40, pageHeight - 16)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(148, 163, 184) // Slate 400
  doc.text("ACOB Lighting Technology Limited   ·   Matrix ERP", pageWidth / 2, pageHeight - 10, {
    align: "center",
  })

  // Bottom subtle green accent line
  doc.setFillColor(22, 101, 52)
  doc.rect(0, pageHeight - 2, pageWidth, 2, "F")

  return doc
}
