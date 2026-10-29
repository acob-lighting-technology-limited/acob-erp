"use client"

import { RequisitionsListPage } from "@/components/requisitions/requisitions-list-page"
import { useFundingCategoriesTab } from "./_components/funding-categories-tab"
import { usePaymentProcessorsTab } from "./_components/payment-processors-tab"

export default function AdminRequisitionsPage() {
  const funding = useFundingCategoriesTab()
  const processors = usePaymentProcessorsTab()
  return <RequisitionsListPage surface="admin" extraTabs={[funding, processors]} />
}
