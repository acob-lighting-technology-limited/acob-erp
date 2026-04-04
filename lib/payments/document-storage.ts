import { departmentToLibraryKey } from "@/lib/onedrive/access"

const PAYMENT_DOCUMENT_LIBRARY = "finance-payments"
type PaymentDocumentType = "one-time" | "recurring"

function sanitizePathSegment(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
}

function slugifyPaymentTitle(value: string): string {
  return sanitizePathSegment(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

export function buildPaymentDocumentFolderPath(
  departmentName: string,
  paymentId: string,
  paymentTitle?: string
): string {
  return buildPaymentDocumentFolderPathByType(departmentName, "recurring", paymentId, paymentTitle)
}

export function buildPaymentDocumentFolderPathByType(
  departmentName: string,
  paymentType: PaymentDocumentType,
  paymentId: string,
  paymentTitle?: string
): string {
  const departmentKey = departmentToLibraryKey(departmentName || "general")
  const titleKey = slugifyPaymentTitle(paymentTitle || "")
  const folderName = titleKey ? `${titleKey}--${paymentId}` : paymentId
  return `/${PAYMENT_DOCUMENT_LIBRARY}/${departmentKey}/${paymentType}/${folderName}`
}

export function buildPaymentDocumentPath(
  departmentName: string,
  paymentType: PaymentDocumentType,
  paymentId: string,
  fileName: string,
  paymentTitle?: string
): string {
  const safeFileName = sanitizePathSegment(fileName || "document")
  return `${buildPaymentDocumentFolderPathByType(departmentName, paymentType, paymentId, paymentTitle)}/${safeFileName}`
}

export function isOneDrivePaymentDocumentPath(filePath: string | null | undefined): boolean {
  return String(filePath || "").startsWith(`/${PAYMENT_DOCUMENT_LIBRARY}/`)
}
