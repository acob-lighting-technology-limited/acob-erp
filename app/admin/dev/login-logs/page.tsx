import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { DevLoginLogsContent } from "./dev-login-logs-content"

import type { Metadata } from "next"

export const metadata: Metadata = { title: "Admin Developer Login Logs" }

export default async function DevLoginLogsPage() {
  await requireAdminSectionAccess("dev")

  return <DevLoginLogsContent />
}
