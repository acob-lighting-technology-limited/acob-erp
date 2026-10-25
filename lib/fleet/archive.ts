import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getOneDriveService } from "@/lib/onedrive"
import { logger } from "@/lib/logger"

const log = logger("fleet-archive")
const FLEET_DOCUMENTS_BUCKET = "fleet_booking_documents"

export interface FleetArchiveResult {
  success: boolean
  archivedAttachments: number
  errors: string[]
}

type FleetAttachmentRecord = {
  id: string
  booking_id: string
  file_name?: string | null
  file_path: string
  mime_type?: string | null
}

function sanitizeSegment(value: string): string {
  return value
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim()
}

export function isSharePointFleetPath(path?: string | null): boolean {
  if (!path) return false
  return path.startsWith("/operations/fleet/") || path.startsWith("https://")
}

/**
 * Moves Fleet vehicle booking documents/inspections from Supabase Storage into
 * permanent SharePoint Operations Fleet archive:
 *
 *   /operations/fleet/{year}/{month}/{booking_id}/{filename}
 *
 * Original files are purged from Supabase Storage once uploaded.
 */
export async function archiveFleetBookingToSharePoint(
  admin: SupabaseClient,
  bookingId: string
): Promise<FleetArchiveResult> {
  const result: FleetArchiveResult = {
    success: false,
    archivedAttachments: 0,
    errors: [],
  }

  const { data: booking, error: bookingError } = await admin
    .from("fleet_bookings")
    .select("id, start_at, created_at, status")
    .eq("id", bookingId)
    .maybeSingle()

  if (bookingError || !booking) {
    result.errors.push(`Booking ${bookingId} not found: ${bookingError?.message || "empty"}`)
    return result
  }

  const onedrive = getOneDriveService()
  if (!onedrive.isEnabled()) {
    log.warn("SharePoint / OneDrive is not configured or enabled; skipping fleet archive", { bookingId })
    result.errors.push("SharePoint integration is disabled")
    return result
  }

  const dateSource = booking.start_at || booking.created_at || new Date().toISOString()
  const d = new Date(dateSource)
  const year = Number.isNaN(d.getTime()) ? new Date().getFullYear().toString() : d.getFullYear().toString()
  const month = Number.isNaN(d.getTime())
    ? String(new Date().getMonth() + 1).padStart(2, "0")
    : String(d.getMonth() + 1).padStart(2, "0")

  const baseFolderPath = `/operations/fleet/${year}/${month}/${booking.id}`

  try {
    await onedrive.createFolder(baseFolderPath).catch(() => {
      // Folder may already exist.
    })
  } catch (err) {
    log.error("Failed to create Fleet destination folder in SharePoint", { path: baseFolderPath, err })
    result.errors.push(`Failed to create SharePoint folder: ${err instanceof Error ? err.message : String(err)}`)
    return result
  }

  const { data: attachments, error: attError } = await admin
    .from("fleet_booking_attachments")
    .select("id, booking_id, file_name, file_path, mime_type")
    .eq("booking_id", bookingId)

  if (attError) {
    result.errors.push(`Failed to load fleet attachments: ${attError.message}`)
    return result
  }

  for (const att of (attachments || []) as FleetAttachmentRecord[]) {
    if (isSharePointFleetPath(att.file_path)) {
      continue
    }

    try {
      const { data: blob, error: dlError } = await admin.storage.from(FLEET_DOCUMENTS_BUCKET).download(att.file_path)

      if (dlError || !blob) {
        throw new Error(`Download from Supabase failed: ${dlError?.message || "empty blob"}`)
      }

      const safeName = sanitizeSegment(att.file_name || "attachment")
      const targetPath = `${baseFolderPath}/${Date.now()}_${safeName}`
      const uploadBuffer = Buffer.from(await blob.arrayBuffer())

      await onedrive.uploadFile(targetPath, uploadBuffer, att.mime_type || undefined)

      // Purge original file from Supabase Storage
      const { error: removeError } = await admin.storage.from(FLEET_DOCUMENTS_BUCKET).remove([att.file_path])

      if (removeError) {
        log.warn("Failed to remove original fleet file from Supabase Storage", {
          path: att.file_path,
          err: removeError,
        })
      }

      // Update row in fleet_booking_attachments
      const { error: updateError } = await admin
        .from("fleet_booking_attachments")
        .update({ file_path: targetPath })
        .eq("id", att.id)

      if (updateError) {
        throw new Error(`DB update failed: ${updateError.message}`)
      }

      result.archivedAttachments += 1
    } catch (err) {
      log.error("Failed to archive fleet attachment to SharePoint", { attId: att.id, err })
      result.errors.push(`Attachment ${att.file_name || att.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  result.success = result.errors.length === 0
  return result
}

/**
 * Maintenance sweep: finds approved or completed fleet bookings that still have
 * attachments in Supabase Storage and moves them to SharePoint in batches.
 */
export async function sweepFleetBookingsForArchive(
  admin: SupabaseClient,
  batchLimit = 25
): Promise<{ totalProcessed: number; results: Record<string, FleetArchiveResult> }> {
  const { data: eligibleBookings, error } = await admin
    .from("fleet_bookings")
    .select("id, status")
    .in("status", ["approved", "completed"])
    .order("created_at", { ascending: false })
    .limit(batchLimit)

  if (error || !eligibleBookings?.length) {
    return { totalProcessed: 0, results: {} }
  }

  const results: Record<string, FleetArchiveResult> = {}
  let totalProcessed = 0

  for (const booking of eligibleBookings) {
    const { data: unarchived } = await admin
      .from("fleet_booking_attachments")
      .select("id, file_path")
      .eq("booking_id", booking.id)

    const needsArchive = (unarchived || []).some((a) => !isSharePointFleetPath(a.file_path))
    if (needsArchive) {
      results[booking.id] = await archiveFleetBookingToSharePoint(admin, booking.id)
      totalProcessed += 1
    }
  }

  return { totalProcessed, results }
}
