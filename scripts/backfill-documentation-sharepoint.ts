import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { getOneDriveService } from "@/lib/onedrive"
import {
  buildDocumentationFolderPath,
  buildDocumentationTextBackup,
  buildEmployeeFolderName,
  getFolderNameFromPath,
  getParentFolderPath,
  remapPathPrefix,
  type DocumentationAttachment,
} from "@/lib/documentation/sharepoint"

dotenv.config({ path: ".env.local" })
dotenv.config()

type DocumentationRow = {
  id: string
  user_id: string
  title: string
  content: string
  category: string | null
  tags: string[] | null
  is_draft: boolean
  created_at: string
  updated_at: string
  sharepoint_folder_path: string | null
  sharepoint_text_file_path: string | null
  sharepoint_attachments: DocumentationAttachment[] | null
}

type ProfileRow = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
}

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error("Missing Supabase service role configuration")
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function getEmployeeName(profile?: ProfileRow | null): string {
  const fullName =
    profile?.full_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    "Unknown Employee"

  return buildEmployeeFolderName(fullName)
}

async function main() {
  const supabase = getSupabaseAdminClient()
  const onedrive = getOneDriveService()

  if (!onedrive.isEnabled()) {
    throw new Error("SharePoint integration is not configured")
  }

  const { data: docs, error: docsError } = await supabase
    .from("user_documentation")
    .select("*")
    .order("created_at", { ascending: true })

  if (docsError) {
    throw docsError
  }

  const rows = (docs || []) as DocumentationRow[]
  console.log(`Found ${rows.length} documentation records`)

  const userIds = Array.from(new Set(rows.map((row) => row.user_id)))
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, first_name, last_name")
    .in("id", userIds)

  if (profilesError) {
    throw profilesError
  }

  const profileMap = new Map<string, ProfileRow>()
  for (const profile of (profiles || []) as ProfileRow[]) {
    profileMap.set(profile.id, profile)
  }

  let processed = 0
  for (const row of rows) {
    const employeeName = getEmployeeName(profileMap.get(row.user_id))
    const desiredFolderPath = buildDocumentationFolderPath(employeeName, row.title, row.created_at, row.id)
    const currentFolderPath = row.sharepoint_folder_path
    let folderPath = currentFolderPath || desiredFolderPath

    if (currentFolderPath && currentFolderPath !== desiredFolderPath) {
      await onedrive.createFolder(getParentFolderPath(desiredFolderPath))
      await onedrive.moveItem(currentFolderPath, getParentFolderPath(desiredFolderPath), getFolderNameFromPath(desiredFolderPath))
      folderPath = desiredFolderPath
    }

    await onedrive.createFolder(folderPath)

    const textFilePath =
      remapPathPrefix(row.sharepoint_text_file_path, currentFolderPath, folderPath) || `${folderPath}/documentation.txt`
    const textBackup = buildDocumentationTextBackup({
      title: row.title,
      category: row.category,
      tags: row.tags || [],
      content: row.content,
      isDraft: row.is_draft,
      updatedAt: row.updated_at,
      employeeName,
    })

    await onedrive.uploadFile(textFilePath, new TextEncoder().encode(textBackup), "text/plain; charset=utf-8")

    const remappedAttachments = (row.sharepoint_attachments || []).map((attachment) => ({
      ...attachment,
      file_path: remapPathPrefix(attachment.file_path, currentFolderPath, folderPath) || attachment.file_path,
    }))

    const { error: updateError } = await supabase
      .from("user_documentation")
      .update({
        sharepoint_folder_path: folderPath,
        sharepoint_text_file_path: textFilePath,
        sharepoint_attachments: remappedAttachments,
        updated_at: row.updated_at,
      })
      .eq("id", row.id)

    if (updateError) {
      throw updateError
    }

    processed += 1
    console.log(`[${processed}/${rows.length}] Backfilled ${row.title}`)
  }

  console.log(`Completed backfill for ${processed} documentation records`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
