import type { Metadata } from "next"
import { AppLayout } from "@/components/app-layout"

export const metadata: Metadata = {
  title: "Feedback | ACOB Lighting Technology Limited",
  description: "Submit feedback, concerns, complaints, or suggestions to ACOB Lighting Technology Limited",
}

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
