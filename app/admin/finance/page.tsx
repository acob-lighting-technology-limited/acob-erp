import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { FinanceDashboardContent } from "./finance-dashboard-content"

export default async function FinanceDashboard() {
  await requireAdminSectionAccess("finance")

  return <FinanceDashboardContent />
}
