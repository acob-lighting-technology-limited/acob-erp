import type { Metadata } from "next"
import { AppLayout } from "@/components/app-layout"

export const metadata: Metadata = {
  title: "Dashboard | ACOB Lighting Technology Limited",
  description: "Access your workspace and company tools",
}

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
