/**
 * Download a requisition as a PDF: the form on A4 pages, captured from the same
 * <RequisitionDocument> the page shows (so the PDF can never drift from the
 * screen), followed by the supporting documents, one after another. Runs in the
 * browser; html-to-image, jsPDF and pdf-lib load on demand.
 *
 * The form is cloned into an off-screen box exactly A4 wide, so the layout
 * (which follows the sheet's own width) is the same on a phone or a desktop.
 * The sheet is always a whole number of A4 pages tall: one page for a normal
 * form, more when a voucher has many lines.
 */

import type { AttachmentKind } from "@/lib/requisitions/attachment-types"

export interface PdfAttachment {
  name: string
  kind: AttachmentKind
  /** Same-origin address that returns the file's bytes. */
  href: string
}

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
/** 210mm at 96dpi, the width the sheet is laid out at. */
const SHEET_WIDTH_PX = 794
const SHEET_PADDING_PX = 40
const PAGE_HEIGHT_PX = Math.round((SHEET_WIDTH_PX * A4_HEIGHT_MM) / A4_WIDTH_MM)
const PIXEL_RATIO = 2.5
/** A4 in PDF points, for the attachment pages. */
const A4_WIDTH_PT = 595.28
const A4_HEIGHT_PT = 841.89
const PAGE_MARGIN_PT = 36
const CAPTION_HEIGHT_PT = 26
/** Longest side of an attached picture, so a phone photo does not make a huge file. */
const MAX_IMAGE_SIDE_PX = 2400

async function imagesReady(root: HTMLElement) {
  await Promise.all(
    Array.from(root.querySelectorAll("img")).map((img) =>
      img.complete ? Promise.resolve() : img.decode().catch(() => undefined)
    )
  )
}

/** Standard PDF fonts only draw Latin text: anything else in a file name becomes "?". */
function latin(text: string) {
  return Array.from(text)
    .map((ch) => (ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) <= 0xff ? ch : "?"))
    .join("")
}

/** Re-draws a picture upright (phone photos carry a rotation) at a sensible size. */
async function pictureBytes(source: ArrayBuffer): Promise<{ bytes: Uint8Array; format: "png" | "jpg" }> {
  const head = new Uint8Array(source.slice(0, 2))
  const isJpeg = head[0] === 0xff && head[1] === 0xd8
  const bitmap = await createImageBitmap(new Blob([source]), { imageOrientation: "from-image" })
  const scale = Math.min(1, MAX_IMAGE_SIDE_PX / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Canvas is not available")
  if (isJpeg) {
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, isJpeg ? "image/jpeg" : "image/png", 0.92)
  )
  if (!blob) throw new Error("Could not read the picture")
  return { bytes: new Uint8Array(await blob.arrayBuffer()), format: isJpeg ? "jpg" : "png" }
}

async function appendAttachments(formPdf: ArrayBuffer, attachments: PdfAttachment[]): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib")
  const pdf = await PDFDocument.load(formPdf)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const caption = (page: ReturnType<typeof pdf.addPage>, index: number, name: string) => {
    page.drawText(latin(`Attachment ${index + 1} of ${attachments.length}`), {
      x: PAGE_MARGIN_PT,
      y: A4_HEIGHT_PT - PAGE_MARGIN_PT,
      size: 10,
      font: bold,
      color: rgb(0.2, 0.2, 0.2),
    })
    page.drawText(latin(name).slice(0, 90), {
      x: PAGE_MARGIN_PT + 110,
      y: A4_HEIGHT_PT - PAGE_MARGIN_PT,
      size: 10,
      font,
      color: rgb(0.35, 0.35, 0.35),
    })
  }

  const notice = (index: number, name: string, message: string) => {
    const page = pdf.addPage([A4_WIDTH_PT, A4_HEIGHT_PT])
    caption(page, index, name)
    page.drawText(latin(message), { x: PAGE_MARGIN_PT, y: A4_HEIGHT_PT / 2, size: 11, font, color: rgb(0.3, 0.3, 0.3) })
  }

  for (const [index, file] of attachments.entries()) {
    try {
      if (file.kind === "other") {
        notice(index, file.name, "This file type cannot be placed in the PDF. Download it from the requisition page.")
        continue
      }
      const res = await fetch(file.href, { cache: "no-store" })
      if (!res.ok) throw new Error(`Could not load (${res.status})`)
      const source = await res.arrayBuffer()

      if (file.kind === "pdf") {
        const attached = await PDFDocument.load(source, { ignoreEncryption: true })
        const pages = await pdf.copyPages(attached, attached.getPageIndices())
        pages.forEach((page) => pdf.addPage(page))
        continue
      }

      const { bytes, format } = await pictureBytes(source)
      const image = format === "jpg" ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes)
      const page = pdf.addPage([A4_WIDTH_PT, A4_HEIGHT_PT])
      caption(page, index, file.name)
      const boxWidth = A4_WIDTH_PT - PAGE_MARGIN_PT * 2
      const boxHeight = A4_HEIGHT_PT - PAGE_MARGIN_PT * 2 - CAPTION_HEIGHT_PT
      const scale = Math.min(boxWidth / image.width, boxHeight / image.height, 1)
      const width = image.width * scale
      const height = image.height * scale
      page.drawImage(image, {
        x: (A4_WIDTH_PT - width) / 2,
        y: PAGE_MARGIN_PT + (boxHeight - height) / 2,
        width,
        height,
      })
    } catch {
      notice(index, file.name, "This document could not be added to the PDF. Open it from the requisition page.")
    }
  }
  return pdf.save()
}

function saveBytes(bytes: Uint8Array, fileName: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }))
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function downloadRequisitionPdf(sheet: HTMLElement, fileName: string, attachments: PdfAttachment[] = []) {
  const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")])

  const host = document.createElement("div")
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${SHEET_WIDTH_PX}px;pointer-events:none;`
  const clone = sheet.cloneNode(true) as HTMLElement
  Object.assign(clone.style, {
    width: `${SHEET_WIDTH_PX}px`,
    maxWidth: "none",
    margin: "0",
    padding: `${SHEET_PADDING_PX}px`,
    border: "0",
    borderRadius: "0",
    boxShadow: "none",
  })
  host.appendChild(clone)
  document.body.appendChild(host)

  try {
    await imagesReady(clone)
    // A whole number of pages: the signatures stay at the foot of the last one.
    const pages = Math.max(1, Math.ceil((clone.offsetHeight - 2) / PAGE_HEIGHT_PX))
    clone.style.minHeight = `${pages * PAGE_HEIGHT_PX}px`
    const dataUrl = await toPng(clone, { pixelRatio: PIXEL_RATIO, backgroundColor: "#ffffff", cacheBust: true })

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true })
    for (let page = 0; page < pages; page++) {
      if (page > 0) pdf.addPage()
      // The same tall image, slid up one page at a time.
      pdf.addImage(dataUrl, "PNG", 0, -page * A4_HEIGHT_MM, A4_WIDTH_MM, pages * A4_HEIGHT_MM, undefined, "FAST")
    }

    if (!attachments.length) {
      pdf.save(fileName)
      return
    }
    saveBytes(await appendAttachments(pdf.output("arraybuffer"), attachments), fileName)
  } finally {
    host.remove()
  }
}
