/**
 * PDF tools that run entirely in the browser.
 *
 * These used to be API routes, which capped every file at Vercel's 4.5 MB
 * request/response body limit. pdf-lib, pdf.js and docx all run client-side, so
 * doing the work here removes the limit, the upload round trip, and the need
 * for the file to leave the user's device. Compression, OCR and passwords live
 * beside this file (compress.ts, ocr.ts, password.ts).
 *
 * The pdf-lib functions also run under Node, which is what the tests use; the
 * canvas and pdf.js helpers are browser-only.
 */
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib"

/**
 * Parse "1-3, 5, 8-10" into sorted, de-duplicated 1-based page numbers within
 * [1, totalPages]. Ranges are cut to the document; unparseable parts are ignored.
 */
export function parsePageRanges(input: string, totalPages: number): number[] {
  const pages = new Set<number>()
  for (const part of input.split(",").map((p) => p.trim())) {
    if (!part) continue
    if (part.includes("-")) {
      const [start, end] = part.split("-").map((s) => parseInt(s.trim(), 10))
      if (Number.isNaN(start) || Number.isNaN(end)) continue
      // Keep only the part of the range inside the document; "5-9" on a 1-page
      // PDF is empty, not page 1.
      const from = Math.max(1, Math.min(start, end))
      const to = Math.min(totalPages, Math.max(start, end))
      for (let page = from; page <= to; page++) pages.add(page)
    } else {
      const page = parseInt(part, 10)
      if (page >= 1 && page <= totalPages) pages.add(page)
    }
  }
  return [...pages].sort((a, b) => a - b)
}

export async function loadPdf(source: Blob | Uint8Array, name = "PDF"): Promise<PDFDocument> {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(await source.arrayBuffer())
  try {
    return await PDFDocument.load(bytes)
  } catch (error) {
    // pdf-lib refuses encrypted files unless told to ignore it, and the output
    // would be unreadable anyway — say so instead of a parser stack trace.
    if (error instanceof Error && /encrypt/i.test(error.message)) {
      throw new Error(`${name} is password-protected. Remove the password first.`)
    }
    throw new Error(`${name} could not be read. It may be damaged or not a real PDF.`)
  }
}

export function toPdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as BlobPart], { type: "application/pdf" })
}

export async function mergePdfs(files: Array<{ name: string; data: Blob | Uint8Array }>): Promise<Uint8Array> {
  if (files.length < 2) throw new Error("Select at least 2 PDF files to merge")
  const merged = await PDFDocument.create()
  for (const file of files) {
    const pdf = await loadPdf(file.data, file.name)
    const pages = await merged.copyPages(pdf, pdf.getPageIndices())
    pages.forEach((page) => merged.addPage(page))
  }
  return merged.save()
}

export async function splitPdf(data: Blob | Uint8Array, ranges: string): Promise<Uint8Array> {
  const pdf = await loadPdf(data)
  const pages = parsePageRanges(ranges, pdf.getPageCount())
  if (pages.length === 0) throw new Error(`No valid pages in "${ranges}". This PDF has ${pdf.getPageCount()} page(s).`)
  const output = await PDFDocument.create()
  const copied = await output.copyPages(
    pdf,
    pages.map((p) => p - 1)
  )
  copied.forEach((page) => output.addPage(page))
  return output.save()
}

export type WatermarkPosition = "center" | "top" | "bottom" | "custom"

export interface WatermarkOptions {
  /** Text watermark; ignored when `image` is given. */
  text?: string
  /** Pre-sized PNG bytes (see `resizeImageToPng`). */
  image?: Uint8Array
  position: WatermarkPosition
  x?: number
  y?: number
  fontSize: number
  opacity: number
  rotation: number
  /** Hex without '#', e.g. "000000". */
  color: string
}

export async function watermarkPdf(data: Blob | Uint8Array, options: WatermarkOptions): Promise<Uint8Array> {
  const pdf = await loadPdf(data)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const image = options.image ? await pdf.embedPng(options.image) : null
  const hex = /^[0-9a-f]{6}$/i.test(options.color) ? options.color : "000000"
  const color = rgb(
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255
  )
  const centred = options.position !== "custom"

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize()
    const anchorX = centred ? width / 2 : (options.x ?? 0)
    const anchorY =
      options.position === "center"
        ? height / 2
        : options.position === "top"
          ? height - 50
          : options.position === "bottom"
            ? 50
            : (options.y ?? 0)

    if (image) {
      const { width: w, height: h } = image.scale(1)
      page.drawImage(image, {
        x: centred ? anchorX - w / 2 : anchorX,
        y: options.position === "center" ? anchorY - h / 2 : anchorY,
        width: w,
        height: h,
        opacity: options.opacity,
        rotate: degrees(options.rotation),
      })
    } else if (options.text) {
      const textWidth = font.widthOfTextAtSize(options.text, options.fontSize)
      const textHeight = font.heightAtSize(options.fontSize)
      page.drawText(options.text, {
        x: centred ? anchorX - textWidth / 2 : anchorX,
        y: options.position === "center" ? anchorY + textHeight / 2 : anchorY,
        size: options.fontSize,
        font,
        color,
        opacity: options.opacity,
        rotate: degrees(options.rotation),
      })
    }
  }
  return pdf.save()
}

const isJpeg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
const isPng = (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47

/** Decode any browser-supported image and draw it onto a canvas (browser only). */
async function drawToCanvas(file: Blob, maxSide?: number): Promise<HTMLCanvasElement> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error("This image format is not supported by your browser. Use JPG or PNG.")
  }
  const scale = maxSide ? Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height)) : 1
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Could not process the image in this browser")
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image"))), type, quality)
  })
}

export async function canvasToBytes(canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg", quality?: number) {
  return new Uint8Array(await (await canvasToBlob(canvas, type, quality)).arrayBuffer())
}

/** Fit an image inside maxSide × maxSide (never enlarging) and return PNG bytes. */
export async function resizeImageToPng(file: Blob, maxSide: number): Promise<Uint8Array> {
  return canvasToBytes(await drawToCanvas(file, maxSide), "image/png")
}

/** One page per image, page size = image size. JPG/PNG are embedded as-is. */
export async function imagesToPdf(files: Array<{ name: string; data: Blob }>): Promise<Uint8Array> {
  if (files.length === 0) throw new Error("Select at least one image")
  const pdf = await PDFDocument.create()
  for (const file of files) {
    const bytes = new Uint8Array(await file.data.arrayBuffer())
    let image
    try {
      if (isJpeg(bytes)) image = await pdf.embedJpg(bytes)
      else if (isPng(bytes)) image = await pdf.embedPng(bytes)
      else {
        // WebP, GIF, BMP… — let the browser decode it, flatten onto white, JPEG it.
        const canvas = await drawToCanvas(file.data)
        const context = canvas.getContext("2d")!
        context.globalCompositeOperation = "destination-over"
        context.fillStyle = "#ffffff"
        context.fillRect(0, 0, canvas.width, canvas.height)
        image = await pdf.embedJpg(await canvasToBytes(canvas, "image/jpeg", 0.9))
      }
    } catch (error) {
      throw new Error(`${file.name}: ${error instanceof Error ? error.message : "could not be added"}`)
    }
    const { width, height } = image.scale(1)
    pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height })
  }
  return pdf.save()
}

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    // The legacy build supports older Safari (most staff are on iPhone). The
    // bundler emits the worker as a same-origin asset, which the CSP allows.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString()
  }
  return pdfjs
}

/** Open a PDF with pdf.js, turning its exceptions into messages staff can act on. */
export async function openWithPdfjs(data: Blob) {
  const pdfjs = await loadPdfjs()
  try {
    return await pdfjs.getDocument({ data: new Uint8Array(await data.arrayBuffer()) }).promise
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException") {
      throw new Error("This PDF is password-protected. Remove the password first.")
    }
    throw new Error("This PDF could not be read. It may be damaged or not a real PDF.")
  }
}

/**
 * Draw one page (1-based) onto a new canvas, `scale` × its size in points
 * (1 = 72 dpi), capped so neither side exceeds `maxSide` pixels.
 */
export async function renderPdfPage(
  document: Awaited<ReturnType<typeof openWithPdfjs>>,
  pageNumber: number,
  scale: number,
  maxSide: number
) {
  const page = await document.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: Math.min(scale, maxSide / Math.max(base.width, base.height)) })
  const canvas = globalThis.document.createElement("canvas")
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  await page.render({ canvas, viewport }).promise
  page.cleanup()
  return { canvas, viewport }
}

export type PageImageFormat = "jpg" | "png" | "webp"
const IMAGE_MIME: Record<PageImageFormat, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" }

/** Every page as an image (150 dpi), zipped. `onPage` reports progress. */
export async function pdfToImages(
  data: Blob,
  format: PageImageFormat,
  onPage?: (page: number, total: number) => void
): Promise<Blob> {
  const document = await openWithPdfjs(data)
  try {
    const { default: JSZip } = await import("jszip")
    const zip = new JSZip()
    const digits = String(document.numPages).length
    for (let n = 1; n <= document.numPages; n++) {
      onPage?.(n, document.numPages)
      const { canvas } = await renderPdfPage(document, n, 150 / 72, 5000)
      const image = await canvasToBlob(canvas, IMAGE_MIME[format], format === "png" ? undefined : 0.9)
      canvas.width = canvas.height = 0
      // Safari cannot encode WebP and silently hands back a PNG instead.
      if (image.type !== IMAGE_MIME[format]) {
        throw new Error(`This browser cannot create ${format.toUpperCase()} images. Choose JPEG or PNG.`)
      }
      zip.file(`page-${String(n).padStart(digits, "0")}.${format}`, image)
    }
    return zip.generateAsync({ type: "blob" })
  } finally {
    await document.destroy()
  }
}

/**
 * Text of each page, with line breaks where the baseline moves and a blank line
 * where the vertical gap is larger than a normal line (a paragraph break).
 */
export async function extractPdfText(data: Blob): Promise<{ pages: string[]; numPages: number }> {
  const document = await openWithPdfjs(data)
  try {
    const pages: string[] = []
    for (let n = 1; n <= document.numPages; n++) {
      const page = await document.getPage(n)
      const content = await page.getTextContent()
      let text = ""
      let lastY: number | null = null
      let lastHeight = 0
      for (const item of content.items) {
        if (!("str" in item)) continue
        const y = item.transform[5]
        if (lastY !== null && Math.abs(y - lastY) > 1) {
          const gap = Math.abs(y - lastY)
          text += gap > (lastHeight || item.height || 12) * 1.8 ? "\n\n" : "\n"
        }
        text += item.str
        if (item.hasEOL && lastY === y) text += "\n"
        lastY = y
        if (item.height) lastHeight = item.height
      }
      pages.push(text.replace(/[ \t]+\n/g, "\n").trim())
      page.cleanup()
    }
    return { pages, numPages: document.numPages }
  } finally {
    await document.destroy()
  }
}

/** Word document with one paragraph per text block; short/all-caps blocks become headings. */
export async function pdfToDocx(data: Blob): Promise<Blob> {
  const { pages } = await extractPdfText(data)
  const blocks = pages
    .join("\n\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
  if (blocks.length === 0) {
    throw new Error("This PDF has no selectable text (it may be a scan). Word conversion needs a text PDF.")
  }

  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx")
  const paragraphs = blocks.map((block) => {
    const isHeading = block.length < 50 || (block.length < 100 && block === block.toUpperCase())
    return isHeading && !block.includes("\n")
      ? new Paragraph({ text: block, heading: HeadingLevel.HEADING_2, spacing: { after: 200 } })
      : new Paragraph({
          children: block.split("\n").map((line, i) => new TextRun(i > 0 ? { text: line, break: 1 } : line)),
          spacing: { after: 100 },
        })
  })
  return Packer.toBlob(new Document({ sections: [{ properties: {}, children: paragraphs }] }))
}
