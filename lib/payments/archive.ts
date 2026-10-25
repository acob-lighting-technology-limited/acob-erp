import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getOneDriveService } from "@/lib/onedrive"
import { logger } from "@/lib/logger"
import {
  buildPaymentDocumentFolderPathByType,
  buildPaymentDocumentPath,
  isOneDrivePaymentDocumentPath,
} from "./document-storage"

const log = logger("payments-archive")
const PAYMENT_DOCUMENTS_BUCKET = "payment_documents"

export interface PaymentArchiveResult {
  success: boolean
  archivedDocuments: number
  errors: string[]
}

type PaymentRecord = {
  id: string
  title: string | null
  payment_type: "one-time" | "recurring" | null
  status: string | null
  department?: { name?: string | null } | Array<{ name?: string | null }> | null
}

type PaymentDocRecord = {
  id: string
  payment_id: string
  file_name: string
  file_path: string
  mime_type?: string | null
}

function getDepartmentName(payment: PaymentRecord): string {
  const rel = payment.department
  if (!rel) return "general"
  if (Array.isArray(rel)) return rel[0]?.name || "general"
  return rel.name || "general"
}

/**
 * Moves supporting payment documents/receipts from Supabase Storage into
 * SharePoint Finance Payments folder:
 *
 *   /finance-payments/{department}/{paymentType}/{title}--{id}/{filename}
 *
 * Once safely written to SharePoint, the original file is purged from Supabase
 * Storage to preserve database and storage quotas.
 */
export async function archivePaymentToSharePoint(
  admin: SupabaseClient,
  paymentId: string
): Promise<PaymentArchiveResult> {
  const result: PaymentArchiveResult = {
    success: false,
    archivedDocuments: 0,
    errors: [],
  }

  const { data: payment, error: paymentError } = await admin
    .from("department_payments")
    .select("id, title, payment_type, status, department:departments(name)")
    .eq("id", paymentId)
    .maybeSingle()

  if (paymentError || !payment) {
    result.errors.push(`Payment ${paymentId} not found: ${paymentError?.message || "empty"}`)
    return result
  }

  const onedrive = getOneDriveService()
  if (!onedrive.isEnabled()) {
    log.warn("SharePoint / OneDrive is not configured or enabled; skipping payment archive", { paymentId })
    result.errors.push("SharePoint integration is disabled")
    return result
  }

  const deptName = getDepartmentName(payment as PaymentRecord)
  const paymentType = payment.payment_type === "one-time" ? "one-time" : "recurring"
  const folderPath = buildPaymentDocumentFolderPathByType(deptName, paymentType, payment.id, payment.title || undefined)

  try {
    await onedrive.createFolder(folderPath).catch(() => {
      // Folder may already exist.
    })
  } catch (err) {
    log.error("Failed to create payment destination folder in SharePoint", { path: folderPath, err })
    result.errors.push(`Failed to create SharePoint folder: ${err instanceof Error ? err.message : String(err)}`)
    return result
  }

  const { data: documents, error: docsError } = await admin
    .from("payment_documents")
    .select("id, payment_id, file_name, file_path, mime_type")
    .eq("payment_id", paymentId)

  if (docsError) {
    result.errors.push(`Failed to load payment documents: ${docsError.message}`)
    return result
  }

  for (const doc of (documents || []) as PaymentDocRecord[]) {
    if (isOneDrivePaymentDocumentPath(doc.file_path)) {
      continue
    }

    try {
      const { data: blob, error: dlError } = await admin.storage.from(PAYMENT_DOCUMENTS_BUCKET).download(doc.file_path)

      if (dlError || !blob) {
        throw new Error(`Download from Supabase failed: ${dlError?.message || "empty blob"}`)
      }

      const targetPath = buildPaymentDocumentPath(
        deptName,
        paymentType,
        payment.id,
        `${Date.now()}-${doc.file_name}`,
        payment.title || undefined
      )
      const uploadBuffer = Buffer.from(await blob.arrayBuffer())

      await onedrive.uploadFile(targetPath, uploadBuffer, doc.mime_type || undefined)

      // Purge original file from Supabase Storage
      const { error: removeError } = await admin.storage.from(PAYMENT_DOCUMENTS_BUCKET).remove([doc.file_path])

      if (removeError) {
        log.warn("Failed to remove original payment file from Supabase Storage", {
          path: doc.file_path,
          err: removeError,
        })
      }

      // Update database record to point to SharePoint
      const { error: updateError } = await admin
        .from("payment_documents")
        .update({ file_path: targetPath })
        .eq("id", doc.id)

      if (updateError) {
        throw new Error(`DB update failed: ${updateError.message}`)
      }

      result.archivedDocuments += 1
    } catch (err) {
      log.error("Failed to archive payment document to SharePoint", { docId: doc.id, err })
      result.errors.push(`Document ${doc.file_name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  result.success = result.errors.length === 0
  return result
}

/**
 * Maintenance sweep: finds paid department payments that still have unarchived
 * documents in Supabase Storage and moves them to SharePoint in batches.
 */
export async function sweepPaidPaymentsForArchive(
  admin: SupabaseClient,
  batchLimit = 25
): Promise<{ totalProcessed: number; results: Record<string, PaymentArchiveResult> }> {
  const { data: paidPayments, error } = await admin
    .from("department_payments")
    .select("id, status")
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(batchLimit)

  if (error || !paidPayments?.length) {
    return { totalProcessed: 0, results: {} }
  }

  const results: Record<string, PaymentArchiveResult> = {}
  let totalProcessed = 0

  for (const pay of paidPayments) {
    const { data: unarchivedDocs } = await admin
      .from("payment_documents")
      .select("id, file_path")
      .eq("payment_id", pay.id)

    const needsArchive = (unarchivedDocs || []).some((d) => !isOneDrivePaymentDocumentPath(d.file_path))
    if (needsArchive) {
      results[pay.id] = await archivePaymentToSharePoint(admin, pay.id)
      totalProcessed += 1
    }
  }

  return { totalProcessed, results }
}
