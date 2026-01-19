import type { Metadata } from "next"
import { AppLayout } from "@/components/app-layout"

export const metadata: Metadata = {
  title: "My Assets | ACOB Lighting Technology Limited",
  description: "View your assigned assets and equipment",
}

export default function AssetsLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
