"use client"

import { createClient } from "@/lib/supabase/client"
import type { RequisitionAttachment } from "./types"
import {
  REQUISITION_ATTACHMENT_MAX_COUNT,
  REQUISITION_ATTACHMENT_MAX_FILE_BYTES,
  REQUISITION_ATTACHMENT_MAX_TOTAL_BYTES,
} from "./limits"

const BUCKET = "requisition_documents"
const ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
])

/**
 * Uploads supporting documents into the uploader's own folder of the private
 * bucket (the storage policy allows nothing else). The API only accepts paths
 * in that folder.
 */
export async function uploadRequisitionFiles(
  files: File[],
  folder: "documents" | "receipts",
  existingAttachments: { file_size?: number }[] = []
) {
  if (existingAttachments.length + files.length > REQUISITION_ATTACHMENT_MAX_COUNT) {
    throw new Error(`You can attach at most ${REQUISITION_ATTACHMENT_MAX_COUNT} files`)
  }

  const currentTotalBytes = existingAttachments.reduce((sum, a) => sum + (a.file_size || 0), 0)
  const newTotalBytes = files.reduce((sum, f) => sum + f.size, 0)
  if (currentTotalBytes + newTotalBytes > REQUISITION_ATTACHMENT_MAX_TOTAL_BYTES) {
    throw new Error(`Combined file size exceeds the ${REQUISITION_ATTACHMENT_MAX_TOTAL_BYTES / (1024 * 1024)} MB limit`)
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Sign in again to upload files")

  const uploaded: RequisitionAttachment[] = []
  for (const file of files) {
    if (!ALLOWED.has(file.type)) throw new Error(`${file.name}: upload a PDF, image, Word or Excel file`)
    if (file.size > REQUISITION_ATTACHMENT_MAX_FILE_BYTES) {
      throw new Error(
        `${file.name} exceeds the ${REQUISITION_ATTACHMENT_MAX_FILE_BYTES / (1024 * 1024)} MB limit for a single file`
      )
    }
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "")
    const path = `${user.id}/${folder}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type })
    if (error) throw new Error(`Upload failed for ${file.name}: ${error.message}`)
    uploaded.push({ file_name: file.name, file_path: path, file_type: file.type, file_size: file.size })
  }
  return uploaded
}
