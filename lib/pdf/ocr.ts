/**
 * OCR in the browser with tesseract.js (Tesseract compiled to WebAssembly).
 * Each page is drawn at ~300 dpi with pdf.js and read by Tesseract.
 *
 * The searchable PDF keeps the original pages untouched and lays the
 * recognised words over them as invisible text, so the file stays the same
 * size and looks identical, but can be searched and copied from.
 *
 * The engine, worker and English data are served from our own origin
 * (copied to public/vendor/pdf-engines on install), not tesseract.js's default
 * CDN: the CSP allows only same-origin scripts and connections, and scans
 * should not depend on a third party being up.
 */
import { PDFDocument, StandardFonts } from "pdf-lib"
import { loadPdf, openWithPdfjs, renderPdfPage } from "./client-tools"

const ENGINE_PATH = "/vendor/pdf-engines"

export interface OcrResult {
  /** Recognised text, pages separated by a blank line. */
  text: string
  /** The original PDF with an invisible, searchable text layer. */
  pdf?: Uint8Array
}

export async function ocrPdf(
  data: Blob,
  options: { searchablePdf: boolean; onPage?: (page: number, total: number) => void }
): Promise<OcrResult> {
  const document = await openWithPdfjs(data)
  const { createWorker } = await import("tesseract.js")
  const worker = await createWorker("eng", 1, {
    workerPath: `${ENGINE_PATH}/worker.min.js`,
    corePath: ENGINE_PATH,
    langPath: ENGINE_PATH,
    // A blob: worker would be blocked by the CSP; load the file directly.
    workerBlobURL: false,
  })

  const output = options.searchablePdf ? await loadPdf(data) : null
  const font = output ? await output.embedFont(StandardFonts.Helvetica) : null
  const pages: string[] = []
  try {
    for (let n = 1; n <= document.numPages; n++) {
      options.onPage?.(n, document.numPages)
      const { canvas, viewport } = await renderPdfPage(document, n, 300 / 72, 4000)
      const { data: result } = await worker.recognize(canvas, {}, { text: true, blocks: Boolean(output) })
      canvas.width = canvas.height = 0
      pages.push(result.text.trim())

      if (output && font && result.blocks) {
        const page = output.getPage(n - 1)
        for (const block of result.blocks) {
          for (const paragraph of block.paragraphs) {
            for (const line of paragraph.lines) {
              for (const word of line.words) {
                drawInvisibleWord(page, font, word.text, word.bbox, viewport)
              }
            }
          }
        }
      }
    }
  } finally {
    await worker.terminate()
    await document.destroy()
  }
  return { text: pages.join("\n\n").trim(), pdf: output ? await output.save() : undefined }
}

type PdfLibPage = ReturnType<PDFDocument["getPage"]>
type PdfLibFont = Awaited<ReturnType<PDFDocument["embedFont"]>>
interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}
interface Viewport {
  convertToPdfPoint(x: number, y: number): number[]
}

/**
 * Place a word over its pixels in PDF space, sized to the box width, at zero
 * opacity. On rotated pages the words still search correctly, though the
 * selection highlight may sit sideways.
 */
function drawInvisibleWord(page: PdfLibPage, font: PdfLibFont, text: string, box: Box, viewport: Viewport) {
  const word = text.trim()
  if (!word) return
  const [ax, ay] = viewport.convertToPdfPoint(box.x0, box.y1)
  const [bx, by] = viewport.convertToPdfPoint(box.x1, box.y0)
  const width = Math.abs(bx - ax)
  const height = Math.abs(by - ay)
  try {
    const unitWidth = font.widthOfTextAtSize(word, 1)
    if (unitWidth <= 0 || width <= 0) return
    page.drawText(word, {
      x: Math.min(ax, bx),
      y: Math.min(ay, by) + height * 0.15,
      size: Math.max(1, Math.min(width / unitWidth, height * 1.5)),
      font,
      opacity: 0,
    })
  } catch {
    // Helvetica cannot encode this word (e.g. non-Latin script); skip it in the
    // layer — it is still in the plain-text output.
  }
}
