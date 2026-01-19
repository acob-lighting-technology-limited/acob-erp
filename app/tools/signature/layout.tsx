import type { Metadata } from "next"
import { AppLayout } from "@/components/app-layout"

export const metadata: Metadata = {
  title: "Email Signature Creator | ACOB Lighting Technology Limited",
  description: "Create professional email signatures for ACOB Lighting Technology Limited",
}

export default function SignatureLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
