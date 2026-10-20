import { config as loadEnv } from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { OneDriveService } from "../lib/onedrive/onedrive"
import { buildPaymentDocumentFolderPathByType, isOneDrivePaymentDocumentPath } from "../lib/payments/document-storage"

loadEnv({ path: ".env.local", override: false })
loadEnv()

type PaymentDocumentRow = {
  id: string
  file_path: string | null
  payment_id: string
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
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function getPaymentRelation(row: PaymentDocumentRow) {
  return Array.isArray(row.department_payments) ? row.department_payments[0] : row.department_payments
}

function getDepartmentName(row: PaymentDocumentRow): string | null {
  const relation = getPaymentRelation(row)?.department
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0]?.name ?? null
  return relation.name ?? null
}

function extractFolderPath(filePath: string): string | null {
  const lastSlash = filePath.lastIndexOf("/")
  return lastSlash > 0 ? filePath.slice(0, lastSlash) : null
}

function extractFolderName(folderPath: string): string {
  return folderPath.split("/").filter(Boolean).pop() || ""
}

function extractParentFolderPath(folderPath: string): string {
  const parts = folderPath.split("/").filter(Boolean)
  if (parts.length <= 1) return "/"
  return `/${parts.slice(0, -1).join("/")}`
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

  const { data, error } = await supabase
    .from("payment_documents")
    .select(
      "id, payment_id, file_path, department_payments!inner(id, title, payment_type, department:departments(name))"
    )

  if (error) {
    throw new Error(`Failed to load payment documents: ${error.message}`)
  }

  const rows = ((data || []) as unknown as PaymentDocumentRow[]).filter(
    (row) => row.file_path && isOneDrivePaymentDocumentPath(row.file_path)
  )

  const grouped = new Map<string, PaymentDocumentRow[]>()
  for (const row of rows) {
    const folderPath = extractFolderPath(row.file_path!)
    if (!folderPath) continue
    const currentRows = grouped.get(folderPath) || []
    currentRows.push(row)
    grouped.set(folderPath, currentRows)
  }

  let renamed = 0
  let skipped = 0
  const failures: Array<{ folderPath: string; reason: string }> = []

  for (const [folderPath, folderRows] of Array.from(grouped.entries())) {
    try {
      const firstRow = folderRows[0]
      const paymentRelation = getPaymentRelation(firstRow)
      const departmentName = getDepartmentName(firstRow)
      const paymentTitle = paymentRelation?.title || undefined
      const paymentType = paymentRelation?.payment_type === "one-time" ? "one-time" : "recurring"
      if (!departmentName) {
        skipped += 1
        failures.push({ folderPath, reason: "Missing department" })
        continue
      }

      const desiredFolderPath = buildPaymentDocumentFolderPathByType(
        departmentName,
        paymentType,
        firstRow.payment_id,
        paymentTitle
      )
      if (folderPath === desiredFolderPath) {
        skipped += 1
        continue
      }

      const desiredFolderName = extractFolderName(desiredFolderPath)
      const desiredParentFolderPath = extractParentFolderPath(desiredFolderPath)
      await onedrive.createFolder(desiredParentFolderPath)
      await onedrive.moveItem(folderPath, desiredParentFolderPath, desiredFolderName)

      for (const row of folderRows) {
        const currentPath = row.file_path!
        const updatedPath = `${desiredFolderPath}${currentPath.slice(folderPath.length)}`
        const { error: updateError } = await supabase
          .from("payment_documents")
          .update({ file_path: updatedPath })
          .eq("id", row.id)
        if (updateError) {
          throw new Error(`Database update failed for ${row.id}: ${updateError.message}`)
        }
      }

      renamed += 1
      console.log(`Renamed folder ${folderPath} -> ${desiredFolderPath}`)
    } catch (renameError) {
      const reason = renameError instanceof Error ? renameError.message : "Unknown rename error"
      failures.push({ folderPath, reason })
      console.error(`Failed folder ${folderPath}: ${reason}`)
    }
  }

  console.log(
    JSON.stringify(
      {
        candidateFolders: grouped.size,
        renamed,
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
