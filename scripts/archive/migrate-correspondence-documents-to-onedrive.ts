import { config as loadEnv } from "dotenv"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { OneDriveService } from "../lib/onedrive/onedrive"
import {
  buildCorrespondenceDocumentPath,
  isOneDriveCorrespondenceDocumentPath,
} from "../lib/correspondence/document-storage"

loadEnv({ path: ".env.local", override: false })
loadEnv()

type CorrespondenceVersionRow = {
  id: string
  correspondence_id: string
  file_path: string | null
}

type CorrespondenceProofRow = {
  id: string
  proof_of_delivery_path: string | null
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function inferDocumentType(filePath: string): "draft" | "proof" | "supporting" {
  if (filePath.includes("/supporting/")) return "supporting"
  if (filePath.includes("/proof/")) return "proof"
  return "draft"
}

function inferFileName(filePath: string, fallbackId: string) {
  return filePath.split("/").pop() || `${fallbackId}.bin`
}

async function migrateBlob(
  supabase: SupabaseClient,
  onedrive: OneDriveService,
  legacyPath: string,
  targetPath: string
) {
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("correspondence_documents")
    .download(legacyPath)
  if (downloadError || !fileBlob) throw new Error(downloadError?.message || "Failed to download legacy file")

  const folderPath = targetPath.slice(0, targetPath.lastIndexOf("/"))
  await onedrive.createFolder(folderPath)
  await onedrive.uploadFile(targetPath, new Uint8Array(await fileBlob.arrayBuffer()))
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

  const [{ data: versions, error: versionsError }, { data: proofs, error: proofsError }] = await Promise.all([
    supabase.from("correspondence_versions").select("id, correspondence_id, file_path"),
    supabase
      .from("correspondence_records")
      .select("id, proof_of_delivery_path")
      .not("proof_of_delivery_path", "is", null),
  ])

  if (versionsError) throw new Error(`Failed to load correspondence versions: ${versionsError.message}`)
  if (proofsError) throw new Error(`Failed to load correspondence proofs: ${proofsError.message}`)

  const versionRows = ((versions || []) as CorrespondenceVersionRow[]).filter(
    (row) => row.file_path && !isOneDriveCorrespondenceDocumentPath(row.file_path)
  )
  const proofRows = ((proofs || []) as CorrespondenceProofRow[]).filter(
    (row) => row.proof_of_delivery_path && !isOneDriveCorrespondenceDocumentPath(row.proof_of_delivery_path)
  )

  console.log(
    `Found ${versionRows.length} correspondence version(s) and ${proofRows.length} proof document(s) to migrate.`
  )

  const failures: Array<{ id: string; reason: string }> = []
  let migratedVersions = 0
  let migratedProofs = 0

  for (const row of versionRows) {
    try {
      const legacyPath = row.file_path!
      const documentType = inferDocumentType(legacyPath)
      const targetPath = buildCorrespondenceDocumentPath(
        row.correspondence_id,
        documentType,
        inferFileName(legacyPath, row.id)
      )
      await migrateBlob(supabase, onedrive, legacyPath, targetPath)

      const { error: updateError } = await supabase
        .from("correspondence_versions")
        .update({ file_path: targetPath })
        .eq("id", row.id)
      if (updateError) throw new Error(`Database update failed: ${updateError.message}`)

      migratedVersions += 1
      console.log(`Migrated version ${row.id}: ${legacyPath} -> ${targetPath}`)
    } catch (migrationError) {
      const reason = migrationError instanceof Error ? migrationError.message : "Unknown migration error"
      failures.push({ id: row.id, reason })
      console.error(`Failed version ${row.id}: ${reason}`)
    }
  }

  for (const row of proofRows) {
    try {
      const legacyPath = row.proof_of_delivery_path!
      const targetPath = buildCorrespondenceDocumentPath(row.id, "proof", inferFileName(legacyPath, row.id))
      await migrateBlob(supabase, onedrive, legacyPath, targetPath)

      const { error: updateError } = await supabase
        .from("correspondence_records")
        .update({ proof_of_delivery_path: targetPath })
        .eq("id", row.id)
      if (updateError) throw new Error(`Database update failed: ${updateError.message}`)

      migratedProofs += 1
      console.log(`Migrated proof ${row.id}: ${legacyPath} -> ${targetPath}`)
    } catch (migrationError) {
      const reason = migrationError instanceof Error ? migrationError.message : "Unknown migration error"
      failures.push({ id: row.id, reason })
      console.error(`Failed proof ${row.id}: ${reason}`)
    }
  }

  console.log(
    JSON.stringify(
      {
        versionCandidates: versionRows.length,
        proofCandidates: proofRows.length,
        migratedVersions,
        migratedProofs,
        failed: failures.length,
        failures,
      },
      null,
      2
    )
  )
  if (failures.length > 0) process.exitCode = 1
}

void main()
