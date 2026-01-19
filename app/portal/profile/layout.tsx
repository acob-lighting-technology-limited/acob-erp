import type { Metadata } from "next"
import { AppLayout } from "@/components/app-layout"

export const metadata: Metadata = {
  title: "Profile | ACOB Lighting Technology Limited",
  description: "Manage your profile information and settings at ACOB Lighting Technology Limited",
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
