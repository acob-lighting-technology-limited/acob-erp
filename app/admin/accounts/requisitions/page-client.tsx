"use client"

import { RequisitionsListPage } from "@/components/requisitions/requisitions-list-page"
import { RequisitionSettingsButton } from "./_components/requisition-settings"

export default function AdminRequisitionsPage() {
  return <RequisitionsListPage surface="admin" headerActions={<RequisitionSettingsButton />} />
}
