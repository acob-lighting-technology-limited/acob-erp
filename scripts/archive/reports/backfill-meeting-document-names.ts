import { config as loadEnv } from "dotenv"
import { createClient } from "@supabase/supabase-js"
import {
  buildMeetingDocumentFileName,
  resolveEffectiveMeetingDateIso,
  sanitizeStoragePathSegment,
} from "@/lib/reports/meeting-date"

loadEnv({ path: ".env.local" })
loadEnv()

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = "meeting_documents"

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

type MeetingWeekDocumentRow = {
  id: string
  meeting_week: number
  meeting_year: number
  document_type: "knowledge_sharing_session" | "minutes" | "action_points"
  department: string | null
  presenter_id: string | null
  file_name: string
  file_path: string
  mime_type: string | null
}

function getFileExtension(fileName: string, mimeType?: string | null): string {
  const lower = String(fileName || "").toLowerCase()
  if (lower.endsWith(".pdf")) return "pdf"
  if (lower.endsWith(".docx")) return "docx"
  if (lower.endsWith(".pptx")) return "pptx"
  if (mimeType === "application/pdf") return "pdf"
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx"
  if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "pptx"
  return "pdf"
}

function sanitizeName(name: string): string {
  return String(name || "file").replace(/[^a-zA-Z0-9._-]/g, "_")
}

function buildRenamedFilePath(currentFilePath: string, nextFileName: string): string {
  const lastSlash = currentFilePath.lastIndexOf("/")
  const dir = lastSlash >= 0 ? currentFilePath.slice(0, lastSlash + 1) : ""
  const currentLeaf = lastSlash >= 0 ? currentFilePath.slice(lastSlash + 1) : currentFilePath
  const existingPrefix = currentLeaf.match(/^(\d+-)/)?.[1] || `${Date.now()}-`
  return `${dir}${existingPrefix}${sanitizeName(sanitizeStoragePathSegment(nextFileName))}`
}

async function main() {
  const { data: documents, error } = await supabase
    .from("meeting_week_documents")
    .select("id, meeting_week, meeting_year, document_type, department, presenter_id, file_name, file_path, mime_type")
    .order("meeting_year", { ascending: true })
    .order("meeting_week", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (documents || []) as MeetingWeekDocumentRow[]
  const presenterIds = Array.from(new Set(rows.map((row) => row.presenter_id).filter(Boolean))) as string[]

  const presenterNameById = new Map<string, string>()
  if (presenterIds.length > 0) {
    const { data: presenters, error: presenterError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", presenterIds)

    if (presenterError) {
      throw new Error(presenterError.message)
    }

    for (const presenter of presenters || []) {
      if (presenter?.id && presenter?.full_name) {
        presenterNameById.set(String(presenter.id), String(presenter.full_name))
      }
    }
  }

  let renamedCount = 0
  let skippedCount = 0

  for (const row of rows) {
    const meetingDate = await resolveEffectiveMeetingDateIso(supabase as any, row.meeting_week, row.meeting_year)
    const presenterName = row.presenter_id ? presenterNameById.get(row.presenter_id) || null : null
    const nextFileName = buildMeetingDocumentFileName({
      documentType: row.document_type,
      meetingDate,
      meetingWeek: row.meeting_week,
      extension: getFileExtension(row.file_name, row.mime_type),
      department: row.department,
      presenterName,
    })
    const nextFilePath = buildRenamedFilePath(row.file_path, nextFileName)

    if (row.file_name === nextFileName && row.file_path === nextFilePath) {
      skippedCount += 1
      continue
    }

    if (row.file_path !== nextFilePath) {
      const { error: moveError } = await supabase.storage.from(BUCKET).move(row.file_path, nextFilePath)
      if (moveError) {
        throw new Error(`Failed to move ${row.file_path}: ${moveError.message}`)
      }
    }

    const { error: updateError } = await supabase
      .from("meeting_week_documents")
      .update({
        file_name: nextFileName,
        file_path: nextFilePath,
      })
      .eq("id", row.id)

    if (updateError) {
      throw new Error(`Failed to update ${row.id}: ${updateError.message}`)
    }

    renamedCount += 1
    console.log(`Renamed ${row.id}: ${nextFileName}`)
  }

  console.log(`Meeting document rename complete. Renamed: ${renamedCount}. Skipped: ${skippedCount}.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
