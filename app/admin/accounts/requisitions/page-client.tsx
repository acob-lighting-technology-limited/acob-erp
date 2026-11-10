"use client"

import { RequisitionsListPage } from "@/components/requisitions/requisitions-list-page"
import { useRequisitionSettingsTab } from "./_components/requisition-settings-tab"

export default function AdminRequisitionsPage() {
  const settings = useRequisitionSettingsTab()
  return <RequisitionsListPage surface="admin" extraTabs={[settings]} />
}
