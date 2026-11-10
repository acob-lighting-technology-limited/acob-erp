/**
 * What a supporting document is, from its name and the type it was uploaded with.
 * Shared by the file route (which decides view vs download) and the page (which
 * decides how to show it).
 */

export type AttachmentKind = "image" | "pdf" | "other"

const BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
}

/** Types the browser may draw in place. SVG and HTML are left out on purpose: they can carry script. */
const INLINE = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"])

export function attachmentContentType(fileName: string, uploadedType?: string | null): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? ""
  const fromName = BY_EXTENSION[ext]
  if (fromName) return fromName
  const declared = (uploadedType || "").toLowerCase().split(";")[0].trim()
  return declared || "application/octet-stream"
}

export function canShowInline(contentType: string): boolean {
  return INLINE.has(contentType)
}

export function attachmentKind(fileName: string, uploadedType?: string | null): AttachmentKind {
  const type = attachmentContentType(fileName, uploadedType)
  if (type === "application/pdf") return "pdf"
  if (canShowInline(type)) return "image"
  return "other"
}

/** Same-origin address of one supporting document. */
export function attachmentHref(requisitionId: string, index: number, download = false): string {
  return `/api/requisitions/${requisitionId}/attachments/${index}${download ? "?download=1" : ""}`
}
