import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getOneDriveService } from "@/lib/onedrive"
import { logger } from "@/lib/logger"
import { loadRequisition, REQUISITION_DOCUMENTS_BUCKET } from "./server"
import type { RequisitionAttachment, RequisitionPayment } from "./types"

const log = logger("requisition-archive")

function sanitizeSegment(value: string): string {
  return value
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim()
}

export function isSharePointArchivePath(path?: string | null): boolean {
  if (!path) return false
  return path.startsWith("/finance/") || path.startsWith("https://")
}

export interface ArchiveResult {
  success: boolean
  archivedAttachments: number
  archivedReceipts: number
  errors: string[]
}

/**
 * Moves supporting documents and payment receipts from Supabase Storage into
 * the company's permanent SharePoint Finance Archive:
 *
 *   /finance/requisitions/{department}/{requisition_number}/{filename}
 *
 * Once safely written to SharePoint, the original file is purged from Supabase
 * Storage to keep operational database storage near zero.
 */
export async function archiveRequisitionToSharePoint(
  admin: SupabaseClient,
  requisitionId: string
): Promise<ArchiveResult> {
  const result: ArchiveResult = {
    success: false,
    archivedAttachments: 0,
    archivedReceipts: 0,
    errors: [],
  }

  const req = await loadRequisition(admin, requisitionId)
  if (!req) {
    result.errors.push(`Requisition ${requisitionId} not found`)
    return result
  }

  const onedrive = getOneDriveService()
  if (!onedrive.isEnabled()) {
    log.warn("SharePoint / OneDrive is not configured or enabled; skipping archive", { requisitionId })
    result.errors.push("SharePoint integration is disabled")
    return result
  }

  const deptFolder = sanitizeSegment(req.department || "General")
  const reqFolder = sanitizeSegment(req.requisition_number || requisitionId)
  const baseFolderPath = `/finance/requisitions/${deptFolder}/${reqFolder}`

  try {
    await onedrive.createFolder(baseFolderPath).catch(() => {
      // Folder may already exist.
    })
  } catch (err) {
    log.error("Failed to create destination folder in SharePoint", { path: baseFolderPath, err })
    result.errors.push(`Failed to create SharePoint folder: ${err instanceof Error ? err.message : String(err)}`)
    return result
  }

  // 1. Archive supporting attachments
  let attachmentsModified = false
  const updatedAttachments: RequisitionAttachment[] = []

  for (const file of req.attachments || []) {
    if (isSharePointArchivePath(file.file_path)) {
      // Already archived
      updatedAttachments.push(file)
      continue
    }

    try {
      const { data: blob, error: dlError } = await admin.storage
        .from(REQUISITION_DOCUMENTS_BUCKET)
        .download(file.file_path)

      if (dlError || !blob) {
        throw new Error(`Download from Supabase failed: ${dlError?.message || "empty blob"}`)
      }

      const safeName = sanitizeSegment(file.file_name) || "attachment.pdf"
      const targetPath = `${baseFolderPath}/${Date.now()}_${safeName}`
      const uploadBuffer = Buffer.from(await blob.arrayBuffer())

      const uploadResult = await onedrive.uploadFile(targetPath, uploadBuffer, file.file_type)

      // Remove from Supabase Storage
      const { error: removeError } = await admin.storage.from(REQUISITION_DOCUMENTS_BUCKET).remove([file.file_path])
      if (removeError) {
        log.warn("Failed to delete original file from Supabase Storage", { path: file.file_path, err: removeError })
      }

      updatedAttachments.push({
        ...file,
        file_path: targetPath,
        web_url: uploadResult.webUrl,
        archived_at: new Date().toISOString(),
      })
      attachmentsModified = true
      result.archivedAttachments += 1
    } catch (err) {
      log.error("Failed to archive attachment to SharePoint", { file: file.file_name, err })
      result.errors.push(`Attachment ${file.file_name}: ${err instanceof Error ? err.message : String(err)}`)
      updatedAttachments.push(file) // Keep original reference so it can retry later
    }
  }

  if (attachmentsModified) {
    const { error: updateError } = await admin
      .from("requisitions")
      .update({ attachments: updatedAttachments })
      .eq("id", req.id)

    if (updateError) {
      log.error("Failed to update requisition attachments in DB", { id: req.id, err: updateError })
      result.errors.push(`DB update failed: ${updateError.message}`)
    }
  }

  // 2. Archive payment receipts
  for (const payment of req.payments || []) {
    if (!payment.receipt_path || isSharePointArchivePath(payment.receipt_path)) {
      continue
    }

    try {
      const { data: blob, error: dlError } = await admin.storage
        .from(REQUISITION_DOCUMENTS_BUCKET)
        .download(payment.receipt_path)

      if (dlError || !blob) {
        throw new Error(`Download receipt from Supabase failed: ${dlError?.message || "empty blob"}`)
      }

      const ext = (payment.receipt_path.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "")
      const refPart = sanitizeSegment(payment.reference || payment.id.slice(0, 8))
      const receiptFileName = `receipt_${refPart}.${ext}`
      const targetPath = `${baseFolderPath}/${receiptFileName}`
      const uploadBuffer = Buffer.from(await blob.arrayBuffer())

      await onedrive.uploadFile(targetPath, uploadBuffer)

      // Remove from Supabase Storage
      await admin.storage.from(REQUISITION_DOCUMENTS_BUCKET).remove([payment.receipt_path])

      // Update requisition_payments row
      const { error: paymentUpdateError } = await admin
        .from("requisition_payments")
        .update({ receipt_path: targetPath })
        .eq("id", payment.id)

      if (paymentUpdateError) {
        log.error("Failed to update payment receipt_path in DB", { paymentId: payment.id, err: paymentUpdateError })
      } else {
        result.archivedReceipts += 1
      }
    } catch (err) {
      log.error("Failed to archive payment receipt to SharePoint", { paymentId: payment.id, err })
      result.errors.push(`Payment receipt: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  result.success = result.errors.length === 0
  return result
}

/**
 * Maintenance sweep: finds paid requisitions that still have unarchived
 * attachments in Supabase Storage and moves them to SharePoint in batches.
 */
export async function sweepPaidRequisitionsForArchive(
  admin: SupabaseClient,
  batchLimit = 15
): Promise<{ totalProcessed: number; results: Record<string, ArchiveResult> }> {
  const { data: paidRequisitions, error } = await admin
    .from("requisitions")
    .select("id, requisition_number, attachments")
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(batchLimit)

  if (error || !paidRequisitions?.length) {
    return { totalProcessed: 0, results: {} }
  }

  const results: Record<string, ArchiveResult> = {}
  let totalProcessed = 0

  for (const req of paidRequisitions) {
    const rawAttachments = (req.attachments || []) as RequisitionAttachment[]
    const needsArchive = rawAttachments.some((a) => !isSharePointArchivePath(a.file_path))

    if (needsArchive) {
      results[req.id] = await archiveRequisitionToSharePoint(admin, req.id)
      totalProcessed += 1
    }
  }

  return { totalProcessed, results }
}
