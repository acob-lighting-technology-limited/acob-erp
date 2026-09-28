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
      // Use the crisp dark Matrix mark
      img.src = "/images/exports/matrix-mark.png"
    })

    const size = canvas.width * 0.22
    const x = (canvas.width - size) / 2
    const y = (canvas.height - size) / 2
    const padding = 8

    // Draw white circular/rounded background badge with clean contrast
    ctx.fillStyle = "#ffffff"
    ctx.strokeStyle = "#cbd5e1"
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect(x - padding, y - padding, size + padding * 2, size + padding * 2, 12)
    ctx.fill()
    ctx.stroke()

    // Draw logo centered
    ctx.drawImage(img, x, y, size, size)
  } catch {
    // Graceful fallback: Draw clean dark Matrix mark
    const size = canvas.width * 0.22
    const x = (canvas.width - size) / 2
    const y = (canvas.height - size) / 2

    ctx.fillStyle = "#ffffff"
    ctx.strokeStyle = "#cbd5e1"
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect(x - 6, y - 6, size + 12, size + 12, 10)
    ctx.fill()
    ctx.stroke()

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

  // Load the dark ACOB logo for the header
  const logoDataUrl = await loadImageDataUrl("/images/exports/acob-lighting-full.png")

  let currentY = 22

  if (logoDataUrl) {
    // Centered dark ACOB logo
    const logoWidth = 68
    const logoHeight = 15
    doc.addImage(logoDataUrl, "PNG", (pageWidth - logoWidth) / 2, currentY, logoWidth, logoHeight)
    currentY += logoHeight + 10
  } else {
    // Text fallback
    doc.setTextColor(15, 23, 42)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(16)
    doc.text("ACOB LIGHTING TECHNOLOGY LIMITED", pageWidth / 2, currentY + 6, { align: "center" })
    currentY += 18
  }

  // Meeting Title
  doc.setTextColor(15, 23, 42) // Dark Slate
  doc.setFont("helvetica", "bold")
  doc.setFontSize(22)
  doc.text("General Meeting & KSS", pageWidth / 2, currentY, { align: "center" })
  currentY += 8

  // Subtitle with Week and Formatted Date
  let formattedDate: string
  try {
    const d = new Date(`${data.meetingDate}T00:00:00`)
    formattedDate = formatWATDate(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  } catch {
    formattedDate = data.meetingDate
  }

  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  doc.setTextColor(100, 116, 139) // Slate 500
  doc.text(`Attendance Sign-In Sheet  •  Week ${data.week}, ${data.year}`, pageWidth / 2, currentY, { align: "center" })
  currentY += 6

  doc.setFontSize(10)
  doc.text(formattedDate, pageWidth / 2, currentY, { align: "center" })
  currentY += 8

  // Holiday notice (if applicable)
  if (data.isHoliday && data.holidayName) {
    doc.setFillColor(254, 243, 199) // Amber 100
    doc.setDrawColor(245, 158, 11) // Amber 500
    doc.roundedRect(30, currentY, pageWidth - 60, 9, 2, 2, "FD")

    doc.setTextColor(146, 64, 14) // Amber 800
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.text(`Public Holiday: ${data.holidayName} (Meeting held ${formattedDate})`, pageWidth / 2, currentY + 6, {
      align: "center",
    })
    currentY += 13
  }

  // Subtle clean divider line
  doc.setDrawColor(226, 232, 240) // Slate 200
  doc.setLineWidth(0.5)
  doc.line(40, currentY, pageWidth - 40, currentY)
  currentY += 10

  // Central QR Code (Large, prominent and easily scannable)
  const qrDataUrl = await generateQrWithMatrixLogo(data.checkInUrl)
  const qrSize = 92
  const qrX = (pageWidth - qrSize) / 2
  doc.addImage(qrDataUrl, "PNG", qrX, currentY, qrSize, qrSize)
  currentY += qrSize + 10

  // Divider: OR ENTER CODE
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(148, 163, 184) // Slate 400
  doc.text("—  OR ENTER 6-DIGIT CODE  —", pageWidth / 2, currentY, { align: "center" })
  currentY += 14

  // Prominent 6-Digit Code (e.g. 849  203)
  const rawCode = String(data.code6Digit || "000000").padStart(6, "0")
  const spacedCode = `${rawCode.slice(0, 3)}   ${rawCode.slice(3, 6)}`

  doc.setTextColor(22, 101, 52) // Brand Deep Green
  doc.setFont("helvetica", "bold")
  doc.setFontSize(36)
  doc.text(spacedCode, pageWidth / 2, currentY, { align: "center" })
  currentY += 11

  // Clean Instruction
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(71, 85, 105) // Slate 600
  doc.text("Scan with your phone camera or visit Matrix on your browser to check in.", pageWidth / 2, currentY, {
    align: "center",
  })

  // Footer Branding
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(148, 163, 184) // Slate 400
  doc.text("ACOB Lighting Technology Limited  •  Matrix ERP", pageWidth / 2, pageHeight - 12, {
    align: "center",
  })

  return doc
}
