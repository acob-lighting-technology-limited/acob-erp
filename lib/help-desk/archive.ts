import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getOneDriveService } from "@/lib/onedrive"
import { logger } from "@/lib/logger"

const log = logger("help-desk-archive")
const HELP_DESK_BUCKET = "help_desk_documents"

export interface HelpDeskArchiveResult {
  success: boolean
  archivedAttachments: number
  errors: string[]
}

type HelpDeskAttachmentRecord = {
  id: string
  ticket_id: string
  file_name: string
  file_path: string
  mime_type?: string | null
}

function sanitizeSegment(value: string): string {
  return value
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim()
}

export function isSharePointHelpDeskPath(path?: string | null): boolean {
  if (!path) return false
  return path.startsWith("/it/help-desk/") || path.startsWith("https://")
}

/**
 * Moves Help Desk attachments from Supabase Storage into the permanent
 * SharePoint IT archive:
 *
 *   /it/help-desk/{year}/{ticket_number}/{filename}
 *
 * Original files are deleted from Supabase Storage once uploaded to SharePoint.
 */
export async function archiveHelpDeskTicketToSharePoint(
  admin: SupabaseClient,
  ticketId: string
): Promise<HelpDeskArchiveResult> {
  const result: HelpDeskArchiveResult = {
    success: false,
    archivedAttachments: 0,
    errors: [],
  }

  const { data: ticket, error: ticketError } = await admin
    .from("help_desk_tickets")
    .select("id, ticket_number, created_at, status")
    .eq("id", ticketId)
    .maybeSingle()

  if (ticketError || !ticket) {
    result.errors.push(`Ticket ${ticketId} not found: ${ticketError?.message || "empty"}`)
    return result
  }

  const onedrive = getOneDriveService()
  if (!onedrive.isEnabled()) {
    log.warn("SharePoint / OneDrive is not configured or enabled; skipping help desk archive", { ticketId })
    result.errors.push("SharePoint integration is disabled")
    return result
  }

  const createdYear = ticket.created_at
    ? new Date(ticket.created_at).getFullYear().toString()
    : new Date().getFullYear().toString()
  const ticketRef = sanitizeSegment(ticket.ticket_number || ticket.id)
  const baseFolderPath = `/it/help-desk/${createdYear}/${ticketRef}`

  try {
    await onedrive.createFolder(baseFolderPath).catch(() => {
      // Folder may already exist.
    })
  } catch (err) {
    log.error("Failed to create Help Desk destination folder in SharePoint", { path: baseFolderPath, err })
    result.errors.push(`Failed to create SharePoint folder: ${err instanceof Error ? err.message : String(err)}`)
    return result
  }

  const { data: attachments, error: attError } = await admin
    .from("help_desk_attachments")
    .select("id, ticket_id, file_name, file_path, mime_type")
    .eq("ticket_id", ticketId)

  if (attError) {
    result.errors.push(`Failed to load attachments: ${attError.message}`)
    return result
  }

  for (const att of (attachments || []) as HelpDeskAttachmentRecord[]) {
    if (isSharePointHelpDeskPath(att.file_path)) {
      continue
    }

    try {
      const { data: blob, error: dlError } = await admin.storage.from(HELP_DESK_BUCKET).download(att.file_path)

      if (dlError || !blob) {
        throw new Error(`Download from Supabase failed: ${dlError?.message || "empty blob"}`)
      }

      const safeName = sanitizeSegment(att.file_name) || "attachment"
      const targetPath = `${baseFolderPath}/${Date.now()}_${safeName}`
      const uploadBuffer = Buffer.from(await blob.arrayBuffer())

      await onedrive.uploadFile(targetPath, uploadBuffer, att.mime_type || undefined)

      // Remove from Supabase Storage
      const { error: removeError } = await admin.storage.from(HELP_DESK_BUCKET).remove([att.file_path])

      if (removeError) {
        log.warn("Failed to delete original help desk file from Supabase Storage", {
          path: att.file_path,
          err: removeError,
        })
      }

      // Update row in help_desk_attachments
      const { error: updateError } = await admin
        .from("help_desk_attachments")
        .update({ file_path: targetPath })
        .eq("id", att.id)

      if (updateError) {
        throw new Error(`DB update failed: ${updateError.message}`)
      }

      result.archivedAttachments += 1
    } catch (err) {
      log.error("Failed to archive help desk attachment to SharePoint", { attId: att.id, err })
      result.errors.push(`Attachment ${att.file_name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  result.success = result.errors.length === 0
  return result
}

/**
 * Maintenance sweep: finds resolved/closed tickets that still have attachments
 * stored in Supabase and archives them to SharePoint in batches.
 */
export async function sweepResolvedTicketsForArchive(
  admin: SupabaseClient,
  batchLimit = 25
): Promise<{ totalProcessed: number; results: Record<string, HelpDeskArchiveResult> }> {
  const { data: resolvedTickets, error } = await admin
    .from("help_desk_tickets")
    .select("id, status")
    .in("status", ["resolved", "closed"])
    .order("created_at", { ascending: false })
    .limit(batchLimit)

  if (error || !resolvedTickets?.length) {
    return { totalProcessed: 0, results: {} }
  }

  const results: Record<string, HelpDeskArchiveResult> = {}
  let totalProcessed = 0

  for (const ticket of resolvedTickets) {
    const { data: unarchived } = await admin
      .from("help_desk_attachments")
      .select("id, file_path")
      .eq("ticket_id", ticket.id)

    const needsArchive = (unarchived || []).some((a) => !isSharePointHelpDeskPath(a.file_path))
    if (needsArchive) {
      results[ticket.id] = await archiveHelpDeskTicketToSharePoint(admin, ticket.id)
      totalProcessed += 1
    }
  }

  return { totalProcessed, results }
}
