import { config as loadEnv } from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { OneDriveService } from "../lib/onedrive/onedrive"

loadEnv({ path: ".env.local", override: false })
loadEnv()

type MeetingWeekDocumentRow = {
  id: string
  file_path: string
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function normalizeReportPath(filePath: string): string {
  return filePath.replace("/reports/", "/reports/general-meeting/").replace("/all/", "/")
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
    .select("id, file_path")
    .like("file_path", "/reports/%")
    .not("file_path", "like", "/reports/general-meeting/%")

  if (error) throw new Error(`Failed to load report documents: ${error.message}`)

  const rows = (data || []) as MeetingWeekDocumentRow[]
  console.log(`Found ${rows.length} report document(s) to move.`)

  const failures: Array<{ id: string; reason: string }> = []
  let moved = 0

  for (const row of rows) {
    try {
      const targetPath = normalizeReportPath(row.file_path)
      const targetFolderPath = targetPath.slice(0, targetPath.lastIndexOf("/"))
      const targetName = targetPath.slice(targetPath.lastIndexOf("/") + 1)

      await onedrive.createFolder(targetFolderPath)
      await onedrive.moveItem(row.file_path, targetFolderPath, targetName)

      const { error: updateError } = await supabase
        .from("meeting_week_documents")
        .update({ file_path: targetPath })
        .eq("id", row.id)

      if (updateError) throw new Error(`Database update failed: ${updateError.message}`)

      moved += 1
      console.log(`Moved ${row.id}: ${row.file_path} -> ${targetPath}`)
    } catch (moveError) {
      const reason = moveError instanceof Error ? moveError.message : "Unknown migration error"
      failures.push({ id: row.id, reason })
      console.error(`Failed ${row.id}: ${reason}`)
    }
  }

  console.log(JSON.stringify({ totalCandidates: rows.length, moved, failed: failures.length, failures }, null, 2))
  if (failures.length > 0) process.exitCode = 1
}

void main()
