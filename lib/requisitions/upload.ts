"use client"

import { createClient } from "@/lib/supabase/client"
import type { RequisitionAttachment } from "./types"
import {
  REQUISITION_ATTACHMENT_MAX_COUNT,
  REQUISITION_ATTACHMENT_MAX_FILE_BYTES,
  REQUISITION_ATTACHMENT_MAX_TOTAL_BYTES,
} from "./limits"

const BUCKET = "requisition_documents"
const ALLOWED = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"]

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
    if (!ALLOWED.includes(file.type)) throw new Error(`${file.name}: upload a PDF or an image`)
    if (file.size > REQUISITION_ATTACHMENT_MAX_FILE_BYTES) {
      throw new Error(
        `${file.name} exceeds the ${REQUISITION_ATTACHMENT_MAX_FILE_BYTES / (1024 * 1024)} MB limit for a single file`
      )
    }
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "")
    const path = `${user.id}/${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type })
    if (error) throw new Error(`Upload failed for ${file.name}: ${error.message}`)
    uploaded.push({ file_name: file.name, file_path: path, file_type: file.type, file_size: file.size })
  }
  return uploaded
}
