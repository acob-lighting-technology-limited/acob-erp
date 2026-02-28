import { redirect } from "next/navigation"

export default function LegacyAdminPaymentDepartmentsPage() {
  redirect("/admin/finance/payments")
}
