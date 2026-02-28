import { redirect } from "next/navigation"

export default function LegacyAdminPaymentDetailPage({ params }: { params: { id: string } }) {
  redirect(`/admin/finance/payments/${params.id}`)
}
