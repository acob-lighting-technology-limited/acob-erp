const CORRESPONDENCE_LIBRARY = "correspondence"

type CorrespondenceDocumentType = "draft" | "proof" | "supporting"

function sanitizeName(name: string): string {
  return String(name || "document").replace(/[^a-zA-Z0-9._-]/g, "_")
}

function kindFolder(documentType: CorrespondenceDocumentType): string {
  if (documentType === "proof") return "proof"
  if (documentType === "supporting") return "supporting"
  return "drafts"
}

export function buildCorrespondenceDocumentPath(
  recordId: string,
  documentType: CorrespondenceDocumentType,
  fileName: string
) {
  return `/${CORRESPONDENCE_LIBRARY}/${recordId}/${kindFolder(documentType)}/${Date.now()}-${sanitizeName(fileName)}`
}

export function isOneDriveCorrespondenceDocumentPath(filePath: string | null | undefined): boolean {
  return String(filePath || "").startsWith(`/${CORRESPONDENCE_LIBRARY}/`)
}
