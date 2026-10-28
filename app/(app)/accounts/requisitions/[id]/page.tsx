import type { Metadata } from "next"
import { RequisitionDetail } from "@/components/requisitions/requisition-detail"

export const metadata: Metadata = { title: "Requisition details" }

export default async function RequisitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RequisitionDetail id={id} backHref="/accounts/requisitions" />
}
