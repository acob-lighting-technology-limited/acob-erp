export interface DocumentationAttachment {
  id: string
  name: string
  file_path: string
  mime_type?: string | null
  size?: number | null
  uploaded_at: string
}

export interface DocumentationSharePointRecord {
  sharepoint_folder_path?: string | null
  sharepoint_text_file_path?: string | null
  sharepoint_attachments?: DocumentationAttachment[] | null
}

function formatDateForFolder(value?: string | null): string {
  const date = value ? new Date(value) : new Date()
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date
  const day = String(safeDate.getUTCDate()).padStart(2, "0")
  const month = String(safeDate.getUTCMonth() + 1).padStart(2, "0")
  const year = safeDate.getUTCFullYear()
  return `${day}-${month}-${year}`
}

function sanitizeSegment(value: string, fallback: string): string {
  const sanitized = value
    .replace(/[~"#%&*:<>?/\\{|}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/g, "")

  return sanitized || fallback
}

export function sanitizeSharePointFileName(fileName: string, fallback = "file"): string {
  const lastDotIndex = fileName.lastIndexOf(".")
  const baseName = lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName
  const extension = lastDotIndex > 0 ? fileName.slice(lastDotIndex) : ""
  const sanitizedBase = sanitizeSegment(baseName, fallback)
  const sanitizedExtension = extension.replace(/[~"#%&*:<>?/\\{|}]/g, "").trim()
  return `${sanitizedBase}${sanitizedExtension}`
}

export function buildEmployeeFolderName(fullName?: string | null, fallback = "Unknown Employee"): string {
  return sanitizeSegment(String(fullName || ""), fallback)
}

export function buildDocumentationFolderName(title: string, createdAt: string | null | undefined, documentId: string): string {
  const safeTitle = sanitizeSegment(title, "Documentation")
  return `${safeTitle}-${formatDateForFolder(createdAt)}-${documentId}`
}

export function buildDocumentationFolderPath(
  employeeName: string,
  title: string,
  createdAt: string | null | undefined,
  documentId: string
): string {
  return `/employees/${buildEmployeeFolderName(employeeName)}/${buildDocumentationFolderName(title, createdAt, documentId)}`
}

export function getParentFolderPath(folderPath: string): string {
  const normalized = folderPath.replace(/\/+$/g, "")
  const lastSlashIndex = normalized.lastIndexOf("/")
  return lastSlashIndex > 0 ? normalized.slice(0, lastSlashIndex) : "/"
}

export function getFolderNameFromPath(folderPath: string): string {
  const normalized = folderPath.replace(/\/+$/g, "")
  const lastSlashIndex = normalized.lastIndexOf("/")
  return lastSlashIndex >= 0 ? normalized.slice(lastSlashIndex + 1) : normalized
}

export function remapPathPrefix(
  value: string | null | undefined,
  fromPrefix: string | null | undefined,
  toPrefix: string
): string | null {
  if (!value) return null
  if (!fromPrefix) return value
  if (value === fromPrefix) return toPrefix
  if (!value.startsWith(`${fromPrefix}/`)) return value
  return `${toPrefix}${value.slice(fromPrefix.length)}`
}

export function buildDocumentationTextBackup(params: {
  title: string
  category?: string | null
  tags: string[]
  content: string
  isDraft: boolean
  updatedAt: string
  employeeName: string
}): string {
  return [
    `Employee: ${params.employeeName}`,
    `Title: ${params.title}`,
    `Category: ${params.category || "Uncategorized"}`,
    `Tags: ${params.tags.length > 0 ? params.tags.join(", ") : "None"}`,
    `Status: ${params.isDraft ? "Draft" : "Published"}`,
    `Updated At: ${params.updatedAt}`,
    "",
    "Content:",
    params.content,
  ].join("\n")
}

export function normalizeDocumentationTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function mergeDocumentationAttachments(
  existing: DocumentationAttachment[],
  incoming: DocumentationAttachment[]
): DocumentationAttachment[] {
  const merged = new Map<string, DocumentationAttachment>()

  for (const attachment of existing) {
    merged.set(attachment.file_path, attachment)
  }

  for (const attachment of incoming) {
    merged.set(attachment.file_path, attachment)
  }

  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name))
}
