import type { Metadata } from "next"
import { RequisitionDetail } from "@/components/requisitions/requisition-detail"

export const metadata: Metadata = { title: "Admin Requisition details" }

export default async function AdminRequisitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RequisitionDetail id={id} backHref="/admin/accounts/requisitions" />
}
