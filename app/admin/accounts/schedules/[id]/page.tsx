import type { Metadata } from "next"
import { ScheduleDetail } from "@/components/requisitions/schedules/schedule-detail"

export const metadata: Metadata = { title: "Payment schedule" }

export default async function PaymentSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ScheduleDetail id={id} />
}
