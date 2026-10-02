import { config as loadEnv } from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { OneDriveService } from "../lib/onedrive/onedrive"
import {
  buildPaymentDocumentFolderPathByType,
  buildPaymentDocumentPath,
  isOneDrivePaymentDocumentPath,
} from "../lib/payments/document-storage"

loadEnv({ path: ".env.local", override: false })
loadEnv()

type PaymentDocumentRow = {
  id: string
  payment_id: string
  file_name: string | null
  file_path: string | null
  mime_type: string | null
  department_payments:
    | {
        id: string
        title: string | null
        payment_type: "one-time" | "recurring" | null
        department: { name: string | null } | { name: string | null }[] | null
      }[]
    | {
        id: string
        title: string | null
        payment_type: "one-time" | "recurring" | null
        department: { name: string | null } | { name: string | null }[] | null
      }
    | null
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function getDepartmentName(row: PaymentDocumentRow): string | null {
  const paymentRelation = Array.isArray(row.department_payments) ? row.department_payments[0] : row.department_payments
  const relation = paymentRelation?.department
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0]?.name ?? null
  return relation.name ?? null
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
  if (!onedrive.isEnabled()) {
    throw new Error("OneDrive/SharePoint integration is not enabled")
  }

  const { data: documents, error } = await supabase
    .from("payment_documents")
    .select(
      "id, payment_id, file_name, file_path, mime_type, department_payments!inner(id, title, payment_type, department:departments(name))"
    )

  if (error) {
    throw new Error(`Failed to load payment documents: ${error.message}`)
  }

  const rows = ((documents || []) as unknown as PaymentDocumentRow[]).filter(
    (row) => row.file_path && !isOneDrivePaymentDocumentPath(row.file_path)
  )

  console.log(`Found ${rows.length} payment document(s) to migrate.`)

  let migrated = 0
  let skipped = 0
  const failures: Array<{ id: string; reason: string }> = []

  for (const row of rows) {
    try {
      const departmentName = getDepartmentName(row)
      const paymentRelation = Array.isArray(row.department_payments)
        ? row.department_payments[0]
        : row.department_payments
      const paymentTitle = paymentRelation?.title || undefined
      const paymentType = paymentRelation?.payment_type === "one-time" ? "one-time" : "recurring"
      if (!departmentName) {
        skipped += 1
        failures.push({ id: row.id, reason: "Missing department relation" })
        continue
      }

      const legacyPath = row.file_path
      if (!legacyPath) {
        skipped += 1
        failures.push({ id: row.id, reason: "Missing legacy file_path" })
        continue
      }

      const fileName = row.file_name || legacyPath.split("/").pop() || `${row.id}.bin`
      const folderPath = buildPaymentDocumentFolderPathByType(departmentName, paymentType, row.payment_id, paymentTitle)
      const targetPath = buildPaymentDocumentPath(
        departmentName,
        paymentType,
        row.payment_id,
        `${row.id}-${fileName}`,
        paymentTitle
      )

      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from("payment_documents")
        .download(legacyPath)
      if (downloadError || !fileBlob) {
        throw new Error(downloadError?.message || "Failed to download legacy file")
      }

      await onedrive.createFolder(folderPath)
      const content = new Uint8Array(await fileBlob.arrayBuffer())
      await onedrive.uploadFile(targetPath, content, row.mime_type || undefined)

      const { error: updateError } = await supabase
        .from("payment_documents")
        .update({ file_path: targetPath })
        .eq("id", row.id)
      if (updateError) {
        throw new Error(`SharePoint upload succeeded but database update failed: ${updateError.message}`)
      }

      migrated += 1
      console.log(`Migrated ${row.id}: ${legacyPath} -> ${targetPath}`)
    } catch (migrationError) {
      const reason = migrationError instanceof Error ? migrationError.message : "Unknown migration error"
      failures.push({ id: row.id, reason })
      console.error(`Failed ${row.id}: ${reason}`)
    }
  }

  console.log(
    JSON.stringify(
      {
        totalCandidates: rows.length,
        migrated,
        skipped,
        failed: failures.length,
        failures,
      },
      null,
      2
    )
  )

  if (failures.length > 0) {
    process.exitCode = 1
  }
}

void main()
