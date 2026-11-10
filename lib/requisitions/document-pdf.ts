/**
 * Download a requisition form as an A4 PDF, captured from the same
 * <RequisitionDocument> the page shows, so the PDF can never drift from the
 * screen. Runs in the browser; html-to-image and jsPDF load on demand.
 *
 * The form is cloned into an off-screen box exactly A4 wide, so the layout
 * (which follows the sheet's own width) is the same on a phone or a desktop.
 */

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
/** 210mm at 96dpi, the width the sheet is laid out at. */
const SHEET_WIDTH_PX = 794
const SHEET_PADDING_PX = 40
const PIXEL_RATIO = 2.5
/** A sheet up to this much taller than A4 is shrunk onto one page instead of split. */
const SHRINK_TO_FIT_LIMIT = 1.3

async function imagesReady(root: HTMLElement) {
  await Promise.all(
    Array.from(root.querySelectorAll("img")).map((img) =>
      img.complete ? Promise.resolve() : img.decode().catch(() => undefined)
    )
  )
}

export async function downloadRequisitionPdf(sheet: HTMLElement, fileName: string) {
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
    const dataUrl = await toPng(clone, { pixelRatio: PIXEL_RATIO, backgroundColor: "#ffffff", cacheBust: true })
    const sheetHeightMm = (clone.offsetHeight / clone.offsetWidth) * A4_WIDTH_MM

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true })
    if (sheetHeightMm <= A4_HEIGHT_MM * SHRINK_TO_FIT_LIMIT) {
      const scale = Math.min(1, A4_HEIGHT_MM / sheetHeightMm)
      const width = A4_WIDTH_MM * scale
      pdf.addImage(dataUrl, "PNG", (A4_WIDTH_MM - width) / 2, 0, width, sheetHeightMm * scale, undefined, "FAST")
    } else {
      // Long vouchers: slide the same image up one page at a time.
      for (let offset = 0; offset < sheetHeightMm; offset += A4_HEIGHT_MM) {
        if (offset > 0) pdf.addPage()
        pdf.addImage(dataUrl, "PNG", 0, -offset, A4_WIDTH_MM, sheetHeightMm, undefined, "FAST")
      }
    }
    pdf.save(fileName)
  } finally {
    host.remove()
  }
}
