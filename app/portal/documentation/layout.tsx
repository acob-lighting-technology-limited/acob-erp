import type { Metadata } from "next"
import { AppLayout } from "@/components/app-layout"

export const metadata: Metadata = {
  title: "Documentation | ACOB Lighting Technology Limited",
  description: "Create and manage your work documentation",
}

export default function DocumentationLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
