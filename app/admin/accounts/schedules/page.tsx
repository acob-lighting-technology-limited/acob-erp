import type { Metadata } from "next"
import { SchedulesListPage } from "@/components/requisitions/schedules/schedules-list-page"

export const metadata: Metadata = { title: "Payment schedules" }

export default function PaymentSchedulesPage() {
  return <SchedulesListPage />
}
