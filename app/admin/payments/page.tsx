import { redirect } from "next/navigation"

export default function LegacyAdminPaymentsPage() {
  redirect("/admin/finance/payments")
}
