import { RequisitionsListPage } from "@/components/requisitions/requisitions-list-page"

import type { Metadata } from "next"

export const metadata: Metadata = { title: "Requisitions" }

export default function RequisitionsPage() {
  return <RequisitionsListPage surface="staff" />
}
