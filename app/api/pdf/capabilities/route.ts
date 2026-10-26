import { NextResponse } from "next/server"
import { hasBinary } from "@/lib/pdf/binaries"
import { isDocumentServiceConfigured } from "@/lib/pdf/document-service"

export const dynamic = "force-dynamic"

export interface PdfServerCapabilities {
  compress: boolean
  convert: boolean
  password: boolean
  ocr: boolean
}

/**
 * Which server-side PDF tools can actually run here, so the page can disable
 * the ones that would only fail. They need either the document service or the
 * native binaries on this host (dev machines); Vercel has neither unless
 * DOCUMENT_SERVICE_URL is set. The other PDF tools run in the browser.
 */
export async function GET() {
  const service = isDocumentServiceConfigured()
  const [gs, pdftoppm, tesseract] = service
    ? [true, true, true]
    : await Promise.all([hasBinary("gs"), hasBinary("pdftoppm"), hasBinary("tesseract")])

  const capabilities: PdfServerCapabilities = {
    compress: service || gs,
    convert: service || pdftoppm || gs,
    // Encryption is qpdf in the document service only; pdf-lib cannot encrypt.
    password: service,
    ocr: service || tesseract,
  }
  return NextResponse.json(capabilities)
}
