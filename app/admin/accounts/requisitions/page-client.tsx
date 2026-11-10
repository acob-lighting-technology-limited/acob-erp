"use client"

import { RequisitionsListPage } from "@/components/requisitions/requisitions-list-page"
import { usePaymentProcessorsTab } from "./_components/payment-processors-tab"

export default function AdminRequisitionsPage() {
  const processors = usePaymentProcessorsTab()
  return <RequisitionsListPage surface="admin" extraTabs={[processors]} />
}
