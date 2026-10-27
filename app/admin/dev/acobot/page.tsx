import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { DevAcobotLogsContent } from "./dev-acobot-logs-content"

import type { Metadata } from "next"

export const metadata: Metadata = { title: "Admin ACOBot Conversations" }

export default async function DevAcobotLogsPage() {
  await requireAdminSectionAccess("dev")
  return <DevAcobotLogsContent />
}
