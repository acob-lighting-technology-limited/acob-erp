import { config as loadEnv } from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { OneDriveService } from "../lib/onedrive/onedrive"
import { departmentToLibraryKey } from "../lib/onedrive/access"

loadEnv({ path: ".env.local", override: false })
loadEnv()

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

  if (!onedrive.isEnabled()) {
    throw new Error("OneDrive/SharePoint integration is not enabled")
  }

  const { data: departments, error } = await supabase
    .from("department_payments")
    .select("department:departments(name)")
    .not("department_id", "is", null)

  if (error) {
    throw new Error(`Failed to load payment departments: ${error.message}`)
  }

  const departmentNames = Array.from(
    new Set(
      (departments || [])
        .map((row) => {
          const relation = row.department as { name?: string | null } | { name?: string | null }[] | null
          return Array.isArray(relation) ? relation[0]?.name || null : relation?.name || null
        })
        .filter((value): value is string => Boolean(value))
    )
  )

  for (const departmentName of departmentNames) {
    const departmentKey = departmentToLibraryKey(departmentName)
    await onedrive.createFolder(`/finance-payments/${departmentKey}/one-time`)
    await onedrive.createFolder(`/finance-payments/${departmentKey}/recurring`)
    console.log(`Ensured payment type folders for ${departmentName}`)
  }
}

void main()
