import { AppLayout } from "@/components/app-layout"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Payments | ACOB Lighting Technology Limited",
  description: "Manage department payments",
}

export default function PaymentsLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
