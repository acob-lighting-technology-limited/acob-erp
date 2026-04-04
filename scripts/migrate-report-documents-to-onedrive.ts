import { config as loadEnv } from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { OneDriveService } from "../lib/onedrive/onedrive"
import { buildReportDocumentPath, isOneDriveReportDocumentPath } from "../lib/reports/document-storage"

loadEnv({ path: ".env.local", override: false })
loadEnv()

type MeetingWeekDocumentRow = {
  id: string
  meeting_week: number
  meeting_year: number
  document_type: "knowledge_sharing_session" | "minutes"
  department: string | null
  file_name: string
  file_path: string
  mime_type: string | null
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

async function main() {
  const supabase = createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )
  const onedrive = new OneDriveService()
  if (!onedrive.isEnabled()) throw new Error("OneDrive/SharePoint integration is not enabled")

  const { data, error } = await supabase
    .from("meeting_week_documents")
    .select("id, meeting_week, meeting_year, document_type, department, file_name, file_path, mime_type")

  if (error) throw new Error(`Failed to load report documents: ${error.message}`)

  const rows = ((data || []) as MeetingWeekDocumentRow[]).filter((row) => !isOneDriveReportDocumentPath(row.file_path))
  console.log(`Found ${rows.length} report document(s) to migrate.`)

  const failures: Array<{ id: string; reason: string }> = []
  let migrated = 0

  for (const row of rows) {
    try {
      const targetPath = buildReportDocumentPath({
        meetingYear: row.meeting_year,
        meetingWeek: row.meeting_week,
        documentType: row.document_type,
        department: row.department,
        fileName: row.file_name,
      })
      const folderPath = targetPath.slice(0, targetPath.lastIndexOf("/"))
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from("meeting_documents")
        .download(row.file_path)
      if (downloadError || !fileBlob) throw new Error(downloadError?.message || "Failed to download legacy file")

      await onedrive.createFolder(folderPath)
      await onedrive.uploadFile(targetPath, new Uint8Array(await fileBlob.arrayBuffer()), row.mime_type || undefined)

      const { error: updateError } = await supabase
        .from("meeting_week_documents")
        .update({ file_path: targetPath })
        .eq("id", row.id)
      if (updateError) throw new Error(`Database update failed: ${updateError.message}`)

      migrated += 1
      console.log(`Migrated ${row.id}: ${row.file_path} -> ${targetPath}`)
    } catch (migrationError) {
      const reason = migrationError instanceof Error ? migrationError.message : "Unknown migration error"
      failures.push({ id: row.id, reason })
      console.error(`Failed ${row.id}: ${reason}`)
    }
  }

  console.log(JSON.stringify({ totalCandidates: rows.length, migrated, failed: failures.length, failures }, null, 2))
  if (failures.length > 0) process.exitCode = 1
}

void main()
