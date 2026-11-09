import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { AreaOwnersContent } from "./area-owners-content"

import type { Metadata } from "next"

export const metadata: Metadata = { title: "Area owners" }

export default async function DevAreaOwnersPage() {
  await requireAdminSectionAccess("dev")

  return <AreaOwnersContent />
}
